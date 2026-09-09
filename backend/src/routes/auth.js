import { Router } from 'express';
import bcrypt from 'bcryptjs';
import prisma from '../db.js';
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
import { registerSchema, loginSchema, refreshSchema } from '../validators/auth.js';
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

export default router;
