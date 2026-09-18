import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import { OAuth2Client } from 'google-auth-library';
import prisma from '../db.js';
import { config } from '../config.js';
import {
  signToken,
  authMiddleware,
  accountStatusMessage,
  issueRefreshToken,
  rotateRefreshToken,
  revokeRefreshToken,
  revokeAllUserTokens,
  purgeExpiredRefreshTokens
} from '../auth.js';
import { validateBody } from '../middleware/validate.js';
import { registerSchema, loginSchema, refreshSchema, changePasswordSchema } from '../validators/auth.js';
import { ApiError, asyncHandler } from '../middleware/errorHandler.js';
import { AR } from '../middleware/messages.js';

const router = Router();

function toPublicUser(user) {
  return {
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    phone: user.phone,
    role: user.role,
    accountStatus: user.accountStatus
  };
}

// حساب التلميذ أُنشئ بكلمة سر مؤقتة (موافقة المدير) ولم يغيّرها بعد ⇒ يُوجَّه
// لتغييرها عند أول دخول. لا عمود إضافي — الحالة مشتقة من وجود tempPassword.
async function withMustChange(publicUser) {
  let mustChangePassword = false;
  if (publicUser.role === 'STUDENT') {
    const linked = await prisma.student.count({ where: { accountUserId: publicUser.id, tempPassword: { not: null } } });
    mustChangePassword = linked > 0;
  }
  return { ...publicUser, mustChangePassword };
}

async function issuePair(user) {
  const token = signToken(user);
  const refreshToken = await issueRefreshToken(user.id);
  await purgeExpiredRefreshTokens();
  return { token, refreshToken };
}

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     summary: تسجيل مستخدم جديد
 *     tags: [auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [firstName, lastName, email, password]
 *             properties:
 *               firstName: { type: string, description: الاسم }
 *               lastName: { type: string, description: اللقب }
 *               email: { type: string, format: email }
 *               phone: { type: string }
 *               password: { type: string, minLength: 6 }
 *     responses:
 *       201:
 *         description: تم إنشاء الحساب
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 token: { type: string }
 *                 user: { type: object }
 *       400:
 *         description: فشل التحقق من البيانات
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       409:
 *         description: البريد مسجل مسبقا
 */
router.post(
  '/register',
  validateBody(registerSchema),
  asyncHandler(async (req, res) => {
    const { firstName, lastName, email, phone, password, schoolId } = req.body;
    const emailNorm = email.toLowerCase();

    const existing = await prisma.user.findUnique({ where: { email: emailNorm } });
    if (existing) throw new ApiError(409, AR.EMAIL_TAKEN);

    // تحديد المدرسة: يحدّدها الولي من القائمة؛ وإن وُجدت مدرسة نشطة واحدة فقط، تُسنَد تلقائياً.
    let resolvedSchoolId = schoolId != null ? Number(schoolId) : null;
    if (resolvedSchoolId != null) {
      const school = await prisma.school.findFirst({ where: { id: resolvedSchoolId, status: 'ACTIVE' } });
      if (!school) throw new ApiError(400, 'المدرسة المختارة غير متوفّرة');
    } else {
      const active = await prisma.school.findMany({ where: { status: 'ACTIVE' }, select: { id: true }, take: 2 });
      if (active.length === 1) resolvedSchoolId = active[0].id;
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        firstName,
        lastName,
        email: emailNorm,
        phone: phone || null,
        passwordHash,
        schoolId: resolvedSchoolId
      }
    });

    const pair = await issuePair(user);
    res.status(201).json({
      ...pair,
      user: toPublicUser(user)
    });
  })
);

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: تسجيل الدخول
 *     tags: [auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email: { type: string, format: email }
 *               password: { type: string }
 *     responses:
 *       200:
 *         description: نجاح الدخول
 *       401:
 *         description: بيانات الدخول غير صحيحة
 */
router.post(
  '/login',
  validateBody(loginSchema),
  asyncHandler(async (req, res) => {
    const { email, password } = req.body;
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() }
    });
    if (!user) throw new ApiError(401, AR.INVALID_CREDENTIALS);

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) throw new ApiError(401, AR.INVALID_CREDENTIALS);

    if (['STUDENT', 'TEACHER'].includes(user.role) && user.accountStatus !== 'ACTIVE') {
      return res.status(403).json({ error: accountStatusMessage(user.accountStatus), status: user.accountStatus });
    }

    const pair = await issuePair(user);
    res.json({
      ...pair,
      user: await withMustChange(toPublicUser(user))
    });
  })
);

/**
 * @swagger
 * /api/auth/google:
 *   post:
 *     summary: تسجيل الدخول/التسجيل بحساب Google (OAuth 2.0)
 *     tags: [auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [idToken]
 *             properties:
 *               idToken: { type: string, description: 'Google ID token (GIS)' }
 *     responses:
 *       200:
 *         description: نجاح الدخول (حساب موجود يُربط، وجديد يُنشأ بدور ولي)
 *       400:
 *         description: رمز Google غير صالح
 *       501:
 *         description: تسجيل Google غير مفعّل (GOOGLE_CLIENT_ID غائب)
 */
router.post(
  '/google',
  asyncHandler(async (req, res) => {
    if (!config.googleClientId) {
      throw new ApiError(501, 'تسجيل الدخول عبر Google غير مفعّل بعد');
    }
    const { idToken } = req.body || {};
    if (!idToken || typeof idToken !== 'string') {
      throw new ApiError(400, AR.INVALID_CREDENTIALS);
    }

    let payload;
    try {
      const client = new OAuth2Client(config.googleClientId);
      const ticket = await client.verifyIdToken({ idToken, audience: config.googleClientId });
      payload = ticket.getPayload();
    } catch {
      throw new ApiError(401, AR.INVALID_CREDENTIALS);
    }
    if (!payload?.sub || !payload?.email || payload.email_verified === false) {
      throw new ApiError(401, AR.INVALID_CREDENTIALS);
    }

    const emailNorm = String(payload.email).toLowerCase();
    let user = await prisma.user.findFirst({
      where: { OR: [{ googleId: payload.sub }, { email: emailNorm }] }
    });

    if (user) {
      // ربط الحساب الموجود بـ Google عند أول دخول بها (مالك البريد موثّق من Google)
      if (!user.googleId) {
        user = await prisma.user.update({
          where: { id: user.id },
          data: { googleId: payload.sub }
        });
      }
    } else {
      // حساب جديد بدور ولي (نفس دور التسجيل الكلاسيكي) + كلمة سر عشوائية غير مستعملة
      const passwordHash = await bcrypt.hash(randomBytes(32).toString('hex'), 10);
      user = await prisma.user.create({
        data: {
          firstName: String(payload.given_name || 'مستخدم').slice(0, 60),
          lastName: String(payload.family_name || 'Google').slice(0, 60),
          email: emailNorm,
          passwordHash,
          googleId: payload.sub
        }
      });
    }

    if (['STUDENT', 'TEACHER'].includes(user.role) && user.accountStatus !== 'ACTIVE') {
      return res.status(403).json({ error: accountStatusMessage(user.accountStatus), status: user.accountStatus });
    }

    const pair = await issuePair(user);
    res.json({
      ...pair,
      user: await withMustChange(toPublicUser(user))
    });
  })
);

/**
 * @swagger
 * /api/auth/change-password:
 *   put:
 *     summary: تغيير كلمة السر ذاتياً (يبطل كل الجلسات عدا الحالية)
 *     tags: [auth]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [currentPassword, newPassword]
 *             properties:
 *               currentPassword: { type: string }
 *               newPassword: { type: string }
 *     responses:
 *       200: { description: تم التغيير مع زوج رموز جديد للجلسة الحالية }
 *       401: { description: كلمة السر الحالية غير صحيحة }
 */
router.put(
  '/change-password',
  authMiddleware,
  validateBody(changePasswordSchema),
  asyncHandler(async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user) throw new ApiError(401, AR.SESSION_EXPIRED);
    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) throw new ApiError(401, 'كلمة السر الحالية غير صحيحة');
    if (currentPassword === newPassword) throw new ApiError(400, 'كلمة السر الجديدة يجب أن تختلف عن الحالية');

    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: await bcrypt.hash(newPassword, 10) }
    });
    // مسح الكلمة المؤقتة المرتبطة (إن وُجدت لحساب تلميذ) ⇒ ينتهي إلزام التغيير
    await prisma.student.updateMany({ where: { accountUserId: user.id }, data: { tempPassword: null } });

    // إبطال كل الجلسات ثم إصدار زوج جديد للجلسة الحالية فقط
    await revokeAllUserTokens(user.id);
    const pair = await issuePair(user);
    res.json({ ...pair, user: toPublicUser(user) });
  })
);

/**
 * @swagger
 * /api/auth/refresh:
 *   post:
 *     summary: تجديد الجلسة برمز التجديد (تدوير آمن)
 *     tags: [auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [refreshToken]
 *             properties:
 *               refreshToken: { type: string }
 *     responses:
 *       200:
 *         description: زوج رموز جديد
 *       401:
 *         description: رمز تجديد منتهٍ/مُبطَل/غير صالح
 */
router.post(
  '/refresh',
  validateBody(refreshSchema),
  asyncHandler(async (req, res) => {
    const { refreshToken } = req.body;
    const user = await prisma.user.findFirst({
      where: {
        refreshTokens: {
          some: {
            tokenHash: (await import('../auth.js')).hashRefreshToken(refreshToken),
            revokedAt: null,
            expiresAt: { gt: new Date() }
          }
        }
      }
    });
    if (!user) throw new ApiError(401, AR.SESSION_EXPIRED);

    const nextRefreshToken = await rotateRefreshToken(user.id, refreshToken);
    if (!nextRefreshToken) throw new ApiError(401, AR.SESSION_EXPIRED);

    if (['STUDENT', 'TEACHER'].includes(user.role) && user.accountStatus !== 'ACTIVE') {
      return res.status(403).json({ error: accountStatusMessage(user.accountStatus), status: user.accountStatus });
    }

    res.json({ token: signToken(user), refreshToken: nextRefreshToken });
  })
);

/**
 * @swagger
 * /api/auth/logout:
 *   post:
 *     summary: إنهاء الجلسة وإبطال رمز التجديد
 *     tags: [auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               refreshToken: { type: string }
 *     responses:
 *       200:
 *         description: تم إنهاء الجلسة
 */
router.post(
  '/logout',
  asyncHandler(async (req, res) => {
    await revokeRefreshToken(req.body?.refreshToken || null);
    res.json({ ok: true });
  })
);

/**
 * @swagger
 * /api/auth/me:
 *   get:
 *     summary: بيانات المستخدم الحالي
 *     tags: [auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: بيانات المستخدم
 *       401:
 *         description: غير مصرح به
 */
router.get(
  '/me',
  authMiddleware,
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user) throw new ApiError(404, AR.USER_NOT_FOUND);
    res.json(await withMustChange(toPublicUser(user)));
  })
);

export default router;
