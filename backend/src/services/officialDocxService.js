import JSZip from 'jszip';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const SUBJECT_MAP = {
  arabic: 'اللغة العربية', french: 'اللغة الفرنسية', english: 'اللغة الإنجليزية',
  math: 'الرياضيات', science: 'العلوم الطبيعية', 'history-geography': 'التاريخ والجغرافيا',
  islamic: 'التربية الإسلامية', civic: 'التربية المدنية', art: 'التربية التشكيلية',
  music: 'التربية الموسيقية', pe: 'التربية البدنية', technology: 'التكنولوجيا'
};

const LEVEL_NAMES = {
  1: 'السنة الأولى أساسي', 2: 'السنة الثانية أساسي', 3: 'السنة الثالثة أساسي',
  4: 'السنة الرابعة أساسي', 5: 'السنة الخامسة أساسي', 6: 'السنة السادسة أساسي'
};

const DEFAULT_CRITERIA = {
  arabic: [
    { id: 'القراءة', label: 'القراءة', mastery: { none: 0, below: 1, min: 2, max: 3 } },
    { id: 'الكتابة', label: 'الكتابة', mastery: { none: 0, below: 1.5, min: 3, max: 4.5 } },
    { id: 'المعالجة اللغوية', label: 'المعالجة اللغوية', mastery: { none: 0, below: 1.5, min: 3, max: 4.5 } }
  ],
  math: [
    { id: 'المفاهيم الرياضية', label: 'المفاهيم الرياضية', mastery: { none: 0, below: 1, min: 2, max: 3 } },
    { id: 'المهارات الحسابية', label: 'المهارات الحسابية', mastery: { none: 0, below: 1.5, min: 3, max: 4.5 } },
    { id: 'حل المسائل', label: 'حل المسائل', mastery: { none: 0, below: 1.5, min: 3, max: 4.5 } }
  ],
  science: [
    { id: 'المفاهيم العلمية', label: 'المفاهيم العلمية', mastery: { none: 0, below: 1, min: 2, max: 3 } },
    { id: 'المهارات العلمية', label: 'المهارات العلمية', mastery: { none: 0, below: 1.5, min: 3, max: 4.5 } },
    { id: 'المعالجة العلمية', label: 'المعالجة العلمية', mastery: { none: 0, below: 1.5, min: 3, max: 4.5 } }
  ],
  french: [
    { id: 'القراءة', label: 'القراءة', mastery: { none: 0, below: 1, min: 2, max: 3 } },
    { id: 'الكتابة', label: 'الكتابة', mastery: { none: 0, below: 1.5, min: 3, max: 4.5 } },
    { id: 'المعالجة اللغوية', label: 'المعالجة اللغوية', mastery: { none: 0, below: 1.5, min: 3, max: 4.5 } }
  ]
};

function esc(text) {
  return String(text ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function dottedLine(n = 30) { return '\u00B7'.repeat(n); }

const FONT = 'Simplified Arabic';
const RTL = 'rtl';

function run(text, opts = {}) {
  const r = [`<w:r><w:rPr><w:rFonts w:ascii="${FONT}" w:hAnsi="${FONT}" w:cs="${FONT}"/><w:sz w:val="${opts.sz || 22}"/><w:szCs w:val="${opts.sz || 22}"/>`];
  if (opts.bold) r.push('<w:b/><w:bCs/>');
  if (opts.italics) r.push('<w:i/><w:iCs/>');
  if (opts.underline) r.push('<w:u w:val="single"/>');
  if (opts.color) r.push(`<w:color w:val="${opts.color}"/>`);
  r.push(`</w:rPr><w:t xml:space="preserve">${esc(text)}</w:t></w:r>`);
  return r.join('');
}

function paragraph(children, opts = {}) {
  const pPr = [`<w:pPr><w:pStyle w:val="Normal"/>`];
  pPr.push(`<w:jc w:val="${opts.align || 'right'}"/>`);
  pPr.push(`<w:rPr><w:rFonts w:ascii="${FONT}" w:hAnsi="${FONT}" w:cs="${FONT}"/><w:sz w:val="${opts.sz || 22}"/><w:szCs w:val="${opts.sz || 22}"/>`);
  if (opts.bold) pPr.push('<w:b/><w:bCs/>');
  pPr.push('</w:rPr>');
  if (opts.spacing) pPr.push(`<w:spacing w:before="${opts.spacing.before || 0}" w:after="${opts.spacing.after || 80}" w:line="${opts.spacing.line || 276}" w:lineRule="auto"/>`);
  if (opts.indent) pPr.push(`<w:ind w:right="${opts.indent}" w:left="${opts.indentLeft || 0}"/>`);
  if (opts.pageBreakBefore) pPr.push('<w:pageBreakBefore/>');
  pPr.push('</w:pPr>');
  return `<w:p>${pPr.join('')}${children.join('')}</w:p>`;
}

function cell(text, opts = {}) {
  const cellPr = ['<w:tcPr>'];
  if (opts.width) cellPr.push(`<w:tcW w:w="${opts.width}" w:type="dxa"/>`);
  cellPr.push(`<w:vAlign w:val="${opts.vAlign || 'center'}"/>`);
  if (opts.shading) cellPr.push(`<w:shd w:val="clear" w:color="auto" w:fill="${opts.shading}"/>`);
  if (opts.columnSpan) cellPr.push(`<w:gridSpan w:val="${opts.columnSpan}"/>`);
  cellPr.push('<w:tcBorders>');
  ['top', 'bottom', 'start', 'end'].forEach(side => {
    cellPr.push(`<w:${side} w:val="single" w:sz="4" w:space="0" w:color="000000"/>`);
  });
  cellPr.push('</w:tcBorders>');
  cellPr.push('<w:textDirection w:val="lr"/>');
  cellPr.push('</w:tcPr>');

  const align = opts.align || 'center';
  const pContent = [run(text, { sz: opts.sz || 20, bold: opts.bold })];
  const pPr = `<w:pPr><w:jc w:val="${align}"/><w:spacing w:before="40" w:after="40"/></w:pPr>`;

  return `<w:tc>${cellPr.join('')}${pPr}${pContent.join('')}</w:tc>`;
}

function table(rows, opts = {}) {
  const tblPr = [`<w:tblPr><w:tblStyle w:val="TableGrid"/>`];
  tblPr.push(`<w:tblW w:w="${opts.width || 9000}" w:type="dxa"/>`);
  tblPr.push('<w:tblBorders>');
  ['top', 'bottom', 'start', 'end', 'insideH', 'insideV'].forEach(side => {
    tblPr.push(`<w:${side} w:val="single" w:sz="4" w:space="0" w:color="000000"/>`);
  });
  tblPr.push('</w:tblBorders>');
  tblPr.push('<w:tblLayout w:type="fixed"/>');
  tblPr.push('</w:tblPr>');

  const tblGrid = rows[0] ? rows[0].map(() => '<w:gridCol w:w="1500"/>').join('') : '';
  const tblRows = rows.map(r => `<w:tr>${r.join('')}</w:tr>`).join('');

  return `<w:tbl>${tblPr.join('')}${tblGrid ? `<w:tblGrid>${tblGrid}</w:tblGrid>` : ''}${tblRows}</w:tbl>`;
}

function emptyPara() {
  return `<w:p><w:pPr><w:spacing w:before="0" w:after="0"/></w:pPr></w:p>`;
}

/* ══════════════════════════════════════════════════════════════════
   BUILD HEADER
   ══════════════════════════════════════════════════════════════════ */

function buildHeader(context = {}) {
  const school = context.school || 'المدرسة الإبتدائية';
  const subjectLabel = SUBJECT_MAP[context.subject] || context.subject || '';
  const levelLabel = LEVEL_NAMES[context.level] || context.level || '';
  const trimester = context.trimester ? `الفصل ${context.trimester}` : '';
  const date = context.date || new Date().toLocaleDateString('ar-TN');
  const duration = context.durationMinutes || 60;
  const teacher = context.teacherName || '...........';
  const studentName = context.studentName || '................................';
  const studentClass = context.studentClass || '................................';

  const rows = [
    [cell(school, { bold: true, width: 3000 }), cell(`تقويم مكتسبات التلاميذ\n${subjectLabel}${trimester ? ' — ' + trimester : ''}`, { bold: true, width: 4500 }), cell(date, { width: 2000 })],
    [cell(`المستوى والقسم: ${levelLabel}`, { width: 3000 }), cell(`المعلم واللقب: ${teacher}`, { width: 4500 }), cell(`التوقيت: ${duration} د`, { width: 2000 })],
    [cell(`الاسم واللقب: ${studentName}`, { width: 4500 }), cell(`القسم: ${studentClass}`, { width: 2500 }), cell(`المستوى: ${levelLabel}`, { width: 2000 })]
  ];

  return table(rows, { width: 9500 });
}

/* ══════════════════════════════════════════════════════════════════
   BUILD QUESTIONS
   ══════════════════════════════════════════════════════════════════ */

function buildPassage(passage) {
  if (!passage?.text) return '';
  return paragraph([run(passage.text)], { spacing: { after: 120, line: 300 }, indent: 400 });
}

function buildSectionHeader(index, title) {
  return paragraph([run(`السند ${index}: `, { bold: true, sz: 24 }), run(title || '', { sz: 22 })], { spacing: { before: 200, after: 100 } });
}

function buildSubQuestion(label, instruction, question, subIndex) {
  const elements = [];

  elements.push(paragraph([run(`${label}: `, { bold: true, sz: 22 }), run(instruction, { sz: 22 })], { spacing: { after: 60 } }));

  if (question.type === 'MCQ') {
    elements.push(...buildMCQ(question));
  } else if (question.type === 'TRUE_FALSE') {
    elements.push(...buildTrueFalse(question));
  } else if (question.type === 'FILL_BLANK') {
    elements.push(...buildFillBlank(question));
  } else if (question.type === 'MATCHING') {
    elements.push(...buildMatching(question));
  } else if (question.type === 'ORDERING') {
    elements.push(...buildOrdering(question));
  } else {
    elements.push(...buildOpen(question));
  }

  return elements.join('');
}

function buildMCQ(q) {
  const prompt = q.prompt || q.text || '';
  const options = q.options || ['أ', 'ب', 'ج'];
  const lines = [];
  if (prompt) lines.push(paragraph([run(prompt)], { spacing: { after: 60 }, indent: 400 }));
  options.forEach((opt, i) => {
    const text = typeof opt === 'string' ? opt : opt.text || '';
    lines.push(paragraph([run(`  ▲  `, { bold: true }), run(text)], { spacing: { after: 40 }, indent: 600 }));
  });
  return lines.join('');
}

function buildTrueFalse(q) {
  const stmts = q.statements || [{ text: q.prompt || q.text || '' }];
  return stmts.map((s, i) => {
    const text = typeof s === 'string' ? s : s.text || '';
    return paragraph([run(`  ${i + 1})  `, { bold: true }), run(text), run('   (  ) صحيح     (  ) خطأ', { sz: 20, bold: true })], { spacing: { after: 60 }, indent: 400 });
  }).join('');
}

function buildFillBlank(q) {
  const items = q.items || [{ text: q.prompt || q.text || '' }];
  return items.map((item, i) => {
    const text = typeof item === 'string' ? item : item.text || '';
    const parts = text.split(/_{3,}/);
    if (parts.length > 1) {
      const children = [run(`  ${i + 1})  `, { bold: true })];
      parts.forEach((part, j) => {
        children.push(run(part));
        if (j < parts.length - 1) children.push(run(dottedLine(15), { underline: true }));
      });
      return paragraph(children, { spacing: { after: 60 }, indent: 400 });
    }
    return paragraph([run(`  ${i + 1})  `, { bold: true }), run(text), run(`   ${dottedLine(20)}`, { underline: true })], { spacing: { after: 60 }, indent: 400 });
  }).join('');
}

function buildMatching(q) {
  const left = q.leftItems || [];
  const right = q.rightItems || [];
  const lines = [];
  if (q.prompt) lines.push(paragraph([run(q.prompt)], { spacing: { after: 80 } }));
  const maxLen = Math.max(left.length, right.length);
  const rows = [];
  for (let i = 0; i < maxLen; i++) {
    rows.push([
      cell(left[i] ? `${i + 1}) ${left[i]}` : '', { width: 4000, align: 'right' }),
      cell('', { width: 1000 }),
      cell(right[i] ? `${String.fromCharCode(1571 + i)}) ${right[i]}` : '', { width: 4000, align: 'right' })
    ]);
  }
  lines.push(table(rows, { width: 9000 }));
  return lines.join('');
}

function buildOrdering(q) {
  const items = q.items || q.orderItems || [];
  const lines = [];
  if (q.prompt) lines.push(paragraph([run(q.prompt)], { spacing: { after: 80 } }));
  items.forEach((item, i) => {
    const text = typeof item === 'string' ? item : item.text || '';
    lines.push(paragraph([run(`  ${i + 1})  `, { bold: true }), run(text), run(`   ${dottedLine(10)}`, { underline: true })], { spacing: { after: 40 }, indent: 400 }));
  });
  return lines.join('');
}

function buildOpen(q) {
  const prompt = q.prompt || q.text || '';
  const lineCount = q.answerLines || 3;
  const lines = [];
  if (prompt) lines.push(paragraph([run(prompt)], { spacing: { after: 80 } }));
  for (let i = 0; i < lineCount; i++) {
    lines.push(paragraph([run(dottedLine(60), { underline: true })], { spacing: { after: 40 }, indent: 200 }));
  }
  return lines.join('');
}

/* ══════════════════════════════════════════════════════════════════
   BUILD CRITERIA TABLE
   ══════════════════════════════════════════════════════════════════ */

function buildCriteriaTable(criteria) {
  if (!criteria?.length) return '';

  const titleRow = [cell('جدول إسناد الأعداد', { bold: true, width: 9000, columnSpan: 6, shading: 'D9E2F3' })];

  const headerRow = [
    cell('المعيار', { bold: true, width: 2500, shading: 'D9E2F3' }),
    cell('انعدام التملك\n(---)', { bold: true, sz: 16, width: 1300, shading: 'D9E2F3' }),
    cell('دون التملك\n(--+)', { bold: true, sz: 16, width: 1300, shading: 'D9E2F3' }),
    cell('التملك الأدنى\n(-++)', { bold: true, sz: 16, width: 1300, shading: 'D9E2F3' }),
    cell('التملك الأقصى\n(+++)', { bold: true, sz: 16, width: 1300, shading: 'D9E2F3' }),
    cell('المجموع', { bold: true, width: 1300, shading: 'D9E2F3' })
  ];

  const dataRows = criteria.map(c => {
    const m = c.mastery || {};
    return [
      cell(c.label || c.id || '', { width: 2500, align: 'right' }),
      cell(String(m.none ?? 0), { width: 1300 }),
      cell(String(m.below ?? 0), { width: 1300 }),
      cell(String(m.min ?? 0), { width: 1300 }),
      cell(String(m.max ?? 0), { width: 1300 }),
      cell(String(m.max ?? 0), { bold: true, width: 1300 })
    ];
  });

  const totalMax = criteria.reduce((s, c) => s + (c.mastery?.max || 0), 0);
  const totalRow = [
    cell('المجموع الكلي', { bold: true, width: 2500, shading: 'E2EFDA' }),
    cell('', { width: 1300, shading: 'E2EFDA' }),
    cell('', { width: 1300, shading: 'E2EFDA' }),
    cell('', { width: 1300, shading: 'E2EFDA' }),
    cell(String(totalMax), { bold: true, width: 1300, shading: 'E2EFDA' }),
    cell(`${totalMax} / 20`, { bold: true, width: 1300, shading: 'E2EFDA' })
  ];

  return paragraph([run('')], { spacing: { before: 200 } }) + table([titleRow, headerRow, ...dataRows, totalRow], { width: 9000 });
}

/* ══════════════════════════════════════════════════════════════════
   GENERATE DOCX
   ══════════════════════════════════════════════════════════════════ */

function buildDocumentXml(bodyContent) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:wpc="http://schemas.microsoft.com/office/word/2010/wordprocessingCanvas"
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
    <w:sectPr>
      <w:pgSz w:w="11906" w:h="16838"/>
      <w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134" w:header="720" w:footer="720" w:gutter="0"/>
      <w:cols w:space="720"/>
    </w:sectPr>
    ${bodyContent}
  </w:body>
</w:document>`;
}

function buildContentTypes() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
</Types>`;
}

function buildRels() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;
}

function buildDocRels() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;
}

function buildStyles() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:style w:type="paragraph" w:default="1" w:styleId="Normal">
    <w:name w:val="Normal"/>
    <w:rPr><w:rFonts w:ascii="${FONT}" w:hAnsi="${FONT}" w:cs="${FONT}"/><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr>
  </w:style>
</w:styles>`;
}

export async function buildOfficialDocx(examData, context = {}) {
  const {
    title, subject, level, trimester,
    questions = [], criteria: rawCriteria,
    passages = [], durationMinutes = 60, totalPoints = 20
  } = examData;

  const subjectKey = typeof subject === 'string' ? subject.toLowerCase().replace(/[^a-z-]/g, '') : '';
  const criteria = rawCriteria || DEFAULT_CRITERIA[subjectKey] || DEFAULT_CRITERIA.arabic;

  const bodyParts = [];

  bodyParts.push(buildHeader({
    ...context, subject, level, trimester, durationMinutes
  }));
  bodyParts.push(emptyPara());

  passages.forEach(p => {
    bodyParts.push(buildPassage(p));
    bodyParts.push(emptyPara());
  });

  let mainIdx = 0;
  const subCounters = {};

  questions.forEach((q, gi) => {
    const mainId = q.section || q.mainIndex || Math.floor(gi / 3) + 1;
    if (!subCounters[mainId]) { subCounters[mainId] = 0; mainIdx++; }
    subCounters[mainId]++;

    if (subCounters[mainId] === 1) {
      bodyParts.push(buildSectionHeader(mainId, q.sectionTitle || q.title || ''));
    }

    const label = q.label || `التعليمة ${mainId}-${subCounters[mainId]}`;
    bodyParts.push(buildSubQuestion(label, q.instruction || '', q, subCounters[mainId]));
    bodyParts.push(emptyPara());
  });

  bodyParts.push(paragraph([run('')], { pageBreakBefore: true }));
  bodyParts.push(buildCriteriaTable(criteria));

  const bodyXml = bodyParts.join('\n');
  const documentXml = buildDocumentXml(bodyXml);

  const zip = new JSZip();
  zip.file('[Content_Types].xml', buildContentTypes());
  zip.file('_rels/.rels', buildRels());
  zip.file('word/_rels/document.xml.rels', buildDocRels());
  zip.file('word/document.xml', documentXml);
  zip.file('word/styles.xml', buildStyles());

  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
}

export function prepareExamForDocx(content, context = {}) {
  if (!content) return null;

  const questions = (content.questions || []).map((q, i) => ({
    id: q.id || `q${i + 1}`,
    section: q.section || q.criterion || Math.floor(i / 3) + 1,
    sectionTitle: q.sectionTitle || '',
    label: q.label || `التعليمة ${q.section || Math.floor(i / 3) + 1}-${((i % 3) + 1)}`,
    instruction: q.instruction || q.prompt || q.text || '',
    prompt: q.prompt || q.text || '',
    type: q.type || 'OPEN',
    options: q.options, correct: q.correct, correctAnswer: q.correctAnswer,
    orderItems: q.orderItems, points: q.points || 1,
    answerLines: q.answerLines || 3,
    items: q.items, leftItems: q.leftItems, rightItems: q.rightItems,
    statements: q.statements, visual: q.visual
  }));

  return {
    title: content.title || 'اختبار رسمي',
    subject: content.subject || context.subject,
    level: content.level || context.level,
    trimester: content.trimester || context.trimester,
    questions, criteria: content.criteria,
    passages: content.passages || [],
    durationMinutes: content.durationMinutes || context.durationMinutes || 60,
    totalPoints: content.totalPoints || 20
  };
}

export { SUBJECT_MAP, LEVEL_NAMES, DEFAULT_CRITERIA };
