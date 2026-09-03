// ===== خدمة بناء ملفات DOCX الرسمية =====
// تطابق كامل مع النموذج الرسمي لتونس
// - جدول رئيسي (المدرسة + المادة + معلومات التلميذ)
// - أسئلة متنوعة مع خطوط إجابة كافية
// - جدول المعايير في نهاية الصفحة
// - جدول إسناد الأعداد

import { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, BorderStyle, AlignmentType, VerticalAlign } from 'docx';

const TRIMESTER_LABELS = { 1: 'الأوّل', 2: 'الثّاني', 3: 'الثّالث' };
const LEVEL_LABELS = {
  year1: 'السنة الأولى أساسي',
  year2: 'السنة الثانية أساسي',
  year3: 'السنة الثالثة أساسي',
  year4: 'السنة الرابعة أساسي',
  year5: 'السنة الخامسة أساسي',
  year6: 'السنة السادسة أساسي'
};
const SUBJECT_LABELS = {
  math: 'الرياضيات', science: 'الإيقاظ العلمي', reading: 'القراءة',
  production: 'الإنتاج الكتابي', handwriting: 'خط وإملاء',
  grammar: 'قواعد اللغة', french: 'اللغة الفرنسية', english: 'اللغة الإنجليزية',
  islamic: 'التربية الإسلامية', civics: 'التربية المدنية',
  technology: 'التكنولوجيا', ict: 'المعلوماتية',
  art: 'التربية التشكيلية', music: 'التربية الموسيقية', pe: 'التربية البدنية'
};

function tr(text, opts = {}) {
  return new TextRun({
    text: String(text || ''),
    font: 'Arial',
    size: opts.size || 22,
    bold: !!opts.bold,
    underline: opts.underline ? {} : undefined
  });
}

function p(children, opts = {}) {
  return new Paragraph({
    children,
    alignment: opts.align || AlignmentType.RIGHT,
    spacing: { after: opts.after || 60, before: opts.before || 30 },
    indent: opts.indent ? { right: opts.indent } : undefined
  });
}

function emptyLine() {
  return new Paragraph({ children: [tr('')], spacing: { after: 40 } });
}

function answerLine() {
  return new Paragraph({
    children: [tr('_______________________________________________', { size: 18 })],
    spacing: { after: 80, before: 20 }
  });
}

function answerLines(count = 2) {
  const lines = [];
  for (let i = 0; i < count; i++) lines.push(answerLine());
  return lines;
}

function cell(text, widthPct, opts = {}) {
  return new TableCell({
    children: [new Paragraph({
      children: [tr(text, { size: opts.size || 18, bold: opts.bold || false })],
      alignment: opts.align || AlignmentType.CENTER
    })],
    width: { size: widthPct, type: WidthType.PERCENTAGE },
    verticalAlign: VerticalAlign.CENTER,
    borders: opts.borders || {
      top: { style: BorderStyle.SINGLE, size: 1 },
      bottom: { style: BorderStyle.SINGLE, size: 1 },
      left: { style: BorderStyle.SINGLE, size: 1 },
      right: { style: BorderStyle.SINGLE, size: 1 }
    }
  });
}

function cellMultiLine(lines, widthPct, opts = {}) {
  return new TableCell({
    children: lines.map(line => new Paragraph({
      children: [tr(line, { size: opts.size || 16, bold: opts.bold || false })],
      alignment: opts.align || AlignmentType.CENTER
    })),
    width: { size: widthPct, type: WidthType.PERCENTAGE },
    verticalAlign: VerticalAlign.CENTER,
    borders: opts.borders || {
      top: { style: BorderStyle.SINGLE, size: 1 },
      bottom: { style: BorderStyle.SINGLE, size: 1 },
      left: { style: BorderStyle.SINGLE, size: 1 },
      right: { style: BorderStyle.SINGLE, size: 1 }
    }
  });
}

function cellBold(text, widthPct) {
  return cell(text, widthPct, { bold: true });
}

function sectionTitle(text) {
  return new Paragraph({
    children: [tr(text, { size: 24, bold: true })],
    alignment: AlignmentType.CENTER,
    spacing: { before: 160, after: 100 }
  });
}

// ============ البناء الرئيسي ============

export async function buildOfficialDocx(exam, options = {}) {
  const {
    gradeId = exam.gradeId || 'year1',
    subject = exam.subject || 'math',
    trimester = options.trimester || 3,
    schoolName = options.schoolName || '',
    className = options.className || '',
    schoolYear = options.schoolYear || '2026-2027'
  } = options;

  const levelLabel = LEVEL_LABELS[gradeId] || 'السنة الأولى أساسي';
  const subjectLabel = SUBJECT_LABELS[subject] || subject;
  const trimesterLabel = TRIMESTER_LABELS[trimester] || 'الثالث';
  const totalScore = exam.totalScore || 20;
  const questions = exam.questions || [];

  const children = [];

  // ═══════════════════════════════════════════
  // 1. الجدول الرئيسي (Header)
  // ═══════════════════════════════════════════

  const headerTable = new Table({
    rows: [
      new TableRow({
        children: [
          cellMultiLine([
            `المدرسة الابتدائية: ${schoolName || '..........................................'}`,
            `السنة الدراسية: ${schoolYear}`
          ], 40, { bold: true, align: AlignmentType.RIGHT }),
          cellMultiLine([
            `تقييم مكتسبات التلاميذ`,
            `نهاية الثلاثي ${trimesterLabel}`,
            `المادة: ${subjectLabel}`,
            `${levelLabel}`
          ], 35, { bold: true, align: AlignmentType.CENTER }),
          cellMultiLine([
            `الاسم واللقب: ${'................................................'}`,
            `القسم: ${className || '........'}`,
            `العدد: / ${totalScore}`
          ], 25, { align: AlignmentType.RIGHT })
        ]
      })
    ],
    width: { size: 100, type: WidthType.PERCENTAGE }
  });

  children.push(headerTable);
  children.push(emptyLine());

  // ═══════════════════════════════════════════
  // 2. الأسئلة مع خطوط إجابة كافية
  // ═══════════════════════════════════════════

  for (const q of questions) {
    // عنوان السؤال
    const questionText = q.content || q.prompt || '';
    const num = children._qNum ? ++children._qNum : (children._qNum = 1);

    // المعيار والتجزئة فوق السؤال
    const metaParts = [];
    if (q.criteria || q.criterion) metaParts.push(`المعيار: ${q.criteria || q.criterion}`);
    if (q.subCriterion) metaParts.push(`التجزئة: ${q.subCriterion}`);
    if (metaParts.length > 0) {
      children.push(p([tr(metaParts.join('  —  '), { size: 16 })], { before: 40, after: 20 }));
    }

    // السؤال الرئيسي
    children.push(p([tr(`_${num}. ${questionText}`, { size: 20, bold: true })], { before: 80, after: 40 }));

    // العرض حسب النوع
    renderQuestionByType(children, q, num);
    children.push(emptyLine());
  }

  // ═══════════════════════════════════════════
  // 3. جدول المعايير في نهاية الصفحة
  // ═══════════════════════════════════════════

  const criteria = exam.criteria || groupQuestionsByCriteria(questions);
  if (criteria.length > 0) {
    children.push(sectionTitle('جدول المعايير'));

    const critRows = [];
    critRows.push(new TableRow({
      children: [
        cell('المعيار', 20, { bold: true }),
        cell('التجزئة', 50, { bold: true }),
        cell('النقاط', 15, { bold: true }),
        cell('المجموع', 15, { bold: true })
      ]
    }));

    for (const crit of criteria) {
      if (crit.subCriteria && crit.subCriteria.length > 0) {
        for (let i = 0; i < crit.subCriteria.length; i++) {
          const sub = crit.subCriteria[i];
          const cells = [];
          if (i === 0) {
            cells.push(cellMultiLine([crit.code, crit.label], 20, { bold: true }));
          } else {
            cells.push(cell('', 20));
          }
          cells.push(cellMultiLine([sub.code, sub.label], 50, { align: AlignmentType.RIGHT }));
          cells.push(cell(`${sub.max}`, 15));
          cells.push(cell(i === 0 ? `${crit.max}` : '', 15));
          critRows.push(new TableRow({ children: cells }));
        }
      } else {
        critRows.push(new TableRow({
          children: [
            cellMultiLine([crit.code, crit.label], 20, { bold: true }),
            cell('—', 50),
            cell(`${crit.max}`, 15),
            cell(`${crit.max}`, 15)
          ]
        }));
      }
    }

    critRows.push(new TableRow({
      children: [cellBold('المجموع الكلي', 20), cell('', 50), cell('', 15), cellBold(`/ ${totalScore}`, 15)]
    }));

    children.push(new Table({ rows: critRows, width: { size: 100, type: WidthType.PERCENTAGE } }));
    children.push(emptyLine());
  }

  // ═══════════════════════════════════════════
  // 4. جدول إسناد الأعداد
  // ═══════════════════════════════════════════

  if (criteria.length > 0) {
    children.push(sectionTitle('جدول إسناد الأعداد'));

    const totalSub = criteria.reduce((sum, c) => sum + (c.subCriteria?.length || 1), 0);
    const subColWidth = Math.floor(70 / Math.max(totalSub, 1));

    const gridRows = [];
    const headerCells = [cell('مستوى التملك', 20, { bold: true })];
    for (const crit of criteria) {
      if (crit.subCriteria && crit.subCriteria.length > 0) {
        for (const sub of crit.subCriteria) {
          headerCells.push(cell(sub.code, subColWidth, { bold: true, size: 14 }));
        }
      } else {
        headerCells.push(cell(crit.code, Math.floor(70 / criteria.length), { bold: true }));
      }
    }
    headerCells.push(cell('المجموع', 10, { bold: true }));
    gridRows.push(new TableRow({ children: headerCells }));

    const levels = [
      { label: 'انعدام التملك', code: '---', calc: () => 0 },
      { label: 'دون التملك الأدنى', code: '+--', calc: (m) => Math.round(m * 0.3) },
      { label: 'التملك الأدنى', code: '++-', calc: (m) => Math.round(m * 0.6) },
      { label: 'التملك الأقصى', code: '+++', calc: (m) => m }
    ];

    for (const level of levels) {
      const rowCells = [cellMultiLine([level.code, level.label], 20, { size: 14 })];
      let total = 0;
      for (const crit of criteria) {
        if (crit.subCriteria && crit.subCriteria.length > 0) {
          for (const sub of crit.subCriteria) {
            const pts = level.calc(sub.max);
            total += pts;
            rowCells.push(cell(`${pts}`, subColWidth, { size: 14 }));
          }
        } else {
          const pts = level.calc(crit.max);
          total += pts;
          rowCells.push(cell(`${pts}`, Math.floor(70 / criteria.length), { size: 14 }));
        }
      }
      rowCells.push(cell(`${total}`, 10, { size: 14, bold: level.code === '+++' }));
      gridRows.push(new TableRow({ children: rowCells }));
    }

    children.push(new Table({ rows: gridRows, width: { size: 100, type: WidthType.PERCENTAGE } }));
    children.push(emptyLine());
  }

  // ═══════════════════════════════════════════
  // 5. الإمضاءات
  // ═══════════════════════════════════════════

  children.push(emptyLine());
  children.push(new Table({
    rows: [new TableRow({
      children: [
        cell('إمضاء التلميذ(ة)', 30, { bold: true }),
        cell('إمضاء المعلّم(ة)', 30, { bold: true }),
        cellMultiLine(['ضعيف: 0-9', 'مقبول: 10-13', 'حسن: 14-16', 'ممتاز: 17-20'], 40, { size: 14 })
      ]
    })],
    width: { size: 100, type: WidthType.PERCENTAGE }
  }));

  // ═══════════════════════════════════════════
  // بناء الملف
  // ═══════════════════════════════════════════

  const doc = new Document({
    sections: [{
      properties: {
        page: {
          margin: { top: 720, right: 720, bottom: 720, left: 720 }
        }
      },
      children
    }]
  });

  return Packer.toBuffer(doc);
}

// ============ عرض الأسئلة حسب النوع ============

function renderQuestionByType(children, q, num) {
  const type = q.type || 'MCQ';
  const content = q.content || q.prompt || '';

  switch (type) {
    case 'MCQ':
    case 'TRUE_FALSE':
      renderMCQ(children, q);
      break;

    case 'VERTICAL_OP':
    case 'VERTICAL_ADD':
    case 'VERTICAL_SUB':
      renderVertical(children, q);
      break;

    case 'COIN':
    case 'COIN_COUNT':
      renderCoin(children, q);
      break;

    case 'MATCHING':
      renderMatching(children, q);
      break;

    case 'FILL_BLANK':
      renderFillBlank(children, q);
      break;

    case 'COPY':
    case 'LETTERS':
      renderHandwriting(children, q);
      break;

    case 'WORD_PROBLEM':
      renderWordProblem(children, q);
      break;

    case 'ORDER':
    case 'COMPARE':
      renderOrderOrCompare(children, q);
      break;

    case 'SHAPE':
    case 'COUNTING':
    case 'NUMBER_READ':
    case 'SEQUENCE':
    case 'MULTIPLY_TABLE':
    case 'FRACTION':
    case 'MEASURE':
    case 'GEOMETRY':
    default:
      renderGeneric(children, q);
      break;
  }
}

// ===== MCQ / TRUE_FALSE =====
function renderMCQ(children, q) {
  if (q.options && q.options.length > 0) {
    for (const opt of q.options) {
      children.push(p([tr(`  (    )   ${opt}`, { size: 20 })], { indent: 200, after: 30 }));
    }
  }
  // TRUE_FALSE: إذا لم يكن هناك خيارات، نضع صح/خطأ
  if (q.type === 'TRUE_FALSE' && (!q.options || q.options.length === 0)) {
    children.push(p([tr('  (    )   صحيح', { size: 20 })], { indent: 200, after: 30 }));
    children.push(p([tr('  (    )   خطأ', { size: 20 })], { indent: 200, after: 30 }));
  }
  children.push(answerLine());
}

// ===== العمليات العمودية =====
function renderVertical(children, q) {
  const op = q.operation || (q.type.includes('ADD') ? 'add' : 'subtract');
  const symbol = op === 'add' ? '+' : '-';
  const n1 = q.operand1 || '';
  const n2 = q.operand2 || '';

  children.push(p([tr(`${n1}`, { size: 22 })], { align: AlignmentType.RIGHT, indent: 400 }));
  children.push(p([tr(`${symbol} ${n2}`, { size: 22 })], { align: AlignmentType.RIGHT, indent: 400 }));
  children.push(p([tr('────────', { size: 20 })], { align: AlignmentType.RIGHT, indent: 400 }));
  children.push(p([tr('(               )', { size: 20 })], { align: AlignmentType.RIGHT, indent: 400 }));
  children.push(answerLine());
}

// ===== العملات =====
function renderCoin(children, q) {
  if (q.coins && Array.isArray(q.coins)) {
    const coinStr = q.coins.map(c => {
      if (typeof c === 'object') return `${c.count} × ${c.value} مليم`;
      return `${c} مليم`;
    }).join('   +   ');
    children.push(p([tr(coinStr, { size: 20 })], { indent: 200, after: 60 }));
  } else {
    // رسم نصي للعملات
    children.push(p([tr(' ○ ○ ○   ○ ○   ○', { size: 24 })], { indent: 200, after: 40 }));
  }
  children.push(p([tr('المجموع:  (               )  مليم', { size: 20 })], { indent: 200 }));
  children.push(answerLine());
}

// ===== الربط =====
function renderMatching(children, q) {
  if (q.pairs && q.pairs.length > 0) {
    const leftCol = q.pairs.map(p => p.left || p[0]);
    const rightCol = [...q.pairs].sort(() => 0.5 - Math.random()).map(p => p.right || p[1]);
    for (let i = 0; i < leftCol.length; i++) {
      children.push(p([
        tr(`  ${leftCol[i]}  ────────────  ${rightCol[i] || '..............'}`, { size: 20 })
      ], { indent: 200, after: 40 }));
    }
  } else {
    for (let i = 0; i < 3; i++) {
      children.push(p([tr(`  ..............  ────────────  ..............`, { size: 20 })], { indent: 200, after: 40 }));
    }
  }
  children.push(answerLine());
}

// ===== ملء الفراغات =====
function renderFillBlank(children, q) {
  children.push(answerLine());
}

// ===== الخط / النسخ =====
function renderHandwriting(children, q) {
  for (let i = 0; i < (q.freeLines || 3); i++) {
    children.push(answerLine());
  }
}

// ===== مسألة كلمة =====
function renderWordProblem(children, q) {
  if (q.subQuestions && q.subQuestions.length > 0) {
    for (let i = 0; i < q.subQuestions.length; i++) {
      const sub = q.subQuestions[i];
      children.push(p([
        tr(`    ${String.fromCharCode(1571 + i)}- ${sub.text}`, { size: 20 })
      ], { indent: 200, before: 40, after: 20 }));
      children.push(answerLine());
    }
  } else {
    children.push(answerLines(3));
  }
}

// ===== الترتيب / المقارنة =====
function renderOrderOrCompare(children, q) {
  if (q.type === 'COMPARE') {
    children.push(p([tr('(    )  ؟  (    )', { size: 20 })], { indent: 200, after: 40 }));
  } else {
    // ترتيب من الأصغر إلى الأكبر
    for (let i = 0; i < 3; i++) {
      children.push(p([tr(`(${i + 1})  ____________`, { size: 20 })], { indent: 200, after: 30 }));
    }
  }
  children.push(answerLine());
}

// ===== عام (COUNTING, SHAPE, SEQUENCE, etc.) =====
function renderGeneric(children, q) {
  children.push(answerLine());
  children.push(answerLine());
}

// ============ تجميع المعايير ============

function groupQuestionsByCriteria(questions) {
  const groups = {};
  for (const q of questions) {
    const code = q.criteria || q.criterion || 'مع1';
    if (!groups[code]) groups[code] = { code, label: code, max: 0, subCriteria: [] };
    groups[code].max += q.points || 0;
    if (q.subCriterion) {
      const sub = groups[code].subCriteria.find(s => s.code === q.subCriterion);
      if (sub) { sub.max += q.points || 0; }
      else { groups[code].subCriteria.push({ code: q.subCriterion, label: q.subCriterion, max: q.points || 0 }); }
    }
  }
  return Object.values(groups);
}

export { groupQuestionsByCriteria };
