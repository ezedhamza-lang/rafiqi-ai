import prisma from '../db.js';

const SEVERITY_RANK = { LOW: 1, MEDIUM: 2, HIGH: 3, CRITICAL: 4 };

export const ANOMALY_TYPES = {
  REPEATED_REFUND: 'REPEATED_REFUND',
  REPEATED_FAILED_PAYMENT: 'REPEATED_FAILED_PAYMENT',
  MULTIPLE_PENDING_INTENTS: 'MULTIPLE_PENDING_INTENTS',
  OVERUSED_DISCOUNT: 'OVERUSED_DISCOUNT',
  FREE_INVOICE: 'FREE_INVOICE',
  SUCCEEDED_WITHOUT_INVOICE: 'SUCCEEDED_WITHOUT_INVOICE',
  INVOICE_AMOUNT_MISMATCH: 'INVOICE_AMOUNT_MISMATCH',
  PROVIDER_FAILURE_RATE: 'PROVIDER_FAILURE_RATE',
  UNKNOWN_WEBHOOK_SURGE: 'UNKNOWN_WEBHOOK_SURGE'
};

async function upsertAnomaly({ key, type, severity, title, description, subjectType = null, subjectId = null, metadata = null }) {
  const existing = await prisma.financialAnomaly.findUnique({ where: { key } });
  if (existing) return null;
  return prisma.financialAnomaly.create({
    data: { key, type, severity, title, description, subjectType, subjectId, metadata }
  });
}

async function detectRepeatedRefunds(now) {
  const since = new Date(now.getTime() - 90 * 86400000);
  const rows = await prisma.refund.groupBy({
    by: ['subscriptionId'],
    _count: true,
    where: { refundedAt: { gte: since } },
    having: { subscriptionId: { _count: { gte: 2 } } }
  });
  const created = [];
  for (const row of rows) {
    const refunds = await prisma.refund.findMany({
      where: { subscriptionId: row.subscriptionId, refundedAt: { gte: since } },
      orderBy: { refundedAt: 'desc' },
      take: 10
    });
    const total = refunds.reduce((acc, r) => acc + Number(r.amount), 0);
    const a = await upsertAnomaly({
      key: `REPEATED_REFUND-${row.subscriptionId}`,
      type: ANOMALY_TYPES.REPEATED_REFUND,
      severity: 'HIGH',
      title: 'إرجاعات متكررة على نفس الاشتراك',
      description: `تم تسجيل ${row._count} عملية إرجاع على نفس الاشتراك خلال آخر 90 يوما (إجمالي ${total} د.ت). قد تدل على استغلال أو خطأ في المعالجة.`,
      subjectType: 'Subscription',
      subjectId: row.subscriptionId,
      metadata: { count: row._count, total, since }
    });
    if (a) created.push(a);
  }
  return created;
}

async function detectRepeatedFailedPayments(now) {
  const since = new Date(now.getTime() - 30 * 86400000);
  const rows = await prisma.paymentIntent.groupBy({
    by: ['subscriptionId'],
    _count: true,
    where: { status: 'FAILED', createdAt: { gte: since } },
    having: { subscriptionId: { _count: { gte: 3 } } }
  });
  const created = [];
  for (const row of rows) {
    const a = await upsertAnomaly({
      key: `REPEATED_FAILED_PAYMENT-${row.subscriptionId}`,
      type: ANOMALY_TYPES.REPEATED_FAILED_PAYMENT,
      severity: 'MEDIUM',
      title: 'محاولات دفع فاشلة متكررة',
      description: `سُجّلت ${row._count} محاولات دفع فاشلة على نفس الاشتراك خلال آخر 30 يوما.`,
      subjectType: 'Subscription',
      subjectId: row.subscriptionId,
      metadata: { count: row._count, since }
    });
    if (a) created.push(a);
  }
  return created;
}

async function detectMultiplePendingIntents() {
  const rows = await prisma.paymentIntent.groupBy({
    by: ['subscriptionId'],
    _count: true,
    where: { status: 'PENDING' },
    having: { subscriptionId: { _count: { gt: 2 } } }
  });
  const created = [];
  for (const row of rows) {
    const a = await upsertAnomaly({
      key: `MULTIPLE_PENDING_INTENTS-${row.subscriptionId}`,
      type: ANOMALY_TYPES.MULTIPLE_PENDING_INTENTS,
      severity: 'LOW',
      title: 'عمليات دفع معلقة متعددة',
      description: `يوجد ${row._count} عمليات دفع معلّقة على نفس الاشتراك دون إتمام.`,
      subjectType: 'Subscription',
      subjectId: row.subscriptionId,
      metadata: { count: row._count }
    });
    if (a) created.push(a);
  }
  return created;
}

async function detectOverusedDiscounts(now) {
  const since = new Date(now.getTime() - 24 * 3600000);
  const rows = await prisma.invoice.groupBy({
    by: ['discountCode'],
    _count: true,
    where: { discountCode: { not: null }, issuedAt: { gte: since } },
    having: { discountCode: { _count: { gte: 5 } } }
  });
  const created = [];
  for (const row of rows) {
    if (!row.discountCode) continue;
    const a = await upsertAnomaly({
      key: `OVERUSED_DISCOUNT-${row.discountCode}`,
      type: ANOMALY_TYPES.OVERUSED_DISCOUNT,
      severity: 'MEDIUM',
      title: 'استعمال كثيف لكود تخفيض',
      description: `كود ${row.discountCode} استُعمل ${row._count} مرات خلال آخر 24 ساعة. راجع توزيع المنح الدراسية.`,
      subjectType: 'DiscountCode',
      metadata: { code: row.discountCode, count: row._count, since }
    });
    if (a) created.push(a);
  }
  return created;
}

async function detectFreeInvoices(now) {
  const since = new Date(now.getTime() - 30 * 86400000);
  const invoices = await prisma.invoice.findMany({
    where: { total: { lte: 0 }, issuedAt: { gte: since } },
    take: 50
  });
  const created = [];
  for (const inv of invoices) {
    const a = await upsertAnomaly({
      key: `FREE_INVOICE-${inv.id}`,
      type: ANOMALY_TYPES.FREE_INVOICE,
      severity: 'LOW',
      title: 'فاتورة بقيمة صفرية (منحة كاملة)',
      description: `الفاتورة ${inv.invoiceNumber || `#${inv.id}`} صدرت بقيمة 0 د.ت${inv.discountCode ? ` عبر كود ${inv.discountCode}` : ''}. تحقق من صحة المنحة.`,
      subjectType: 'Invoice',
      subjectId: inv.id,
      metadata: { invoiceNumber: inv.invoiceNumber, discountCode: inv.discountCode }
    });
    if (a) created.push(a);
  }
  return created;
}

async function detectSucceededWithoutInvoice() {
  const intents = await prisma.paymentIntent.findMany({
    where: { status: 'SUCCEEDED', providerReference: { not: null } }
  });
  const references = intents.map((i) => i.providerReference);
  const payments = await prisma.payment.findMany({
    where: { reference: { in: references } },
    include: { invoice: true }
  });
  const paidMap = new Map(payments.map((p) => [p.reference, p]));
  const created = [];
  for (const intent of intents) {
    const payment = paidMap.get(intent.providerReference);
    const hasInvoice = Boolean(payment?.invoice);
    if (!hasInvoice) {
      const a = await upsertAnomaly({
        key: `SUCCEEDED_WITHOUT_INVOICE-${intent.id}`,
        type: ANOMALY_TYPES.SUCCEEDED_WITHOUT_INVOICE,
        severity: 'HIGH',
        title: 'دفع ناجح دون فاتورة',
        description: `عملية دفع ناجحة (${intent.amount} د.ت) دون فاتورة مقابلة — نقص محتمل في التسوية.`,
        subjectType: 'PaymentIntent',
        subjectId: intent.id,
        metadata: { amount: Number(intent.amount), subscriptionId: intent.subscriptionId }
      });
      if (a) created.push(a);
    }
  }
  return created;
}

async function detectInvoiceMismatches() {
  const invoices = await prisma.invoice.findMany({
    where: { status: 'PAID' },
    include: { payment: true }
  });
  const created = [];
  for (const inv of invoices) {
    if (Math.abs(round2(inv.total) - round2(inv.payment.amount)) > 0.001) {
      const a = await upsertAnomaly({
        key: `INVOICE_AMOUNT_MISMATCH-${inv.id}`,
        type: ANOMALY_TYPES.INVOICE_AMOUNT_MISMATCH,
        severity: 'HIGH',
        title: 'اختلاف بين الفاتورة والدفع',
        description: `الفاتورة ${inv.invoiceNumber || `#${inv.id}`}: المجموع ${inv.total} د.ت بينما الدفعة ${inv.payment.amount} د.ت.`,
        subjectType: 'Invoice',
        subjectId: inv.id,
        metadata: { invoiceNumber: inv.invoiceNumber, invoiceTotal: Number(inv.total), paymentAmount: Number(inv.payment.amount) }
      });
      if (a) created.push(a);
    }
  }
  return created;
}

async function detectProviderFailureRate(now) {
  const since = new Date(now.getTime() - 30 * 86400000);
  const intents = await prisma.paymentIntent.findMany({
    where: { createdAt: { gte: since } },
    select: { provider: true, status: true }
  });
  const stats = new Map();
  for (const intent of intents) {
    const entry = stats.get(intent.provider) || { provider: intent.provider, decided: 0, failed: 0 };
    if (intent.status === 'SUCCEEDED' || intent.status === 'FAILED') {
      entry.decided += 1;
      if (intent.status === 'FAILED') entry.failed += 1;
    }
    stats.set(intent.provider, entry);
  }
  const created = [];
  for (const entry of stats.values()) {
    if (entry.decided >= 5 && entry.failed / entry.decided > 0.5) {
      const rate = Math.round((entry.failed / entry.decided) * 100);
      const a = await upsertAnomaly({
        key: `PROVIDER_FAILURE_RATE-${entry.provider}`,
        type: ANOMALY_TYPES.PROVIDER_FAILURE_RATE,
        severity: 'MEDIUM',
        title: 'نسبة فشل مرتفعة لمزود الدفع',
        description: `المزود ${entry.provider} سجّل ${entry.failed} فشلا من ${entry.decided} عمليات حاسمة (${rate}%) خلال آخر 30 يوما.`,
        subjectType: 'PaymentProvider',
        metadata: { provider: entry.provider, failed: entry.failed, decided: entry.decided, rate }
      });
      if (a) created.push(a);
    }
  }
  return created;
}

async function detectUnknownWebhookSurge(now) {
  const since = new Date(now.getTime() - 24 * 3600000);
  const count = await prisma.auditLog.count({
    where: { action: 'PAYMENT_WEBHOOK_UNKNOWN_INTENT', createdAt: { gte: since } }
  });
  if (count >= 5) {
    const a = await upsertAnomaly({
      key: `UNKNOWN_WEBHOOK_SURGE-${since.getTime()}`,
      type: ANOMALY_TYPES.UNKNOWN_WEBHOOK_SURGE,
      severity: 'HIGH',
      title: 'موجة أحداث Webhook غير معروفة',
      description: `تم استقبال ${count} أحداث Webhook لعملات غير معروفة خلال آخر 24 ساعة. قد تشير إلى محاولة استغلال.`,
      subjectType: 'Webhook',
      metadata: { count, since }
    });
    return a ? [a] : [];
  }
  return [];
}

function round2(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

export async function detectAnomalies({ now = new Date() } = {}) {
  const rules = [
    detectRepeatedRefunds,
    detectRepeatedFailedPayments,
    detectMultiplePendingIntents,
    detectOverusedDiscounts,
    detectFreeInvoices,
    detectSucceededWithoutInvoice,
    detectInvoiceMismatches,
    detectProviderFailureRate,
    detectUnknownWebhookSurge
  ];
  const created = [];
  for (const rule of rules) {
    try {
      const result = await rule(now);
      created.push(...result);
    } catch (err) {
      console.error(`[AnomalyDetect] ${rule.name} failed:`, err.message);
    }
  }
  return created;
}

export async function listAnomalies({ status = 'OPEN', type = null, page = 1, pageSize = 50 } = {}) {
  const where = {};
  if (status && status !== 'ALL') where.status = status;
  if (type) where.type = type;
  const [total, anomalies] = await Promise.all([
    prisma.financialAnomaly.count({ where }),
    prisma.financialAnomaly.findMany({
      where,
      include: { resolver: { select: { id: true, firstName: true, lastName: true, email: true } } },
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
      skip: (page - 1) * pageSize,
      take: pageSize
    })
  ]);
  return { total, page, pageSize, anomalies };
}

export async function resolveAnomaly(id, actorId, { status = 'RESOLVED', resolution = null } = {}) {
  const existing = await prisma.financialAnomaly.findUnique({ where: { id: Number(id) } });
  if (!existing) return null;
  if (!['RESOLVED', 'IGNORED'].includes(status)) {
    throw new TypeError('حالة المعالجة غير صحيحة');
  }
  return prisma.financialAnomaly.update({
    where: { id: existing.id },
    data: { status, resolution: resolution || null, resolvedBy: actorId, resolvedAt: new Date() },
    include: { resolver: { select: { id: true, firstName: true, lastName: true, email: true } } }
  });
}

export async function refundInvoice({ invoiceId, reason = null, actorId }) {
  const invoice = await prisma.invoice.findUnique({
    where: { id: Number(invoiceId) },
    include: { subscription: { select: { id: true, userId: true, plan: true, schoolYear: true } } }
  });
  if (!invoice) throw new Error('الفاتورة غير موجودة');
  if (invoice.status === 'REFUNDED') throw new Error('هذه الفاتورة مُرجَعة مسبقا');

  // ذرّية: فحص الحالة كان خارج المعاملة فيسمح لاستدعاءين متزامنين بإنشاء
  // استرجاعين. المطالبة الآن داخل المعاملة وشرطية على الحالة الحالية —
  // الفائز وحده يُنشئ سجل الاسترجاع (count===0 ⇒ رُجع مسبقاً).
  const [created, updatedInvoice] = await prisma.$transaction(async (tx) => {
    const claim = await tx.invoice.updateMany({
      where: { id: invoice.id, status: { not: 'REFUNDED' } },
      data: { status: 'REFUNDED' }
    });
    if (claim.count === 0) throw new Error('هذه الفاتورة مُرجَعة مسبقا');

    // سقف تراكمي: مجموع الاسترجاعات (بما فيها هذا) لا يتجاوز إجمالي الفاتورة
    const prev = await tx.refund.aggregate({
      where: { invoiceId: invoice.id },
      _sum: { amount: true }
    });
    const alreadyRefunded = Number(prev._sum.amount ?? 0);
    const refundAmount = Number(invoice.total);
    if (alreadyRefunded + refundAmount > Number(invoice.total) + 1e-6) {
      throw new Error('مجموع الاسترجاعات يتجاوز مبلغ الفاتورة المدفوع');
    }

    const rec = await tx.refund.create({
      data: {
        invoiceId: invoice.id,
        paymentId: invoice.paymentId,
        subscriptionId: invoice.subscriptionId,
        amount: invoice.total,
        reason: reason || null,
        refundedBy: actorId
      }
    });
    const inv = await tx.invoice.findUnique({ where: { id: invoice.id } });
    return [rec, inv];
  });

  return { refund: created, invoice: updatedInvoice };
}

export { SEVERITY_RANK };
