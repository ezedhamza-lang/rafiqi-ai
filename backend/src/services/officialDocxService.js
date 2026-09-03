import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  AlignmentType, WidthType, BorderStyle, HeadingLevel, TableLayoutType,
  ShadingType, VerticalAlign, PageOrientation, TabStopType, TabStopPosition,
  UnderlineType, ImageRun, HorizontalPositionAlign, HorizontalPositionRelativeFrom,
  VerticalPositionAlign, VerticalPositionRelativeFrom, NumberFormat
} from 'docx';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/* ══════════════════════════════════════════════════════════════════════════
   CONSTANTS — Tunisian Ministry of Education Exam Template
   ══════════════════════════════════════════════════════════════════════════ */

const ARABIC_FONT = 'Simplified Arabic';
const FONT_SIZE = { small: 18, normal: 22, large: 24, title: 28 };
const PT_TO_EMU = 12700;
const BORDER_THIN = { style: BorderStyle.SINGLE, size: 1, color: '000000' };
const BORDER_NONE = { style: BorderStyle.NONE, size: 0 };
const CELL_FULL_BORDER = { top: BORDER_THIN, bottom: BORDER_THIN, left: BORDER_THIN, right: BORDER_THIN };
const CELL_NO_BORDER = { top: BORDER_NONE, bottom: BORDER_NONE, left: BORDER_NONE, right: BORDER_NONE };

const MASTERY_LEVELS = [
  { key: 'none', label: 'انعدام التملك', symbol: '---' },
  { key: 'below', label: 'دون التملك الأدنى', symbol: '--+' },
  { key: 'min', label: 'التملك الأدنى', symbol: '-++' },
  { key: 'max', label: 'التملك الأقصى', symbol: '+++' }
];

const DEFAULT_CRITERIA_PRESETS = {
  'arabic': [
    { id: 'القراءة', label: 'القراءة', mastery: { none: 0, below: 1, min: 2, max: 3 } },
    { id: 'الكتابة', label: 'الكتابة', mastery: { none: 0, below: 1.5, min: 3, max: 4.5 } },
    { id: 'المعالجة اللغوية', label: 'المعالجة اللغوية', mastery: { none: 0, below: 1.5, min: 3, max: 4.5 } }
  ],
  'math': [
    { id: 'المفاهيم الرياضية', label: 'المفاهيم الرياضية', mastery: { none: 0, below: 1, min: 2, max: 3 } },
    { id: 'المهارات الحسابية', label: 'المهارات الحسابية', mastery: { none: 0, below: 1.5, min: 3, max: 4.5 } },
    { id: 'حل المسائل', label: 'حل المسائل', mastery: { none: 0, below: 1.5, min: 3, max: 4.5 } }
  ],
  'science': [
    { id: 'المفاهيم العلمية', label: 'المفاهيم العلمية', mastery: { none: 0, below: 1, min: 2, max: 3 } },
    { id: 'المهارات العلمية', label: 'المهارات العلمية', mastery: { none: 0, below: 1.5, min: 3, max: 4.5 } },
    { id: 'المعالجة العلمية', label: 'المعالجة العلمية', mastery: { none: 0, below: 1.5, min: 3, max: 4.5 } }
  ],
  'french': [
    { id: 'القراءة', label: 'القراءة', mastery: { none: 0, below: 1, min: 2, max: 3 } },
    { id: 'الكتابة', label: 'الكتابة', mastery: { none: 0, below: 1.5, min: 3, max: 4.5 } },
    { id: 'المعالجة اللغوية', label: 'المعالجة اللغوية', mastery: { none: 0, below: 1.5, min: 3, max: 4.5 } }
  ],
  'history-geography': [
    { id: 'المفاهيم', label: 'المفاهيم', mastery: { none: 0, below: 1, min: 2, max: 3 } },
    { id: 'المهارات', label: 'المهارات', mastery: { none: 0, below: 1.5, min: 3, max: 4.5 } },
    { id: 'المعالجة', label: 'المعالجة', mastery: { none: 0, below: 1.5, min: 3, max: 4.5 } }
  ]
};

const SUBJECT_MAP = {
  'arabic': 'اللغة العربية',
  'french': 'اللغة الفرنسية',
  'english': 'اللغة الإنجليزية',
  'math': 'الرياضيات',
  'science': 'العلوم الطبيعية',
  'history-geography': 'التاريخ والجغرافيا',
  'islamic': 'التربية الإسلامية',
  'civic': 'التربية المدنية',
  'art': 'التربية التشكيلية',
  'music': 'التربية الموسيقية',
  'pe': 'التربية البدنية',
  'technology': 'التكنولوجيا'
};

const LEVEL_NAMES = {
  1: 'السنة الأولى أساسي',
  2: 'السنة الثانية أساسي',
  3: 'السنة الثالثة أساسي',
  4: 'السنة الرابعة أساسي',
  5: 'السنة الخامسة أساسي',
  6: 'السنة السادسة أساسي'
};

/* ══════════════════════════════════════════════════════════════════════════
   HELPER FUNCTIONS
   ══════════════════════════════════════════════════════════════════════════ */

function txt(text, opts = {}) {
  return new TextRun({
    text: String(text ?? ''),
    font: ARABIC_FONT,
    size: opts.size || FONT_SIZE.normal,
    bold: opts.bold || false,
    italics: opts.italics || false,
    underline: opts.underline ? { type: UnderlineType.SINGLE } : undefined,
    color: opts.color || '000000',
    ...opts
  });
}

function para(children, opts = {}) {
  const runs = typeof children === 'string'
    ? [txt(children, opts.runOpts)]
    : Array.isArray(children) ? children : [children];
  return new Paragraph({
    children: runs,
    alignment: opts.alignment || AlignmentType.RIGHT,
    direction: 'rtl',
    spacing: opts.spacing || { after: 80, line: 276 },
    indent: opts.indent,
    ...opts.paraOpts
  });
}

function emptyPara(count = 1) {
  const paras = [];
  for (let i = 0; i < count; i++) {
    paras.push(new Paragraph({ children: [txt('')], spacing: { after: 0 } }));
  }
  return paras;
}

function cellBorder(opts = {}) {
  return {
    top: opts.top || BORDER_THIN,
    bottom: opts.bottom || BORDER_THIN,
    left: opts.left || BORDER_THIN,
    right: opts.right || BORDER_THIN
  };
}

function textCell(text, opts = {}) {
  return new TableCell({
    children: [para([txt(text, { size: opts.size || FONT_SIZE.normal, bold: opts.bold })], {
      alignment: opts.alignment || AlignmentType.CENTER,
      spacing: { after: 0 }
    })],
    verticalAlign: VerticalAlign.CENTER,
    borders: opts.borders || CELL_FULL_BORDER,
    shading: opts.shading ? { type: ShadingType.CLEAR, fill: opts.shading } : undefined,
    width: opts.width ? { size: opts.width, type: WidthType.DXA } : undefined,
    columnSpan: opts.columnSpan,
    rowSpan: opts.rowSpan,
    margins: { top: 40, bottom: 40, left: 80, right: 80 }
  });
}

function dottedLine(length = 40) {
  return '·'.repeat(length);
}

function answerLine(length = 30) {
  return dottedLine(length);
}

/* ══════════════════════════════════════════════════════════════════════════
   HEADER — Matches official Ministry template exactly
   ══════════════════════════════════════════════════════════════════════════ */

function buildHeader(context = {}) {
  const school = context.school || 'المدرسة الإبتدائية';
  const examType = context.examType || 'تقويم مكتسبات التلاميذ';
  const subject = context.subjectLabel || SUBJECT_MAP[context.subject] || context.subject || '';
  const level = context.levelName || LEVEL_NAMES[context.level] || context.level || '';
  const trimester = context.trimester ? `الفصل ${context.trimester}` : '';
  const date = context.date || new Date().toLocaleDateString('ar-TN');
  const duration = context.durationMinutes || 60;
  const studentName = context.studentName || '................................';
  const studentClass = context.studentClass || '................................';

  const headerTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.FIXED,
    rows: [
      // Row 1: School name | Exam type | Subject/Date
      new TableRow({
        children: [
          textCell(school, { bold: true, width: 3000 }),
          textCell(`${examType}\n${subject}${trimester ? ' — ' + trimester : ''}`, { bold: true, width: 5000 }),
          textCell(date, { width: 2000 })
        ],
        tableHeader: true
      }),
      // Row 2: Level | Teacher | Duration
      new TableRow({
        children: [
          textCell(`المستوى والقسم: ${level}`, { width: 3000 }),
          textCell(`المعلم واللقب: ${context.teacherName || '...........'}`, { width: 5000 }),
          textCell(`التوقيت: ${duration} دقيقة`, { width: 2000 })
        ]
      }),
      // Row 3: Student name | Class | Level
      new TableRow({
        children: [
          textCell(`الاسم واللقب: ${studentName}`, { width: 5000 }),
          textCell(`القسم: ${studentClass}`, { width: 3000 }),
          textCell(`المستوى: ${level}`, { width: 2000 })
        ]
      })
    ],
    borders: CELL_FULL_BORDER
  });

  return headerTable;
}

/* ══════════════════════════════════════════════════════════════════════════
   QUESTION RENDERERS — Each type matches real exam format
   ══════════════════════════════════════════════════════════════════════════ */

function renderPassage(passage) {
  if (!passage?.text) return [];
  const elements = [];
  elements.push(para([txt(passage.text, { bold: false })], {
    alignment: AlignmentType.RIGHT,
    spacing: { after: 120, line: 300 },
    indent: { left: 400, right: 400 }
  }));
  return elements;
}

function renderQuestionHeader(sندIndex, text, points) {
  const elements = [];
  const headerChildren = [
    txt(`السند ${sندIndex}: `, { bold: true, size: FONT_SIZE.large }),
    txt(text, { size: FONT_SIZE.normal })
  ];
  if (points !== undefined) {
    headerChildren.push(txt(`  (${points} مع)`, { size: FONT_SIZE.small, bold: true }));
  }
  elements.push(para(headerChildren, {
    alignment: AlignmentType.RIGHT,
    spacing: { after: 100, before: 200 }
  }));
  return elements;
}

function renderSubQuestion(label, instruction, question, markColumn, subIndex) {
  const elements = [];
  const labelChildren = [
    txt(`${label}: `, { bold: true, size: FONT_SIZE.normal }),
    txt(instruction, { size: FONT_SIZE.normal })
  ];
  elements.push(para(labelChildren, {
    alignment: AlignmentType.RIGHT,
    spacing: { after: 60 }
  }));

  // Render based on question type
  if (question.type === 'MCQ') {
    elements.push(...renderMCQ(question, subIndex));
  } else if (question.type === 'TRUE_FALSE') {
    elements.push(...renderTrueFalse(question, subIndex));
  } else if (question.type === 'FILL_BLANK') {
    elements.push(...renderFillBlank(question, subIndex));
  } else if (question.type === 'MATCHING') {
    elements.push(...renderMatching(question, subIndex));
  } else if (question.type === 'ORDERING') {
    elements.push(...renderOrdering(question, subIndex));
  } else if (question.type === 'OPEN' || question.type === 'SENTENCE' || question.type === 'WORD_ANALYSIS') {
    elements.push(...renderOpen(question, subIndex));
  } else {
    elements.push(...renderOpen(question, subIndex));
  }

  return elements;
}

/* --- MCQ (اختيار من متعدد) --- */
function renderMCQ(question, subIndex) {
  const elements = [];
  const options = question.options || ['أ', 'ب', 'ج', 'د'];
  const promptText = question.prompt || question.text || '';

  if (promptText) {
    elements.push(para([txt(promptText)], {
      alignment: AlignmentType.RIGHT,
      spacing: { after: 60 }
    }));
  }

  // Visual MCQ with symbols (▲ △ ○ □)
  if (question.visual) {
    // For visual MCQ like year1 math - images with arrows
    const symbols = ['▲', '△', '○', '□'];
    options.forEach((opt, i) => {
      elements.push(para([
        txt(`  ${symbols[i]}  `, { bold: true }),
        txt(typeof opt === 'string' ? opt : opt.text || '', {})
      ], {
        alignment: AlignmentType.RIGHT,
        spacing: { after: 40 },
        indent: { right: 600 }
      }));
    });
  } else {
    // Standard MCQ with ▲ arrows or checkboxes
    const symbols = ['▲', '▲', '▲', '▲'];
    options.forEach((opt, i) => {
      const optText = typeof opt === 'string' ? opt : opt.text || '';
      elements.push(para([
        txt(`  ${symbols[i]}  `, { bold: true }),
        txt(optText, {})
      ], {
        alignment: AlignmentType.RIGHT,
        spacing: { after: 40 },
        indent: { right: 600 }
      }));
    });
  }

  return elements;
}

/* --- TRUE/FALSE (صحيح/خطأ) --- */
function renderTrueFalse(question, subIndex) {
  const elements = [];
  const statements = question.statements || [{ text: question.prompt || question.text || '', correct: question.correct }];

  statements.forEach((stmt, i) => {
    const stmtText = typeof stmt === 'string' ? stmt : stmt.text || '';
    elements.push(para([
      txt(`  ${i + 1})  `, { bold: true }),
      txt(stmtText, {}),
      txt('   (  ) صحيح     (  ) خطأ', { size: FONT_SIZE.small, bold: true })
    ], {
      alignment: AlignmentType.RIGHT,
      spacing: { after: 60 },
      indent: { right: 400 }
    }));
  });

  return elements;
}

/* --- FILL IN THE BLANK (ملء الفراغات) --- */
function renderFillBlank(question, subIndex) {
  const elements = [];
  const items = question.items || [{ text: question.prompt || question.text || '' }];

  items.forEach((item, i) => {
    const text = typeof item === 'string' ? item : item.text || '';
    // Split by ____ or ___ to find blanks
    const parts = text.split(/_{3,}/);
    if (parts.length > 1) {
      const children = [txt(`  ${i + 1})  `, { bold: true })];
      parts.forEach((part, j) => {
        children.push(txt(part, {}));
        if (j < parts.length - 1) {
          children.push(txt(dottedLine(15), { underline: true }));
        }
      });
      elements.push(para(children, {
        alignment: AlignmentType.RIGHT,
        spacing: { after: 60 },
        indent: { right: 400 }
      }));
    } else {
      elements.push(para([
        txt(`  ${i + 1})  `, { bold: true }),
        txt(text, {}),
        txt(`   ${dottedLine(20)}`, { underline: true })
      ], {
        alignment: AlignmentType.RIGHT,
        spacing: { after: 60 },
        indent: { right: 400 }
      }));
    }
  });

  return elements;
}

/* --- MATCHING (ربط) --- */
function renderMatching(question, subIndex) {
  const elements = [];
  const left = question.leftItems || [];
  const right = question.rightItems || [];

  if (question.prompt) {
    elements.push(para([txt(question.prompt)], {
      alignment: AlignmentType.RIGHT,
      spacing: { after: 80 }
    }));
  }

  // Create matching table
  const maxRows = Math.max(left.length, right.length);
  const rows = [];
  for (let i = 0; i < maxRows; i++) {
    rows.push(new TableRow({
      children: [
        textCell(left[i] ? `${i + 1}) ${left[i]}` : '', { width: 4500, alignment: AlignmentType.RIGHT }),
        textCell('', { width: 1000 }),
        textCell(right[i] ? `${String.fromCharCode(1571 + i)}) ${right[i]}` : '', { width: 4500, alignment: AlignmentType.RIGHT })
      ]
    }));
  }

  const matchTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.FIXED,
    rows,
    borders: CELL_FULL_BORDER
  });

  elements.push(matchTable);
  return elements;
}

/* --- ORDERING (ترتيب) --- */
function renderOrdering(question, subIndex) {
  const elements = [];
  const items = question.items || question.orderItems || [];

  if (question.prompt) {
    elements.push(para([txt(question.prompt)], {
      alignment: AlignmentType.RIGHT,
      spacing: { after: 80 }
    }));
  }

  items.forEach((item, i) => {
    const text = typeof item === 'string' ? item : item.text || '';
    elements.push(para([
      txt(`  ${i + 1})  `, { bold: true }),
      txt(text, {}),
      txt(`   ${dottedLine(10)}`, { underline: true })
    ], {
      alignment: AlignmentType.RIGHT,
      spacing: { after: 40 },
      indent: { right: 400 }
    }));
  });

  return elements;
}

/* --- OPEN / SENTENCE / WORD_ANALYSIS ( WALL / جمل / تحليل كلمة) --- */
function renderOpen(question, subIndex) {
  const elements = [];
  const prompt = question.prompt || question.text || '';
  const lineCount = question.answerLines || 3;

  if (prompt) {
    elements.push(para([txt(prompt)], {
      alignment: AlignmentType.RIGHT,
      spacing: { after: 80 }
    }));
  }

  // Word analysis table
  if (question.type === 'WORD_ANALYSIS' && question.tableHeaders) {
    const headerRow = new TableRow({
      children: question.tableHeaders.map(h => textCell(h, { bold: true, shading: 'D9E2F3' }))
    });
    const dataRows = (question.tableData || []).map(row =>
      new TableRow({
        children: row.map(cell => textCell(cell || '', {}))
      })
    );
    const analysisTable = new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      layout: TableLayoutType.FIXED,
      rows: [headerRow, ...dataRows],
      borders: CELL_FULL_BORDER
    });
    elements.push(analysisTable);
    return elements;
  }

  // Answer lines
  for (let i = 0; i < lineCount; i++) {
    elements.push(para([txt(dottedLine(60), { underline: true })], {
      alignment: AlignmentType.RIGHT,
      spacing: { after: 40 },
      indent: { right: 200 }
    }));
  }

  return elements;
}

/* ══════════════════════════════════════════════════════════════════════════
   CRITERIA TABLE — Grading rubric at end of exam
   ══════════════════════════════════════════════════════════════════════════ */

function buildCriteriaTable(criteria) {
  if (!criteria || criteria.length === 0) return null;

  // Title row
  const titleRow = new TableRow({
    children: [
      textCell('جدول إسناد الأعداد', { bold: true, columnSpan: 6, shading: 'D9E2F3' })
    ]
  });

  // Header row
  const headerRow = new TableRow({
    children: [
      textCell('المعيار', { bold: true, shading: 'D9E2F3', width: 3000 }),
      textCell('انعدام التملك\n(---)', { bold: true, size: FONT_SIZE.small, shading: 'D9E2F3', width: 1500 }),
      textCell('دون التملك الأدنى\n(--+)', { bold: true, size: FONT_SIZE.small, shading: 'D9E2F3', width: 1500 }),
      textCell('التملك الأدنى\n(-++)', { bold: true, size: FONT_SIZE.small, shading: 'D9E2F3', width: 1500 }),
      textCell('التملك الأقصى\n(+++)', { bold: true, size: FONT_SIZE.small, shading: 'D9E2F3', width: 1500 }),
      textCell('المجموع', { bold: true, shading: 'D9E2F3', width: 1500 })
    ]
  });

  // Data rows
  const dataRows = criteria.map(c => {
    const m = c.mastery || {};
    const maxScore = m.max || 0;
    return new TableRow({
      children: [
        textCell(c.label || c.id || '', { width: 3000, alignment: AlignmentType.RIGHT }),
        textCell(String(m.none ?? 0), { width: 1500 }),
        textCell(String(m.below ?? 0), { width: 1500 }),
        textCell(String(m.min ?? 0), { width: 1500 }),
        textCell(String(m.max ?? 0), { width: 1500 }),
        textCell(String(maxScore), { bold: true, width: 1500 })
      ]
    });
  });

  // Total row
  const totalMax = criteria.reduce((sum, c) => sum + (c.mastery?.max || 0), 0);
  const totalRow = new TableRow({
    children: [
      textCell('المجموع الكلي', { bold: true, shading: 'E2EFDA', width: 3000 }),
      textCell('', { shading: 'E2EFDA', width: 1500 }),
      textCell('', { shading: 'E2EFDA', width: 1500 }),
      textCell('', { shading: 'E2EFDA', width: 1500 }),
      textCell(String(totalMax), { bold: true, shading: 'E2EFDA', width: 1500 }),
      textCell(`${totalMax} / 20`, { bold: true, shading: 'E2EFDA', width: 1500 })
    ]
  });

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.FIXED,
    rows: [titleRow, headerRow, ...dataRows, totalRow],
    borders: CELL_FULL_BORDER
  });
}

/* ══════════════════════════════════════════════════════════════════════════
   MARKS COLUMN — Right-side marking grid
   ══════════════════════════════════════════════════════════════════════════ */

function buildMarksColumn(questions) {
  // Group questions by their main section
  const sections = [];
  let currentSection = null;

  questions.forEach((q, i) => {
    if (q.section !== currentSection) {
      currentSection = q.section || Math.floor(i / 3) + 1;
      sections.push({ id: currentSection, marks: [] });
    }
    sections[sections.length - 1].marks.push(q.points || 1);
  });

  return sections;
}

/* ══════════════════════════════════════════════════════════════════════════
   MAIN BUILD FUNCTION — Assembles complete exam document
   ══════════════════════════════════════════════════════════════════════════ */

export async function buildOfficialDocx(examData, context = {}) {
  const {
    title,
    subject,
    level,
    trimester,
    questions = [],
    criteria: rawCriteria,
    passages = [],
    durationMinutes = 60,
    totalPoints = 20
  } = examData;

  // Resolve criteria
  const subjectKey = typeof subject === 'string' ? subject.toLowerCase().replace(/[^a-z-]/g, '') : '';
  const criteria = rawCriteria || DEFAULT_CRITERIA_PRESETS[subjectKey] || DEFAULT_CRITERIA_PRESETS['arabic'];

  const children = [];

  // 1. Header table
  children.push(buildHeader({
    ...context,
    subject,
    level,
    trimester,
    durationMinutes,
    subjectLabel: SUBJECT_MAP[subjectKey] || subject,
    levelName: LEVEL_NAMES[level] || context.levelName
  }));

  children.push(new Paragraph({ children: [txt('')], spacing: { after: 120 } }));

  // 2. Passages (reading texts)
  passages.forEach(p => {
    children.push(...renderPassage(p));
    children.push(new Paragraph({ children: [txt('')], spacing: { after: 80 } }));
  });

  // 3. Questions
  let mainIndex = 0;
  let subCounters = {};

  questions.forEach((q, globalIndex) => {
    const mainId = q.section || q.mainIndex || Math.floor(globalIndex / 3) + 1;
    if (!subCounters[mainId]) {
      subCounters[mainId] = 0;
      mainIndex++;
    }
    subCounters[mainId]++;
    const subIndex = subCounters[mainId];

    // Main section header (Sند)
    if (subIndex === 1) {
      children.push(...renderQuestionHeader(mainId, q.sectionTitle || q.title || '', q.sectionPoints));
    }

    // Sub-question (Commentary/Exercise)
    const label = q.label || `التعليمة ${mainId}-${subIndex}`;
    children.push(...renderSubQuestion(label, q.instruction || '', q, q.points, subIndex));

    // Add space between sub-questions
    children.push(new Paragraph({ children: [txt('')], spacing: { after: 80 } }));
  });

  // 4. Answer lines for open questions (if needed)
  const hasOpenQuestions = questions.some(q => q.type === 'OPEN' || q.type === 'SENTENCE');
  if (hasOpenQuestions) {
    children.push(new Paragraph({ children: [txt('')], spacing: { after: 120 } }));
  }

  // 5. Page break before criteria table
  children.push(new Paragraph({
    children: [txt('')],
    pageBreakBefore: true
  }));

  // 6. Criteria table at the end
  const criteriaTable = buildCriteriaTable(criteria);
  if (criteriaTable) {
    children.push(criteriaTable);
  }

  // Build the document
  const doc = new Document({
    creator: 'منصة رفيقي — مولّد الاختبارات',
    title: title || 'اختبار رسمي',
    description: `اختبار ${SUBJECT_MAP[subjectKey] || subject} — ${LEVEL_NAMES[level] || ''}`,
    sections: [{
      properties: {
        page: {
          size: {
            orientation: PageOrientation.PORTRAIT,
            width: 11906, // A4 width in twips
            height: 16838  // A4 height in twips
          },
          margin: {
            top: 1134,    // ~2cm
            right: 1134,
            bottom: 1134,
            left: 1134
          }
        }
      },
      children
    }]
  });

  // Generate buffer
  const buffer = await Packer.toBuffer(doc);
  return buffer;
}

/* ══════════════════════════════════════════════════════════════════════════
   EXAM CONTENT BUILDER — Converts generic exam data to DOCX-ready format
   ══════════════════════════════════════════════════════════════════════════ */

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
    options: q.options,
    correct: q.correct,
    correctAnswer: q.correctAnswer,
    orderItems: q.orderItems,
    points: q.points || 1,
    sectionPoints: q.sectionPoints,
    answerLines: q.answerLines || 3,
    items: q.items,
    leftItems: q.leftItems,
    rightItems: q.rightItems,
    statements: q.statements,
    visual: q.visual,
    tableHeaders: q.tableHeaders,
    tableData: q.tableData
  }));

  return {
    title: content.title || 'اختبار رسمي',
    subject: content.subject || context.subject,
    level: content.level || context.level,
    trimester: content.trimester || context.trimester,
    questions,
    criteria: content.criteria,
    passages: content.passages || [],
    durationMinutes: content.durationMinutes || context.durationMinutes || 60,
    totalPoints: content.totalPoints || 20
  };
}

/* ══════════════════════════════════════════════════════════════════════════
   EXPORTS
   ══════════════════════════════════════════════════════════════════════════ */

export { buildCriteriaTable, MASTERY_LEVELS, DEFAULT_CRITERIA_PRESETS, SUBJECT_MAP, LEVEL_NAMES };
