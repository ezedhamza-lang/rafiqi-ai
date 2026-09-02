import { Router } from 'express';
import prisma from '../db.js';
import { authMiddleware } from '../auth.js';
import { validateBody, validateParams } from '../middleware/validate.js';
import { registrationCreateSchema } from '../validators/registration.js';
import { idParamSchema } from '../validators/common.js';
import { ApiError, asyncHandler } from '../middleware/errorHandler.js';

const router = Router();

router.use(authMiddleware);

/**
 * @swagger
 * /api/registrations:
 *   get:
 *     summary: تسجيلات الولي
 *     tags: [registrations]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: قائمة التسجيلات
 */
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const registrations = await prisma.registration.findMany({
      where: { userId: req.user.id },
      include: { student: true },
      orderBy: { createdAt: 'desc' }
    });
    res.json(registrations);
  })
);

/**
 * @swagger
 * /api/registrations:
 *   post:
 *     summary: تقديم طلب تسجيل تلميذ (الولي)
 *     tags: [registrations]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [studentId, schoolYear, level]
 *             properties:
 *               studentId: { type: integer }
 *               schoolYear: { type: string }
 *               level: { type: string }
 *               notes: { type: string }
 *     responses:
 *       201:
 *         description: تم إنشاء طلب التسجيل
 *       400:
 *         description: فشل التحقق من البيانات
 *       404:
 *         description: التلميذ غير موجود
 */
router.post(
  '/',
  validateBody(registrationCreateSchema),
  asyncHandler(async (req, res) => {
    const { studentId, schoolYear, level, notes } = req.body;
    const student = await prisma.student.findUnique({ where: { id: studentId } });
    if (!student || student.userId !== req.user.id) {
      throw new ApiError(404, 'التلميذ غير موجود');
    }
    const registration = await prisma.registration.create({
      data: {
        userId: req.user.id,
        studentId: student.id,
        schoolYear: String(schoolYear),
        level: String(level),
        notes: notes || null
      },
      include: { student: true }
    });
    res.status(201).json(registration);
  })
);

/**
 * @swagger
 * /api/registrations/{id}/cancel:
 *   put:
 *     summary: إلغاء طلب تسجيل معلق
 *     tags: [registrations]
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
 *       404:
 *         description: الطلب غير موجود
 */
router.put(
  '/:id/cancel',
  validateParams(idParamSchema),
  asyncHandler(async (req, res) => {
    const registration = await prisma.registration.findUnique({ where: { id: req.params.id } });
    if (!registration || registration.userId !== req.user.id) {
      throw new ApiError(404, 'الطلب غير موجود');
    }
    if (registration.status !== 'PENDING') {
      throw new ApiError(400, 'لا يمكن إلغاء طلب تمت معالجته');
    }
    const updated = await prisma.registration.update({
      where: { id: registration.id },
      data: { status: 'REJECTED', notes: 'أُلغي الطلب من طرف الولي' }
    });
    res.json(updated);
  })
);

export default router;
