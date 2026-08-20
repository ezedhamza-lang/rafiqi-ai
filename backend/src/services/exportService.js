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

export async function buildGradesPdf({ klass, rows, assignments }) {
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
