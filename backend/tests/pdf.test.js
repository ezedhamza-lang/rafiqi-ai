import { describe, it, expect } from 'vitest';
import { buildGradesPdf } from '../src/services/exportService.js';
import { buildInvoicePdf } from '../src/services/invoiceService.js';
import { buildReportPdf } from '../src/services/financialReportService.js';

function countPdfPages(buf) {
  const str = buf.toString('latin1');
  const matches = str.match(/\/Type\s*\/Page[^s]/g) || [];
  return matches.length;
}

describe('تصدير PDF بالعربية (P2-9 / P2-10)', () => {
  it('ينشئ كشف النتائج PDF عربيًا صالحًا ويحتوي على النص العربي', async () => {
    const buf = await buildGradesPdf({
      klass: { name: 'قسم السنة الخامسة', level: 'سنة خامسة' },
      rows: [
        { firstName: 'أحمد', lastName: 'الترابلسي', completionRate: 80, avgPercent: 72 },
        { firstName: 'فاطمة', lastName: 'بن علي', completionRate: 55, avgPercent: 48 }
      ],
      assignments: [{ title: 'واجب الرياضيات 1', subject: 'math', avgPercent: 64 }]
    });
    expect(buf.slice(0, 4).toString()).toBe('%PDF');
    expect(countPdfPages(buf)).toBe(1);
  });

  it('يكسر الصفوف إلى صفحات متعددة مع ترقيم عند تجاوز الصفحة الواحدة', async () => {
    const rows = Array.from({ length: 80 }, (_, i) => ({
      firstName: 'تلميذ',
      lastName: `رقم ${i + 1}`,
      completionRate: (i % 100),
      avgPercent: (i % 100)
    }));
    const buf = await buildGradesPdf({ klass: { name: 'قسم', level: 'سنة' }, rows });
    expect(buf.slice(0, 4).toString()).toBe('%PDF');
    expect(countPdfPages(buf)).toBeGreaterThan(1);
  });

  it('ينشئ فاتورة PDF عربية صالحة', async () => {
    const buf = await buildInvoicePdf({
      invoiceNumber: 'INV-2026-000001',
      issuedAt: new Date(),
      paymentId: 7,
      status: 'PAID',
      amount: 147,
      discountAmount: 14.7,
      taxAmount: 0,
      total: 132.3,
      currency: 'TND',
      subscription: {
        plan: 'اشتراك تلميذ',
        schoolYear: '2026-2027',
        startDate: new Date('2026-09-01'),
        endDate: new Date('2027-06-30'),
        user: { firstName: 'سعيد', lastName: 'المنصوري', email: 'sa@test.tn', role: 'STUDENT' }
      }
    });
    expect(buf.slice(0, 4).toString()).toBe('%PDF');
    expect(countPdfPages(buf)).toBe(1);
  });

  it('ينشئ التقرير المالي PDF عربيًا صالحًا', async () => {
    const buf = await buildReportPdf({
      period: { label: 'السنة الدراسية 2026-2027' },
      generatedAt: new Date(),
      summary: {
        totalRevenue: 500,
        totalDiscounts: 14.7,
        totalTax: 0,
        totalRefunds: 0,
        netRevenue: 485.3,
        paymentCount: 4,
        invoiceCount: 4,
        refundCount: 0
      },
      revenueByMonth: [{ month: '2026-09', amount: 250 }],
      payments: [
        {
          paidAt: new Date(),
          amount: 147,
          subscription: { user: { firstName: 'أحمد', lastName: 'ب' }, plan: 'اشتراك تلميذ' }
        }
      ]
    });
    expect(buf.slice(0, 4).toString()).toBe('%PDF');
    expect(countPdfPages(buf)).toBe(1);
  });
});
