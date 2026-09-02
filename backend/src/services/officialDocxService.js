import { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, BorderStyle, AlignmentType, Header, Footer } from 'docx';

const TRIMESTER_LABELS = { 1: 'الأوّل', 2: 'الثّاني', 3: 'الثّالث' };
const SUBJECT_LABELS = {
  math: 'رياضيات',
  science: 'إيقاظ علمي',
  reading: 'قراءة',
  production: 'إنتاج كتابي',
  handwriting: 'خط وإملاء',
  islamic: 'تربية إسلامية',
  french: 'لغة فرنسية',
  english: 'لغة إنجليزية',
  tech: 'تكنولوجيا',
  civics: 'تربية مدنية',
  history: 'تاريخ',
  geography: 'جغرافيا'
};

const LEVEL_LABELS = {
  year1: 'السنة الأولى',
  year2: 'السنة الثانية',
  year3: 'السنة الثالثة',
  year4: 'السنة الرابعة',
  year5: 'السنة الخامسة',
  year6: 'السنة السادسة'
};

const TRIMESTER_MONTHS = { 1: 'ديسمبر', 2: 'مارس', 3: 'جوان' };

function createTextRun(text, options = {}) {
  return new TextRun({
    text,
    font: 'Amiri',
    size: options.size || 24,
    bold: options.bold || false,
    rtl: true,
    ...options
  });
}

function createParagraph(children, alignment = AlignmentType.RIGHT) {
  return new Paragraph({
    children,
    alignment,
    spacing: { after: 80, before: 40 },
    bidirectional: true
  });
}

function createTableCell(children, width, options = {}) {
  return new TableCell({
    children: children.map(c => typeof c === 'string' ? new Paragraph({ children: [createTextRun(c, { size: options.size || 20, bold: options.bold })], alignment: AlignmentType.CENTER, bidirectional: true }) : c),
    width: { size: width, type: WidthType.PERCENTAGE },
    verticalAlign: 'center',
    margins: { top: 40, bottom: 40, left: 40, right: 40 },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 1, color: '000000' },
      bottom: { style: BorderStyle.SINGLE, size: 1, color: '000000' },
      left: { style: BorderStyle.SINGLE, size: 1, color: '000000' },
      right: { style: BorderStyle.SINGLE, size: 1, color: '000000' }
    },
    shading: options.shading
  });
}

export function buildOfficialDocx(exam, options = {}) {
  const { gradeId = 'year1', subject = 'math', trimester = 3, schoolName = '', teacherName = '' } = options;

  const levelLabel = LEVEL_LABELS[gradeId] || 'السنة الأولى';
  const subjectLabel = SUBJECT_LABELS[subject] || subject;
  const trimesterLabel = TRIMESTER_LABELS[trimester] || 'الثّالث';
  const dateLabel = `${TRIMESTER_MONTHS[trimester] || ''} ${new Date().getFullYear()}`;

  const docChildren = [];

  // Header section
  docChildren.push(
    createParagraph([
      createTextRun('الجمهورية التونسية', { size: 20, bold: true }),
      createTextRun('\t\t\t'),
      createTextRun('وزارة التربية', { size: 20, bold: true }),
      createTextRun('\t\t\t'),
      createTextRun('المندوبية الجهوية للتربية', { size: 18 })
    ]),
    createParagraph([
      createTextRun(`مدرسة : ${schoolName || '..........................................'}`, { size: 18 })
    ]),
    createParagraph([
      createTextRun(`اختبار الثلاثي ${trimesterLabel}`, { size: 24, bold: true })
    ]),
    createParagraph([
      createTextRun(`السنة الدراسية: ${dateLabel}`, { size: 18 }),
      createTextRun('\t\t\t'),
      createTextRun(levelLabel, { size: 18 })
    ]),
    createParagraph([
      createTextRun(`المادة: ${subjectLabel}`, { size: 18, bold: true }),
      createTextRun('\t\t\t'),
      createTextRun(`المدة: 60 دقيقة`, { size: 18 }),
      createTextRun('\t\t\t'),
      createTextRun(`التاريخ: ${dateLabel}`, { size: 18 })
    ]),
    createParagraph([
      createTextRun('الاسم واللقب: ..................................................', { size: 20 })
    ]),
    createParagraph([
      createTextRun(`القسم: ..................`, { size: 20 }),
      createTextRun('\t\t\t'),
      createTextRun('العدد: .... / 20', { size: 20, bold: true })
    ]),
    createParagraph([
      createTextRun(`${subjectLabel} - ${levelLabel} - الثلاثي ${trimesterLabel}`, { size: 24, bold: true })
    ], AlignmentType.CENTER),
    createParagraph([
      createTextRun(`حول دروس: ${exam.meta?.lessonsStr || '........................................'}`, { size: 18 })
    ], AlignmentType.CENTER)
  );

  // Scoring table
  const scoringTable = new Table({
    rows: [
      new TableRow({
        children: [
          createTableCell(['التمرين'], 10, { bold: true, size: 18, shading: 'F0F0F0' }),
          ...exam.senods.map((_, i) => createTableCell([`${i + 1}`], 10, { bold: true, size: 18, shading: 'F0F0F0' })),
          createTableCell(['المجموع'], 10, { bold: true, size: 18, shading: 'F0F0F0' })
        ]
      }),
      new TableRow({
        children: [
          createTableCell(['العدد'], 10, { bold: true, size: 18, shading: 'F0F0F0' }),
          ...exam.senods.map(() => createTableCell(['..'], 10, { size: 18 })),
          createTableCell(['/20'], 10, { bold: true, size: 18, shading: 'F0F0F0' })
        ]
      }),
      new TableRow({
        children: [
          createTableCell(['المعيار'], 10, { bold: true, size: 18, shading: 'F0F0F0' }),
          ...exam.senods.map((s, i) => createTableCell([s.activities[0]?.criterion || 'معـ'], 10, { bold: true, size: 18, shading: 'F0F0F0' })),
          createTableCell(['التميز'], 10, { bold: true, size: 18, shading: 'F0F0F0' })
        ]
      })
    ],
    width: { size: 100, type: WidthType.PERCENTAGE }
  });
  docChildren.push(scoringTable);

  // Exercises
  for (let sIdx = 0; sIdx < exam.senods.length; sIdx++) {
    const senod = exam.senods[sIdx];
    const totalPoints = senod.activities.reduce((sum, a) => sum + (a.points || 0), 0);
    const criterion = senod.activities[0]?.criterion || 'معـ';

    docChildren.push(
      createParagraph([
        createTextRun(`التمرين ${sIdx + 1}: نشاط (${totalPoints} نقاط)`, { size: 20, bold: true })
      ]),
      createParagraph([
        createTextRun(`المعيار ${criterion} - ${criterion === 'تم' ? 'معيار التميز' : 'معايير الحد الأدنى'}`, { size: 16, bold: true })
      ]),
      createParagraph([
        createTextRun(senod.text, { size: 18, bold: true })
      ])
    );

    for (let aIdx = 0; aIdx < senod.activities.length; aIdx++) {
      const activity = senod.activities[aIdx];
      docChildren.push(
        createParagraph([
          createTextRun(`${aIdx + 1}-${sIdx + 1} ${activity.instruction}`, { size: 18 })
        ])
      );

      if (activity.kind === 'free') {
        for (let i = 0; i < (activity.freeLines || 3); i++) {
          docChildren.push(
            createParagraph([
              createTextRun('................................................................', { size: 18 })
            ])
          );
        }
      } else {
        if (activity.question?.options) {
          docChildren.push(
            createParagraph(
              activity.question.options.map(opt => createTextRun(`⭕ ${opt}  `, { size: 18 }))
            )
          );
        }
        docChildren.push(
          createParagraph([
            createTextRun('................................................................', { size: 18 })
          ])
        );
      }
    }

    // Thresholds
    const thresholds = exam.thresholds.filter(t => t.afterSenod === sIdx + 1);
    for (const t of thresholds) {
      docChildren.push(
        createParagraph([
          createTextRun(t.label, { size: 18, bold: true })
        ], AlignmentType.CENTER)
      );
    }
  }

  // Final scoring table detail
  docChildren.push(
    createParagraph([
      createTextRun('جدول إسناد الأعـــــــــــــداد', { size: 22, bold: true })
    ], AlignmentType.CENTER)
  );

  const finalTable = new Table({
    rows: [
      new TableRow({
        children: [
          createTableCell(['المعايير'], 30, { bold: true, size: 18, shading: 'F0F0F0' }),
          createTableCell(['مستويات التملك'], 70, { bold: true, size: 18, shading: 'F0F0F0' })
        ]
      }),
      new TableRow({
        children: [
          createTableCell(['انعدام التملك'], 30, { size: 18 }),
          createTableCell(['0 نقطة'], 70, { size: 18 })
        ]
      }),
      new TableRow({
        children: [
          createTableCell(['دون التملك الأدنى'], 30, { size: 18 }),
          createTableCell([exam.senods.map(s => `${s.activities[0]?.criterion}: ${s.activities[0].points || 1}ن`).join(' | ')], 70, { size: 18 })
        ]
      }),
      new TableRow({
        children: [
          createTableCell(['التملك الأدنى'], 30, { size: 18 }),
          createTableCell([exam.senods.map(s => `${s.activities[0]?.criterion}: ${s.activities[0].points || 2}ن`).join(' | ')], 70, { size: 18 })
        ]
      }),
      new TableRow({
        children: [
          createTableCell(['التملك الأفصى (تميز)'], 30, { size: 18, bold: true }),
          createTableCell([exam.senods.map(s => `${s.activities[0]?.criterion === 'تم' ? '2 نقاط' : '---'}`).join(' | ')], 70, { size: 18 })
        ]
      })
    ],
    width: { size: 100, type: WidthType.PERCENTAGE }
  });
  docChildren.push(finalTable);

  const doc = new Document({
    sections: [{
      properties: {
        page: { margin: { top: 1000, right: 720, bottom: 1000, left: 720 } }
      },
      headers: {
        default: new Header({
          children: [
            new Paragraph({
              children: [createTextRun('تونِسيوك - مولد الاختبارات الرسمي - وزارة التربية', { size: 16, bold: true })],
              alignment: AlignmentType.CENTER
            })
          ]
        })
      },
      footers: {
        default: new Footer({
          children: [
            new Paragraph({
              children: [
                createTextRun('إمضاء الولي', { size: 18, bold: true }),
                createTextRun('\n\n................................', { size: 18 }),
                createTextRun('\t\t\tإمضاء المعلم(ة)', { size: 18, bold: true }),
                createTextRun('\n\n................................', { size: 18 }),
                createTextRun('\t\t\tملاحظة: ........................ | المقياس: ضعيف <10 | مقبول 10-13 | حسن 14-16 | ممتاز 17-20', { size: 16 })
              ],
              alignment: AlignmentType.CENTER,
              spacing: { before: 400 }
            })
          ]
        })
      },
      children: docChildren
    }]
  });

  return Packer.toBuffer(doc);
}