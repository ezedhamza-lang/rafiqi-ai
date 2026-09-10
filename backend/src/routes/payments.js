import { Router } from 'express';
import express from 'express';
import prisma from '../db.js';
import { config } from '../config.js';
import { authMiddleware, requireRole } from '../auth.js';
import { validateBody, validateParams, validateQuery } from '../middleware/validate.js';
import { ApiError, asyncHandler } from '../middleware/errorHandler.js';
import { createCaptcha } from '../services/captchaService.js';
import { listProviders, getProvider, normalizeProviderName } from '../services/payments/provider.js';
import { createCheckoutIntent, processWebhookEvent, PAYABLE_STATUSES } from '../services/paymentService.js';
import { verifyDemoCheckoutToken, demoCheckoutToken } from '../services/payments/demoProvider.js';
import { audit, requestContext } from '../services/auditService.js';
import { getInvoiceWithRelations, buildInvoicePdf, INVOICE_INCLUDE } from '../services/invoiceService.js';
import { cancelAutoRenewal, enableAutoRenewal, runRenewalSweep } from '../services/subscriptionRenewalService.js';
import { setAttachment } from '../services/exportService.js';
import {
  checkoutSchema,
  paymentIntentIdSchema,
  auditLogsQuerySchema,
  discountCodeSchema,
  discountUpdateSchema
} from '../validators/payment.js';

const router = Router();

async function canAccessInvoice(req, invoice) {
  const ownerId = invoice.subscription?.userId;
  if (ownerId === req.user.id) return true;
  if (['ADMIN', 'SUPER_ADMIN'].includes(req.user.role)) return true;
  if (req.user.role === 'PARENT' && ownerId != null) {
    const child = await prisma.student.findFirst({
      where: { userId: req.user.id, accountUserId: ownerId }
    });
    return Boolean(child);
  }
  return false;
}

function parseRawBody(body) {
  if (Buffer.isBuffer(body) || typeof body === 'string') {
    try {
      return JSON.parse(body.toString('utf8'));
    } catch {
      return {};
    }
  }
  return body || {};
}

// ==================== Webhooks (raw body) ====================

/**
 * @swagger
 * /api/payments/webhook/{provider}:
 *   post:
 *     summary: نقطة استقبال أحداث الدفع (Webhook) من المزود
 *     tags: [payments]
 *     description: يستقبل أحداث النجاح/الفشل/الإلغاء ويحدّث الاشتراك تلقائيا. يُستدعى من بوابة الدفع.
 *     parameters:
 *       - in: path
 *         name: provider
 *         required: true
 *         schema: { type: string, enum: [DEMO, STRIPE, STB] }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               type: { type: string, description: "SUCCEEDED | FAILED | CANCELED | EXPIRED أو event غريب (checkout.session.completed...)" }
 *               providerReference: { type: string }
 *               metadata: { type: object }
 *     responses:
 *       200: { description: تمت المعالجة }
 *       400: { description: توقيع غير صالح أو نوع غير معروف }
 */
router.post(
  '/webhook/:provider',
  express.raw({ type: '*/*' }),
  asyncHandler(async (req, res) => {
    const providerName = normalizeProviderName(req.params.provider);
    const provider = getProvider(providerName);
    const verified = await provider.verifyWebhook(req);
    if (!verified) throw new ApiError(400, 'توقيع webhook غير صالح');

    const event = {
      ...provider.parseWebhook(req),
      ip: req.ip || null,
      userAgent: req.headers['user-agent'] || null
    };
    const out = await processWebhookEvent(event);
    res.json(out);
  })
);

/**
 * @swagger
 * /api/payments/demo-checkout/{intentId}/result:
 *   post:
 *     summary: محاكاة نتيجة دفع للمزود التجريبي DEMO
 *     tags: [payments]
 *     parameters:
 *       - in: path
 *         name: intentId
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               result: { type: string, enum: [success, failure, cancel] }
 *     responses:
 *       200: { description: نتيجة المعالجة }
 */
router.post(
  '/demo-checkout/:intentId/result',
  express.raw({ type: '*/*' }),
  authMiddleware,
  asyncHandler(async (req, res) => {
    if (config.nodeEnv === 'production' && !config.payment.allowDemoPayments) {
      throw new ApiError(503, 'المزود التجريبي DEMO معطّل في الإنتاج');
    }
    const intent = await prisma.paymentIntent.findUnique({ where: { id: Number(req.params.intentId) } });
    if (!intent || intent.provider !== 'DEMO') throw new ApiError(404, 'العملية غير موجودة');
    const isAdmin = ['ADMIN', 'SUPER_ADMIN'].includes(req.user.role);
    if (intent.userId !== req.user.id && !isAdmin) {
      throw new ApiError(403, 'ليست لك صلاحية إتمام هذه العملية');
    }
    const body = parseRawBody(req.body);
    const result = body.result || 'success';
    if (!['success', 'failure', 'cancel'].includes(result)) throw new ApiError(400, 'نتيجة غير معروفة');

    const event = {
      provider: 'DEMO',
      type: result === 'success' ? 'SUCCEEDED' : result === 'failure' ? 'FAILED' : 'CANCELED',
      providerReference: intent.providerReference,
      metadata: { intentId: intent.id, subscriptionId: intent.subscriptionId },
      failureMessage: result === 'failure' ? 'فشلت معالجة البطاقة في المزود التجريبي' : null,
      ip: req.ip || null,
      userAgent: req.headers['user-agent'] || null
    };
    const out = await processWebhookEvent(event);
    res.json(out);
  })
);

router.use(express.json());

// ==================== عمومي ====================

/**
 * @swagger
 * /api/payments/captcha:
 *   get:
 *     summary: توليد تحدٍّ لرمز التحقق (CAPTCHA)
 *     tags: [payments]
 *     responses:
 *       200:
 *         description: التحدي (token + question + svg)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 token: { type: string }
 *                 question: { type: string }
 *                 svg: { type: string }
 */
router.get('/captcha', (_req, res) => {
  res.json(createCaptcha());
});

/**
 * @swagger
 * /api/payments/providers:
 *   get:
 *     summary: قائمة مزودي الدفع المتاحين وحالتهم
 *     tags: [payments]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200: { description: قائمة المزودين }
 */
router.get('/providers', authMiddleware, (_req, res) => {
  res.json(listProviders());
});

/**
 * @swagger
 * /api/payments/confirm/{outcome}:
 *   get:
 *     summary: صفحة إرجاع بعد الدفع الخارجي (نجاح/إلغاء)
 *     tags: [payments]
 *     parameters:
 *       - in: path
 *         name: outcome
 *         required: true
 *         schema: { type: string, enum: [success, cancel] }
 *       - in: query
 *         name: intent
 *         schema: { type: integer }
 *     responses:
 *       200: { description: صفحة HTML }
 */
router.get(
  '/confirm/:outcome',
  asyncHandler(async (req, res) => {
    const outcome = req.params.outcome === 'success' ? 'success' : 'cancel';
    const intentId = Number(req.query.intent) || null;
    res.type('html').send(renderConfirmPage(outcome, intentId));
  })
);

// ==================== محمية ====================

/**
 * @swagger
 * /api/payments/payable:
 *   get:
 *     summary: اشتراكات يمكن للطالب/الولي دفعها
 *     tags: [payments]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200: { description: قائمة الاشتراكات المعلقة للدفع }
 */
router.get(
  '/payable',
  authMiddleware,
  asyncHandler(async (req, res) => {
    const own = await prisma.subscription.findMany({
      where: { userId: req.user.id, status: { in: PAYABLE_STATUSES } },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, role: true, email: true } },
        payments: { orderBy: { paidAt: 'desc' }, take: 3 }
      },
      orderBy: { createdAt: 'desc' }
    });

    let children = [];
    if (req.user.role === 'PARENT') {
      const childRows = await prisma.student.findMany({
        where: { userId: req.user.id },
        select: { accountUserId: true, firstName: true, lastName: true }
      });
      const ids = childRows.map((c) => c.accountUserId).filter(Boolean);
      if (ids.length) {
        const childSubs = await prisma.subscription.findMany({
          where: { userId: { in: ids }, status: { in: PAYABLE_STATUSES } },
          include: {
            user: { select: { id: true, firstName: true, lastName: true, role: true, email: true } },
            payments: { orderBy: { paidAt: 'desc' }, take: 3 }
          },
          orderBy: { createdAt: 'desc' }
        });
        children = childSubs.map((s) => ({ ...s, childName: childRows.find((c) => c.accountUserId === s.userId)?.firstName }));
      }
    }

    res.json({ own, children, payerRole: req.user.role });
  })
);

/**
 * @swagger
 * /api/payments/checkout:
 *   post:
 *     summary: بدء عملية دفع (إنشاء نية دفع)
 *     tags: [payments]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [subscriptionId, captchaToken, captchaAnswer]
 *             properties:
 *               subscriptionId: { type: integer }
 *               provider: { type: string, enum: [DEMO, STRIPE, STB] }
 *               captchaToken: { type: string }
 *               captchaAnswer: { type: string }
 *     responses:
 *       201: { description: نية الدفع مع رابط التحويل }
 *       400: { description: تحقق فاشل / CAPTCHA خاطئ }
 *       403: { description: لا صلاحية }
 *       503: { description: مزود غير مضبوط }
 */
router.post(
  '/checkout',
  authMiddleware,
  requireRole('PARENT', 'ADMIN', 'SUPER_ADMIN'),
  validateBody(checkoutSchema),
  asyncHandler(async (req, res) => {
    const { subscriptionId, provider, captchaToken, captchaAnswer, kind, discountCode } = req.body;
    const intent = await createCheckoutIntent({
      subscriptionId,
      provider,
      userId: req.user.id,
      role: req.user.role,
      captchaToken,
      captchaAnswer,
      req,
      kind,
      discountCode
    });
    res.status(201).json(intent);
  })
);

/**
 * @swagger
 * /api/payments/intents/mine:
 *   get:
 *     summary: عمليات الدفع الخاصة بالمستخدم
 *     tags: [payments]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200: { description: قائمة العمليات }
 */
router.get(
  '/intents/mine',
  authMiddleware,
  asyncHandler(async (req, res) => {
    const intents = await prisma.paymentIntent.findMany({
      where: { userId: req.user.id },
      include: { subscription: { select: { id: true, plan: true, schoolYear: true, amount: true } } },
      orderBy: { createdAt: 'desc' }
    });
    res.json(intents);
  })
);

/**
 * @swagger
 * /api/payments/intents/{id}:
 *   get:
 *     summary: تفاصيل عملية دفع
 *     tags: [payments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: العملية }
 *       404: { description: غير موجودة }
 */
router.get(
  '/intents/:id',
  authMiddleware,
  validateParams(paymentIntentIdSchema),
  asyncHandler(async (req, res) => {
    const intent = await prisma.paymentIntent.findUnique({
      where: { id: req.params.id },
      include: { subscription: { select: { id: true, plan: true, schoolYear: true, amount: true } } }
    });
    if (!intent) throw new ApiError(404, 'العملية غير موجودة');
    const isOwner = intent.userId === req.user.id;
    const isAdmin = ['ADMIN', 'SUPER_ADMIN'].includes(req.user.role);
    if (!isOwner && !isAdmin) throw new ApiError(403, 'لا تملك صلاحية الاطلاع على هذه العملية');
    res.json(intent);
  })
);

/**
 * @swagger
 * /api/payments/intents/{id}/cancel:
 *   post:
 *     summary: إلغاء عملية دفع معلّقة
 *     tags: [payments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: "أُلغي" }
 *       400: { description: العملية ليست معلقة }
 */
router.post(
  '/intents/:id/cancel',
  authMiddleware,
  validateParams(paymentIntentIdSchema),
  asyncHandler(async (req, res) => {
    const intent = await prisma.paymentIntent.findUnique({ where: { id: req.params.id } });
    if (!intent) throw new ApiError(404, 'العملية غير موجودة');
    if (intent.userId !== req.user.id && !['ADMIN', 'SUPER_ADMIN'].includes(req.user.role)) {
      throw new ApiError(403, 'لا تملك صلاحية إلغاء هذه العملية');
    }
    if (intent.status !== 'PENDING') throw new ApiError(400, 'لا يمكن إلغاء عملية غير معلّقة');
    const updated = await prisma.paymentIntent.update({ where: { id: intent.id }, data: { status: 'CANCELED' } });
    await audit({
      actorId: req.user.id,
      actorRole: req.user.role,
      action: 'PAYMENT_INTENT_CANCELED',
      resource: 'PaymentIntent',
      resourceId: intent.id,
      ...requestContext(req)
    });
    res.json(updated);
  })
);

/**
 * @swagger
 * /api/payments/active:
 *   get:
 *     summary: اشتراكات المستخدم/الأبناء النشطة مع حالة التجديد التلقائي
 *     tags: [payments]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200: { description: قائمة الاشتراكات النشطة }
 */
router.get(
  '/active',
  authMiddleware,
  asyncHandler(async (req, res) => {
    const where = { status: 'ACTIVE' };
    if (req.user.role === 'PARENT') {
      const childRows = await prisma.student.findMany({
        where: { userId: req.user.id },
        select: { accountUserId: true, firstName: true, lastName: true }
      });
      const ids = childRows.map((c) => c.accountUserId).filter(Boolean);
      where.userId = { in: [...ids, req.user.id] };
      const subs = await prisma.subscription.findMany({
        where,
        include: {
          user: { select: { id: true, firstName: true, lastName: true, role: true } },
          paymentIntents: { where: { status: 'PENDING', metadata: { path: ['kind'], equals: 'RENEWAL' } }, take: 1 }
        },
        orderBy: { endDate: 'asc' }
      });
      res.json(
        subs.map((s) => ({
          ...s,
          childName: childRows.find((c) => c.accountUserId === s.userId)?.firstName || null
        }))
      );
    } else {
      where.userId = req.user.id;
      const subs = await prisma.subscription.findMany({
        where,
        include: {
          user: { select: { id: true, firstName: true, lastName: true, role: true } },
          paymentIntents: { where: { status: 'PENDING', metadata: { path: ['kind'], equals: 'RENEWAL' } }, take: 1 }
        },
        orderBy: { endDate: 'asc' }
      });
      res.json(subs);
    }
  })
);

/**
 * @swagger
 * /api/payments/subscriptions/{id}/cancel-renewal:
 *   post:
 *     summary: إلغاء التجديد التلقائي لاشتراك
 *     tags: [payments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: أُلغي التجديد التلقائي }
 *       403: { description: لا صلاحية }
 *       404: { description: الاشتراك غير موجود }
 */
router.post(
  '/subscriptions/:id/cancel-renewal',
  authMiddleware,
  validateParams(paymentIntentIdSchema),
  asyncHandler(async (req, res) => {
    const sub = await cancelAutoRenewal(req.params.id, req.user.id, req.user.role);
    await audit({
      actorId: req.user.id,
      actorRole: req.user.role,
      action: 'SUBSCRIPTION_AUTO_RENEWAL_CANCELED',
      resource: 'Subscription',
      resourceId: sub.id,
      ...requestContext(req)
    });
    res.json(sub);
  })
);

/**
 * @swagger
 * /api/payments/subscriptions/{id}/enable-renewal:
 *   post:
 *     summary: إعادة تفعيل التجديد التلقائي لاشتراك
 *     tags: [payments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: فُعّل التجديد التلقائي }
 */
router.post(
  '/subscriptions/:id/enable-renewal',
  authMiddleware,
  validateParams(paymentIntentIdSchema),
  asyncHandler(async (req, res) => {
    const sub = await enableAutoRenewal(req.params.id, req.user.id, req.user.role);
    await audit({
      actorId: req.user.id,
      actorRole: req.user.role,
      action: 'SUBSCRIPTION_AUTO_RENEWAL_ENABLED',
      resource: 'Subscription',
      resourceId: sub.id,
      ...requestContext(req)
    });
    res.json(sub);
  })
);

/**
 * @swagger
 * /api/payments/invoices/mine:
 *   get:
 *     summary: فواتير المستخدم (أو فواتير أبنائه)
 *     tags: [payments]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200: { description: قائمة الفواتير }
 */
router.get(
  '/invoices/mine',
  authMiddleware,
  asyncHandler(async (req, res) => {
    const ownSubIds = await prisma.subscription
      .findMany({ where: { userId: req.user.id }, select: { id: true } })
      .then((rows) => rows.map((r) => r.id));
    let childSubIds = [];
    if (req.user.role === 'PARENT') {
      const childRows = await prisma.student.findMany({
        where: { userId: req.user.id },
        select: { accountUserId: true }
      });
      const ids = childRows.map((c) => c.accountUserId).filter(Boolean);
      if (ids.length) {
        childSubIds = await prisma.subscription
          .findMany({ where: { userId: { in: ids } }, select: { id: true } })
          .then((rows) => rows.map((r) => r.id));
      }
    }
    const invoices = await prisma.invoice.findMany({
      where: { subscriptionId: { in: [...ownSubIds, ...childSubIds] } },
      include: {
        subscription: {
          include: { user: { select: { id: true, firstName: true, lastName: true, role: true } } }
        },
        payment: true
      },
      orderBy: { issuedAt: 'desc' }
    });
    res.json(invoices);
  })
);

/**
 * @swagger
 * /api/payments/invoices/{id}:
 *   get:
 *     summary: تفاصيل فاتورة
 *     tags: [payments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: الفاتورة }
 *       404: { description: غير موجودة }
 */
router.get(
  '/invoices/:id',
  authMiddleware,
  validateParams(paymentIntentIdSchema),
  asyncHandler(async (req, res) => {
    const invoice = await getInvoiceWithRelations(req.params.id);
    if (!invoice) throw new ApiError(404, 'الفاتورة غير موجودة');
    if (!(await canAccessInvoice(req, invoice))) {
      throw new ApiError(403, 'لا تملك صلاحية الاطلاع على هذه الفاتورة');
    }
    res.json(invoice);
  })
);

/**
 * @swagger
 * /api/payments/invoices/{id}/pdf:
 *   get:
 *     summary: تحميل الفاتورة PDF
 *     tags: [payments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: ملف PDF }
 *       404: { description: الفاتورة غير موجودة }
 */
router.get(
  '/invoices/:id/pdf',
  authMiddleware,
  validateParams(paymentIntentIdSchema),
  asyncHandler(async (req, res) => {
    const invoice = await getInvoiceWithRelations(req.params.id);
    if (!invoice) throw new ApiError(404, 'الفاتورة غير موجودة');
    if (!(await canAccessInvoice(req, invoice))) {
      throw new ApiError(403, 'لا تملك صلاحية تحميل هذه الفاتورة');
    }
    const buffer = await buildInvoicePdf(invoice);
    setAttachment(res, `${invoice.invoiceNumber || 'invoice'}.pdf`, 'application/pdf', buffer);
  })
);

/**
 * @swagger
 * /api/payments/demo-checkout/{intentId}:
 *   get:
 *     summary: صفحة دفع تجريبية (مزود DEMO)
 *     tags: [payments]
 *     parameters:
 *       - in: path
 *         name: intentId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: صفحة HTML }
 *       404: { description: غير موجودة }
 */
router.get(
  '/demo-checkout/:intentId',
  asyncHandler(async (req, res) => {
    if (config.nodeEnv === 'production' && !config.payment.allowDemoPayments) {
      throw new ApiError(404, 'صفحة الدفع غير موجودة');
    }
    const intentId = Number(req.params.intentId);
    if (!verifyDemoCheckoutToken(intentId, req.query.t)) {
      throw new ApiError(403, 'رابط الدفع غير صالح أو منتهي الصلاحية');
    }
    const intent = await prisma.paymentIntent.findUnique({
      where: { id: intentId },
      include: { subscription: { include: { user: { select: { firstName: true, lastName: true, email: true } } } } }
    });
    if (!intent || intent.provider !== 'DEMO') throw new ApiError(404, 'صفحة الدفع غير موجودة');
    res.type('html').send(renderDemoCheckoutPage(intent));
  })
);

// ==================== إداري ====================

/**
 * @swagger
 * /api/payments/admin/intents:
 *   get:
 *     summary: كل عمليات الدفع (إداري/نظامي)
 *     tags: [payments]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200: { description: قائمة العمليات }
 */
router.get(
  '/admin/intents',
  authMiddleware,
  requireRole('ADMIN', 'SUPER_ADMIN'),
  asyncHandler(async (_req, res) => {
    const intents = await prisma.paymentIntent.findMany({
      include: {
        subscription: { select: { id: true, plan: true, schoolYear: true, amount: true } },
        user: { select: { id: true, firstName: true, lastName: true, email: true, role: true } }
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(intents);
  })
);

/**
 * @swagger
 * /api/payments/admin/audit-logs:
 *   get:
 *     summary: سجلات التدقيق الأمني (إداري/نظامي)
 *     tags: [payments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: action
 *         schema: { type: string }
 *       - in: query
 *         name: page
 *         schema: { type: integer }
 *       - in: query
 *         name: pageSize
 *         schema: { type: integer }
 *     responses:
 *       200: { description: قائمة السجلات }
 */
router.get(
  '/admin/audit-logs',
  authMiddleware,
  requireRole('ADMIN', 'SUPER_ADMIN'),
  validateQuery(auditLogsQuerySchema),
  asyncHandler(async (req, res) => {
    const { action, page, pageSize } = req.query;
    const where = action ? { action: String(action) } : {};
    const [total, logs] = await Promise.all([
      prisma.auditLog.count({ where }),
      prisma.auditLog.findMany({
        where,
        include: { actor: { select: { id: true, firstName: true, lastName: true, email: true, role: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize
      })
    ]);
    res.json({ total, page, pageSize, logs });
  })
);

/**
 * @swagger
 * /api/payments/admin/invoices:
 *   get:
 *     summary: كل الفواتير (إداري/نظامي)
 *     tags: [payments]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200: { description: قائمة الفواتير }
 */
router.get(
  '/admin/invoices',
  authMiddleware,
  requireRole('ADMIN', 'SUPER_ADMIN'),
  asyncHandler(async (_req, res) => {
    const invoices = await prisma.invoice.findMany({
      include: INVOICE_INCLUDE,
      orderBy: { issuedAt: 'desc' }
    });
    res.json(invoices);
  })
);

/**
 * @swagger
 * /api/payments/admin/discounts:
 *   get:
 *     summary: قائمة أكواد التخفيض/المنح الدراسية (إداري/نظامي)
 *     tags: [payments]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200: { description: قائمة الأكواد }
 */
router.get(
  '/admin/discounts',
  authMiddleware,
  requireRole('ADMIN', 'SUPER_ADMIN'),
  asyncHandler(async (_req, res) => {
    const discounts = await prisma.discountCode.findMany({
      include: { creator: { select: { id: true, firstName: true, lastName: true } } },
      orderBy: { createdAt: 'desc' }
    });
    res.json(discounts);
  })
);

/**
 * @swagger
 * /api/payments/admin/discounts:
 *   post:
 *     summary: إنشاء كود تخفيض/منحة دراسية (إداري/نظامي)
 *     tags: [payments]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [code, value]
 *             properties:
 *               code: { type: string }
 *               type: { type: string, enum: [PERCENTAGE, AMOUNT] }
 *               value: { type: number }
 *               description: { type: string }
 *               usageLimit: { type: integer }
 *               expiresAt: { type: string, format: date }
 *     responses:
 *       201: { description: تم إنشاء الكود }
 */
router.post(
  '/admin/discounts',
  authMiddleware,
  requireRole('ADMIN', 'SUPER_ADMIN'),
  validateBody(discountCodeSchema),
  asyncHandler(async (req, res) => {
    const { code, type, value, description, usageLimit, expiresAt } = req.body;
    const normalized = String(code).trim().toUpperCase();
    const existing = await prisma.discountCode.findUnique({ where: { code: normalized } });
    if (existing) throw new ApiError(400, 'كود تخفيض بهذا الاسم موجود مسبقا');

    const dc = await prisma.discountCode.create({
      data: {
        code: normalized,
        type,
        value: Number(value),
        description: description || null,
        usageLimit: usageLimit != null ? Number(usageLimit) : null,
        expiresAt: expiresAt ? new Date(`${expiresAt}T23:59:59`) : null,
        createdBy: req.user.id
      },
      include: { creator: { select: { id: true, firstName: true, lastName: true } } }
    });
    await audit({
      actorId: req.user.id,
      actorRole: req.user.role,
      action: 'DISCOUNT_CODE_CREATED',
      resource: 'DiscountCode',
      resourceId: dc.id,
      ...requestContext(req),
      metadata: { code: dc.code, type: dc.type, value: dc.value }
    });
    res.status(201).json(dc);
  })
);

/**
 * @swagger
 * /api/payments/admin/discounts/{id}:
 *   patch:
 *     summary: تعديل كود تخفيض (الوصف/الحد/الصلاحية)
 *     tags: [payments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: تم التعديل }
 */
router.patch(
  '/admin/discounts/:id',
  authMiddleware,
  requireRole('ADMIN', 'SUPER_ADMIN'),
  validateParams(paymentIntentIdSchema),
  validateBody(discountUpdateSchema),
  asyncHandler(async (req, res) => {
    const existing = await prisma.discountCode.findUnique({ where: { id: req.params.id } });
    if (!existing) throw new ApiError(404, 'كود التخفيض غير موجود');
    const { description, usageLimit, expiresAt } = req.body;
    const data = {};
    if (description !== undefined) data.description = description;
    if (usageLimit !== undefined) data.usageLimit = usageLimit != null ? Number(usageLimit) : null;
    if (expiresAt !== undefined) data.expiresAt = expiresAt ? new Date(`${expiresAt}T23:59:59`) : null;
    const dc = await prisma.discountCode.update({ where: { id: existing.id }, data });
    res.json(dc);
  })
);

/**
 * @swagger
 * /api/payments/admin/discounts/{id}/deactivate:
 *   post:
 *     summary: تعطيل كود تخفيض
 *     tags: [payments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: عُطّل الكود }
 */
router.post(
  '/admin/discounts/:id/deactivate',
  authMiddleware,
  requireRole('ADMIN', 'SUPER_ADMIN'),
  validateParams(paymentIntentIdSchema),
  asyncHandler(async (req, res) => {
    const existing = await prisma.discountCode.findUnique({ where: { id: req.params.id } });
    if (!existing) throw new ApiError(404, 'كود التخفيض غير موجود');
    const dc = await prisma.discountCode.update({ where: { id: existing.id }, data: { active: false } });
    await audit({
      actorId: req.user.id,
      actorRole: req.user.role,
      action: 'DISCOUNT_CODE_DEACTIVATED',
      resource: 'DiscountCode',
      resourceId: dc.id,
      ...requestContext(req)
    });
    res.json(dc);
  })
);

/**
 * @swagger
 * /api/payments/admin/jobs/run-renewal:
 *   post:
 *     summary: تشغيل فحص التجديد التلقائي يدويا (إداري/نظامي)
 *     tags: [payments]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200: { description: قائمة نوايا التجديد المنشأة }
 */
router.post(
  '/admin/jobs/run-renewal',
  authMiddleware,
  requireRole('ADMIN', 'SUPER_ADMIN'),
  asyncHandler(async (req, res) => {
    const created = await runRenewalSweep({ now: req.body?.now ? new Date(req.body.now) : new Date() });
    await audit({
      actorId: req.user.id,
      actorRole: req.user.role,
      action: 'RENEWAL_SWEEP_RUN',
      resource: 'PaymentIntent',
      ...requestContext(req),
      metadata: { created: created.length }
    });
    res.json({ ok: true, created: created.length, intentIds: created });
  })
);

function escHtml(v) {
  return String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderConfirmPage(outcome, intentId) {
  const isSuccess = outcome === 'success';
  const icon = isSuccess ? '✅' : '↩️';
  const title = isSuccess ? 'تم استلام الدفعة بنجاح' : 'أُلغيت عملية الدفع';
  const body = isSuccess
    ? 'سيُفعَّل اشتراكك تلقائيا فور تأكيد بوابة الدفع، ويعلمك إشعار فوري بذلك.'
    : 'لم تُسجَّل أي دفعة. يمكنك إعادة المحاولة من مركز الدفع في أي وقت.';
  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>${title}</title>
  <style>
    body{font-family:'Segoe UI',Tahoma,Arial,sans-serif;background:#f1f5f9;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;direction:rtl}
    .card{background:#fff;border-radius:16px;box-shadow:0 10px 30px rgba(0,0,0,.08);padding:40px;max-width:440px;text-align:center}
    .icon{font-size:52px}.title{font-size:22px;font-weight:800;color:#1e293b;margin:14px 0 8px}
    .body{color:#64748b;line-height:1.8}
    .btn{display:inline-block;margin-top:20px;background:#4f46e5;color:#fff;padding:10px 22px;border-radius:10px;text-decoration:none;font-weight:700}
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">${icon}</div>
    <div class="title">${title}</div>
    <div class="body">${body}</div>
    <a class="btn" href="${intentId ? `/api/payments/demo-checkout/${intentId}?t=${encodeURIComponent(demoCheckoutToken(intentId))}` : '/login'}">العودة</a>
  </div>
</body>
</html>`;
}

function renderDemoCheckoutPage(intent) {
  const sub = intent.subscription;
  const owner = sub?.user || {};
  const ownerName = escHtml([owner.firstName, owner.lastName].filter(Boolean).join(' '));
  const amount = `${intent.amount} ${intent.currency === 'TND' ? 'د.ت' : escHtml(intent.currency)}`;
  const plan = escHtml(sub?.plan || 'اشتراك المنصة');
  const schoolYear = escHtml(sub?.schoolYear || '');
  const providerRef = escHtml(intent.providerReference || '—');
  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>صفحة دفع تجريبية — ${plan}</title>
  <style>
    *{box-sizing:border-box}
    body{font-family:'Segoe UI',Tahoma,Arial,sans-serif;background:#eef2ff;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;padding:16px;direction:rtl}
    .card{background:#fff;border-radius:18px;box-shadow:0 12px 34px rgba(79,70,229,.15);padding:36px;max-width:460px;width:100%;text-align:center}
    .badge{display:inline-block;background:#ecfdf5;color:#047857;font-size:12px;font-weight:800;padding:5px 12px;border-radius:999px;margin-bottom:14px}
    h1{font-size:22px;color:#1e293b;margin:0 0 6px}
    .plan{color:#64748b;font-size:15px;margin:0 0 18px}
    .price{font-size:34px;font-weight:900;color:#4f46e5;margin:0 0 4px}
    .meta{color:#94a3b8;font-size:13px;margin:0 0 24px}
    .sub {background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:14px;margin-bottom:20px;text-align:right;font-size:14px;color:#475569;line-height:1.9}
    .btn{display:block;width:100%;padding:13px;border:none;border-radius:12px;font-size:16px;font-weight:800;cursor:pointer;margin-bottom:10px;transition:.15s}
    .btn:disabled{opacity:.6;cursor:wait}
    .btn-success{background:#059669;color:#fff}
    .btn-success:hover{background:#047857}
    .btn-fail{background:#e11d48;color:#fff}
    .btn-fail:hover{background:#be123c}
    .btn-cancel{background:#f1f5f9;color:#334155}
    .btn-cancel:hover{background:#e2e8f0}
    .hint{font-size:12px;color:#94a3b8;margin-top:14px;line-height:1.8}
    .note{background:#fef3c7;color:#92400e;font-size:12px;padding:10px;border-radius:10px;margin-bottom:16px}
  </style>
</head>
<body>
  <div class="card">
    <span class="badge">وضع اختبار — Sandbox</span>
    <h1>${plan}</h1>
    <p class="plan">${ownerName}${schoolYear ? ' · ' + schoolYear : ''}</p>
    <div class="price">${amount}</div>
    <p class="meta">مرجع العملية: ${providerRef}</p>
    <div class="sub">هذه صفحة <b>المزود التجريبي DEMO</b> التي تحاكي بوابة الدفع. اختر نتيجة لاختبار كيف تتعامل المنصة مع كل حالة (نجاح / فشل / إلغاء).</div>
    <button class="btn btn-success" data-result="success">إتمام الدفع بنجاح</button>
    <button class="btn btn-fail" data-result="failure">محاكاة فشل الدفع</button>
    <button class="btn btn-cancel" data-result="cancel">إلغاء العملية</button>
    <p class="hint">بعد إتمام الدفع يُفعَّل الاشتراك فورا ويُرسل إشعار، تماما كما تفعل بوابة حقيقية عبر Webhook.</p>
  </div>
  <script>
    document.querySelectorAll('.btn[data-result]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const result = btn.dataset.result;
        const buttons = document.querySelectorAll('.btn[data-result]');
        buttons.forEach((b) => (b.disabled = true));
        try {
          const token = localStorage.getItem('school_token');
          const res = await fetch('/api/payments/demo-checkout/${intent.id}/result', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
            body: JSON.stringify({ result })
          });
          const data = await res.json();
          if (!res.ok) {
            throw new Error(data.error || 'فشل معالجة النتيجة');
          }
          if (data.status === 'SUCCEEDED') {
            document.body.innerHTML = '<div class="card" style="text-align:center"><div style="font-size:52px">✅</div><h1>تم الدفع بنجاح</h1><p style="color:#64748b">تم تفعيل اشتراكك. يمكنك العودة إلى المنصة الآن.</p><a style="display:inline-block;margin-top:16px;background:#4f46e5;color:#fff;padding:10px 22px;border-radius:10px;text-decoration:none;font-weight:700" href="/">العودة إلى المنصة</a></div>';
          } else if (data.status === 'FAILED') {
            document.body.innerHTML = '<div class="card" style="text-align:center"><div style="font-size:52px">⚠️</div><h1>فشلت العملية</h1><p style="color:#64748b">لم تُسجَّل أي دفعة. أعد المحاولة من مركز الدفع.</p><a style="display:inline-block;margin-top:16px;background:#4f46e5;color:#fff;padding:10px 22px;border-radius:10px;text-decoration:none;font-weight:700" href="/">العودة إلى المنصة</a></div>';
          } else {
            document.body.innerHTML = '<div class="card" style="text-align:center"><div style="font-size:52px">↩️</div><h1>أُلغيت العملية</h1><p style="color:#64748b">يمكنك إعادة المحاولة متى شئت.</p><a style="display:inline-block;margin-top:16px;background:#4f46e5;color:#fff;padding:10px 22px;border-radius:10px;text-decoration:none;font-weight:700" href="/">العودة إلى المنصة</a></div>';
          }
        } catch (err) {
          alert('حدث خطأ أثناء معالجة الطلب');
          buttons.forEach((b) => (b.disabled = false));
        }
      });
    });
  </script>
</body>
</html>`;
}

export default router;
