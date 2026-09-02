import prisma from '../db.js';
import { createDoc, docToBuffer, PdfLayout, COLORS, CONTENT_WIDTH, PAGE } from './pdfUtils.js';

export const INVOICE_INCLUDE = {
  subscription: {
    include: {
      user: { select: { id: true, firstName: true, lastName: true, email: true, role: true } }
    }
  },
  payment: {
    include: {
      paidBy: { select: { id: true, firstName: true, lastName: true, email: true, role: true } }
    }
  }
};

export async function nextInvoiceNumber(id) {
  const year = new Date().getFullYear();
  return `INV-${year}-${String(id).padStart(6, '0')}`;
}

export async function createInvoice({ subscriptionId, paymentId, intent, override = {} }) {
  const metadata = intent?.metadata || {};
  const originalAmount =
    override.amount != null ? Number(override.amount) : metadata.originalAmount != null ? Number(metadata.originalAmount) : Number(intent?.amount || 0);
  const discountAmount = override.discountAmount != null ? Number(override.discountAmount) : Number(metadata.discountAmount || 0);
  const total = override.total != null ? Number(override.total) : Number(intent?.amount || originalAmount - discountAmount);

  const invoice = await prisma.invoice.create({
    data: {
      subscriptionId,
      paymentId,
      amount: originalAmount,
      discountAmount,
      taxAmount: 0,
      total,
      discountCode: override.discountCode != null ? override.discountCode : metadata.discountCode || null,
      currency: intent?.currency || 'TND'
    }
  });

  const invoiceNumber = await nextInvoiceNumber(invoice.id);
  return prisma.invoice.update({ where: { id: invoice.id }, data: { invoiceNumber } });
}

export async function getInvoiceWithRelations(id) {
  return prisma.invoice.findUnique({ where: { id: Number(id) }, include: INVOICE_INCLUDE });
}

export function money(value, currency = 'TND') {
  const n = Number(value || 0).toLocaleString('fr-TN', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
  return `${n} ${currency === 'TND' ? 'د.ت' : currency}`;
}

export async function buildInvoicePdf(invoice) {
  const doc = createDoc();
  const layout = new PdfLayout(doc);

  const sub = invoice.subscription;
  const holder = sub?.user || {};
  const roleLabels = { STUDENT: 'تلميذ', PARENT: 'ولي', TEACHER: 'أستاذ', SCHOOL_DIRECTOR: 'مدير مدرسة', ADMIN: 'مدير عام', SUPER_ADMIN: 'نظامي' };

  doc.save();
  doc.rect(0, 0, PAGE.width, 62).fill(COLORS.cyan);
  doc.restore();
  doc.font('AmiriBold').fontSize(18).fillColor(COLORS.white).text('بوابة رفيقي للحياة المدرسية', PAGE.margin, 20, { width: CONTENT_WIDTH, align: 'right' });
  doc.font('Amiri').fontSize(11).fillColor(COLORS.white).text('فاتورة اشتراك رقمية', PAGE.margin, 42, { width: CONTENT_WIDTH, align: 'right' });

  layout.y = PAGE.margin + 24;
  layout.heading('فاتورة', { size: 26, gap: 16 });

  const metaLines = [
    ['رقم الفاتورة', invoice.invoiceNumber || '—'],
    ['تاريخ الإصدار', new Date(invoice.issuedAt).toLocaleDateString('ar-TN')],
    ['رقم العملية', `#${invoice.paymentId}`],
    ['الحالة', invoice.status === 'PAID' ? 'مُسدَّدة' : invoice.status]
  ];
  metaLines.forEach(([label, value]) => {
    layout.line(`${label}: ${value}`, { size: 11, color: COLORS.dark, gap: 18 });
  });

  layout.line('المستفيد', { size: 13, font: 'AmiriBold', color: COLORS.cyan, gap: 12 });
  const holderName = `${holder.firstName || ''} ${holder.lastName || ''}`.trim() || '—';
  const holderMeta = [holderName, roleLabels[holder.role] || holder.role || '', holder.email || ''];
  holderMeta.forEach((line) => layout.line(line, { size: 11, color: COLORS.dark, gap: 15 }));

  layout.line('تفاصيل الاشتراك', { size: 13, font: 'AmiriBold', color: COLORS.cyan, gap: 12 });
  const subCols = [0.25, 0.25, 0.25, 0.25];
  layout.tableRow(['الخطة', 'السنة الدراسية', 'الفترة', 'المبلغ'], subCols, { header: true });
  layout.tableRow(
    [
      sub?.plan || '—',
      sub?.schoolYear || '—',
      sub ? `${new Date(sub.startDate).toLocaleDateString('fr-TN')} ← ${new Date(sub.endDate).toLocaleDateString('fr-TN')}` : '—',
      money(invoice.amount, invoice.currency)
    ],
    subCols
  );

  layout.line('التفصيل المالي', { size: 13, font: 'AmiriBold', color: COLORS.cyan, gap: 12 });

  const amountLine = (label, value) => {
    layout.ensure(22);
    const startY = layout.y;
    doc.font('Amiri').fontSize(11).fillColor(COLORS.gray).text(label, PAGE.margin, startY, { width: CONTENT_WIDTH * 0.5, align: 'right' });
    doc.font('Amiri').fontSize(11).fillColor(COLORS.dark).text(value, PAGE.margin + CONTENT_WIDTH * 0.5, startY, { width: CONTENT_WIDTH * 0.5, align: 'left' });
    layout.y = startY + 20;
  };

  amountLine('المبلغ الأصلي', money(invoice.amount, invoice.currency));
  if (invoice.discountAmount > 0) {
    amountLine(`التخفيض${invoice.discountCode ? ` (${invoice.discountCode})` : ''}`, `-${money(invoice.discountAmount, invoice.currency)}`);
  }
  if (invoice.taxAmount > 0) {
    amountLine('الضريبة', money(invoice.taxAmount, invoice.currency));
  }
  layout.rule(8);
  layout.line(`المجموع: ${money(invoice.total, invoice.currency)}`, { size: 14, font: 'AmiriBold', color: COLORS.cyan, gap: 20 });

  doc.font('Amiri').fontSize(10).fillColor(COLORS.gray).text('شكرا لثقتك بمنصة رفيقي. هذه الفاتورة صادرة إلكترونيا ولها نفس قيمة الأصل الورقي.', PAGE.margin, PAGE.height - 90, { width: CONTENT_WIDTH, align: 'center' });

  layout.footer();

  return docToBuffer(doc);
}
