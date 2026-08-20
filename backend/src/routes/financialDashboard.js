import { Router } from 'express';
import prisma from '../db.js';
import { authMiddleware, requireRole } from '../auth.js';
import { validateBody, validateParams, validateQuery } from '../middleware/validate.js';
import { ApiError, asyncHandler } from '../middleware/errorHandler.js';
import { audit, requestContext } from '../services/auditService.js';
import {
  buildFinancialOverview,
  buildFinancialReport,
  buildReconciliation,
  buildReportPdf,
  buildReportCsv
} from '../services/financialReportService.js';
import { detectAnomalies, listAnomalies, resolveAnomaly, refundInvoice } from '../services/anomalyService.js';
import { setAttachment } from '../services/exportService.js';
import {
  financePeriodQuerySchema,
  anomalyQuerySchema,
  anomalyResolveSchema,
  refundSchema,
  financeIdParamSchema
} from '../validators/finance.js';

const router = Router();

router.use(authMiddleware, requireRole('ADMIN', 'SUPER_ADMIN'));

/**
 * @swagger
 * /api/admin/finance/overview:
 *   get:
 *     summary: نظرة عامة مالية (إداري/نظامي)
 *     tags: [finance]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: from
 *         schema: { type: string, format: date }
 *       - in: query
 *         name: to
 *         schema: { type: string, format: date }
 *       - in: query
 *         name: schoolYear
 *         schema: { type: string }
 *     responses:
 *       200: { description: الملخص المالي والتفصيل }
 */
router.get(
  '/overview',
  validateQuery(financePeriodQuerySchema),
  asyncHandler(async (req, res) => {
    const data = await buildFinancialOverview(req.query);
    res.json(data);
  })
);

/**
 * @swagger
 * /api/admin/finance/reports:
 *   get:
 *     summary: بيانات التقرير المالي الكامل
 *     tags: [finance]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: from
 *         schema: { type: string, format: date }
 *       - in: query
 *         name: to
 *         schema: { type: string, format: date }
 *       - in: query
 *         name: schoolYear
 *         schema: { type: string }
 *     responses:
 *       200: { description: التقرير المالي }
 */
router.get(
  '/reports',
  validateQuery(financePeriodQuerySchema),
  asyncHandler(async (req, res) => {
    const report = await buildFinancialReport(req.query);
    await audit({
      actorId: req.user.id,
      actorRole: req.user.role,
      action: 'FINANCE_REPORT_VIEWED',
      resource: 'FinanceReport',
      ...requestContext(req),
      metadata: { period: report.period.label }
    });
    res.json(report);
  })
);

/**
 * @swagger
 * /api/admin/finance/reports/pdf:
 *   get:
 *     summary: تصدير التقرير المالي PDF
 *     tags: [finance]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: from
 *         schema: { type: string, format: date }
 *       - in: query
 *         name: to
 *         schema: { type: string, format: date }
 *       - in: query
 *         name: schoolYear
 *         schema: { type: string }
 *     responses:
 *       200: { description: ملف PDF }
 */
router.get(
  '/reports/pdf',
  validateQuery(financePeriodQuerySchema),
  asyncHandler(async (req, res) => {
    const report = await buildFinancialReport(req.query);
    const buffer = await buildReportPdf(report);
    await audit({
      actorId: req.user.id,
      actorRole: req.user.role,
      action: 'FINANCE_REPORT_EXPORTED',
      resource: 'FinanceReport',
      ...requestContext(req),
      metadata: { format: 'PDF', period: report.period.label }
    });
    const slug = req.query.schoolYear || `${req.query.from || 'all'}_${req.query.to || ''}`;
    setAttachment(res, `financial-report-${slug}.pdf`, 'application/pdf', buffer);
  })
);

/**
 * @swagger
 * /api/admin/finance/reports/csv:
 *   get:
 *     summary: تصدير التقرير المالي CSV
 *     tags: [finance]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: from
 *         schema: { type: string, format: date }
 *       - in: query
 *         name: to
 *         schema: { type: string, format: date }
 *       - in: query
 *         name: schoolYear
 *         schema: { type: string }
 *     responses:
 *       200: { description: ملف CSV }
 */
router.get(
  '/reports/csv',
  validateQuery(financePeriodQuerySchema),
  asyncHandler(async (req, res) => {
    const report = await buildFinancialReport(req.query);
    const csv = buildReportCsv(report);
    await audit({
      actorId: req.user.id,
      actorRole: req.user.role,
      action: 'FINANCE_REPORT_EXPORTED',
      resource: 'FinanceReport',
      ...requestContext(req),
      metadata: { format: 'CSV', period: report.period.label }
    });
    const slug = req.query.schoolYear || `${req.query.from || 'all'}_${req.query.to || ''}`;
    setAttachment(res, `financial-report-${slug}.csv`, 'text/csv; charset=utf-8', Buffer.from(csv, 'utf8'));
  })
);

/**
 * @swagger
 * /api/admin/finance/reconciliation:
 *   get:
 *     summary: تسوية مالية (مطابقة العمليات والفواتير والنوايا)
 *     tags: [finance]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200: { description: نتائج التسوية والفروقات }
 */
router.get(
  '/reconciliation',
  asyncHandler(async (_req, res) => {
    const data = await buildReconciliation();
    res.json(data);
  })
);

/**
 * @swagger
 * /api/admin/finance/refunds:
 *   get:
 *     summary: قائمة الإرجاعات
 *     tags: [finance]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200: { description: قائمة الإرجاعات }
 */
router.get(
  '/refunds',
  asyncHandler(async (_req, res) => {
    const refunds = await prisma.refund.findMany({
      include: {
        invoice: { select: { invoiceNumber: true } },
        subscription: { select: { id: true, plan: true, schoolYear: true, user: { select: { firstName: true, lastName: true, email: true } } } },
        refundedByUser: { select: { id: true, firstName: true, lastName: true, email: true } }
      },
      orderBy: { refundedAt: 'desc' }
    });
    res.json(refunds);
  })
);

/**
 * @swagger
 * /api/admin/finance/invoices/{id}/refund:
 *   post:
 *     summary: إرجاع فاتورة (Refund) مع تسجيل سجل تدقيق
 *     tags: [finance]
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
 *               reason: { type: string }
 *     responses:
 *       200: { description: تم الإرجاع }
 *       400: { description: الفاتورة مُرجَعة مسبقا }
 *       404: { description: الفاتورة غير موجودة }
 */
router.post(
  '/invoices/:id/refund',
  validateParams(financeIdParamSchema),
  validateBody(refundSchema),
  asyncHandler(async (req, res) => {
    let result;
    try {
      result = await refundInvoice({ invoiceId: req.params.id, reason: req.body.reason, actorId: req.user.id });
    } catch (err) {
      if (err.message === 'الفاتورة غير موجودة') throw new ApiError(404, err.message);
      if (err.message === 'هذه الفاتورة مُرجَعة مسبقا') throw new ApiError(400, err.message);
      throw err;
    }
    await audit({
      actorId: req.user.id,
      actorRole: req.user.role,
      action: 'INVOICE_REFUNDED',
      resource: 'Invoice',
      resourceId: result.invoice.id,
      ...requestContext(req),
      metadata: {
        invoiceNumber: result.invoice.invoiceNumber,
        amount: result.refund.amount,
        reason: req.body.reason || null
      }
    });
    await detectAnomalies();
    res.json(result);
  })
);

/**
 * @swagger
 * /api/admin/finance/anomalies:
 *   get:
 *     summary: قائمة الشذوذات المالية
 *     tags: [finance]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [OPEN, RESOLVED, IGNORED, ALL] }
 *       - in: query
 *         name: type
 *         schema: { type: string }
 *       - in: query
 *         name: page
 *         schema: { type: integer }
 *       - in: query
 *         name: pageSize
 *         schema: { type: integer }
 *     responses:
 *       200: { description: قائمة الشذوذات }
 */
router.get(
  '/anomalies',
  validateQuery(anomalyQuerySchema),
  asyncHandler(async (req, res) => {
    const data = await listAnomalies(req.query);
    res.json(data);
  })
);

/**
 * @swagger
 * /api/admin/finance/anomalies/detect:
 *   post:
 *     summary: تشغيل كشف الشذوذ يدويا
 *     tags: [finance]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200: { description: الشذوذات المكتشفة }
 */
router.post(
  '/anomalies/detect',
  asyncHandler(async (req, res) => {
    const created = await detectAnomalies();
    await audit({
      actorId: req.user.id,
      actorRole: req.user.role,
      action: 'ANOMALY_DETECT_RUN',
      resource: 'FinancialAnomaly',
      ...requestContext(req),
      metadata: { created: created.length }
    });
    res.json({ ok: true, created: created.length, anomalies: created });
  })
);

/**
 * @swagger
 * /api/admin/finance/anomalies/{id}/resolve:
 *   post:
 *     summary: معالجة/تجاهل شذوذ مالي
 *     tags: [finance]
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
 *               status: { type: string, enum: [RESOLVED, IGNORED] }
 *               resolution: { type: string }
 *     responses:
 *       200: { description: تمت المعالجة }
 *       404: { description: الشذوذ غير موجود }
 */
router.post(
  '/anomalies/:id/resolve',
  validateParams(financeIdParamSchema),
  validateBody(anomalyResolveSchema),
  asyncHandler(async (req, res) => {
    const anomaly = await resolveAnomaly(req.params.id, req.user.id, req.body);
    if (!anomaly) throw new ApiError(404, 'الشذوذ المالي غير موجود');
    await audit({
      actorId: req.user.id,
      actorRole: req.user.role,
      action: 'ANOMALY_RESOLVED',
      resource: 'FinancialAnomaly',
      resourceId: anomaly.id,
      ...requestContext(req),
      metadata: { status: anomaly.status, type: anomaly.type }
    });
    res.json(anomaly);
  })
);

export default router;
