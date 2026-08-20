import prisma from '../db.js';
import { createDoc, docToBuffer, PdfLayout, COLORS, CONTENT_WIDTH, PAGE } from './pdfUtils.js';
import { schoolYearBounds } from './schoolYear.js';

export const SEVERITY_LABELS = {
  LOW: 'منخفض',
  MEDIUM: 'متوسط',
  HIGH: 'مرتفع',
  CRITICAL: 'حرج'
};

export const ANOMALY_STATUS_LABELS = {
  OPEN: 'مفتوح',
  RESOLVED: 'مُعالَج',
  IGNORED: 'مُتجاهَل'
};

export const INTENT_STATUS_LABELS = {
  PENDING: 'معلّقة',
  SUCCEEDED: 'ناجحة',
  FAILED: 'فاشلة',
  CANCELED: 'ملغاة',
  EXPIRED: 'منتهية'
};

const ROLE_LABELS = {
  STUDENT: 'تلميذ',
  PARENT: 'ولي',
  TEACHER: 'أستاذ',
  SCHOOL_DIRECTOR: 'مدير مدرسة',
  ADMIN: 'مدير عام',
  SUPER_ADMIN: 'نظامي'
};

export function round2(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

function money(value, currency = 'TND') {
  const n = round2(value).toLocaleString('fr-TN', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
  return `${n} ${currency === 'TND' ? 'د.ت' : currency}`;
}

export function resolvePeriod({ from, to, schoolYear } = {}) {
  if (schoolYear) {
    const { start, end } = schoolYearBounds(schoolYear);
    return { from: start, to: end, label: `السنة الدراسية ${schoolYear}` };
  }
  const fromDate = from ? new Date(`${String(from).slice(0, 10)}T00:00:00`) : null;
  const toDate = to ? new Date(`${String(to).slice(0, 10)}T23:59:59.999`) : null;
  if (fromDate && Number.isNaN(fromDate.getTime())) {
    throw new TypeError('تاريخ البداية غير صالح');
  }
  if (toDate && Number.isNaN(toDate.getTime())) {
    throw new TypeError('تاريخ النهاية غير صالح');
  }
  return { from: fromDate, to: toDate, label: periodLabel(fromDate, toDate) };
}

export function periodLabel(from, to) {
  const fmt = (d) => (d ? new Date(d).toLocaleDateString('ar-TN') : '');
  if (from && to) return `${fmt(from)} ← ${fmt(to)}`;
  if (from) return `ابتداء من ${fmt(from)}`;
  if (to) return `حتى ${fmt(to)}`;
  return 'كل الفترات';
}

function dateRange(field, { from, to }) {
  if (!from && !to) return {};
  const cond = {};
  if (from) cond.gte = from;
  if (to) cond.lte = to;
  return { [field]: cond };
}

async function sumBy(field, where) {
  const agg = await prisma.payment.aggregate({ _sum: { amount: true }, _count: true, where });
  return { count: agg._count, amount: round2(agg._sum.amount || 0) };
}

export async function buildFinancialOverview({ from, to, schoolYear } = {}) {
  const period = resolvePeriod({ from, to, schoolYear });
  const payWhere = dateRange('paidAt', period);
  const intentWhere = dateRange('createdAt', period);
  const refundWhere = dateRange('refundedAt', period);

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const in15Days = new Date(now.getTime() + 15 * 86400000);

  const [periodRevenue, totalRevenue, monthRevenue, refunds, intents, invoices, activeCount, expiringSoon] = await Promise.all([
    sumBy('amount', payWhere),
    sumBy('amount', {}),
    sumBy('amount', { paidAt: { gte: monthStart } }),
    prisma.refund.aggregate({ _sum: { amount: true }, _count: true, where: refundWhere }),
    prisma.paymentIntent.groupBy({ by: ['status'], _count: true, where: intentWhere }),
    prisma.invoice.aggregate({ _sum: { discountAmount: true, taxAmount: true, total: true }, _count: true, where: dateRange('issuedAt', period) }),
    prisma.subscription.count({ where: { status: 'ACTIVE' } }),
    prisma.subscription.count({ where: { status: 'ACTIVE', endDate: { gte: now, lte: in15Days } } })
  ]);

  const intentStatus = {};
  for (const row of intents) intentStatus[row.status] = row._count;
  const succeeded = intentStatus.SUCCEEDED || 0;
  const failed = intentStatus.FAILED || 0;
  const totalDecided = succeeded + failed;
  const successRate = totalDecided ? Math.round((succeeded / totalDecided) * 100) : null;

  const [revenueByMonth, byPlan, byMethod] = await Promise.all([
    revenueByMonthList(),
    prisma.payment.groupBy({
      by: ['subscriptionId'],
      _sum: { amount: true },
      _count: true,
      where: payWhere
    }).then((rows) => planBreakdown(rows)),
    prisma.payment.groupBy({
      by: ['method'],
      _sum: { amount: true },
      _count: true,
      where: payWhere
    }).then((rows) =>
      rows.map((r) => ({ method: r.method || 'OFFLINE', count: r._count, amount: round2(r._sum.amount || 0) }))
    )
  ]);

  const recentPayments = await prisma.payment.findMany({
    where: payWhere,
    include: {
      subscription: { select: { id: true, plan: true, schoolYear: true, user: { select: { id: true, firstName: true, lastName: true, email: true } } } },
      paidBy: { select: { id: true, firstName: true, lastName: true, email: true } }
    },
    orderBy: { paidAt: 'desc' },
    take: 10
  });

  const recentIntents = await prisma.paymentIntent.findMany({
    where: intentWhere,
    include: {
      subscription: { select: { id: true, plan: true, schoolYear: true } },
      user: { select: { id: true, firstName: true, lastName: true } }
    },
    orderBy: { createdAt: 'desc' },
    take: 10
  });

  return {
    period,
    generatedAt: now,
    summary: {
      totalRevenue: totalRevenue.amount,
      periodRevenue: periodRevenue.amount,
      periodRevenueCount: periodRevenue.count,
      monthRevenue: monthRevenue.amount,
      refundCount: refunds._count,
      refundAmount: round2(refunds._sum.amount || 0),
      discountAmount: round2(invoices._sum.discountAmount || 0),
      taxAmount: round2(invoices._sum.taxAmount || 0),
      invoiceCount: invoices._count,
      succeeded,
      failed,
      pending: intentStatus.PENDING || 0,
      canceled: (intentStatus.CANCELED || 0) + (intentStatus.EXPIRED || 0),
      successRate,
      activeSubscriptions: activeCount,
      expiringSoon
    },
    revenueByMonth,
    byPlan,
    byMethod,
    recentPayments,
    recentIntents
  };
}

async function planBreakdown(rows) {
  const ids = rows.map((r) => r.subscriptionId);
  const subs = await prisma.subscription.findMany({
    where: { id: { in: ids } },
    select: { id: true, plan: true, schoolYear: true, type: true }
  });
  const map = new Map(subs.map((s) => [s.id, s]));
  const byPlan = new Map();
  for (const row of rows) {
    const sub = map.get(row.subscriptionId);
    const plan = sub ? `${sub.plan} (${sub.schoolYear})` : `اشتراك #${row.subscriptionId}`;
    const entry = byPlan.get(plan) || { plan, count: 0, amount: 0 };
    entry.count += row._count;
    entry.amount = round2(entry.amount + (row._sum.amount || 0));
    byPlan.set(plan, entry);
  }
  return Array.from(byPlan.values()).sort((a, b) => b.amount - a.amount);
}

async function revenueByMonthList() {
  const payments = await prisma.payment.findMany({ select: { amount: true, paidAt: true } });
  const map = new Map();
  for (const p of payments) {
    const key = p.paidAt.toISOString().slice(0, 7);
    map.set(key, round2((map.get(key) || 0) + p.amount));
  }
  return Array.from(map.entries())
    .map(([month, amount]) => ({ month, amount }))
    .sort((a, b) => (a.month < b.month ? -1 : 1))
    .slice(-12);
}

export async function buildFinancialReport({ from, to, schoolYear } = {}) {
  const period = resolvePeriod({ from, to, schoolYear });
  const payWhere = dateRange('paidAt', period);
  const refundWhere = dateRange('refundedAt', period);
  const invoiceWhere = dateRange('issuedAt', period);

  const [payments, invoices, refunds, discountCodes] = await Promise.all([
    prisma.payment.findMany({
      where: payWhere,
      include: {
        subscription: { select: { id: true, plan: true, schoolYear: true, user: { select: { id: true, firstName: true, lastName: true, email: true, role: true } } } },
        paidBy: { select: { id: true, firstName: true, lastName: true, email: true } },
        invoice: true
      },
      orderBy: { paidAt: 'desc' }
    }),
    prisma.invoice.findMany({
      where: invoiceWhere,
      include: {
        subscription: { include: { user: { select: { id: true, firstName: true, lastName: true, email: true, role: true } } } },
        payment: true
      },
      orderBy: { issuedAt: 'desc' }
    }),
    prisma.refund.findMany({
      where: refundWhere,
      include: {
        invoice: { select: { invoiceNumber: true } },
        subscription: { select: { plan: true, schoolYear: true } },
        refundedByUser: { select: { id: true, firstName: true, lastName: true, email: true } }
      },
      orderBy: { refundedAt: 'desc' }
    }),
    prisma.discountCode.findMany({
      include: { creator: { select: { id: true, firstName: true, lastName: true } } },
      orderBy: { usedCount: 'desc' }
    })
  ]);

  const totalRevenue = round2(payments.reduce((acc, p) => acc + p.amount, 0));
  const totalDiscounts = round2(invoices.reduce((acc, i) => acc + i.discountAmount, 0));
  const totalTax = round2(invoices.reduce((acc, i) => acc + i.taxAmount, 0));
  const totalRefunds = round2(refunds.reduce((acc, r) => acc + r.amount, 0));
  const netRevenue = round2(totalRevenue - totalRefunds);
  const discountCodesUsed = discountCodes.reduce((acc, d) => acc + d.usedCount, 0);

  const reportPayments = payments.map((p) => ({
    id: p.id,
    paidAt: p.paidAt,
    amount: p.amount,
    method: p.method,
    reference: p.reference,
    subscription: p.subscription,
    paidBy: p.paidBy,
    invoiceNumber: p.invoice?.invoiceNumber || null
  }));

  return {
    period,
    generatedAt: new Date(),
    summary: {
      totalRevenue,
      totalDiscounts,
      totalTax,
      totalRefunds,
      netRevenue,
      paymentCount: payments.length,
      invoiceCount: invoices.length,
      refundCount: refunds.length,
      activeCodes: discountCodes.filter((d) => d.active).length,
      discountCodesUsed,
      discountCodesTotal: discountCodes.length
    },
    revenueByMonth: await revenueByMonthList(),
    payments: reportPayments,
    invoices: invoices.map((i) => ({
      id: i.id,
      invoiceNumber: i.invoiceNumber,
      status: i.status,
      issuedAt: i.issuedAt,
      amount: i.amount,
      discountAmount: i.discountAmount,
      taxAmount: i.taxAmount,
      total: i.total,
      discountCode: i.discountCode,
      subscription: i.subscription,
      paymentId: i.paymentId
    })),
    refunds,
    discountCodes
  };
}

export async function buildReconciliation() {
  const [payments, invoices, refunds, intents] = await Promise.all([
    prisma.payment.findMany({
      include: {
        subscription: { select: { id: true, plan: true, schoolYear: true, user: { select: { firstName: true, lastName: true, email: true } } } },
        invoice: true
      },
      orderBy: { paidAt: 'desc' }
    }),
    prisma.invoice.findMany({ include: { payment: true } }),
    prisma.refund.findMany({ select: { id: true, invoiceId: true, subscriptionId: true, amount: true, refundedAt: true } }),
    prisma.paymentIntent.findMany({ select: { id: true, status: true, amount: true, subscriptionId: true, providerReference: true } })
  ]);

  const invoicesByPayment = new Map(invoices.map((i) => [i.paymentId, i]));
  const refundedInvoiceIds = new Set(refunds.map((r) => r.invoiceId));

  const paymentsWithoutInvoice = payments.filter((p) => !invoicesByPayment.has(p.id));
  const refundedPaidInvoices = invoices.filter((i) => i.status === 'REFUNDED');
  const invoicesWithoutPayment = invoices.filter((i) => !i.payment);
  const mismatchInvoices = invoices.filter(
    (i) => i.status === 'PAID' && i.payment && Math.abs(round2(i.total) - round2(i.payment.amount)) > 0.001
  );
  const intentsSucceededWithoutPayment = intents.filter((t) => {
    if (t.status !== 'SUCCEEDED') return false;
    if (t.providerReference) {
      return !payments.some((p) => p.reference === t.providerReference);
    }
    return !payments.some((p) => p.subscriptionId === t.subscriptionId);
  });
  const activeSubsWithIssues = await prisma.subscription.findMany({
    where: { status: 'ACTIVE' },
    include: { payments: true, invoices: true }
  });
  const activeWithoutPayment = activeSubsWithIssues.filter((s) => s.payments.length === 0);

  const sumPaid = round2(payments.reduce((acc, p) => acc + p.amount, 0));
  const sumInvoiced = round2(invoices.reduce((acc, i) => acc + i.total, 0));
  const sumRefunded = round2(refunds.reduce((acc, r) => acc + r.amount, 0));
  const sumIntentsSucceeded = round2(
    intents.filter((t) => t.status === 'SUCCEEDED').reduce((acc, t) => acc + t.amount, 0)
  );

  const reconciled = sumPaid - sumRefunded;

  return {
    generatedAt: new Date(),
    totals: {
      payments: round2(sumPaid),
      invoices: round2(sumInvoiced),
      refunds: round2(sumRefunded),
      intentsSucceeded: round2(sumIntentsSucceeded),
      reconciledNet: reconciled
    },
    differences: {
      paidVsInvoiced: round2(sumPaid - sumInvoiced),
      paidVsIntents: round2(sumPaid - sumIntentsSucceeded),
      invoicesVsIntents: round2(sumInvoiced - sumIntentsSucceeded)
    },
    issues: {
      paymentsWithoutInvoice,
      invoicesWithoutPayment,
      mismatchInvoices,
      refundedPaidInvoices,
      intentsSucceededWithoutPayment,
      activeWithoutPayment,
      refundedInvoiceIds
    },
    counts: {
      payments: payments.length,
      invoices: invoices.length,
      refunds: refunds.length,
      paymentsWithoutInvoice: paymentsWithoutInvoice.length,
      invoicesWithoutPayment: invoicesWithoutPayment.length,
      mismatchInvoices: mismatchInvoices.length,
      intentsSucceededWithoutPayment: intentsSucceededWithoutPayment.length,
      activeWithoutPayment: activeWithoutPayment.length
    }
  };
}

export async function buildReportPdf(report) {
  const doc = createDoc();
  const layout = new PdfLayout(doc);

  doc.save();
  doc.rect(0, 0, PAGE.width, 62).fill(COLORS.cyan);
  doc.restore();
  doc.font('AmiriBold').fontSize(18).fillColor(COLORS.white).text('بوابة رفيقي للحياة المدرسية', PAGE.margin, 20, { width: CONTENT_WIDTH, align: 'right' });
  doc.font('Amiri').fontSize(11).fillColor(COLORS.white).text('تقرير مالي للإدارة', PAGE.margin, 42, { width: CONTENT_WIDTH, align: 'right' });

  layout.y = PAGE.margin + 24;
  layout.heading('التقرير المالي', { size: 24, gap: 16 });

  layout.line(`الفترة: ${report.period.label}`, { size: 11, font: 'AmiriBold', color: COLORS.dark, gap: 14 });
  layout.line(`تاريخ التوليد: ${new Date(report.generatedAt).toLocaleString('ar-TN')}`, { size: 11, color: COLORS.dark, gap: 16 });

  layout.heading('ملخص مالي', { size: 14, gap: 10 });

  const s = report.summary;
  const summaryRows = [
    ['الإيراد الإجمالي', money(s.totalRevenue)],
    ['التخفيضات الممنوحة', `-${money(s.totalDiscounts)}`],
    ['الضرائب المحصّلة', money(s.totalTax)],
    ['الإرجاعات (Refunds)', `-${money(s.totalRefunds)}`],
    ['صافي الإيراد', money(s.netRevenue)],
    ['عدد العمليات', String(s.paymentCount)],
    ['عدد الفواتير', String(s.invoiceCount)],
    ['عدد الإرجاعات', String(s.refundCount)]
  ];

  summaryRows.forEach(([label, value]) => {
    layout.tableRow([label, value], [0.55, 0.45]);
  });
  layout.line('', { gap: 6 });

  layout.heading('الإيراد الشهري (آخر 12 شهرًا)', { size: 14, gap: 10 });
  layout.tableRow(['الشهر', 'المبلغ'], [0.5, 0.5], { header: true });
  const monthRows = report.revenueByMonth.length
    ? report.revenueByMonth.map((r) => [r.month, money(r.amount)])
    : [['لا توجد بيانات', '']];
  monthRows.forEach((cells) => layout.tableRow(cells, [0.5, 0.5]));

  layout.line('', { gap: 6 });
  layout.heading('أحدث عمليات الدفع', { size: 14, gap: 10 });
  const payCols = [0.25, 0.3, 0.25, 0.2];
  layout.tableRow(['التاريخ', 'المستفيد', 'الخطة', 'المبلغ'], payCols, { header: true });
  const payRows = report.payments.slice(0, 15).map((p) => [
    new Date(p.paidAt).toLocaleDateString('ar-TN'),
    `${p.subscription?.user?.firstName || ''} ${p.subscription?.user?.lastName || ''}`,
    p.subscription?.plan || '—',
    money(p.amount)
  ]);
  (payRows.length ? payRows : [['لا توجد عمليات', '', '', '']]).forEach((cells) => layout.tableRow(cells, payCols));

  doc.font('Amiri').fontSize(10).fillColor(COLORS.gray).text('شكرا لثقتك بمنصة رفيقي. هذا التقرير صادر إلكترونيا ويصلح للمراجعة الداخلية.', PAGE.margin, PAGE.height - 90, { width: CONTENT_WIDTH, align: 'center' });

  layout.footer();

  return docToBuffer(doc);
}

function csvField(value) {
  const str = value === null || value === undefined ? '' : String(value);
  return `"${str.replace(/"/g, '""')}"`;
}

function joinRow(...fields) {
  return fields.map(csvField).join(';');
}

export function buildReportCsv(report) {
  const lines = [];
  lines.push(joinRow('التقرير المالي — بوابة رفيقي للحياة المدرسية'));
  lines.push(joinRow('الفترة', report.period.label));
  lines.push(joinRow('تاريخ التوليد', new Date(report.generatedAt).toLocaleString('ar-TN')));
  lines.push(joinRow('', ''));
  lines.push(joinRow('الملخص المالي'));
  const s = report.summary;
  lines.push(joinRow('الإيراد الإجمالي', s.totalRevenue));
  lines.push(joinRow('التخفيضات الممنوحة', s.totalDiscounts));
  lines.push(joinRow('الضرائب المحصّلة', s.totalTax));
  lines.push(joinRow('الإرجاعات', s.totalRefunds));
  lines.push(joinRow('صافي الإيراد', s.netRevenue));
  lines.push(joinRow('عدد العمليات', s.paymentCount));
  lines.push(joinRow('عدد الفواتير', s.invoiceCount));
  lines.push(joinRow('عدد الإرجاعات', s.refundCount));
  lines.push(joinRow('', ''));

  lines.push(joinRow('الإيراد الشهري'));
  lines.push(joinRow('الشهر', 'المبلغ'));
  report.revenueByMonth.forEach((r) => lines.push(joinRow(r.month, r.amount)));
  lines.push(joinRow('', ''));

  lines.push(joinRow('عمليات الدفع'));
  lines.push(joinRow('التاريخ', 'المبلغ', 'الطريقة', 'المستفيد', 'الخطة', 'السنة الدراسية', 'الفاتورة', 'سجّلها'));
  report.payments.forEach((p) => {
    const u = p.subscription?.user || {};
    lines.push(
      joinRow(
        new Date(p.paidAt).toLocaleDateString('ar-TN'),
        p.amount,
        p.method,
        `${u.firstName || ''} ${u.lastName || ''}`,
        p.subscription?.plan || '—',
        p.subscription?.schoolYear || '—',
        p.invoiceNumber || '—',
        p.paidBy?.email || '—'
      )
    );
  });
  lines.push(joinRow('', ''));

  lines.push(joinRow('الفواتير'));
  lines.push(joinRow('الرقم', 'التاريخ', 'المبلغ', 'التخفيض', 'المجموع', 'الحالة', 'المستفيد'));
  report.invoices.forEach((i) => {
    const u = i.subscription?.user || {};
    lines.push(
      joinRow(
        i.invoiceNumber || `#${i.id}`,
        new Date(i.issuedAt).toLocaleDateString('ar-TN'),
        i.amount,
        i.discountAmount,
        i.total,
        i.status,
        `${u.firstName || ''} ${u.lastName || ''}`
      )
    );
  });
  lines.push(joinRow('', ''));

  lines.push(joinRow('الإرجاعات'));
  lines.push(joinRow('التاريخ', 'المبلغ', 'الفاتورة', 'السبب', 'المسؤول'));
  report.refunds.forEach((r) => {
    lines.push(
      joinRow(
        new Date(r.refundedAt).toLocaleDateString('ar-TN'),
        r.amount,
        r.invoice?.invoiceNumber || '—',
        r.reason || '—',
        `${r.refundedByUser?.firstName || ''} ${r.refundedByUser?.lastName || ''}`
      )
    );
  });

  const bom = '\uFEFF';
  return bom + lines.join('\r\n');
}

export const roleLabel = (role) => ROLE_LABELS[role] || role || '—';
