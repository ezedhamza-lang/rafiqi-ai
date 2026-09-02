import { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, BorderStyle, AlignmentType, Header, Footer } from 'docx';

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
  return new TextRun({ text, font: 'Amiri', size: opts.size || 22, bold: !!opts.bold, rtl: true, ...opts });
}

function p(children, align = AlignmentType.RIGHT) {
  return new Paragraph({ children, alignment: align, spacing: { after: 60, before: 30 }, bidirectional: true });
}

function cell(texts, width, opts = {}) {
  const paras = (Array.isArray(texts) ? texts : [texts]).map(t =>
    typeof t === 'string'
      ? new Paragraph({ children: [tr(t, { size: opts.size || 18, bold: !!opts.bold })], alignment: AlignmentType.CENTER, bidirectional: true })
      : t
  );
  return new TableCell({
    children: paras,
    width: { size: width, type: WidthType.PERCENTAGE },
    verticalAlign: 'center',
    margins: { top: 30, bottom: 30, left: 30, right: 30 },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 1, color: '000000' },
      bottom: { style: BorderStyle.SINGLE, size: 1, color: '000000' },
      left: { style: BorderStyle.SINGLE, size: 1, color: '000000' },
      right: { style: BorderStyle.SINGLE, size: 1, color: '000000' }
    },
    shading: opts.shading ? { fill: opts.shading } : undefined
  });
}

function blankLine() {
  return new Paragraph({
    children: [tr('________________________________________________', { size: 18 })],
    spacing: { after: 100, before: 40 },
    bidirectional: true
  });
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
  const trimesterLabel = TRIMESTER_LABELS[trimester] || 'الثّالث';
  const dateLabel = `${TRIMESTER_MONTHS[trimester] || ''} ${new Date().getFullYear()}`;

  const children = [];

  // === HEADER ===
  children.push(
    p([tr('الجمهورية التونسية', { size: 20, bold: true })], AlignmentType.RIGHT),
    p([tr('وزارة التربية', { size: 20, bold: true })], AlignmentType.RIGHT),
    p([tr('المندوبية الجهوية للتربية', { size: 18 })], AlignmentType.RIGHT),
    p([tr(`مدرسة : ${schoolName || '..........................................'}`, { size: 18 })], AlignmentType.RIGHT),
    p([tr(`السنة الدراسية: ${schoolYear}`, { size: 18 })], AlignmentType.RIGHT),
    p([tr('')])
  );

  // === STUDENT INFO TABLE ===
  children.push(new Table({
    rows: [
      new TableRow({ children: [
        cell('الاسم واللقب', 25, { bold: true, shading: 'F0F0F0' }),
        cell('................................................', 50),
        cell('القسم', 10, { bold: true, shading: 'F0F0F0' }),
        cell('........', 15)
      ]})
    ],
    width: { size: 100, type: WidthType.PERCENTAGE }
  }));

  children.push(p([tr('')]));

  // === TITLE ===
  children.push(
    p([tr(`اختبار الثلاثي ${trimesterLabel}`, { size: 28, bold: true })], AlignmentType.CENTER),
    p([tr(`المادة: ${subjectLabel} — ${levelLabel}`, { size: 22, bold: true })], AlignmentType.CENTER),
    p([tr(`المدة: 60 دقيقة — العدد: / 20`, { size: 20 })], AlignmentType.CENTER)
  );

  // === CRITERIA SCORING TABLE ===
  const critHeader = exam.criteria.map(c =>
    cell([c.code, tr(c.label, { size: 14 })], Math.floor(70 / exam.criteria.length), { bold: true, shading: 'E8E8E8' })
  );
  const critScores = exam.criteria.map(c =>
    cell(`${c.max}`, Math.floor(70 / exam.criteria.length), { bold: true, size: 20 })
  );
  children.push(new Table({
    rows: [
      new TableRow({ children: [
        cell('المعايير', 15, { bold: true, shading: 'F0F0F0' }),
        ...critHeader,
        cell('المجموع', 15, { bold: true, shading: 'F0F0F0' })
      ]}),
      new TableRow({ children: [
        cell('الأعداد', 15, { bold: true, shading: 'F0F0F0' }),
        ...critScores,
        cell(`/ ${exam.totalScore}`, 15, { bold: true, size: 22 })
      ]})
    ],
    width: { size: 100, type: WidthType.PERCENTAGE }
  }));

  children.push(p([tr('')]));

  // === QUESTIONS GROUPED BY CRITERION ===
  let questionNum = 0;
  let currentCriterion = null;

  for (const q of exam.questions) {
    if (q.criterion !== currentCriterion) {
      currentCriterion = q.criterion;
      const critDef = exam.criteria.find(c => c.code === currentCriterion);
      children.push(p([tr(`التمريــن — المعيار ${currentCriterion}${critDef ? ': ' + critDef.label : ''}`, { size: 24, bold: true })], AlignmentType.RIGHT));
    }

    questionNum++;
    if (q.type === 'MCQ') {
      children.push(
        p([tr(`${questionNum}- ${q.prompt}`, { size: 20 })], AlignmentType.RIGHT)
      );
      if (q.options && q.options.length) {
        const optTexts = q.options.map(o => tr(`  (  )  ${o}   `, { size: 20 }));
        children.push(p(optTexts, AlignmentType.RIGHT));
      }
    } else {
      // FREE question
      children.push(
        p([tr(`${questionNum}- ${q.prompt}`, { size: 20 })], AlignmentType.RIGHT)
      );
      const lines = q.freeLines || 3;
      for (let i = 0; i < lines; i++) {
        children.push(blankLine());
      }
    }
  }

  // === THRESHOLD LABELS ===
  children.push(p([tr('')]));
  children.push(p([tr('عتبات التمكّن', { size: 22, bold: true })], AlignmentType.CENTER));
  const thresholds = [
    { label: 'انعدام التملك', score: '0' },
    { label: 'دون التملك الأدنى', score: exam.criteria.map(c => `${c.code}: 1ن`).join(' | ') },
    { label: 'التملك الأدنى', score: exam.criteria.map(c => `${c.code}: 2ن`).join(' | ') },
    { label: 'التملك الأقصى (تميز)', score: exam.criteria.map(c => c.code === 'تم' ? 'تم: 5ن' : `${c.code}: --`).join(' | ') }
  ];
  children.push(new Table({
    rows: thresholds.map(t =>
      new TableRow({ children: [
        cell(t.label, 35, { bold: true, shading: 'E8E8E8' }),
        cell(t.score, 65)
      ]})
    ),
    width: { size: 100, type: WidthType.PERCENTAGE }
  }));

  // === GRADING TABLE ===
  children.push(p([tr('')]));
  children.push(p([tr('جدول إسناد الأعداد', { size: 22, bold: true })], AlignmentType.CENTER));
  children.push(new Table({
    rows: [
      new TableRow({ children: [
        cell('مستوى التملك', 25, { bold: true, shading: 'F0F0F0' }),
        cell('المعايير', 75, { bold: true, shading: 'F0F0F0' })
      ]}),
      new TableRow({ children: [
        cell('انعدام التملك', 25, { shading: 'FFF0F0' }),
        cell('0 نقطة', 75)
      ]}),
      new TableRow({ children: [
        cell('دون الأدنى', 25),
        cell(exam.criteria.map(c => `${c.code}: 1ن`).join(' | '), 75)
      ]}),
      new TableRow({ children: [
        cell('الأدنى', 25),
        cell(exam.criteria.map(c => `${c.code}: 2ن`).join(' | '), 75)
      ]}),
      new TableRow({ children: [
        cell('الأقصى (تميز)', 25, { bold: true }),
        cell(exam.criteria.map(c => `${c.code}: ${c.max}ن`).join(' | '), 75)
      ]})
    ],
    width: { size: 100, type: WidthType.PERCENTAGE }
  }));

  // === FOOTER SIGNATURES ===
  children.push(p([tr('')]));
  children.push(p([tr('')]));
  children.push(new Table({
    rows: [
      new TableRow({ children: [
        cell([
          tr('إمضاء التلميذ(ة)', { size: 18, bold: true }),
          tr('\n\n................................', { size: 18 })
        ], 33),
        cell([
          tr('إمضاء المعلم(ة)', { size: 18, bold: true }),
          tr('\n\n................................', { size: 18 })
        ], 33),
        cell([
          tr('ملاحظة:', { size: 16, bold: true }),
          tr('ضعيف < 10 | مقبول 10-13 | حسن 14-16 | ممتاز 17-20', { size: 14 })
        ], 34)
      ]})
    ],
    width: { size: 100, type: WidthType.PERCENTAGE }
  }));

  const doc = new Document({
    sections: [{
      properties: {
        page: { margin: { top: 900, right: 720, bottom: 900, left: 720 } }
      },
      headers: {
        default: new Header({
          children: [new Paragraph({
            children: [tr('رفيقي — مولد الاختبارات الرسمي — وزارة التربية التونسية', { size: 14, bold: true })],
            alignment: AlignmentType.CENTER
          })]
        })
      },
      footers: {
        default: new Footer({
          children: [new Paragraph({
            children: [tr('صفحة ', { size: 14 })],
            alignment: AlignmentType.CENTER
          })]
        })
      },
      children
    }]
  });

  return Packer.toBuffer(doc);
}
