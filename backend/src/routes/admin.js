import { Router } from 'express';
import prisma from '../db.js';
import { authMiddleware, adminMiddleware } from '../auth.js';
import { validateBody, validateParams } from '../middleware/validate.js';
import { registrationStatusSchema, helpRequestStatusSchema } from '../validators/admin.js';
import { idParamSchema } from '../validators/common.js';
import { ApiError, asyncHandler } from '../middleware/errorHandler.js';

const router = Router();

router.use(authMiddleware, adminMiddleware);

/**
 * @swagger
 * /api/admin/stats:
 *   get:
 *     summary: إحصاءات عامة (إدارة)
 *     tags: [admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: الإحصاءات
 */
router.get(
  '/stats',
  asyncHandler(async (_req, res) => {
    const [users, students, registrations, pendingRegs, helpRequests, contactMessages] = await Promise.all([
      prisma.user.count({ where: { role: 'PARENT' } }),
      prisma.student.count(),
      prisma.registration.count(),
      prisma.registration.count({ where: { status: 'PENDING' } }),
      prisma.helpRequest.count(),
      prisma.contactMessage.count()
    ]);
    res.json({
      users,
      students,
      registrations,
      pendingRegs,
      helpRequests,
      contactMessages
    });
  })
);

/**
 * @swagger
 * /api/admin/registrations:
 *   get:
 *     summary: قائمة طلبات التسجيل
 *     tags: [admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: قائمة الطلبات
 */
router.get(
  '/registrations',
  asyncHandler(async (_req, res) => {
    const items = await prisma.registration.findMany({
      include: { student: true, user: true },
      orderBy: { createdAt: 'desc' },
      take: 100
    });
    res.json(items);
  })
);

/**
 * @swagger
 * /api/admin/registrations/{id}:
 *   put:
 *     summary: تحديث حالة طلب تسجيل
 *     tags: [admin]
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
 *             properties:
 *               status: { type: string }
 *               notes: { type: string }
 *     responses:
 *       200:
 *         description: تم التحديث
 */
router.put(
  '/registrations/:id',
  validateParams(idParamSchema),
  validateBody(registrationStatusSchema),
  asyncHandler(async (req, res) => {
    const { status, notes } = req.body;
    const existing = await prisma.registration.findUnique({ where: { id: req.params.id } });
    if (!existing) throw new ApiError(404, 'طلب التسجيل غير موجود');
    const updated = await prisma.registration.update({
      where: { id: req.params.id },
      data: { status: status || 'PENDING', notes: notes || undefined },
      include: { student: true }
    });
    res.json(updated);
  })
);

/**
 * @swagger
 * /api/admin/help-requests:
 *   get:
 *     summary: قائمة طلبات المساعدة
 *     tags: [admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: قائمة الطلبات
 */
router.get(
  '/help-requests',
  asyncHandler(async (_req, res) => {
    const items = await prisma.helpRequest.findMany({ orderBy: { createdAt: 'desc' }, take: 100 });
    res.json(items);
  })
);

/**
 * @swagger
 * /api/admin/help-requests/{id}:
 *   put:
 *     summary: تحديث حالة طلب مساعدة
 *     tags: [admin]
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
 *             properties:
 *               status: { type: string }
 *     responses:
 *       200:
 *         description: تم التحديث
 */
router.put(
  '/help-requests/:id',
  validateParams(idParamSchema),
  validateBody(helpRequestStatusSchema),
  asyncHandler(async (req, res) => {
    const { status } = req.body;
    const existing = await prisma.helpRequest.findUnique({ where: { id: req.params.id } });
    if (!existing) throw new ApiError(404, 'طلب المساعدة غير موجود');
    const updated = await prisma.helpRequest.update({
      where: { id: req.params.id },
      data: { status }
    });
    res.json(updated);
  })
);

export default router;
