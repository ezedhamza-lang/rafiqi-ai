import { Router } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import prisma from '../db.js';
import { logger } from '../utils/logger.js';
import {
  signToken,
  authMiddleware,
  accountStatusMessage,
  issueRefreshToken,
  rotateRefreshToken,
  revokeRefreshToken,
  purgeExpiredRefreshTokens
} from '../auth.js';
import { validateBody } from '../middleware/validate.js';
import { registerSchema, loginSchema, refreshSchema, forgotPasswordSchema, resetPasswordSchema } from '../validators/auth.js';import { ApiError, asyncHandler } from '../middleware/errorHandler.js';
import { AR } from '../middleware/messages.js';
import { sendPasswordResetEmail, sendVerificationEmail } from '../services/mailService.js';
import { config } from '../config.js';

const router = Router();

// ===== أدوات رموز البريد (استعادة/تأكيد) — تُخزَّن مجزَّأة sha256 =====
const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');
async function issueEmailToken(model, userId, ttlMs) {
  const raw = crypto.randomBytes(32).toString('hex');
  await model.create({
    data: { userId, tokenHash: sha256(raw), expiresAt: new Date(Date.now() + ttlMs) }
  });
  return raw;
}
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
    const { firstName, lastName, email, phone, password, role } = req.body;
    const emailNorm = email.toLowerCase();

    const existing = await prisma.user.findUnique({ where: { email: emailNorm } });
    if (existing) throw new ApiError(409, AR.EMAIL_TAKEN);

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        firstName,
        lastName,
        email: emailNorm,
        phone: phone || null,
        passwordHash,
        role: role || 'PARENT'
      }
    });

    const pair = await issuePair(user);
    res.status(201).json({
      ...pair,
      user: toPublicUser(user)
    });

    // تأكيد البريد (خارج مسار الاستجابة حتى لا يُعطّل التسجيل إن تعذّر الإرسال)
    try {
      const raw = await issueEmailToken(prisma.emailVerificationToken, user.id, 24 * 60 * 60 * 1000);
      await sendVerificationEmail(user.email, `${firstName} ${lastName}`, `${config.appUrl}/verify-email?token=${raw}`);
    } catch (err) {
      logger.error({ err }, '[mail] verification email failed');
    }
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

    // مدرسة معلّقة = مستخدموها لا يدخلون (إلا السوبر أدمن)
    if (user.schoolId && user.role !== 'SUPER_ADMIN') {
      const school = await prisma.school.findUnique({ where: { id: user.schoolId }, select: { status: true } });
      if (school?.status === 'SUSPENDED') {
        return res.status(403).json({ error: 'المدرسة معلّقة حالياً. يرجى مراجعة إدارة المنصة.' });
      }
    }

    const pair = await issuePair(user);
    res.json({
      ...pair,
      user: toPublicUser(user)
    });
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
    res.json({
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      phone: user.phone,
      role: user.role,
      accountStatus: user.accountStatus
    });
  })
);

/**
 * @swagger
 * /api/auth/forgot-password:
 *   post:
 *     summary: طلب استعادة كلمة المرور (يرسل رابطاً بالبريد)
 *     tags: [auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email]
 *             properties:
 *               email: { type: string, format: email }
 *     responses:
 *       200:
 *         description: دائماً 200 (لا كشف عن وجود البريد أو عدمه)
 */
router.post(
  '/forgot-password',
  validateBody(forgotPasswordSchema),
  asyncHandler(async (req, res) => {
    const { email } = req.body;
    const user = await prisma.user.findUnique({ where: { email } });
    if (user) {
      // إبطال الرموز السابقة ثم إصدار رمز جديد (صالح ساعة واحدة)
      await prisma.passwordResetToken.updateMany({
        where: { userId: user.id, usedAt: null },
        data: { usedAt: new Date() }
      });
      const raw = await issueEmailToken(prisma.passwordResetToken, user.id, 60 * 60 * 1000);
      try {
        await sendPasswordResetEmail(user.email, `${user.firstName} ${user.lastName}`, `${config.appUrl}/reset-password?token=${raw}`);
      } catch (err) {
        logger.error({ err }, '[mail] reset email failed');
      }
    }
    // الاستجابة نفسها سواء وُجد البريد أم لا — منع تعداد الحسابات
    res.json({ message: 'إن كان البريد مسجلاً لدينا فستصلك رسالة لإعادة تعيين كلمة المرور.' });
  })
);

/**
 * @swagger
 * /api/auth/reset-password:
 *   post:
 *     summary: إعادة تعيين كلمة المرور برمز الاستعادة
 *     tags: [auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [token, password]
 *             properties:
 *               token: { type: string }
 *               password: { type: string, minLength: 6 }
 *     responses:
 *       200:
 *         description: تم تغيير كلمة المرور
 *       400:
 *         description: رمز غير صالح أو منتهٍ
 */
router.post(
  '/reset-password',
  validateBody(resetPasswordSchema),
  asyncHandler(async (req, res) => {
    const { token, password } = req.body;
    const record = await prisma.passwordResetToken.findUnique({ where: { tokenHash: sha256(token) } });
    if (!record || record.usedAt || record.expiresAt < new Date()) {
      throw new ApiError(400, 'رمز الاستعادة غير صالح أو منتهي الصلاحية. اطلب رابطاً جديداً.');
    }
    const passwordHash = await bcrypt.hash(password, 10);
    await prisma.$transaction([
      prisma.user.update({ where: { id: record.userId }, data: { passwordHash } }),
      prisma.passwordResetToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
      // إبطال كل جلسات المستخدم بعد تغيير كلمة المرور
      prisma.refreshToken.updateMany({
        where: { userId: record.userId, revokedAt: null },
        data: { revokedAt: new Date() }
      })
    ]);
    res.json({ message: 'تم تغيير كلمة المرور بنجاح. يمكنك الدخول بكلمة السر الجديدة.' });
  })
);

/**
 * @swagger
 * /api/auth/verify-email:
 *   post:
 *     summary: تأكيد البريد الإلكتروني برمز التسجيل
 *     tags: [auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [token]
 *             properties:
 *               token: { type: string }
 *     responses:
 *       200:
 *         description: تم التأكيد
 *       400:
 *         description: رمز غير صالح
 */
router.post(
  '/verify-email',
  asyncHandler(async (req, res) => {
    const token = String(req.body?.token || '');
    if (token.length < 20) throw new ApiError(400, 'رمز التأكيد غير صالح.');
    const record = await prisma.emailVerificationToken.findUnique({ where: { tokenHash: sha256(token) } });
    if (!record || record.usedAt || record.expiresAt < new Date()) {
      throw new ApiError(400, 'رمز التأكيد غير صالح أو منتهي. اطلب رسالة جديدة.');
    }
    await prisma.$transaction([
      prisma.user.update({ where: { id: record.userId }, data: { emailVerified: true } }),
      prisma.emailVerificationToken.update({ where: { id: record.id }, data: { usedAt: new Date() } })
    ]);
    res.json({ message: 'تم تأكيد بريدك الإلكتروني بنجاح.' });
  })
);

/**
 * @swagger
 * /api/auth/resend-verification:
 *   post:
 *     summary: إعادة إرسال رسالة تأكيد البريد (يتطلب تسجيل الدخول)
 *     tags: [auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: أُرسلت الرسالة إن كان البريد غير مؤكد
 */
router.post(
  '/resend-verification',
  authMiddleware,
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user) throw new ApiError(404, AR.USER_NOT_FOUND);
    if (user.emailVerified) return res.json({ message: 'بريدك مؤكد مسبقاً.' });
    const raw = await issueEmailToken(prisma.emailVerificationToken, user.id, 24 * 60 * 60 * 1000);
    try {
      await sendVerificationEmail(user.email, `${user.firstName} ${user.lastName}`, `${config.appUrl}/verify-email?token=${raw}`);
    } catch (err) {
      logger.error({ err }, '[mail] verification email failed');
    }
    res.json({ message: 'أُرسلت رسالة التأكيد إلى بريدك.' });
  })
);

export default router;
