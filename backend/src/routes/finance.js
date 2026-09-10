import { Router } from 'express';
import prisma from '../db.js';
import { authMiddleware, requireRole } from '../auth.js';
import { notify } from '../services/notify.js';
import { audit, requestContext } from '../services/auditService.js';
import { schoolYearBounds, nextSchoolYear } from '../services/schoolYear.js';
import { createInvoice } from '../services/invoiceService.js';
import { validateBody, validateParams } from '../middleware/validate.js';
import { paymentSchema, idParamSchema } from '../validators/subscription.js';
import { ApiError, asyncHandler } from '../middleware/errorHandler.js';

const router = Router();

router.use(authMiddleware, requireRole('ADMIN', 'SUPER_ADMIN'));

const USER_SELECT = { select: { id: true, firstName: true, lastName: true, email: true, role: true, accountStatus: true } };

/**
 * @swagger
 * /api/admin/subscriptions:
 *   get:
 *     summary: لوحة الاشتراكات المالية (إداري/نظامي)
 *     tags: [subscriptions]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: الإحصاءات المالية وقائمة الاشتراكات
 *       403:
 *         description: صلاحية غير كافية
 */
router.get(
  '/',
  asyncHandler(async (_req, res) => {
    const now = new Date();
    const in15Days = new Date(now.getTime() + 15 * 86400000);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const [subscriptions, activeCount, pendingCount, suspendedCount, expiredCount, payments, expiringSoon, revenueByMonth, monthRevenue] = await Promise.all([
      prisma.subscription.findMany({
        include: { user: USER_SELECT, payments: { include: { paidBy: { select: { id: true, firstName: true, lastName: true } } } } },
        orderBy: { createdAt: 'desc' }
      }),
      prisma.subscription.count({ where: { status: 'ACTIVE' } }),
      prisma.subscription.count({ where: { status: 'PENDING_PAYMENT' } }),
      prisma.subscription.count({ where: { status: 'SUSPENDED' } }),
      prisma.subscription.count({ where: { status: 'EXPIRED' } }),
      prisma.payment.findMany({ orderBy: { paidAt: 'desc' }, include: { subscription: { select: { id: true, plan: true, schoolYear: true } }, paidBy: { select: { id: true, firstName: true, lastName: true } } } }),
      prisma.subscription.findMany({
        where: { status: 'ACTIVE', endDate: { gte: now, lte: in15Days } },
        include: { user: USER_SELECT },
        orderBy: { endDate: 'asc' }
      }),
      prisma.payment.findMany({ select: { amount: true, paidAt: true } }),
      prisma.payment.aggregate({ _sum: { amount: true }, where: { paidAt: { gte: monthStart } } })
    ]);

    const totalRevenue = payments.reduce((acc, p) => acc + Number(p.amount), 0);

    const monthMap = new Map();
    for (const p of revenueByMonth) {
      const key = p.paidAt.toISOString().slice(0, 7);
      monthMap.set(key, (monthMap.get(key) || 0) + Number(p.amount));
    }
    const revenueByMonthList = Array.from(monthMap.entries())
      .map(([month, amount]) => ({ month, amount }))
      .sort((a, b) => (a.month < b.month ? -1 : 1))
      .slice(-12);

    res.json({
      subscriptions,
      payments,
      summary: {
        activeCount,
        pendingCount,
        suspendedCount,
        expiredCount,
        totalRevenue,
        monthRevenue: Number(monthRevenue._sum.amount || 0),
        expiringSoonCount: expiringSoon.length
      },
      expiringSoon,
      revenueByMonth: revenueByMonthList
    });
  })
);

async function setAccountStatus(subscriptionId, status, message) {
  const sub = await prisma.subscription.findUnique({
    where: { id: Number(subscriptionId) },
    include: { user: { select: { id: true, role: true } } }
  });
  if (!sub) throw new ApiError(404, 'الاشتراك غير موجود');

  await prisma.subscription.update({ where: { id: sub.id }, data: { status } });
  if (['STUDENT', 'TEACHER'].includes(sub.user.role)) {
    await prisma.user.update({ where: { id: sub.user.id }, data: { accountStatus: status } });
  }
  await prisma.subscriptionRequest.updateMany({ where: { subscriptionId: sub.id }, data: { status } });

  const parentIds = await prisma.student
    .findMany({ where: { accountUserId: sub.user.id }, select: { userId: true } })
    .then((rows) => rows.map((r) => r.userId));
  await notify([...parentIds, sub.user.id], {
    type: 'SUBSCRIPTION',
    title: message.title,
    body: message.body,
    link: message.link || '/my-requests'
  });
}

/**
 * @swagger
 * /api/admin/subscriptions/{id}/pay:
 *   post:
 *     summary: تسجيل دفعة وتفعيل الاشتراك
 *     tags: [subscriptions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               amount: { type: number }
 *               method: { type: string }
 *               reference: { type: string }
 *     responses:
 *       201: { description: تم الدفع والتفعيل }
 *       400: { description: الاشتراك مفعّل مسبقا }
 *       404: { description: الاشتراك غير موجود }
 */
router.post(
  '/:id/pay',
  validateParams(idParamSchema),
  validateBody(paymentSchema),
  asyncHandler(async (req, res) => {
    const { amount, method, reference } = req.body;
    const sub = await prisma.subscription.findUnique({ where: { id: req.params.id } });
    if (!sub) throw new ApiError(404, 'الاشتراك غير موجود');
    if (sub.status === 'ACTIVE') throw new ApiError(400, 'هذا الاشتراك مفعّل مسبقا');

    const paidAmount = amount != null ? Number(amount) : sub.amount || 0;

    // ذرّية: مطالبة مشروطة (status != ACTIVE) داخل معاملة — إداريان متزامنان
    // (أو إداري + webhook) لا يسجّلان دفعتين/فاتورتين لنفس الاشتراك.
    const payment = await prisma.$transaction(async (tx) => {
      const claim = await tx.subscription.updateMany({
        where: { id: sub.id, status: { not: 'ACTIVE' } },
        data: { status: 'ACTIVE' }
      });
      if (claim.count === 0) throw new ApiError(400, 'هذا الاشتراك مفعّل مسبقا');

      const created = await tx.payment.create({
        data: {
          subscriptionId: sub.id,
          amount: paidAmount,
          method: method || 'OFFLINE',
          reference: reference || null,
          paidByUserId: req.user.id
        }
      });

      await tx.user.update({ where: { id: sub.userId }, data: { accountStatus: 'ACTIVE' } });
      await tx.subscriptionRequest.updateMany({ where: { subscriptionId: sub.id }, data: { status: 'ACTIVE' } });
      return created;
    });

    const invoice = await createInvoice({
      subscriptionId: sub.id,
      paymentId: payment.id,
      intent: {
        amount: paidAmount,
        currency: 'TND',
        metadata: { originalAmount: paidAmount, discountAmount: 0 }
      }
    });
    await audit({
      actorId: req.user.id,
      actorRole: req.user.role,
      action: 'INVOICE_ISSUED',
      resource: 'Invoice',
      resourceId: invoice.id,
      ...requestContext(req),
      metadata: { invoiceNumber: invoice.invoiceNumber, source: 'OFFLINE_PAYMENT', subscriptionId: sub.id }
    });

    const parentIds = await prisma.student
      .findMany({ where: { accountUserId: sub.userId }, select: { userId: true } })
      .then((rows) => rows.map((r) => r.userId));
    await notify([...parentIds, sub.userId], {
      type: 'PAID',
      title: 'تم تفعيل الحساب والاشتراك',
      body: `تم تسجيل عملية الدفع (${paidAmount} د.ت) وتفعيل الاشتراك حتى ${new Date(sub.endDate).toLocaleDateString('ar-TN')}`,
      link: '/my-requests'
    });

    res.status(201).json({ payment, status: 'ACTIVE', invoice });
  })
);

router.post(
  '/:id/suspend',
  validateParams(idParamSchema),
  asyncHandler(async (req, res) => {
    await setAccountStatus(req.params.id, 'SUSPENDED', {
      title: 'تعطيل الحساب',
      body: 'تم تعطيل الحساب مؤقتا بسبب عدم دفع الاشتراك'
    });
    res.json({ ok: true, status: 'SUSPENDED' });
  })
);

router.post(
  '/:id/reactivate',
  validateParams(idParamSchema),
  asyncHandler(async (req, res) => {
    const sub = await prisma.subscription.findUnique({ where: { id: req.params.id } });
    if (!sub) throw new ApiError(404, 'الاشتراك غير موجود');
    if (sub.status === 'EXPIRED') throw new ApiError(400, 'الاشتراك منتهي، استعمل التجديد');
    await setAccountStatus(req.params.id, 'ACTIVE', {
      title: 'إعادة تفعيل الحساب',
      body: 'تمت إعادة تفعيل الحساب بلا فقدان أي بيانات'
    });
    res.json({ ok: true, status: 'ACTIVE' });
  })
);

router.post(
  '/:id/remind',
  validateParams(idParamSchema),
  asyncHandler(async (req, res) => {
    const sub = await prisma.subscription.findUnique({ where: { id: req.params.id } });
    if (!sub) throw new ApiError(404, 'الاشتراك غير موجود');
    if (sub.status !== 'ACTIVE') throw new ApiError(400, 'الاشتراك غير مفعّل حاليا');

    const parentIds = await prisma.student
      .findMany({ where: { accountUserId: sub.userId }, select: { userId: true } })
      .then((rows) => rows.map((r) => r.userId));

    await notify([...parentIds, sub.userId], {
      type: 'RENEWAL_REMINDER',
      title: 'تذكير بموعد انتهاء الاشتراك',
      body: `يقترب انتهاء اشتراكك (${new Date(sub.endDate).toLocaleDateString('ar-TN')})، يرجى تجديده في الآجال`,
      link: '/my-requests'
    });

    res.json({ ok: true });
  })
);

router.post(
  '/:id/renew',
  validateParams(idParamSchema),
  asyncHandler(async (req, res) => {
    const sub = await prisma.subscription.findUnique({ where: { id: req.params.id } });
    if (!sub) throw new ApiError(404, 'الاشتراك غير موجود');
    const schoolYear = nextSchoolYear(sub.schoolYear);
    const { start, end } = schoolYearBounds(schoolYear);

    const updated = await prisma.subscription.update({
      where: { id: sub.id },
      data: { schoolYear, startDate: start, endDate: end, status: 'ACTIVE' }
    });
    await prisma.user.update({ where: { id: sub.userId }, data: { accountStatus: 'ACTIVE' } });
    await prisma.subscriptionRequest.updateMany({ where: { subscriptionId: sub.id }, data: { status: 'ACTIVE', schoolYear } });

    const parentIds = await prisma.student
      .findMany({ where: { accountUserId: sub.userId }, select: { userId: true } })
      .then((rows) => rows.map((r) => r.userId));
    await notify([...parentIds, sub.userId], {
      type: 'RENEWED',
      title: 'تم تجديد الاشتراك',
      body: `تم تجديد اشتراكك للسنة الدراسية ${schoolYear}`,
      link: '/my-requests'
    });

    res.json(updated);
  })
);

export default router;
