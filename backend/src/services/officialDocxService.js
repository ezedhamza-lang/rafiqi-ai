import { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, BorderStyle, AlignmentType, VerticalAlign } from 'docx';

const TRIMESTER_LABELS = { 1: 'الأوّل', 2: 'الثّاني', 3: 'الثّالث' };
const TRIMESTER_MONTHS = { 1: 'ديسمبر', 2: 'مارس', 3: 'جوان' };
const LEVEL_LABELS = {
  year1: 'السنة الأولى اساسي',
  year2: 'السنة الثانية اساسي',
  year3: 'السنة الثالثة اساسي',
  year4: 'السنة الرابعة اساسي',
  year5: 'السنة الخامسة اساسي',
  year6: 'السنة السادسة اساسي'
};
const SUBJECT_LABELS = {
  math: 'الرياضيات', science: 'الإيقاظ العلمي', reading: 'القراءة',
  production: 'الإنتاج الكتابي', handwriting: 'خط وإملاء',
  grammar: 'قواعد اللغة', french: 'اللغة الفرنسية', english: 'اللغة الإنجليزية',
  islamic: 'التربية الإسلامية', civics: 'التربية المدنية',
  technology: 'التكنولوجيا', ict: 'المعلوماتية',
  art: 'التربية التشكيلية', music: 'التربية الموسيقية',
  pe: 'التربية البدنية'
};

function tr(text, opts = {}) {
  return new TextRun({ text: String(text || ''), font: 'Arial', size: opts.size || 22, bold: !!opts.bold });
}

function p(children, align) {
  return new Paragraph({ children, alignment: align || AlignmentType.RIGHT, spacing: { after: 60, before: 30 } });
}

function cell(text, widthPct) {
  return new TableCell({
    children: [new Paragraph({ children: [tr(text, { size: 18 })], alignment: AlignmentType.CENTER })],
    width: { size: widthPct, type: WidthType.PERCENTAGE },
    verticalAlign: VerticalAlign.CENTER
  });
}

function cellBold(text, widthPct) {
  return new TableCell({
    children: [new Paragraph({ children: [tr(text, { size: 18, bold: true })], alignment: AlignmentType.CENTER })],
    width: { size: widthPct, type: WidthType.PERCENTAGE },
    verticalAlign: VerticalAlign.CENTER
  });
}

function blankLine() {
  return new Paragraph({ children: [tr('_______________________________________________', { size: 18 })], spacing: { after: 80, before: 20 } });
}

export async function buildOfficialDocx(exam, options = {}) {
  const {
    gradeId = exam.gradeId || 'year1',
    subject = exam.subject || 'math',
    trimester = options.trimester || 3,
    schoolName = options.schoolName || '',
    schoolYear = options.schoolYear || '2025-2026'
  } = options;

  const levelLabel = LEVEL_LABELS[gradeId] || 'السنة الأولى اساسي';
  const subjectLabel = SUBJECT_LABELS[subject] || subject;
  const trimesterLabel = TRIMESTER_LABELS[trimester] || 'الثالث';
  const dateLabel = `${TRIMESTER_MONTHS[trimester] || ''} ${new Date().getFullYear()}`;

  const children = [];

  // === HEADER ===
  children.push(
    p([tr('الجمهورية التونسية', { size: 20, bold: true })]),
    p([tr('وزارة التربية', { size: 20, bold: true })]),
    p([tr('المندوبية الجهوية للتربية', { size: 18 })]),
    p([tr(`مدرسة : ${schoolName || '..........................................'}`, { size: 18 })]),
    p([tr(`السنة الدراسية: ${schoolYear}`, { size: 18 })])
  );

  // === STUDENT INFO ===
  children.push(new Table({
    rows: [new TableRow({ children: [
      cellBold('الاسم واللقب', 25),
      cell('................................................', 50),
      cellBold('القسم', 10),
      cell('........', 15)
    ]})],
    width: { size: 100, type: WidthType.PERCENTAGE }
  }));

  // === TITLE ===
  children.push(
    p([tr(`اختبار الثلاثي ${trimesterLabel}`, { size: 28, bold: true })], AlignmentType.CENTER),
    p([tr(`المادة: ${subjectLabel} — ${levelLabel}`, { size: 22, bold: true })], AlignmentType.CENTER),
    p([tr(`المدة: 60 دقيقة — العدد: / 20`, { size: 20 })], AlignmentType.CENTER)
  );

  // === CRITERIA TABLE ===
  const critCount = exam.criteria.length;
  const critCellW = Math.floor(70 / critCount);
  const critRows = [
    new TableRow({ children: [
      cellBold('المعايير', 15),
      ...exam.criteria.map(c => cellBold(`${c.code}\n${c.label}`, critCellW)),
      cellBold('المجموع', 15)
    ]}),
    new TableRow({ children: [
      cellBold('الأعداد', 15),
      ...exam.criteria.map(c => cellBold(`${c.max}`, critCellW)),
      cellBold(`/ ${exam.totalScore}`, 15)
    ]})
  ];
  children.push(new Table({ rows: critRows, width: { size: 100, type: WidthType.PERCENTAGE } }));

  children.push(p([tr('')]));

  // === QUESTIONS ===
  let num = 0;
  let curCrit = null;

  for (const q of exam.questions) {
    if (q.criterion !== curCrit) {
      curCrit = q.criterion;
      const critDef = exam.criteria.find(c => c.code === curCrit);
      children.push(p([tr(`المعيار ${curCrit}${critDef ? ': ' + critDef.label : ''}`, { size: 22, bold: true })]));
    }

    num++;
    if (q.type === 'MCQ') {
      children.push(p([tr(`${num}- ${q.prompt}`, { size: 20 })]));
      if (q.options && q.options.length) {
        const optStr = q.options.map(o => `(  )  ${o}`).join('        ');
        children.push(p([tr(optStr, { size: 20 })]));
      }
    } else {
      children.push(p([tr(`${num}- ${q.prompt}`, { size: 20 })]));
      for (let i = 0; i < (q.freeLines || 3); i++) children.push(blankLine());
    }
  }

  // === THRESHOLDS ===
  children.push(p([tr('')]));
  children.push(p([tr('عتبات التمكّن', { size: 22, bold: true })], AlignmentType.CENTER));
  children.push(new Table({
    rows: [
      new TableRow({ children: [cellBold('مستوى التملك', 35), cellBold('النقاط', 65)] }),
      new TableRow({ children: [cell('انعدام التملك', 35), cell('0 نقطة', 65)] }),
      new TableRow({ children: [cell('دون الأدنى', 35), cell(exam.criteria.map(c => `${c.code}: 1ن`).join(' | '), 65)] }),
      new TableRow({ children: [cell('الأدنى', 35), cell(exam.criteria.map(c => `${c.code}: 2ن`).join(' | '), 65)] }),
      new TableRow({ children: [cellBold('الأقصى (تميز)', 35), cell(exam.criteria.map(c => `${c.code}: ${c.max}ن`).join(' | '), 65)] })
    ],
    width: { size: 100, type: WidthType.PERCENTAGE }
  }));

  // === GRADING TABLE ===
  children.push(p([tr('')]));
  children.push(p([tr('جدول إسناد الأعداد', { size: 22, bold: true })], AlignmentType.CENTER));
  children.push(new Table({
    rows: [
      new TableRow({ children: [cellBold('مستوى التملك', 25), cellBold('المعايير', 75)] }),
      new TableRow({ children: [cell('انعدام التملك', 25), cell('0 نقطة', 75)] }),
      new TableRow({ children: [cell('دون الأدنى', 25), cell(exam.criteria.map(c => `${c.code}: 1ن`).join(' | '), 75)] }),
      new TableRow({ children: [cell('الأدنى', 25), cell(exam.criteria.map(c => `${c.code}: 2ن`).join(' | '), 75)] }),
      new TableRow({ children: [cellBold('الأقصى', 25), cell(exam.criteria.map(c => `${c.code}: ${c.max}ن`).join(' | '), 75)] })
    ],
    width: { size: 100, type: WidthType.PERCENTAGE }
  }));

  // === SIGNATURES ===
  children.push(p([tr('')]));
  children.push(p([tr('')]));
  children.push(new Table({
    rows: [new TableRow({ children: [
      cellBold('إمضاء التلميذ(ة)', 33),
      cellBold('إمضاء المعلم(ة)', 33),
      cell('ضعيف < 10 | مقبول 10-13 | حسن 14-16 | ممتاز 17-20', 34)
    ]})],
    width: { size: 100, type: WidthType.PERCENTAGE }
  }));

  const doc = new Document({
    sections: [{
      properties: { page: { margin: { top: 900, right: 720, bottom: 900, left: 720 } } },
      children
    }]
  });

  return Packer.toBuffer(doc);
}
