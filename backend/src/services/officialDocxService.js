import JSZip from 'jszip';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/* ══════════════════════════════════════════════════════════════════
   OFFICIAL TUNISIAN MINISTRY OF EDUCATION EXAM TEMPLATE
   Matches real teacher papers (years 1-6, all subjects, all trimesters):
   - Header table: school / title / subject-year-name
   - Grey shaded Sanad (reading passage) blocks
   - Numbered Taalima (instruction) blocks with marks
   - Question types: MCQ ○, TRUE_FALSE, FILL_BLANK, MATCHING,
     ORDERING, EXTRACT, OPEN (dotted answer lines)
   - Grading table "جدول إسناد الأعداد" at the end
   - RTL Arabic, Andalus headings + Traditional Arabic body
   ══════════════════════════════════════════════════════════════════ */

const SUBJECT_MAP = {
  // رموز خاصة بتصدير DOCX غير موجودة في المعجم المركزي
  'history-geography': 'التاريخ والجغرافيا',
  history: 'التاريخ', geography: 'الجغرافيا', civic: 'التربية المدنية',
  grammar: 'قواعد اللغة', writing: 'الإنتاج الكتابي', pe: 'التربية البدنية',
  technology: 'التكنولوجيا',
  'قواعد اللغة': 'قواعد اللغة', 'الإنتاج الكتابي': 'الإنتاج الكتابي',
  // المعجم المركزي (src/exams/subject-labels.js) هو المرجع — لا تكرار (§79)
  ...SUBJECT_LABELS
};

const LEVEL_NAMES = {
  1: 'السنة الأولى', 2: 'السنة الثانية', 3: 'السنة الثالثة',
  4: 'السنة الرابعة', 5: 'السنة الخامسة', 6: 'السنة السادسة'
};

const TRIMESTER_NAMES = {
  1: 'الثلاثي الأول', 2: 'الثلاثي الثاني', 3: 'الثلاثي الثالث'
};

// المعايير الرسمية منقولة إلى src/exams/criteria-grids.js — مصدر واحد مشترك
// بين تصدير DOCX ومحرّك الاختبارات (§79) مع إمكانية تحجيمها لأي هدف 10/15/20.
import { DEFAULT_CRITERIA } from '../exams/criteria-grids.js';
// معجم المادة المركزي (§78,§79): تسمية واحدة لكل واجهة — لا ادّعاء رسمية.
import { SUBJECT_LABELS, subjectLabel as centralSubjectLabel } from '../exams/subject-labels.js';

function esc(text) {
  return String(text ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function dottedLine(n = 40) { return '.'.repeat(n); }

/* ── Image support: embed local images (uploads/, images/, media/) ── */
const BACKEND_ROOT = path.join(__dirname, '..', '..');
const EMU_PER_PX = 9525;
const MAX_IMG_W_PX = 420;
const MAX_IMG_H_PX = 300;

function resolveLocalImage(visual) {
  if (!visual || typeof visual !== 'string') return null;
  const v = visual.trim();
  if (/^https?:\/\//i.test(v) || /^data:/i.test(v)) return null;
  const rel = v.startsWith('/') ? v.slice(1) : v;
  if (rel.includes('..')) return null;
  const abs = path.join(BACKEND_ROOT, rel);
  try {
    if (!fs.existsSync(abs) || !fs.statSync(abs).isFile()) return null;
    const ext = path.extname(abs).toLowerCase();
    if (!['.png', '.jpg', '.jpeg'].includes(ext)) return null;
    return { abs, ext: ext === '.jpeg' ? '.jpg' : ext };
  } catch {
    return null;
  }
}

function imageDimensions(abs, ext) {
  try {
    const buf = fs.readFileSync(abs);
    if (ext === '.png' && buf.length > 24 && buf.readUInt32BE(16) > 0 && buf.readUInt32BE(20) > 0) {
      return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20), buf };
    }
    if (ext === '.jpg') {
      let i = 2;
      while (i + 8 < buf.length) {
        if (buf[i] !== 0xFF) break;
        const marker = buf[i + 1];
        if (marker >= 0xC0 && marker <= 0xC3) {
          return { w: buf.readUInt16BE(i + 7), h: buf.readUInt16BE(i + 5), buf };
        }
        const len = buf.readUInt16BE(i + 2);
        if (len < 2) break;
        i += 2 + len;
      }
      return { w: 300, h: 200, buf };
    }
    return { w: 300, h: 200, buf };
  } catch {
    return null;
  }
}

function collectVisuals(passages, questions) {
  const seen = new Map();
  const list = [];
  const consider = (visual) => {
    if (!visual || seen.has(visual)) return;
    const resolved = resolveLocalImage(visual);
    if (!resolved) return;
    const dims = imageDimensions(resolved.abs, resolved.ext);
    if (!dims) return;
    const scale = Math.min(1, MAX_IMG_W_PX / dims.w, MAX_IMG_H_PX / dims.h);
    const wPx = Math.max(40, Math.round(dims.w * scale));
    const hPx = Math.max(40, Math.round(dims.h * scale));
    seen.set(visual, list.length);
    list.push({ visual, ...resolved, buf: dims.buf, wPx, hPx, rid: `rIdImg${list.length + 1}` });
  };
  (passages || []).forEach((p) => { if (p && typeof p === 'object') { consider(p.image || p.visual); } });
  (questions || []).forEach((q) => consider(q.visual || q.image));
  return { list, indexOf: (v) => seen.get(v) };
}

function imageParagraph(img, docPrId) {
  const cx = img.wPx * EMU_PER_PX;
  const cy = img.hPx * EMU_PER_PX;
  return `<w:p><w:pPr><w:jc w:val="center"/><w:spacing w:before="80" w:after="80"/></w:pPr><w:r><w:rPr><w:rFonts w:ascii="${FONT_BODY}" w:hAnsi="${FONT_BODY}" w:cs="${FONT_BODY}"/><w:sz w:val="20"/><w:szCs w:val="20"/></w:rPr><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${cx}" cy="${cy}"/><wp:docPr id="${docPrId}" name="exam-img-${docPrId}"/><wp:cNvGraphicFramePr/><a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="${docPrId}" name="exam-img-${docPrId}"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="${img.rid}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>`;
}

// Official fonts: Andalus for headings, Traditional Arabic for body
const FONT_TITLE = 'Andalus';
const FONT_BODY = 'Traditional Arabic';
const GREY_FILL = 'D9D9D9';
const HEADER_FILL = 'D9E2F3';

function run(text, opts = {}) {
  const font = opts.font || FONT_BODY;
  const sz = opts.sz || 28;
  const parts = [`<w:r><w:rPr><w:rFonts w:ascii="${font}" w:hAnsi="${font}" w:cs="${font}"/><w:sz w:val="${sz}"/><w:szCs w:val="${sz}"/><w:rtl/><w:lang w:val="ar-TN" w:bidi="ar-SA"/>`];
  if (opts.bold) parts.push('<w:b/><w:bCs/>');
  if (opts.italics) parts.push('<w:i/><w:iCs/>');
  if (opts.underline) parts.push('<w:u w:val="single"/>');
  if (opts.color) parts.push(`<w:color w:val="${opts.color}"/>`);
  parts.push(`</w:rPr><w:t xml:space="preserve">${esc(text)}</w:t></w:r>`);
  return parts.join('');
}

function paragraph(children, opts = {}) {
  const kids = Array.isArray(children) ? children : [children];
  const pPr = [`<w:pPr><w:pStyle w:val="Normal"/>`];
  pPr.push(`<w:jc w:val="${opts.align || 'right'}"/>`);
  const font = opts.font || FONT_BODY;
  const sz = opts.sz || 28;
  pPr.push(`<w:rPr><w:rFonts w:ascii="${font}" w:hAnsi="${font}" w:cs="${font}"/><w:sz w:val="${sz}"/><w:szCs w:val="${sz}"/><w:rtl/>`);
  if (opts.bold) pPr.push('<w:b/><w:bCs/>');
  pPr.push('</w:rPr>');
  if (opts.shading) pPr.push(`<w:shd w:val="clear" w:color="auto" w:fill="${opts.shading}"/>`);
  if (opts.borders) {
    pPr.push('<w:pBdr>');
    ['top', 'bottom', 'start', 'end'].forEach(side => {
      pPr.push(`<w:${side} w:val="single" w:sz="6" w:space="4" w:color="000000"/>`);
    });
    pPr.push('</w:pBdr>');
  }
  pPr.push(`<w:spacing w:before="${opts.before ?? 0}" w:after="${opts.after ?? 100}" w:line="${opts.line || 300}" w:lineRule="auto"/>`);
  pPr.push('</w:pPr>');
  return `<w:p>${pPr.join('')}${kids.join('')}</w:p>`;
}

function cellXml(innerXml, opts = {}) {
  const tcPr = ['<w:tcPr>'];
  if (opts.width) tcPr.push(`<w:tcW w:w="${opts.width}" w:type="dxa"/>`);
  tcPr.push(`<w:vAlign w:val="${opts.vAlign || 'center'}"/>`);
  if (opts.shading) tcPr.push(`<w:shd w:val="clear" w:color="auto" w:fill="${opts.shading}"/>`);
  if (opts.columnSpan) tcPr.push(`<w:gridSpan w:val="${opts.columnSpan}"/>`);
  if (opts.noBorders) {
    tcPr.push('<w:tcBorders><w:top w:val="nil" w:sz="0" w:space="0" w:color="auto"/><w:bottom w:val="nil" w:sz="0" w:space="0" w:color="auto"/><w:start w:val="nil" w:sz="0" w:space="0" w:color="auto"/><w:end w:val="nil" w:sz="0" w:space="0" w:color="auto"/></w:tcBorders>');
  } else {
    tcPr.push('<w:tcBorders>');
    ['top', 'bottom', 'start', 'end'].forEach(side => {
      tcPr.push(`<w:${side} w:val="single" w:sz="6" w:space="0" w:color="000000"/>`);
    });
    tcPr.push('</w:tcBorders>');
  }
  tcPr.push('</w:tcPr>');
  return `<w:tc>${tcPr.join('')}${innerXml}</w:tc>`;
}

function cellPara(text, opts = {}) {
  const font = opts.font || (opts.bold ? FONT_TITLE : FONT_BODY);
  const sz = opts.sz || (opts.bold ? 30 : 28);
  const align = opts.align || 'center';
  return `<w:p><w:pPr><w:jc w:val="${align}"/><w:spacing w:before="30" w:after="30"/><w:rPr><w:rFonts w:ascii="${font}" w:hAnsi="${font}" w:cs="${font}"/><w:sz w:val="${sz}"/><w:szCs w:val="${sz}"/><w:rtl/>${opts.bold ? '<w:b/><w:bCs/>' : ''}</w:rPr></w:pPr><w:r><w:rPr><w:rFonts w:ascii="${font}" w:hAnsi="${font}" w:cs="${font}"/><w:sz w:val="${sz}"/><w:szCs w:val="${sz}"/><w:rtl/>${opts.bold ? '<w:b/><w:bCs/>' : ''}</w:rPr><w:t xml:space="preserve">${esc(text)}</w:t></w:r></w:p>`;
}

function table(rowsXml, opts = {}) {
  const parts = [`<w:tbl><w:tblPr><w:tblStyle w:val="TableGrid"/><w:bidiVisual/>`];
  parts.push(`<w:tblW w:w="${opts.width || 9500}" w:type="dxa"/>`);
  parts.push(`<w:jc w:val="${opts.jc || 'center'}"/>`);
  parts.push('<w:tblBorders>');
  ['top', 'bottom', 'start', 'end', 'insideH', 'insideV'].forEach(side => {
    parts.push(`<w:${side} w:val="single" w:sz="6" w:space="0" w:color="000000"/>`);
  });
  parts.push('</w:tblBorders><w:tblLayout w:type="fixed"/></w:tblPr>');
  const nCols = opts.cols || (rowsXml[0] ? (rowsXml[0].match(/<w:tc>/g) || []).length : 1);
  const colW = Math.floor((opts.width || 9500) / Math.max(nCols, 1));
  parts.push('<w:tblGrid>' + Array.from({ length: Math.max(nCols, 1) }, () => `<w:gridCol w:w="${colW}"/>`).join('') + '</w:tblGrid>');
  parts.push(rowsXml.map(cells => `<w:tr>${cells}</w:tr>`).join(''));
  parts.push('</w:tbl>');
  return parts.join('');
}

function emptyPara() {
  return `<w:p><w:pPr><w:spacing w:before="0" w:after="60"/></w:pPr></w:p>`;
}

/* ══════════════════════════════════════════════════════════════════
   OFFICIAL HEADER TABLE (matches Ministry papers)
   ══════════════════════════════════════════════════════════════════ */

function buildHeader(context = {}) {
  const school = context.school || 'المدرسة الابتدائية';
  const subjectLabel = SUBJECT_MAP[context.subject] || centralSubjectLabel(context.subject) || '';
  const levelLabel = LEVEL_NAMES[context.level] || context.level || '';
  const trimesterLabel = TRIMESTER_NAMES[context.trimester] || (context.trimester ? `الثلاثي ${context.trimester}` : '');
  const year = new Date().getFullYear();
  const schoolYear = `${year - 1}/${year}`;
  const date = context.date || new Date().toLocaleDateString('ar-TN');
  const duration = context.durationMinutes || 60;
  const teacher = context.teacherName || '...........';
  const studentName = context.studentName || '................................';
  const studentClass = context.studentClass || '...........';
  const title = context.title || `تقييم مكتسبات التلاميذ في نهاية ${trimesterLabel}`;

  const row1 =
    cellXml(cellPara(`المدرسة الابتدائية: ${school}`, { bold: true, sz: 28, width: 0 }), { width: 3000 }) +
    cellXml(cellPara(`${title}`, { bold: true, sz: 30, font: FONT_TITLE }) + cellPara(`${subjectLabel}`, { bold: true, sz: 30, font: FONT_TITLE }), { width: 3800 }) +
    cellXml(cellPara(`السنة الدراسية: ${schoolYear}`, { bold: true, sz: 26 }), { width: 2700 });

  const row2 =
    cellXml(cellPara(`الاسم واللقب: ${studentName}`, { sz: 26, align: 'right' }), { width: 3000 }) +
    cellXml(cellPara(`القسم: ${studentClass}`, { sz: 26, align: 'right' }), { width: 3800 }) +
    cellXml(cellPara(`${levelLabel}${trimesterLabel ? ' — ' + trimesterLabel : ''}`, { sz: 26 }), { width: 2700 });

  const row3 =
    cellXml(cellPara(`المعلم(ة): ${teacher}`, { sz: 24, align: 'right' }), { width: 3000 }) +
    cellXml(cellPara(`التاريخ: ${date}`, { sz: 24 }), { width: 3800 }) +
    cellXml(cellPara(`المدة: ${duration} دقيقة`, { sz: 24 }), { width: 2700 });

  return table([row1, row2, row3], { width: 9500, cols: 3 });
}

/* ══════════════════════════════════════════════════════════════════
   SANAD (grey passage block) + TAALIMA (numbered instruction)
   ══════════════════════════════════════════════════════════════════ */

function buildSanad(index, text) {
  if (!text) return '';
  return paragraph(
    [run(`السند ${index}: `, { bold: true, sz: 30, font: FONT_TITLE }), run(text, { sz: 28 })],
    { shading: GREY_FILL, borders: true, after: 120, before: 160 }
  );
}

function buildTaalimaHeader(label, instruction, points) {
  const mark = points ? `  (${points}ن)` : '';
  return paragraph(
    [run(`${label}: `, { bold: true, sz: 30, font: FONT_TITLE }), run(`${instruction}${mark}`, { sz: 28 })],
    { after: 80, before: 140 }
  );
}

function answerLines(n = 3, width = 60) {
  const out = [];
  for (let i = 0; i < n; i++) {
    out.push(paragraph([run(dottedLine(width), { sz: 24 })], { after: 60 }));
  }
  return out.join('');
}

/* مساحات §D12 و§B3-هندسة-4: إطار مقفول يكتب التلميذ فيه — بلاه تُطبع ورقة بلا
   مكان للعملية العمودية ولا للرسم (شكاوى exam-20). */
function verticalSpaceBox() {
  const cell = cellXml(Array.from({ length: 4 }, () => cellPara('')).join(''), { width: 2500 });
  return table([cell], { width: 2500, cols: 1, jc: 'right' });
}

function drawingSpaceBox() {
  const cell = cellXml(Array.from({ length: 6 }, () => cellPara('')).join(''), { width: 9500 });
  return table([cell], { width: 9500, cols: 1 });
}

/* ══════════════════════════════════════════════════════════════════
   QUESTION TYPES (official rendering)
   ══════════════════════════════════════════════════════════════════ */

function buildMCQ(q) {
  const prompt = q.prompt || q.text || '';
  const options = q.options && q.options.length ? q.options : ['أ', 'ب', 'ج'];
  const lines = [];
  if (prompt) lines.push(paragraph([run(prompt, { sz: 28 })], { after: 80, indent: 0 }));
  options.forEach((opt) => {
    const text = typeof opt === 'string' ? opt : (opt.text || '');
    lines.push(paragraph([run('○   ', { sz: 28 }), run(text, { sz: 28 })], { after: 50 }));
  });
  return lines.join('');
}

function buildTrueFalse(q) {
  const stmts = q.statements && q.statements.length ? q.statements : [{ text: q.prompt || q.text || '' }];
  return stmts.map((s) => {
    const text = typeof s === 'string' ? s : (s.text || '');
    return paragraph(
      [run(text, { sz: 28 }), run('    (  ) صحيح       (  ) خطأ', { sz: 26, bold: true })],
      { after: 70 }
    );
  }).join('');
}

function buildFillBlank(q) {
  const items = q.items && q.items.length ? q.items : [{ text: q.prompt || q.text || '' }];
  return items.map((item) => {
    const text = typeof item === 'string' ? item : (item.text || '');
    const parts = String(text).split(/_{3,}|\.{4,}|…+/);
    if (parts.length > 1) {
      const children = [];
      parts.forEach((part, j) => {
        children.push(run(part, { sz: 28 }));
        if (j < parts.length - 1) children.push(run(dottedLine(18), { sz: 26 }));
      });
      return paragraph(children, { after: 70 });
    }
    return paragraph([run(text, { sz: 28 }), run('   ' + dottedLine(25), { sz: 26 })], { after: 70 });
  }).join('');
}

function buildMatching(q) {
  const left = q.leftItems || [];
  const right = q.rightItems || [];
  const lines = [];
  if (q.prompt || q.text) lines.push(paragraph([run(q.prompt || q.text, { sz: 28 })], { after: 80 }));
  const maxLen = Math.max(left.length, right.length, 1);
  const rows = [];
  for (let i = 0; i < maxLen; i++) {
    const l = left[i] ? `${i + 1}) ${typeof left[i] === 'string' ? left[i] : (left[i].text || '')}` : '';
    const r = right[i] ? `${String.fromCharCode(1571 + i)}) ${typeof right[i] === 'string' ? right[i] : (right[i].text || '')}` : '';
    rows.push(
      cellXml(cellPara(l, { align: 'right', sz: 26 }), { width: 4200 }) +
      cellXml(cellPara('', { sz: 26 }), { width: 1100 }) +
      cellXml(cellPara(r, { align: 'right', sz: 26 }), { width: 4200 })
    );
  }
  lines.push(table(rows, { width: 9500, cols: 3 }));
  return lines.join('');
}

function buildOrdering(q) {
  const items = q.items || q.orderItems || [];
  const lines = [];
  if (q.prompt || q.text) lines.push(paragraph([run(q.prompt || q.text, { sz: 28 })], { after: 80 }));
  if (!items.length) {
    // مخرَج بلا عناصر: أسطر مرقّمة بدل صمت يُفقد التلميذ مكان إجابته تمامًا
    for (let i = 1; i <= 4; i += 1) {
      lines.push(paragraph([run(`${i}) `, { sz: 28 }), run(dottedLine(48), { sz: 26 })], { after: 60 }));
    }
    return lines.join('');
  }
  items.forEach((item) => {
    const text = typeof item === 'string' ? item : (item.text || '');
    lines.push(paragraph(
      [run('□   ', { sz: 28 }), run(text, { sz: 28 }), run('   ' + dottedLine(12), { sz: 24 })],
      { after: 50 }
    ));
  });
  return lines.join('');
}

function buildExtract(q) {
  const prompt = q.prompt || q.text || '';
  const options = q.options && q.options.length ? q.options : [];
  const lines = [];
  if (prompt) lines.push(paragraph([run(prompt, { sz: 28 })], { after: 80 }));
  options.forEach((opt) => {
    const text = typeof opt === 'string' ? opt : (opt.text || '');
    lines.push(paragraph([run('□   ', { sz: 28 }), run(text, { sz: 28 })], { after: 50 }));
  });
  if (!options.length) lines.push(answerLines(2, 55));
  return lines.join('');
}

function buildOpen(q) {
  const prompt = q.prompt || q.text || '';
  const lineCount = q.answerLines || 4;
  const lines = [];
  if (prompt) lines.push(paragraph([run(prompt, { sz: 28 })], { after: 80 }));
  lines.push(answerLines(lineCount, 65));
  return lines.join('');
}

function buildQuestionBody(q) {
  const type = (q.type || 'OPEN').toUpperCase();
  if (type === 'MCQ') return buildMCQ(q);
  if (type === 'TRUE_FALSE') return buildTrueFalse(q);
  if (type === 'FILL_BLANK') return buildFillBlank(q);
  if (type === 'MATCHING') return buildMatching(q);
  if (type === 'ORDERING' || type === 'ORDER') return buildOrdering(q);
  if (type === 'EXTRACT') return buildExtract(q);
  return buildOpen(q);
}

/* ══════════════════════════════════════════════════════════════════
   OFFICIAL GRADING TABLE (جدول إسناد الأعداد)
   ══════════════════════════════════════════════════════════════════ */

function buildCriteriaTable(criteria) {
  if (!criteria?.length) return '';

  const n = criteria.length;
  const colW = Math.floor(7000 / n);
  const titleRow = cellXml(cellPara('جدول إسناد الأعداد', { bold: true, sz: 30, font: FONT_TITLE }), { width: 9500, columnSpan: n + 2 });

  let headerRow =
    cellXml(cellPara('المعيار', { bold: true, sz: 26 }), { width: 2500, shading: HEADER_FILL });
  criteria.forEach((c, i) => {
    headerRow += cellXml(cellPara(c.id || `مع${i + 1}`, { bold: true, sz: 26 }), { width: colW, shading: HEADER_FILL });
  });
  headerRow += cellXml(cellPara('العدد', { bold: true, sz: 26 }), { width: 1200, shading: HEADER_FILL });

  const levelRow = (symbol, key) => {
    let row = cellXml(cellPara(symbol, { bold: true, sz: 26 }), { width: 2500 });
    criteria.forEach((c) => {
      const m = c.mastery || {};
      row += cellXml(cellPara(String(m[key] ?? 0), { sz: 26 }), { width: colW });
    });
    row += cellXml(cellPara('', { sz: 26 }), { width: 1200 });
    return row;
  };

  const minCriteria = criteria.filter((c) => !c.excellence);
  const excCriteria = criteria.filter((c) => c.excellence);
  const spanAll = n + 2;

  const sectionRow = (label) => cellXml(cellPara(label, { bold: true, sz: 24 }), { width: 9500, columnSpan: spanAll, shading: 'E2EFDA' });

  const labelRowsFor = (list) => list.map((c) => {
    let r = cellXml(cellPara(c.label || c.id || '', { sz: 24, align: 'right' }), { width: 2500 });
    for (let i = 0; i < n; i++) r += cellXml(cellPara('', { sz: 24 }), { width: colW });
    r += cellXml(cellPara('', { sz: 24 }), { width: 1200 });
    return r;
  });

  const rows = [titleRow, headerRow];
  if (excCriteria.length > 0 && minCriteria.length > 0) {
    rows.push(sectionRow('معايير الحد الأدنى'));
    rows.push(...labelRowsFor(minCriteria));
    rows.push(sectionRow('معيار التميز'));
    rows.push(...labelRowsFor(excCriteria));
  } else {
    rows.push(...labelRowsFor(criteria));
  }
  rows.push(sectionRow('عتبات التملك'));
  rows.push(levelRow('[---]', 'none'));
  rows.push(levelRow('[+---]', 'below'));
  rows.push(levelRow('[-++]', 'min'));
  rows.push(levelRow('[+++]', 'max'));

  const totalMax = criteria.reduce((s, c) => s + (Number(c.mastery?.max) || 0), 0);
  let totalRow = cellXml(cellPara('المجموع', { bold: true, sz: 26 }), { width: 2500, shading: 'E2EFDA' });
  for (let i = 0; i < n; i++) totalRow += cellXml(cellPara('', { sz: 26 }), { width: colW, shading: 'E2EFDA' });
  totalRow += cellXml(cellPara(`${totalMax} / 20`, { bold: true, sz: 26 }), { width: 1200, shading: 'E2EFDA' });
  rows.push(totalRow);

  return paragraph([run('')], { before: 240 }) + table(rows, { width: 9500, cols: n + 2 });
}

/* ══════════════════════════════════════════════════════════════════
   DOCUMENT ASSEMBLY
   ══════════════════════════════════════════════════════════════════ */

function buildDocumentXml(bodyContent) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:wpc="http://schemas.microsoft.com/office/word/2010/wordprocessingCanvas"
            xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
            xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"
            xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"
            xmlns:o="urn:schemas-microsoft-com:office:office"
            xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
            xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math"
            xmlns:v="urn:schemas-microsoft-com:vml"
            xmlns:wp14="http://schemas.microsoft.com/office/word/2010/wordprocessingDrawing"
            xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"
            xmlns:w10="urn:schemas-microsoft-com:office:word"
            xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
            xmlns:w14="http://schemas.microsoft.com/office/word/2010/wordml"
            xmlns:wpg="http://schemas.microsoft.com/office/word/2010/wordprocessingGroup"
            xmlns:wpi="http://schemas.microsoft.com/office/word/2010/wordprocessingInk"
            xmlns:wne="http://schemas.microsoft.com/office/word/2006/wordml"
            xmlns:wps="http://schemas.microsoft.com/office/word/2010/wordprocessingShape"
            mc:Ignorable="w14 wp14">
  <w:body>
    ${bodyContent}
    <w:sectPr>
      <w:pgSz w:w="11906" w:h="16838"/>
      <w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134" w:header="720" w:footer="720" w:gutter="0"/>
      <w:cols w:space="720"/>
      <w:docGrid w:linePitch="360"/>
    </w:sectPr>
  </w:body>
</w:document>`;
}

function buildContentTypes(images = []) {
  const imgOverrides = images.map((img, i) =>
    `  <Override PartName="/word/media/image${i + 1}${img.ext}" ContentType="image/${img.ext === '.png' ? 'png' : 'jpeg'}"/>`
  ).join('\n');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
  <Override PartName="/word/fontTable.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.fontTable+xml"/>
${imgOverrides}
</Types>`;
}

function buildRels() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;
}

function buildDocRels(images = []) {
  const imgRels = images.map((img, i) =>
    `  <Relationship Id="${img.rid}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/image${i + 1}${img.ext}"/>`
  ).join('\n');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/fontTable" Target="fontTable.xml"/>
${imgRels}
</Relationships>`;
}

function buildStyles() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:docDefaults>
    <w:rPrDefault><w:rPr><w:rFonts w:ascii="${FONT_BODY}" w:hAnsi="${FONT_BODY}" w:cs="${FONT_BODY}"/><w:sz w:val="28"/><w:szCs w:val="28"/><w:lang w:val="ar-TN" w:bidi="ar-SA"/></w:rPr></w:rPrDefault>
    <w:pPrDefault><w:pPr><w:jc w:val="right"/></w:pPr></w:pPrDefault>
  </w:docDefaults>
  <w:style w:type="paragraph" w:default="1" w:styleId="Normal">
    <w:name w:val="Normal"/>
    <w:rPr><w:rFonts w:ascii="${FONT_BODY}" w:hAnsi="${FONT_BODY}" w:cs="${FONT_BODY}"/><w:sz w:val="28"/><w:szCs w:val="28"/><w:rtl/><w:lang w:val="ar-TN" w:bidi="ar-SA"/></w:rPr>
  </w:style>
</w:styles>`;
}

function buildFontTable() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:fonts xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:font w:name="${FONT_TITLE}"><w:charset w:val="178"/><w:family w:val="auto"/><w:pitch w:val="variable"/></w:font>
  <w:font w:name="${FONT_BODY}"><w:charset w:val="178"/><w:family w:val="auto"/><w:pitch w:val="variable"/></w:font>
</w:fonts>`;
}

function groupIntoSections(questions) {
  const groups = [];
  const bySection = new Map();
  questions.forEach((q) => {
    const key = q.section ?? q.criterion ?? 1;
    if (!bySection.has(key)) {
      bySection.set(key, { id: key, title: q.sectionTitle || '', questions: [] });
      groups.push(bySection.get(key));
    }
    bySection.get(key).questions.push(q);
  });
  return groups;
}

export async function buildOfficialDocx(examData, context = {}) {
  const {
    title, subject, level, trimester,
    questions = [], criteria: rawCriteria,
    passages = [], durationMinutes = 60
  } = examData;

  const subjectKey = typeof subject === 'string' ? subject.toLowerCase().replace(/[^a-z-]/g, '') : '';
  const criteria = rawCriteria || DEFAULT_CRITERIA[subjectKey] || DEFAULT_CRITERIA.arabic;

  const { list: images, indexOf: imageIndexOf } = collectVisuals(passages, questions);
  let docPrId = 10;
  const imgParaFor = (visual) => {
    const idx = visual ? imageIndexOf(visual) : undefined;
    if (idx === undefined) return '';
    return imageParagraph(images[idx], ++docPrId);
  };

  const bodyParts = [];

  bodyParts.push(buildHeader({
    ...context, subject, level, trimester, durationMinutes, title
  }));
  bodyParts.push(emptyPara());

  passages.forEach((p, i) => {
    const text = typeof p === 'string' ? p : (p.text || '');
    const pTitle = typeof p === 'object' ? (p.title || '') : '';
    if (pTitle) bodyParts.push(buildSanad(i + 1, pTitle));
    if (p && typeof p === 'object') {
      const ip = imgParaFor(p.image || p.visual);
      if (ip) bodyParts.push(ip);
    }
    bodyParts.push(paragraph([run(text, { sz: 28 })], { after: 100 }));
    bodyParts.push(emptyPara());
  });

  const groups = groupIntoSections(questions);
  groups.forEach((g, gi) => {
    const mainNum = gi + 1;
    if (g.title) {
      bodyParts.push(buildSanad(mainNum, g.title));
    }
    g.questions.forEach((q, qi) => {
      const label = q.label || `التعليمة ${mainNum}-${qi + 1}`;
      const instruction = q.instruction || q.prompt || q.text || '';
      const points = q.points || '';
      const hasOwnPrompt = ['MCQ', 'TRUE_FALSE', 'FILL_BLANK', 'MATCHING', 'ORDERING', 'ORDER', 'EXTRACT'].includes((q.type || '').toUpperCase());
      bodyParts.push(buildTaalimaHeader(label, hasOwnPrompt ? '' : instruction, points));
      if (hasOwnPrompt && instruction && q.type && (q.type || '').toUpperCase() !== 'OPEN') {
        // instruction shown above via header; body renders prompt/options
      }
      const qImg = imgParaFor(q.visual || q.image);
      if (qImg) bodyParts.push(qImg);
      const bodyQ = { ...q };
      if (!hasOwnPrompt) bodyQ.prompt = '';
      else if (!bodyQ.prompt && !bodyQ.text && instruction) bodyQ.prompt = instruction;
      bodyParts.push(buildQuestionBody(bodyQ));
      // مساحة مخصّصة §D12/§B3: عملية عمودية أو رسم — بلاها تُطبع الورقة بلا مكان للحل
      if ((q.layout || '') === 'vertical') bodyParts.push(verticalSpaceBox());
      else if ((q.layout || '') === 'drawing') bodyParts.push(drawingSpaceBox());
      bodyParts.push(emptyPara());
    });
  });

  bodyParts.push(buildCriteriaTable(criteria));

  const bodyXml = bodyParts.join('\n');
  const documentXml = buildDocumentXml(bodyXml);

  const zip = new JSZip();
  zip.file('[Content_Types].xml', buildContentTypes(images));
  zip.file('_rels/.rels', buildRels());
  zip.file('word/_rels/document.xml.rels', buildDocRels(images));
  images.forEach((img, i) => {
    zip.file(`word/media/image${i + 1}${img.ext}`, img.buf);
  });
  zip.file('word/document.xml', documentXml);
  zip.file('word/styles.xml', buildStyles());
  zip.file('word/fontTable.xml', buildFontTable());

  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
}

export function prepareExamForDocx(content, context = {}) {
  if (!content) return null;

  const rawQuestions = Array.isArray(content.questions) && content.questions.length
    ? content.questions
    : (Array.isArray(content.items) ? content.items : []);

  const questions = rawQuestions.map((q, i) => ({
    id: q.id || `q${i + 1}`,
    section: q.section ?? q.criterion ?? Math.floor(i / 3) + 1,
    sectionTitle: q.sectionTitle || '',
    label: q.label || `التعليمة ${q.section ?? Math.floor(i / 3) + 1}-${((i % 3) + 1)}`,
    instruction: q.instruction || '',
    prompt: q.prompt || q.text || '',
    type: q.type || (Array.isArray(q.options) && q.options.length ? 'MCQ' : 'OPEN'),
    options: q.options, correct: q.correct, correctAnswer: q.correctAnswer,
    orderItems: q.orderItems, points: q.points || 1,
    answerLines: q.answerLines || 4,
    items: q.items, leftItems: q.leftItems, rightItems: q.rightItems,
    statements: q.statements, visual: q.visual || q.image, image: q.image || q.visual,
    layout: q.layout
  }));

  return {
    title: content.title || context.title || 'اختبار',
    subject: content.subject || context.subject,
    level: content.level ?? context.level,
    trimester: content.trimester ?? context.trimester,
    questions, criteria: content.criteria,
    passages: content.passages || [],
    durationMinutes: content.durationMinutes || context.durationMinutes || 60,
    totalPoints: content.totalPoints || 20
  };
}

export { SUBJECT_MAP, LEVEL_NAMES, DEFAULT_CRITERIA, TRIMESTER_NAMES };
