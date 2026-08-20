import { Router } from 'express';
import crypto from 'crypto';
import prisma from '../db.js';
import { authMiddleware, superAdminMiddleware } from '../auth.js';
import { currentSchoolYear, schoolYearBounds, priceForType } from '../services/schoolYear.js';
import { validateBody, validateParams, validateQuery } from '../middleware/validate.js';
import { ApiError, asyncHandler } from '../middleware/errorHandler.js';
import {
  licenseCreateSchema,
  superAdminSubscriptionCreateSchema,
  superAdminRoleUpdateSchema,
  superAdminUsersQuerySchema,
  superAdminIdParamSchema
} from '../validators/superadmin.js';

const router = Router();
router.use(authMiddleware, superAdminMiddleware);

/**
 * @swagger
 * /api/superadmin/licenses:
 *   get:
 *     summary: قائمة التراخيص
 *     tags: [superadmin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: قائمة التراخيص
 */
router.get('/licenses', asyncHandler(async (req, res) => {
  const licenses = await prisma.license.findMany({ orderBy: { createdAt: 'desc' } });
  res.json(licenses);
}));

/**
 * @swagger
 * /api/superadmin/licenses:
 *   post:
 *     summary: إنشاء ترخيص جديد
 *     tags: [superadmin]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [entityName]
 *             properties:
 *               entityName: { type: string }
 *               expiresAt: { type: string }
 *     responses:
 *       201:
 *         description: تم إنشاء الترخيص
 *       400:
 *         description: فشل التحقق من البيانات
 */
router.post('/licenses', validateBody(licenseCreateSchema), asyncHandler(async (req, res) => {
  const { entityName, expiresAt } = req.body;
  const key = `RAFI-${crypto.randomBytes(5).toString('hex').toUpperCase()}`;
  const license = await prisma.license.create({
    data: {
      key,
      entityName: String(entityName).trim(),
      expiresAt: expiresAt ? new Date(expiresAt) : null
    }
  });
  res.status(201).json(license);
}));

/**
 * @swagger
 * /api/superadmin/licenses/{id}/revoke:
 *   post:
 *     summary: إلغاء ترخيص
 *     tags: [superadmin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: تم الإلغاء
 */
router.post('/licenses/:id/revoke', validateParams(superAdminIdParamSchema), asyncHandler(async (req, res) => {
  const license = await prisma.license.update({
    where: { id: Number(req.params.id) },
    data: { status: 'REVOKED', revokedAt: new Date() }
  });
  res.json(license);
}));

/**
 * @swagger
 * /api/superadmin/subscriptions:
 *   get:
 *     summary: قائمة الاشتراكات
 *     tags: [superadmin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: قائمة الاشتراكات
 */
router.get('/subscriptions', asyncHandler(async (req, res) => {
  const subscriptions = await prisma.subscription.findMany({
    include: {
      user: { select: { id: true, firstName: true, lastName: true, email: true, role: true, accountStatus: true } },
      payments: { include: { paidBy: { select: { id: true, firstName: true, lastName: true } } } }
    },
    orderBy: { createdAt: 'desc' }
  });
  res.json(subscriptions);
}));

/**
 * @swagger
 * /api/superadmin/subscriptions:
 *   post:
 *     summary: إنشاء اشتراك يدوي
 *     tags: [superadmin]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [userId, type]
 *             properties:
 *               userId: { type: integer }
 *               type: { type: string, enum: [STUDENT, TEACHER] }
 *               schoolYear: { type: string }
 *               amount: { type: number }
 *     responses:
 *       201:
 *         description: تم إنشاء الاشتراك
 *       400:
 *         description: فشل التحقق من البيانات
 *       404:
 *         description: المستخدم غير موجود
 */
router.post('/subscriptions', validateBody(superAdminSubscriptionCreateSchema), asyncHandler(async (req, res) => {
  const { userId, type, schoolYear, amount } = req.body;
  const user = await prisma.user.findUnique({ where: { id: Number(userId) } });
  if (!user) throw new ApiError(404, 'المستخدم غير موجود');

  const year = schoolYear || currentSchoolYear();
  const { start, end } = schoolYearBounds(year);
  const subscription = await prisma.subscription.create({
    data: {
      userId: user.id,
      type,
      plan: type === 'TEACHER' ? 'اشتراك أستاذ' : 'اشتراك تلميذ',
      schoolYear: year,
      startDate: start,
      endDate: end,
      status: 'ACTIVE',
      amount: amount != null ? Number(amount) : priceForType(type)
    }
  });
  await prisma.user.update({ where: { id: user.id }, data: { accountStatus: 'ACTIVE' } });
  res.status(201).json(subscription);
}));

/**
 * @swagger
 * /api/superadmin/subscriptions/{id}/renew:
 *   post:
 *     summary: تجديد اشتراك
 *     tags: [superadmin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: تم التجديد
 *       404:
 *         description: الاشتراك غير موجود
 */
router.post('/subscriptions/:id/renew', validateParams(superAdminIdParamSchema), asyncHandler(async (req, res) => {
  const sub = await prisma.subscription.findUnique({ where: { id: Number(req.params.id) } });
  if (!sub) throw new ApiError(404, 'الاشتراك غير موجود');
  const schoolYear = currentSchoolYear();
  const { start, end } = schoolYearBounds(schoolYear);
  const updated = await prisma.subscription.update({
    where: { id: sub.id },
    data: { schoolYear, startDate: start, endDate: end, status: 'ACTIVE' }
  });
  await prisma.user.update({ where: { id: sub.userId }, data: { accountStatus: 'ACTIVE' } });
  res.json(updated);
}));

/**
 * @swagger
 * /api/superadmin/subscriptions/{id}/expire:
 *   post:
 *     summary: إنهاء اشتراك (انتهاء)
 *     tags: [superadmin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: تم الإنهاء
 */
router.post('/subscriptions/:id/expire', validateParams(superAdminIdParamSchema), asyncHandler(async (req, res) => {
  const sub = await prisma.subscription.update({
    where: { id: Number(req.params.id) },
    data: { status: 'EXPIRED' }
  });
  await prisma.user.update({ where: { id: sub.userId }, data: { accountStatus: 'EXPIRED' } });
  res.json(sub);
}));

/**
 * @swagger
 * /api/superadmin/subscriptions/{id}/suspend:
 *   post:
 *     summary: تعليق اشتراك
 *     tags: [superadmin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: تم التعليق
 */
router.post('/subscriptions/:id/suspend', validateParams(superAdminIdParamSchema), asyncHandler(async (req, res) => {
  const sub = await prisma.subscription.update({
    where: { id: Number(req.params.id) },
    data: { status: 'SUSPENDED' }
  });
  await prisma.user.update({ where: { id: sub.userId }, data: { accountStatus: 'SUSPENDED' } });
  res.json(sub);
}));

/**
 * @swagger
 * /api/superadmin/users:
 *   get:
 *     summary: بحث في المستخدمين
 *     tags: [superadmin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: q
 *         schema: { type: string }
 *       - in: query
 *         name: role
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: قائمة المستخدمين
 */
router.get('/users', validateQuery(superAdminUsersQuerySchema), asyncHandler(async (req, res) => {
  const { q, role } = req.query;
  const where = {};
  if (role) where.role = role;
  if (q) {
    where.OR = [
      { firstName: { contains: String(q) } },
      { lastName: { contains: String(q) } },
      { email: { contains: String(q) } }
    ];
  }
  const users = await prisma.user.findMany({
    where,
    select: {
      id: true, firstName: true, lastName: true, email: true, phone: true, role: true, createdAt: true,
      studentAccount: { select: { id: true, class: { select: { name: true } } } },
      subscriptions: { select: { id: true, plan: true, endDate: true, status: true } }
    },
    orderBy: { createdAt: 'desc' },
    take: 200
  });
  res.json(users);
}));

/**
 * @swagger
 * /api/superadmin/users/{id}/role:
 *   put:
 *     summary: تغيير دور مستخدم
 *     tags: [superadmin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [role]
 *             properties:
 *               role: { type: string }
 *     responses:
 *       200:
 *         description: تم التغيير
 *       400:
 *         description: دور غير صالح
 */
router.put('/users/:id/role', validateParams(superAdminIdParamSchema), validateBody(superAdminRoleUpdateSchema), asyncHandler(async (req, res) => {
  const { role } = req.body;
  await prisma.user.update({ where: { id: Number(req.params.id) }, data: { role } });
  res.json({ ok: true });
}));

/**
 * @swagger
 * /api/superadmin/students:
 *   get:
 *     summary: قائمة التلاميذ
 *     tags: [superadmin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: قائمة التلاميذ
 */
router.get('/students', asyncHandler(async (req, res) => {
  const students = await prisma.student.findMany({
    include: {
      class: { select: { id: true, name: true } },
      account: { select: { id: true, firstName: true, lastName: true, email: true, xp: true, level: true } },
      user: { select: { id: true, firstName: true, lastName: true, email: true } }
    },
    orderBy: { createdAt: 'desc' },
    take: 200
  });
  res.json(students);
}));

export default router;
