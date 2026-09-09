import { Router } from 'express';
import prisma from '../db.js';
import { authMiddleware, requireRole } from '../auth.js';
import { notify } from '../services/notify.js';
import { currentSchoolYear } from '../services/schoolYear.js';
import { validateBody } from '../middleware/validate.js';
import { subscriptionRequestSchema } from '../validators/subscription.js';
import { ApiError, asyncHandler } from '../middleware/errorHandler.js';

const router = Router();

router.use(authMiddleware);

/**
 * @swagger
 * /api/subscription-requests/mine:
 *   get:
 *     summary: طلبات الولي
 *     tags: [subscriptions]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: قائمة الطلبات
 */
router.get(
  '/mine',
  requireRole('PARENT'),
  asyncHandler(async (req, res) => {
    const requests = await prisma.subscriptionRequest.findMany({
      where: { parentId: req.user.id },
      include: {
        class: { select: { id: true, name: true, level: true } },
        parent: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } }
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(requests);
  })
);

/**
 * @swagger
 * /api/subscription-requests:
 *   post:
 *     summary: تقديم طلب إضافة تلميذ (الولي)
 *     tags: [subscriptions]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [firstName, lastName, birthDate, level]
 *             properties:
 *               firstName: { type: string }
 *               lastName: { type: string }
 *               birthDate: { type: string, format: date, description: "YYYY-MM-DD" }
 *               cin: { type: string }
 *               gender: { type: string }
 *               level: { type: string }
 *               schoolYear: { type: string }
 *               schoolName: { type: string }
 *               notes: { type: string }
 *     responses:
 *       201:
 *         description: تم إنشاء الطلب
 *       400:
 *         description: فشل التحقق
 */
router.post(
  '/',
  requireRole('PARENT'),
  validateBody(subscriptionRequestSchema),
  asyncHandler(async (req, res) => {
    const { firstName, lastName, birthDate, cin, gender, level, schoolYear, schoolName, notes } = req.body;

    const request = await prisma.subscriptionRequest.create({
      data: {
        parentId: req.user.id,
        firstName,
        lastName,
        birthDate: new Date(birthDate),
        cin: cin || null,
        gender: gender || null,
        level,
        schoolYear: schoolYear || currentSchoolYear(),
        schoolName: schoolName || null,
        notes: notes || null
      },
      include: {
        class: { select: { id: true, name: true, level: true } },
        parent: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } }
      }
    });

    // توجيه التنبيه لمدرسة الولي فقط (مديرو مدرسته + الإدارة/المشرف)، لا كل مديري المنصة.
    const parentSchoolId = req.user?.schoolId ?? null;
    const directors = await prisma.user.findMany({
      where: { role: 'SCHOOL_DIRECTOR', ...(parentSchoolId != null ? { schoolId: parentSchoolId } : { schoolId: -1 }) },
      select: { id: true }
    });
    const managers = await prisma.user.findMany({ where: { role: { in: ['ADMIN', 'SUPER_ADMIN'] } }, select: { id: true } });
    const recipientIds = [...new Set([...directors.map((d) => d.id), ...managers.map((m) => m.id)])];
    if (recipientIds.length) {
      await notify(recipientIds, {
        type: 'SUBSCRIPTION_REQUEST',
        title: 'طلب إضافة تلميذ جديد',
        body: `${firstName} ${lastName} (${level}) ينتظر المصادقة من طرف الولي`,
        link: '/director/requests'
      });
    }

    res.status(201).json(request);
  })
);

/**
 * @swagger
 * /api/subscription-requests/{id}/cancel:
 *   put:
 *     summary: إلغاء طلب معلق
 *     tags: [subscriptions]
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
  requireRole('PARENT'),
  asyncHandler(async (req, res) => {
    const request = await prisma.subscriptionRequest.findUnique({ where: { id: Number(req.params.id) } });
    if (!request || request.parentId !== req.user.id) {
      throw new ApiError(404, 'الطلب غير موجود');
    }
    if (request.status !== 'PENDING_APPROVAL') {
      throw new ApiError(400, 'لا يمكن إلغاء طلب تمت معالجته');
    }
    const updated = await prisma.subscriptionRequest.update({
      where: { id: request.id },
      data: { status: 'CANCELLED', rejectionReason: 'أُلغي الطلب من طرف الولي' }
    });
    res.json(updated);
  })
);

export default router;
