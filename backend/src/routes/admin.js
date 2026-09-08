import { Router } from 'express';
import prisma from '../db.js';
import { authMiddleware, adminMiddleware } from '../auth.js';
import { validateBody, validateParams } from '../middleware/validate.js';
import { registrationStatusSchema, helpRequestStatusSchema } from '../validators/admin.js';
import { idParamSchema } from '../validators/common.js';
import { ApiError, asyncHandler } from '../middleware/errorHandler.js';
import { actorSchoolId } from '../tenant.js';

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
  asyncHandler(async (req, res) => {
    const sid = actorSchoolId(req);
    const sc = sid != null ? { schoolId: sid } : null;
    const [users, students, registrations, pendingRegs, helpRequests, contactMessages] = await Promise.all([
      prisma.user.count({ where: { role: 'PARENT', ...(sc || {}) } }),
      prisma.student.count({ where: sc ? { account: sc } : {} }),
      prisma.registration.count({ where: sc ? { user: sc } : {} }),
      prisma.registration.count({ where: { status: 'PENDING', ...(sc ? { user: sc } : {}) } }),
      prisma.helpRequest.count({ where: sc ? { user: sc } : {} }),
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
  asyncHandler(async (req, res) => {
    const sid = actorSchoolId(req);
    const items = await prisma.registration.findMany({
      where: sid != null ? { user: { schoolId: sid } } : {},
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
    const sid = actorSchoolId(req);
    const { status, notes } = req.body;
    const existing = await prisma.registration.findFirst({
      where: { id: Number(req.params.id), ...(sid != null ? { user: { schoolId: sid } } : {}) }
    });
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
  asyncHandler(async (req, res) => {
    const sid = actorSchoolId(req);
    const items = await prisma.helpRequest.findMany({ where: sid != null ? { user: { schoolId: sid } } : {}, orderBy: { createdAt: 'desc' }, take: 100 });
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
    const sid = actorSchoolId(req);
    const { status } = req.body;
    const existing = await prisma.helpRequest.findFirst({
      where: { id: Number(req.params.id), ...(sid != null ? { user: { schoolId: sid } } : {}) }
    });
    if (!existing) throw new ApiError(404, 'طلب المساعدة غير موجود');
    const updated = await prisma.helpRequest.update({
      where: { id: req.params.id },
      data: { status }
    });
    res.json(updated);
  })
);

export default router;
