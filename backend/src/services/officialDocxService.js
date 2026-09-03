// ===== خدمة بناء ملفات DOCX الرسمية =====
// تطابق كامل مع النموذج الرسمي لتونس
// - جدول رئيسي (المدرسة + المادة + معلومات التلميذ)
// - جدول معايير مع تجزئة (مع1أ، مع1ب، مع2أ1...)
// - أسئلة متنوعة مع خطوط إجابة
// - جدول إسناد الأعداد مع 4 مستويات تملك

import { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, BorderStyle, AlignmentType, VerticalAlign, HeadingLevel } from 'docx';

const TRIMESTER_LABELS = { 1: 'الأوّل', 2: 'الثّاني', 3: 'الثّالث' };
const TRIMESTER_MONTHS = { 1: 'ديسمبر', 2: 'مارس', 3: 'جوان' };
const LEVEL_LABELS = {
  year1: 'السنة الأولى أساسي',
  year2: 'السنة الثانية أساسي',
  year3: 'السنة الثالثة أساسي',
  year4: 'السنة الرابعة أساسي',
  year5: 'السنة الخامسة أساسي',
  year6: 'السنة السادسة أساسي'
};
const SUBJECT_LABELS = {
  math: 'الرياضيات',
  science: 'الإيقاظ العلمي',
  reading: 'القراءة',
  production: 'الإنتاج الكتابي',
  handwriting: 'خط وإملاء',
  grammar: 'قواعد اللغة',
  french: 'اللغة الفرنسية',
  english: 'اللغة الإنجليزية',
  islamic: 'التربية الإسلامية',
  civics: 'التربية المدنية',
  technology: 'التكنولوجيا',
  ict: 'المعلوماتية',
  art: 'التربية التشكيلية',
  music: 'التربية الموسيقية',
  pe: 'التربية البدنية'
};

// ============ دوال مساعدة ============

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

// ============ البناء الرئيسي ============

export async function buildOfficialDocx(exam, options = {}) {
  const {
    gradeId = exam.gradeId || 'year1',
    subject = exam.subject || 'math',
    trimester = options.trimester || 3,
    schoolName = options.schoolName || '',
    teacherName = options.teacherName || '',
    className = options.className || '',
    schoolYear = options.schoolYear || '2025-2026'
  } = options;

  const levelLabel = LEVEL_LABELS[gradeId] || 'السنة الأولى أساسي';
  const subjectLabel = SUBJECT_LABELS[subject] || subject;
  const trimesterLabel = TRIMESTER_LABELS[trimester] || 'الثالث';
  const totalScore = exam.totalScore || 20;

  const children = [];

  // ═══════════════════════════════════════════
  // 1. الجدول الرئيسي (Header Table)
  // ═══════════════════════════════════════════
  ///format: 
  // | اسم المدرسة | عنوان الاختبار والمادة | المعلومات |
  // |             |                         | الاسم واللقب |
  // |             |                         | القسم |
  // |             |                         | العدد /20 |

  const headerTable = new Table({
    rows: [
      // الصف الأول: العناوين
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
  // 2. جدول المعايير مع التجزئة
  // ═══════════════════════════════════════════
  // يعرض كل معيار وتجزئاته مع النقاط

  if (exam.criteria && exam.criteria.length > 0) {
    const criteriaHeader = new Paragraph({
      children: [tr('جدول المعايير', { size: 22, bold: true })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 100 }
    });
    children.push(criteriaHeader);

    // بناء صفوف جدول المعايير
    const critRows = [];

    // صف رؤوس الأعمدة: المعيار | التجزئة | النقاط
    critRows.push(new TableRow({
      children: [
        cell('المعيار', 20, { bold: true }),
        cell('التجزئة', 50, { bold: true }),
        cell('النقاط', 15, { bold: true }),
        cell('المجموع', 15, { bold: true })
      ]
    }));

    // صفوف كل معيار وتجزئاته
    for (const crit of exam.criteria) {
      if (crit.subCriteria && crit.subCriteria.length > 0) {
        for (let i = 0; i < crit.subCriteria.length; i++) {
          const sub = crit.subCriteria[i];
          const cells = [];

          if (i === 0) {
            // أول سطر يحتوي على رمز المعيار الرئيسي
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

    // صف المجموع الكلي
    critRows.push(new TableRow({
      children: [
        cellBold('المجموع الكلي', 20),
        cell('', 50),
        cell('', 15),
        cellBold(`/ ${totalScore}`, 15)
      ]
    }));

    children.push(new Table({
      rows: critRows,
      width: { size: 100, type: WidthType.PERCENTAGE }
    }));
    children.push(emptyLine());
  }

  // ═══════════════════════════════════════════
  // 3. الأسئلة
  // ═══════════════════════════════════════════

  let currentCriterion = null;
  let questionNum = 0;

  for (const q of exam.questions) {
    // عنوان المعيار الجديد
    if ((q.criteria || q.criterion) !== currentCriterion) {
      currentCriterion = q.criteria || q.criterion;
      const critDef = exam.criteria?.find(c => c.code === currentCriterion);

      children.push(new Paragraph({
        children: [
          tr(`المعيار ${currentCriterion}`, { size: 22, bold: true }),
          tr(critDef ? `: ${critDef.label}` : '', { size: 20 })
        ],
        alignment: AlignmentType.RIGHT,
        spacing: { before: 120, after: 60 }
      }));

      // خط فاصل
      children.push(new Paragraph({
        children: [tr('─'.repeat(60), { size: 16 })],
        alignment: AlignmentType.CENTER,
        spacing: { after: 60 }
      }));
    }

    questionNum++;

    // تجزئة المعيار الفرعي
    if (q.subCriterion) {
      children.push(new Paragraph({
        children: [
          tr(`[${q.subCriterion}]`, { size: 18, bold: true }),
          tr(q.subCriterionLabel ? ` ${q.subCriterionLabel}` : '', { size: 18 })
        ],
        alignment: AlignmentType.RIGHT,
        spacing: { before: 60, after: 30 }
      }));
    }

    // نوع السؤال
    switch (q.type) {
      case 'MCQ':
      case 'TRUE_FALSE':
        renderMCQ(children, q, questionNum);
        break;
      case 'VERTICAL_OP':
      case 'VERTICAL_ADD':
      case 'VERTICAL_SUB':
        renderVerticalOperation(children, q, questionNum);
        break;
      case 'COIN':
      case 'COIN_COUNT':
        renderCoinQuestion(children, q, questionNum);
        break;
      case 'MATCHING':
        renderMatching(children, q, questionNum);
        break;
      case 'FILL_BLANK':
        renderFillBlank(children, q, questionNum);
        break;
      case 'COPY':
      case 'LETTERS':
        renderHandwriting(children, q, questionNum);
        break;
      case 'WORD_PROBLEM':
        renderWordProblem(children, q, questionNum);
        break;
      case 'ORDER':
        renderOrdering(children, q, questionNum);
        break;
      case 'SHAPE':
        renderShape(children, q, questionNum);
        break;
      case 'FREE':
      case 'OPINION':
      case 'STORY_ORDER':
      case 'STORY_COMPLETE':
      case 'PICTURE_DESC':
      case 'SENTENCE_COMPLETE':
      case 'PERSONAL_WRITE':
        renderFreeResponse(children, q, questionNum);
        break;
      default:
        renderGenericQuestion(children, q, questionNum);
    }
  }

  // ═══════════════════════════════════════════
  // 4. جدول إسناد الأعداد (Scoring Grid)
  // ═══════════════════════════════════════════

  children.push(emptyLine());
  children.push(new Paragraph({
    children: [tr('جدول إسناد الأعداد', { size: 24, bold: true })],
    alignment: AlignmentType.CENTER,
    spacing: { before: 200, after: 100 }
  }));

  if (exam.criteria && exam.criteria.length > 0) {
    const gridRows = [];

    // صف الرؤوس
    const headerCells = [cell('مستوى التملك', 20, { bold: true })];
    for (const crit of exam.criteria) {
      if (crit.subCriteria && crit.subCriteria.length > 0) {
        for (const sub of crit.subCriteria) {
          headerCells.push(cell(sub.code, Math.floor(70 / exam.criteria.reduce((sum, c) => sum + (c.subCriteria?.length || 1), 0)), { bold: true, size: 14 }));
        }
      } else {
        headerCells.push(cell(crit.code, Math.floor(70 / exam.criteria.length), { bold: true }));
      }
    }
    headerCells.push(cell('المجموع', 10, { bold: true }));
    gridRows.push(new TableRow({ children: headerCells }));

    // صفوف مستويات التملك
    const levels = [
      { label: 'انعدام التملك', code: '---', points: () => 0 },
      { label: 'دون التملك الأدنى', code: '+--', points: (crit) => Math.round(crit.max * 0.3) },
      { label: 'التملك الأدنى', code: '++-', points: (crit) => Math.round(crit.max * 0.6) },
      { label: 'التملك الأقصى', code: '+++', points: (crit) => crit.max }
    ];

    for (const level of levels) {
      const rowCells = [cellMultiLine([level.code, level.label], 20, { size: 14 })];
      let total = 0;

      for (const crit of exam.criteria) {
        if (crit.subCriteria && crit.subCriteria.length > 0) {
          for (const sub of crit.subCriteria) {
            const subMax = sub.max;
            const subPoints = level.code === '---' ? 0 :
              level.code === '+--' ? Math.round(subMax * 0.3) :
              level.code === '++-' ? Math.round(subMax * 0.6) :
              subMax;
            total += subPoints;
            rowCells.push(cell(`${subPoints}`, Math.floor(70 / exam.criteria.reduce((sum, c) => sum + (c.subCriteria?.length || 1), 0)), { size: 14 }));
          }
        } else {
          const critPoints = level.points(crit);
          total += critPoints;
          rowCells.push(cell(`${critPoints}`, Math.floor(70 / exam.criteria.length), { size: 14 }));
        }
      }

      rowCells.push(cell(`${total}`, 10, { size: 14, bold: level.code === '+++' }));
      gridRows.push(new TableRow({ children: rowCells }));
    }

    children.push(new Table({
      rows: gridRows,
      width: { size: 100, type: WidthType.PERCENTAGE }
    }));
  }

  // ═══════════════════════════════════════════
  // 5. الإمضاءات
  // ═══════════════════════════════════════════

  children.push(emptyLine());
  children.push(emptyLine());

  children.push(new Table({
    rows: [new TableRow({
      children: [
        cell('إمضاء التلميذ(ة)', 30, { bold: true }),
        cell('إمضاء المعلّم(ة)', 30, { bold: true }),
        cellMultiLine([
          'ضعيف: 0-9',
          'مقبول: 10-13',
          'حسن: 14-16',
          'ممتاز: 17-20'
        ], 40, { size: 14 })
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
          margin: {
            top: 720,     // 1.27 cm
            right: 720,
            bottom: 720,
            left: 720
          }
        }
      },
      children
    }]
  });

  return Packer.toBuffer(doc);
}

// ============ دوال عرض الأسئلة ============

function renderMCQ(children, q, num) {
  children.push(p([tr(`${num}- ${q.content || q.prompt}`, { size: 20 })]));

  // الخيارات
  if (q.options && q.options.length > 0) {
    for (const opt of q.options) {
      children.push(p([tr(`    (  )  ${opt}`, { size: 20 })], { indent: 200 }));
    }
  }
  children.push(emptyLine());
}

function renderVerticalOperation(children, q, num) {
  children.push(p([tr(`${num}- ${q.content || q.prompt}`, { size: 20 })]));

  // العمليات العمودية
  const op = q.operation || (q.type.includes('ADD') ? 'add' : 'subtract');
  const symbol = op === 'add' ? '+' : '-';

  children.push(p([tr(`${q.operand1}`, { size: 22 })], { align: AlignmentType.LEFT, indent: 400 }));
  children.push(p([tr(`${symbol} ${q.operand2}`, { size: 22 })], { align: AlignmentType.LEFT, indent: 400 }));
  children.push(p([tr('───────', { size: 20 })], { align: AlignmentType.LEFT, indent: 400 }));
  children.push(p([tr('(       )', { size: 20 })], { align: AlignmentType.LEFT, indent: 400 }));
  children.push(emptyLine());
}

function renderCoinQuestion(children, q, num) {
  children.push(p([tr(`${num}- ${q.content || q.prompt}`, { size: 20 })]));

  if (q.coins && Array.isArray(q.coins)) {
    const coinStr = q.coins.map(c => {
      if (typeof c === 'object') {
        return `${c.count} × ${c.value} مليم`;
      }
      return `${c} مليم`;
    }).join('  +  ');
    children.push(p([tr(coinStr, { size: 20 })], { indent: 200 }));
  }

  children.push(p([tr('المجموع: (       ) مليم', { size: 20 })], { indent: 200 }));
  children.push(emptyLine());
}

function renderMatching(children, q, num) {
  children.push(p([tr(`${num}- ${q.content || q.prompt}`, { size: 20 })]));

  if (q.pairs && q.pairs.length > 0) {
    const leftCol = q.pairs.map(p => p.left);
    const rightCol = [...q.pairs].sort(() => 0.5 - Math.random()).map(p => p.right);

    for (let i = 0; i < q.pairs.length; i++) {
      children.push(p([
        tr(`    ${leftCol[i]}  ───────  ${rightCol[i] || '..............'}`, { size: 20 })
      ], { indent: 200 }));
    }
  }
  children.push(emptyLine());
}

function renderFillBlank(children, q, num) {
  children.push(p([tr(`${num}- ${q.content || q.prompt}`, { size: 20 })]));
  children.push(answerLine());
}

function renderHandwriting(children, q, num) {
  children.push(p([tr(`${num}- ${q.content || q.prompt}`, { size: 20 })]));
  for (let i = 0; i < (q.freeLines || 3); i++) {
    children.push(answerLine());
  }
}

function renderWordProblem(children, q, num) {
  children.push(p([tr(`${num}- ${q.content || q.prompt}`, { size: 20 })]));

  if (q.subQuestions && q.subQuestions.length > 0) {
    for (let i = 0; i < q.subQuestions.length; i++) {
      const sub = q.subQuestions[i];
      children.push(p([
        tr(`    ${String.fromCharCode(1571 + i)}- ${sub.text}`, { size: 18 })
      ], { indent: 200 }));
      children.push(answerLine());
    }
  } else {
    children.push(answerLine());
    children.push(answerLine());
  }
}

function renderOrdering(children, q, num) {
  children.push(p([tr(`${num}- ${q.prompt || q.content}`, { size: 20 })]));
  children.push(p([tr('(       )  ◄  (       )  ◄  (       )', { size: 20 })], { indent: 200 }));
  children.push(emptyLine());
}

function renderShape(children, q, num) {
  children.push(p([tr(`${num}- ${q.prompt || q.content}`, { size: 20 })]));
  if (q.options && q.options.length > 0) {
    const optStr = q.options.map(o => `(  )  ${o}`).join('        ');
    children.push(p([tr(optStr, { size: 20 })], { indent: 200 }));
  }
  children.push(emptyLine());
}

function renderFreeResponse(children, q, num) {
  children.push(p([tr(`${num}- ${q.prompt || q.content}`, { size: 20 })]));
  for (let i = 0; i < (q.freeLines || 4); i++) {
    children.push(answerLine());
  }
}

function renderGenericQuestion(children, q, num) {
  children.push(p([tr(`${num}- ${q.prompt || q.content}`, { size: 20 })]));

  if (q.options && q.options.length > 0) {
    const optStr = q.options.map(o => `(  )  ${o}`).join('        ');
    children.push(p([tr(optStr, { size: 20 })], { indent: 200 }));
  } else {
    children.push(answerLine());
  }
  children.push(emptyLine());
}

function cellBold(text, widthPct) {
  return cell(text, widthPct, { bold: true });
}
