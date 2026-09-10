import { subjectLabel } from './analyticsService.js';

// ===== قوالب PDF الرسمية (تُرسم عبر محرك المتصفح — انظر browserPdf.js) =====
// كل المستندات الديناميكية تُهرَّب بـesc() ضد الحقن، والنص غير قابل للتحديد
// (user-select:none)، مع علامة مائية ثابتة واسم المنشئ في تذييل كل صفحة.

export const AUTHOR_CREDIT = 'الأستاذ والمهندس حمزة بن عمر عزالدين';

export function esc(v) {
  return String(v ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[c]);
}

const money = (v) => `${Number(v ?? 0).toFixed(3)} د.ت`;

function baseHtml(title, body) {
  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8"/>
<title>${esc(title)}</title>
<style>
  @page { size: A4; }
  * { box-sizing: border-box; }
  html, body {
    font-family: "Noto Naskh Arabic", "Amiri", "Segoe UI", Tahoma, Arial, sans-serif;
    color: #1f2937; margin: 0; line-height: 1.7; font-size: 12px;
    -webkit-user-select: none; -moz-user-select: none; user-select: none;
    -webkit-touch-callout: none;
  }
  .banner {
    background: linear-gradient(135deg, #0b2a52, #123a6b 55%, #0FA6E8);
    color: #fff; padding: 14px 20px; margin: -14mm -12mm 12px; border-radius: 0;
  }
  .banner h1 { margin: 0; font-size: 18px; }
  .banner p { margin: 2px 0 0; font-size: 11.5px; opacity: .92; }
  h2 { color: #0b6ca8; font-size: 15px; margin: 16px 0 6px; border-bottom: 2px solid #cfe8f7; padding-bottom: 3px; }
  table { width: 100%; border-collapse: collapse; margin: 6px 0 10px; }
  th, td { border: 1px solid #dbe7f0; padding: 5px 8px; text-align: right; font-size: 11.5px; }
  th { background: #eef6fb; color: #0b4a75; }
  .kv td:first-child { color: #64748b; width: 38%; }
  .total { font-weight: 800; color: #c2410c; font-size: 14px; }
  .note { font-size: 10.5px; color: #64748b; text-align: center; margin-top: 14px; }
  .page { padding: 0 4px; }
  .wm {
    position: fixed; top: 30%; left: 0; right: 0; text-align: center; z-index: 0;
    transform: rotate(-24deg); opacity: .06; font-size: 26px; font-weight: 800;
    color: #0b2a52; line-height: 2.2; pointer-events: none;
  }
  .credit {
    position: fixed; bottom: 0; left: 0; right: 0; text-align: center;
    font-size: 9.5px; color: #94a3b8; padding: 4px 0 0; border-top: 1px solid #e2e8f0;
  }
  .doc { position: relative; z-index: 1; }
</style>
</head>
<body>
<div class="wm">منصة رفيقي — وثيقة رسمية<br/>${esc(AUTHOR_CREDIT)}<br/>منصة رفيقي — وثيقة رسمية</div>
<div class="doc">
<div class="banner">
  <h1>بوابة رفيقي للحياة المدرسية</h1>
  <p>${esc(title)}</p>
</div>
${body}
</div>
<div class="credit">© ${esc(AUTHOR_CREDIT)} — جميع الحقوق محفوظة · منصة رفيقي ${new Date().getFullYear()} · هذه الوثيقة غير قابلة للنسخ</div>
</body>
</html>`;
}

// ===== الفاتورة =====
export function invoiceHtml(invoice) {
  const sub = invoice.subscription || {};
  const holder = sub.user || {};
  const roleLabels = { STUDENT: 'تلميذ', PARENT: 'ولي', TEACHER: 'أستاذ', SCHOOL_DIRECTOR: 'مدير مدرسة', ADMIN: 'مدير عام', SUPER_ADMIN: 'نظامي' };
  const holderName = `${holder.firstName || ''} ${holder.lastName || ''}`.trim() || '—';
  const rows = [
    ['رقم الفاتورة', invoice.invoiceNumber || '—'],
    ['تاريخ الإصدار', new Date(invoice.issuedAt).toLocaleDateString('ar-TN')],
    ['رقم العملية', `#${invoice.paymentId ?? '—'}`],
    ['الحالة', invoice.status === 'PAID' ? 'مُسدَّدة' : invoice.status]
  ];
  const body = `
<div class="page">
  <h2>فاتورة اشتراك رقمي</h2>
  <table class="kv"><tbody>${rows.map(([k, v]) => `<tr><td>${esc(k)}</td><td><b>${esc(v)}</b></td></tr>`).join('')}</tbody></table>
  <h2>المستفيد</h2>
  <p>${esc(holderName)} — ${esc(roleLabels[holder.role] || holder.role || '')} ${esc(holder.email || '')}</p>
  <h2>تفاصيل الاشتراك</h2>
  <table><thead><tr><th>الخطة</th><th>السنة الدراسية</th><th>الفترة</th><th>المبلغ</th></tr></thead>
  <tbody><tr><td>${esc(sub.plan || '—')}</td><td>${esc(sub.schoolYear || '—')}</td>
  <td>${sub.startDate ? `${new Date(sub.startDate).toLocaleDateString('fr-TN')} ← ${new Date(sub.endDate).toLocaleDateString('fr-TN')}` : '—'}</td>
  <td>${esc(money(invoice.amount))}</td></tr></tbody></table>
  <h2>التفصيل المالي</h2>
  <table class="kv"><tbody>
    <tr><td>المبلغ الأصلي</td><td>${esc(money(invoice.amount))}</td></tr>
    ${Number(invoice.discountAmount) > 0 ? `<tr><td>التخفيض${invoice.discountCode ? ` (${esc(invoice.discountCode)})` : ''}</td><td>-${esc(money(invoice.discountAmount))}</td></tr>` : ''}
    ${Number(invoice.taxAmount) > 0 ? `<tr><td>الضريبة</td><td>${esc(money(invoice.taxAmount))}</td></tr>` : ''}
    <tr><td>المجموع</td><td class="total">${esc(money(invoice.total))}</td></tr>
  </tbody></table>
  <p class="note">شكرا لثقتك بمنصة رفيقي. هذه الفاتورة صادرة إلكترونيا ولها نفس قيمة الأصل الورقي.</p>
</div>`;
  return baseHtml('فاتورة اشتراك', body);
}

// ===== كشف نتائج القسم =====
export function gradesHtml({ klass, rows, assignments }) {
  const mainRows = (rows || []).map((r) => `<tr><td>${esc(`${r.firstName} ${r.lastName}`)}</td><td>${esc(`${r.completionRate}%`)}</td><td>${esc(`${r.avgPercent}%`)}</td></tr>`).join('');
  const assignRows = (assignments || []).map((a) => `<tr><td>${esc(a.title)}</td><td>${esc(subjectLabel(a.subject))}</td><td>${esc(`${a.avgPercent}%`)}</td></tr>`).join('');
  const body = `
<div class="page">
  <h2>${esc(klass ? `${klass.name} — كشف النتائج` : 'كشف النتائج')}</h2>
  ${klass?.level ? `<p>المستوى: <b>${esc(klass.level)}</b></p>` : ''}
  <table><thead><tr><th>التلميذ</th><th>الإنجاز</th><th>المتوسط</th></tr></thead><tbody>${mainRows || '<tr><td colspan=3>لا توجد بيانات</td></tr>'}</tbody></table>
  ${(assignments || []).length ? `
  <h2>متوسطات التكليفات</h2>
  <table><thead><tr><th>التكليف</th><th>المادة</th><th>متوسط القسم</th></tr></thead><tbody>${assignRows}</tbody></table>` : ''}
</div>`;
  return baseHtml('كشف نتائج القسم', body);
}

// ===== التقرير المالي =====
export function financialReportHtml(report) {
  const s = report.summary || {};
  const sumRow = (k, v) => `<tr><td>${esc(k)}</td><td>${esc(v)}</td></tr>`;
  const months = (report.revenueByMonth || []).length
    ? report.revenueByMonth.map((r) => sumRow(r.month, money(r.amount))).join('')
    : sumRow('لا توجد بيانات', '');
  const pays = (report.payments || []).slice(0, 15).map((p) => `
    <tr><td>${esc(new Date(p.paidAt).toLocaleDateString('ar-TN'))}</td>
    <td>${esc(`${p.subscription?.user?.firstName || ''} ${p.subscription?.user?.lastName || ''}`)}</td>
    <td>${esc(p.subscription?.plan || '—')}</td><td>${esc(money(p.amount))}</td></tr>`).join('');
  const body = `
<div class="page">
  <h2>التقرير المالي</h2>
  <p>الفترة: <b>${esc(report.period?.label || '')}</b> — تاريخ التوليد: ${esc(new Date(report.generatedAt).toLocaleString('ar-TN'))}</p>
  <h2>ملخص مالي</h2>
  <table class="kv"><tbody>
    ${sumRow('الإيراد الإجمالي', money(s.totalRevenue))}
    ${sumRow('التخفيضات الممنوحة', `-${money(s.totalDiscounts)}`)}
    ${sumRow('الضرائب المحصّلة', money(s.totalTax))}
    ${sumRow('الإرجاعات', `-${money(s.totalRefunds)}`)}
    ${sumRow('صافي الإيراد', money(s.netRevenue))}
    ${sumRow('عدد العمليات', String(s.paymentCount ?? 0))}
    ${sumRow('عدد الفواتير', String(s.invoiceCount ?? 0))}
    ${sumRow('عدد الإرجاعات', String(s.refundCount ?? 0))}
  </tbody></table>
  <h2>الإيراد الشهري (آخر 12 شهرًا)</h2>
  <table class="kv"><tbody>${months}</tbody></table>
  <h2>أحدث عمليات الدفع</h2>
  <table><thead><tr><th>التاريخ</th><th>المستفيد</th><th>الخطة</th><th>المبلغ</th></tr></thead>
  <tbody>${pays || '<tr><td colspan=4>لا توجد عمليات</td></tr>'}</tbody></table>
  <p class="note">هذا التقرير صادر إلكترونيا ويصلح للمراجعة الداخلية.</p>
</div>`;
  return baseHtml('تقرير مالي للإدارة', body);
}

// ===== تقرير تقدم تلميذ (للأولياء) =====
export function childReportHtml({ student, report }) {
  const { summary = {}, strengths = [], weaknesses = [], trend = [] } = report || {};
  const li = (items) => (items.length ? items.map((x) => `<li>${esc(`${x.label}: ${x.avgPercent}%`)}</li>`).join('') : '<li>— لا توجد بعد</li>');
  const recent = (trend || []).slice(-12).map((t) => `<tr><td>${esc(t.title)}</td><td>${esc(t.subjectLabel)}</td><td>${esc(`${t.percent}%`)}</td></tr>`).join('');
  const body = `
<div class="page">
  <h2>تقرير تقدم التلميذ — ${esc(`${student.account?.firstName || ''} ${student.account?.lastName || ''}`)}</h2>
  <p>القسم: <b>${esc(student.class?.name || '—')}</b> — السنة الدراسية: <b>${esc(student.schoolYear || '—')}</b></p>
  <p>الدقة العامة: <b>${esc(`${summary.avgPercent ?? 0}%`)}</b> — الإنجاز: <b>${esc(`${summary.completionRate ?? 0}%`)}</b> — التقييمات المنجزة: <b>${esc(`${summary.gradedCount ?? 0} من ${summary.assignmentsTotal ?? 0}`)}</b></p>
  <h2>نقاط القوة</h2><ul>${li(strengths)}</ul>
  <h2>نقاط الضعف (تحتاج مرافقة)</h2><ul>${li(weaknesses)}</ul>
  <h2>آخر النتائج</h2>
  <table><thead><tr><th>التقييم</th><th>المادة</th><th>النتيجة</th></tr></thead>
  <tbody>${recent || '<tr><td colspan=3>— لا توجد نتائج بعد</td></tr>'}</tbody></table>
  <p class="note">رفيقي — الحياة المدرسية</p>
</div>`;
  return baseHtml('تقرير تقدم التلميذ', body);
}
