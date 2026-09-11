import { renderPdfFromHtml } from './browserPdf.js';
import { gradesHtml, childReportHtml, memoHtml, gradesBookHtml, certificateHtml } from './pdfTemplates.js';
import { subjectLabel, percent } from './analyticsService.js';
import { createDoc, docToBuffer, PdfLayout, COLORS, CONTENT_WIDTH, PAGE } from './pdfUtils.js';

function csvField(value) {
  const str = value === null || value === undefined ? '' : String(value);
  return `"${str.replace(/"/g, '""')}"`;
}

export function buildGradesCsv({ klass, rows, assignments }) {
  const join = (...fields) => fields.map(csvField).join(';');
  const lines = [];
  lines.push(join(klass.name, klass.level, ''));
  lines.push(join('', '', ''));
  lines.push(join('التلميذ', 'الإنجاز', 'المتوسط'));
  rows.forEach((r) => {
    lines.push(join(`${r.firstName} ${r.lastName}`, `${r.completionRate}%`, `${r.avgPercent}%`));
  });
  if (assignments && assignments.length) {
    lines.push(join('', '', ''));
    lines.push(join('تفاصيل التكليفات', '', ''));
    lines.push(join('التكليف', 'المادة', 'متوسط القسم'));
    assignments.forEach((a) => {
      lines.push(join(a.title, subjectLabel(a.subject), `${a.avgPercent}%`));
    });
  }
  const bom = '\uFEFF';
  return bom + lines.join('\r\n');
}

async function buildGradesPdfLegacy({ klass, rows, assignments }) {
  const doc = createDoc();
  const layout = new PdfLayout(doc);

  const title = klass ? `${klass.name} — كشف النتائج` : 'كشف النتائج';
  doc.font('AmiriBold').fontSize(20).fillColor(COLORS.cyan).text(title, PAGE.margin, layout.y, { width: CONTENT_WIDTH, align: 'right' });
  layout.y = doc.y + 12;
  if (klass?.level) {
    doc.font('Amiri').fontSize(12).fillColor(COLORS.gray).text(`المستوى: ${klass.level}`, PAGE.margin, layout.y, { width: CONTENT_WIDTH, align: 'right' });
    layout.y = doc.y + 16;
  }

  const colWidths = [0.5, 0.25, 0.25];

  const drawHeaderRow = () => {
    layout.tableRow(['التلميذ', 'الإنجاز', 'المتوسط'], colWidths, { header: true });
  };

  const drawRow = (cells) => {
    layout.tableRow(cells, colWidths);
  };

  drawHeaderRow();

  rows.forEach((r) => {
    drawRow([`${r.firstName} ${r.lastName}`, `${r.completionRate}%`, `${r.avgPercent}%`]);
  });

  if (assignments && assignments.length) {
    layout.line('متوسطات التكليفات', { size: 14, font: 'AmiriBold', color: COLORS.dark, gap: 12 });
    const assignCols = [0.4, 0.3, 0.3];
    layout.tableRow(['التكليف', 'المادة', 'متوسط القسم'], assignCols, { header: true });
    assignments.forEach((a) => {
      layout.tableRow([a.title, subjectLabel(a.subject), `${a.avgPercent}%`], assignCols);
    });
  }

  layout.footer();

  return docToBuffer(doc);
}

export function setAttachment(res, filename, contentType, buffer) {
  const safe = filename.replace(/[^a-zA-Z0-9\u0600-\u06FF._-]/g, '_');
  res.setHeader('Content-Type', contentType);
  res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(safe)}`);
  res.send(buffer);
}

export { percent };

export async function buildGradesPdf(data) {
  const viaBrowser = await renderPdfFromHtml(gradesHtml(data));
  if (viaBrowser) return viaBrowser;
  return buildGradesPdfLegacy(data);
}

async function buildChildReportPdfLegacy({ student, report }) {
  const doc = createDoc();
  const layout = new PdfLayout(doc);
  const { summary, strengths, weaknesses, trend } = report;
  layout.heading(`تقرير تقدم التلميذ — ${student.account?.firstName || ''} ${student.account?.lastName || ''}`, { size: 18, color: COLORS.cyan });
  layout.rule();
  layout.line(`القسم: ${student.class?.name || '—'}  |  السنة الدراسية: ${student.schoolYear || '—'}`);
  layout.line(`الدقة العامة: ${summary.avgPercent}%  |  الإنجاز: ${summary.completionRate}%  |  التقييمات المنجزة: ${summary.gradedCount} من ${summary.assignmentsTotal}`);
  layout.heading('نقاط القوة', { size: 14, color: COLORS.cyan });
  if (strengths.length) strengths.forEach((s) => layout.line(`• ${s.label}: ${s.avgPercent}%`)); else layout.line('— لا توجد بعد');
  layout.heading('نقاط الضعف (تحتاج مرافقة)', { size: 14, color: COLORS.cyan });
  if (weaknesses.length) weaknesses.forEach((w) => layout.line(`• ${w.label}: ${w.avgPercent}%`)); else layout.line('— لا توجد بعد');
  layout.heading('آخر النتائج', { size: 14, color: COLORS.cyan });
  const recent = trend.slice(-12);
  if (recent.length) {
    layout.tableRow(['التقييم', 'المادة', 'النتيجة'], [0.45, 0.3, 0.25], { header: true });
    recent.forEach((t, i) => layout.tableRow([t.title, t.subjectLabel, `${t.percent}%`], [0.45, 0.3, 0.25], { highlight: i % 2 === 0 }));
  } else layout.line('— لا توجد نتائج بعد');
  layout.footer('رفيقي — الحياة المدرسية');
  return docToBuffer(doc);
}

export async function buildChildReportPdf({ student, report }) {
  const viaBrowser = await renderPdfFromHtml(childReportHtml({ student, report }));
  if (viaBrowser) return viaBrowser;
  return buildChildReportPdfLegacy({ student, report });
}

export async function buildMemoPdf(memo) {
  const viaBrowser = await renderPdfFromHtml(memoHtml(memo));
  if (viaBrowser) return viaBrowser;
  return buildMemoPdfLegacy(memo);
}

async function buildMemoPdfLegacy(memo) {
  let c = memo.content;
  if (typeof c === 'string') { try { c = JSON.parse(c); } catch { c = {}; } }
  c = c || {};
  const doc = createDoc();
  const layout = new PdfLayout(doc);
  layout.heading('مذكرة حصة: ' + (memo.lessonTitle || ''), { size: 16, color: COLORS.cyan });
  if (c.methodologyTitle) { layout.line('البروفايل المنهجي: ' + c.methodologyTitle, { size: 12 }); }
  if ((c.warmup || []).length) { layout.heading('التمهيد', { size: 13 }); c.warmup.forEach((w) => layout.line('• ' + w)); }
  if ((c.phases || []).length) {
    layout.heading('مراحل الحصة', { size: 13 });
    c.phases.forEach((p, i) => {
      layout.line((i + 1) + '. ' + (p.name || ''), { size: 12, font: 'AmiriBold' });
      (p.activities || []).forEach((a) => layout.line('   • ' + a));
    });
  }
  if ((c.closing || []).length) { layout.heading('الختام', { size: 13 }); c.closing.forEach((x) => layout.line('• ' + x)); }
  layout.footer('رفيقي — مذكرة الأستاذ');
  return docToBuffer(doc);
}

// ===== بنّاءو PDF للنتائج والشهادات (محرك متصفح + بديل pdfkit) =====
export async function buildGradesBookPdf(data) {
  const viaBrowser = await renderPdfFromHtml(gradesBookHtml(data));
  if (viaBrowser) return viaBrowser;
  const doc = createDoc();
  const layout = new PdfLayout(doc);
  layout.heading(`دفتر الأعداد — ${data.class.name} (${data.periodLabel})`, { size: 15, color: COLORS.cyan });
  layout.line(`المواد: ${data.subjects.map((s) => `${s.label} ×${s.coefficient}`).join(' | ')}`, { size: 10 });
  for (const r of data.rows) {
    const marks = data.subjects.map((s) => (r.marks[s.code] == null ? '—' : Number(r.marks[s.code]).toFixed(2))).join(' | ');
    layout.line(`${r.firstName} ${r.lastName} — ${marks} | المعدل: ${r.mean == null ? '—' : r.mean.toFixed(2)} | الرتبة: ${r.rank ?? '—'}`, { size: 10, gap: 10 });
  }
  layout.footer();
  return docToBuffer(doc);
}

export async function buildCertificatePdf(cert) {
  const viaBrowser = await renderPdfFromHtml(certificateHtml(cert));
  if (viaBrowser) return viaBrowser;
  const doc = createDoc();
  const layout = new PdfLayout(doc);
  layout.heading(`بطاقة الأعداد — ${cert.student.firstName} ${cert.student.lastName} (${cert.periodLabel})`, { size: 14, color: COLORS.cyan });
  layout.line(`القسم: ${cert.class.name} — السنة: ${cert.class.schoolYear || ''}`, { size: 11 });
  for (const s of cert.subjects) layout.line(`• ${s.label} (×${s.coefficient}): ${s.mark == null ? '—' : s.mark.toFixed(2)}`, { size: 10, gap: 4 });
  layout.line(`المعدل: ${cert.mean == null ? '—' : cert.mean.toFixed(2)} / 20 — الرتبة: ${cert.rank ?? '—'}/${cert.effectifs} — ${cert.mention || ''}`, { size: 12, font: 'AmiriBold' });
  layout.footer();
  return docToBuffer(doc);
}
