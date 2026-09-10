import { describe, it, expect } from 'vitest';
import { esc, AUTHOR_CREDIT, invoiceHtml, gradesHtml, financialReportHtml, childReportHtml } from '../src/services/pdfTemplates.js';
import { browserPdfStatus } from '../src/services/browserPdf.js';
import { buildInvoicePdf } from '../src/services/invoiceService.js';
import { buildGradesPdf, buildChildReportPdf } from '../src/services/exportService.js';

describe('خدمة PDF الموحّدة (محرك المتصفح + النسخ القديم كبديل)', () => {
  it('esc يهرّب كل شيء ضد الحقن', () => {
    expect(esc('<img src=x onerror=alert(1)>')).toBe('&lt;img src=x onerror=alert(1)&gt;');
    expect(esc('a"b\'c')).toBe('a&quot;b&#39;c');
    expect(esc(null)).toBe('');
  });

  it('browserPdfStatus يعيد توقيعه بلا رموز قابلة للاستغلال', () => {
    const s = browserPdfStatus();
    expect(['auto', 'off']).toContain(s.mode);
    expect(s.executable === null || typeof s.executable === 'string').toBe(true);
    expect(typeof s.testEnv).toBe('boolean');
  });

  it('قالب الفاتورة: RTL + منع تحديد النص + توقيع الإنشاء + تهريب الحقول', () => {
    const html = invoiceHtml({
      invoiceNumber: 'INV<1>',
      issuedAt: new Date(),
      paymentId: 3,
      status: 'PAID',
      amount: 10,
      discountAmount: 1,
      taxAmount: 0,
      total: 9,
      currency: 'TND',
      subscription: { plan: 'خطة', schoolYear: '2026-2027', startDate: new Date(), endDate: new Date(), user: { firstName: 'أ', lastName: 'ب', role: 'STUDENT', email: 'x@y.tn' } }
    });
    expect(html).toContain('dir="rtl"');
    expect(html).toContain('user-select: none');
    expect(html).toContain(AUTHOR_CREDIT);
    expect(html).toContain('INV&lt;1&gt;');
    expect(html).not.toContain('INV<1>');
    expect(html).toContain('10.000 د.ت');
  });

  it('بقية القوالب تبني بلا أخطاء مع بيانات ناقصة', () => {
    expect(gradesHtml({ klass: null, rows: [], assignments: [] })).toContain('dir="rtl"');
    expect(financialReportHtml({ summary: {}, revenueByMonth: [], payments: [], period: { label: 'الكل' }, generatedAt: new Date() })).toContain('dir="rtl"');
    expect(childReportHtml({ student: {}, report: {} })).toContain('dir="rtl"');
  });

  it('في بيئة الاختبار (PDF_ENGINE=auto/test) يرجع البناء عبر البديل القديم بـPDF صالح', async () => {
    const buf = await buildInvoicePdf({
      invoiceNumber: 'T-1',
      issuedAt: new Date(),
      paymentId: 1,
      status: 'PAID',
      amount: 5,
      discountAmount: 0,
      taxAmount: 0,
      total: 5,
      currency: 'TND',
      subscription: { plan: 'p', schoolYear: '2026-2027', startDate: new Date(), endDate: new Date(), user: { firstName: 'أ', lastName: 'ب', role: 'PARENT' } }
    });
    expect(buf.slice(0, 4).toString()).toBe('%PDF');
  });

  it('buildChildReportPdf متاح من exportService ويعيد PDF', async () => {
    const buf = await buildChildReportPdf({
      student: { account: { firstName: 'ز', lastName: 'ي' }, class: { name: 'قسم' }, schoolYear: '2026-2027' },
      report: { summary: { avgPercent: 50, completionRate: 40, gradedCount: 2, assignmentsTotal: 5 }, strengths: [], weaknesses: [], trend: [] }
    });
    expect(buf.slice(0, 4).toString()).toBe('%PDF');
  });
});
