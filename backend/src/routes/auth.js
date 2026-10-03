import { Router, urlencoded } from 'express';
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
 * /api/auth/config:
 *   get:
 *     summary: إعدادات المصادقة العامة (معرّف Google إن كان مفعّلاً)
 *     tags: [auth]
 *     responses:
 *       200:
 *         description: الإعدادات العامة
 */
router.get(
  '/config',
  asyncHandler(async (req, res) => {
    const clientId = config.googleClientId || null;
    const allowed = config.googleAllowedOrigins || [];
    const origin = String(req.headers.origin || '').replace(/\/$/, '');
    const originAllowed = allowed.length === 0 || allowed.includes(origin);
    res.json({
      // نطاق غير مصرّح به في Google ⇒ لا نعرض زرًا معطّلًا
      googleClientId: clientId && originAllowed ? clientId : null,
      googleOriginBlocked: Boolean(clientId && !originAllowed)
    });
  })
);
function readCookie(req, name) {
  const header = req.headers?.cookie || '';
  const found = header.split(';').map((p) => p.trim()).find((p) => p.startsWith(`${name}=`));
  return found ? decodeURIComponent(found.slice(name.length + 1)) : null;
}

// تحقّق من رمز Google ثم إيجاد/إنشاء المستخدم (مشترك بين وضعي popup وredirect)
async function resolveGoogleUser(idToken) {
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
  return user;
}

function ensureActiveRole(user) {
  if (['STUDENT', 'TEACHER'].includes(user.role) && user.accountStatus !== 'ACTIVE') {
    throw new ApiError(403, accountStatusMessage(user.accountStatus));
  }
}

router.post(
  '/google', // تسجيل الدخول/التسجيل بحساب Google (idToken موثّق عبر google-auth-library)
  asyncHandler(async (req, res) => {
    if (!config.googleClientId) {
      throw new ApiError(501, 'تسجيل الدخول عبر Google غير مفعّل بعد');
    }
    const { idToken } = req.body || {};
    if (!idToken || typeof idToken !== 'string') {
      throw new ApiError(400, AR.INVALID_CREDENTIALS);
    }

    const user = await resolveGoogleUser(idToken);
    ensureActiveRole(user);

    const pair = await issuePair(user);
    res.json({
      ...pair,
      user: await withMustChange(toPublicUser(user))
    });
  })
);

// وضع redirect (GIS ux_mode:'redirect') : Google تنقل المتصفح كاملاً ثم
// POST (formulaire) الرمز إلى هنا. نتحقق من g_csrf_token (cookie مقابل body
// حسب توثيق Google) ثم نعيد التوجيه للواجهة مع الرموز في الـ fragment
// (لا تصل للخوادم ولا تُسجَّل).
router.post(
  '/google-redirect',
  urlencoded({ extended: false }),
  asyncHandler(async (req, res) => {
    const base = config.nodeEnv === 'production' ? '' : config.appUrl;
    const fail = (code) => res.redirect(302, `${base}/login#google=error&code=${code}`);
    if (!config.googleClientId) return fail('disabled');
    const { credential, g_csrf_token: bodyToken } = req.body || {};
    const cookieToken = readCookie(req, 'g_csrf_token');
    if (!credential || !bodyToken || !cookieToken || bodyToken !== cookieToken) {
      return fail('csrf');
    }
    try {
      const user = await resolveGoogleUser(credential);
      ensureActiveRole(user);
      const pair = await issuePair(user);
      const params = new URLSearchParams({
        google: '1', token: pair.token, refresh: pair.refreshToken || ''
      });
      return res.redirect(302, `${base}/login#${params.toString()}`);
    } catch {
      return fail('invalid');
    }
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
