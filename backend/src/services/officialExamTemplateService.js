// ===== مولّد الامتحان الرسمي — قالب الوزارة التونسية =====
//
// يأخذ الأسئلة المولّدة إجرائياً حسب المعايير ويخرجها في البنية الرسمية
// المطابقة لامتحانات الوزارة: ترويسة رسمية + سناد قصصية + تعليمات مرقمة
// (N-M) موسومة بالمعايير + عتبات الإنجاز + جدول إسناد الأعداد.
//
// المرجع: نماذج امتحانات الثلاثي الثالث س1 (قرص D:\ المستخدم).

/**
 * يبني ترويسة الامتحان الرسمية
 */
export function buildHeader({ schoolName = '', levelLabel = 'السّنة الأولى أ+ ب', trimester = 3, subjectLabel, dateLabel = '' }) {
  return {
    schoolLine: `مدرسة : ${schoolName || '..........................................'}`,
    levelLine: levelLabel,
    titleLine: `اِختبار الثّلاثي اُل${['الأوّل', 'الثّاني', 'ثّالث'][trimester - 1] || 'الثّالث'}`,
    subjectLine: `النّشاط : ${subjectLabel}`,
    dateLine: dateLabel,
    nameLine: 'الإسم :................................................',
    surnameLine: 'اللّقب :...............................................'
  };
}

const TRIMESTER_MONTHS = { 1: 'دِيسَمبر', 2: 'مارس', 3: 'جوان' };

/**
 * يحوّل أسئلة مولّدة إلى أنشطة بصيغة التعليمات الرسمية داخل سناد قصصية.
 * math: سناد قصصية واحدة تضم الأرقام المولَّدة + تعليمات مرقمة.
 * reading/science: سناد قصيرة لكل مجموعة أنشطة.
 */
export function assembleOfficialExam(paper, options = {}) {
  const { gradeId = 'year1', trimester = 3 } = options;
  const SUBJECT_LABELS = {
    math: 'رياضيات',
    science: 'إيقاظ علمي',
    reading: 'قراءة',
    production: 'إنتاج كتابي',
    handwriting: 'خط وإملاء'
  };
  const header = buildHeader({
    trimester,
    subjectLabel: SUBJECT_LABELS[paper.subject] || paper.subject,
    dateLabel: `${TRIMESTER_MONTHS[trimester] || ''} ${new Date().getFullYear()}`
  });

  const objective = paper.questions.filter((q) => q.type === 'MCQ');
  const free = paper.questions.filter((q) => q.type === 'FREE');

  // تجميع الأسئلة في سناد: كل سناد 2-3 أنشطة متتابعة
  const senods = [];
  let current = null;
  let senodNum = 0;
  let actCounter = { n: 0 };

  for (const q of objective) {
    if (!current || current.activities.length >= 2) {
      senodNum += 1;
      current = {
        num: senodNum,
        text: buildSenodText(paper.subject, q, senodNum),
        activities: []
      };
      senods.push(current);
    }
    actCounter.n += 1;
    current.activities.push({
      instruction: instructionFor(paper.subject, q, actCounter.n, current.activities.length + 1),
      criterion: q.criterion,
      standardId: q.standardId,
      kind: q.kind || mcqKind(q),
      question: q,
      points: q.points
    });
  }

  // الأسئلة الحرة (كتابة/إنتاج) في سناد ختامية
  if (free.length) {
    senodNum += 1;
    senods.push({
      num: senodNum,
      text: freeSenodText(paper.subject),
      activities: free.map((q, i) => ({
        instruction: `${i + 1}-${q.prompt}`,
        criterion: q.criterion,
        standardId: q.standardId,
        kind: 'free',
        freeLines: q.freeLines || 3,
        points: q.points
      }))
    });
  }

  // العتبات: موزعة بين السناد (عتبة الحد الأدنى ثم عتبة التميز)
  const thresholds = [
    { afterSenod: Math.max(1, senods.length - 1), label: 'عتبة 1' },
    { afterSenod: senods.length, label: 'عتبة 2' }
  ];

  // جدول إسناد الأعداد: عمود لكل معيار + انعدام التملك
  const criteriaColumns = [];
  for (const c of paper.criteria) {
    criteriaColumns.push(c.code);
  }

  return {
    header,
    senods,
    thresholds,
    scoringTable: {
      title: 'جدول إسناد الأعـــــــــــــداد',
      minCriteriaLabel: 'معايير الحدّ الأدنى',
      excellenceLabel: 'معيار التّميّز',
      columns: criteriaColumns,
      zeroRow: 'انعدام التّملّك'
    },
    totalScore: paper.totalScore,
    meta: { gradeId, subject: paper.subject, generatedAt: paper.generatedAt, blueprintNote: paper.blueprintNote }
  };
}

function mcqKind(q) {
  if (/ضع دائرة|اختر|أيّ|كم/.test(q.prompt)) return 'circle';
  if (/صل|وصّل|اربط/.test(q.prompt)) return 'match';
  if (/رتّب|أرتب/.test(q.prompt)) return 'order';
  return 'circle';
}

/** سناد قصصية للرياضيات تحمل الأرقام المولَّدة (نمط «عادل في الضيعة») */
function buildSenodText(subject, q, senodNum) {
  if (subject === 'math') {
    const nums = extractNumbers(q.prompt);
    const hero = pickHero(senodNum);
    if (nums.length >= 2) {
      return `اُلسَّنَدُ ${senodNum} : ذهبَ ${hero} إلى سوقِ الضيعةِ فاشترى ${nums[0]} تفاحةً و${nums[1]} برتقالةً ليتصدّق بهما على إخوته الصغار.`;
    }
    if (nums.length === 1) {
      return `اُلسَّنَدُ ${senodNum} : في طريقِ العودةِ وجدَ ${hero} ${nums[0]} زهرةٍ جميلةً فقطفها لأمِّه.`;
    }
    return `اُلسَّنَدُ ${senodNum} : تجوّلَ ${hero} في ضيعةِ جدهِ ورأى أشجاراً مثمرةً وطيوراً ملوّنةً.`;
  }
  if (subject === 'science') {
    return `اُلسَّنَدُ : في الحديقةِ لاحظَ الأطفالُ الكائناتِ الحيّةَ من حولهم وتأمّلوا كيف تعيشُ وتتحرك.`;
  }
  return `اُلسَّنَدُ : اقرأ النصَّ الآتي بتمعُّنٍ.`;
}

function freeSenodText(subject) {
  if (subject === 'production') return 'انظر إلى الصورة وأعطِ الدفعةَ الحرّة:';
  if (subject === 'handwriting') return 'من دفترِ الخطِّ والإملاء:';
  return 'أنجزِ النشاطَ الآتي:';
}

function instructionFor(subject, q, senodNum, actNum) {
  const label = `${actNum}-${senodNum}`;
  if (subject === 'math') {
    if (/احسب|أكمل/.test(q.prompt)) return `اُلتَّعْلِيمَةُ ${label}: أَحْسُبُ النَّتِيجَةَ.`;
    if (/أيّ العددين/.test(q.prompt)) return `اُلتَّعْلِيمَةُ ${label}: أُقَارِنُ بَيْنَ العَدَدَيْنِ.`;
    if (/عدد/.test(q.prompt)) return `اُلتَّعْلِيمَةُ ${label}: أُعَدُّ وَأَكْتُبُ العَدَدَ المناسِبَ.`;
    return `اُلتَّعْلِيمَةُ ${label}: أُنجِزُ النَّشاطَ.`;
  }
  return `اُلتَّعْلِيمَةُ ${label}: ${shorten(q.prompt)}`;
}

function shorten(prompt) {
  const p = String(prompt);
  return p.length > 90 ? `${p.slice(0, 87)}...` : p;
}

function extractNumbers(prompt) {
  return (String(prompt).match(/\d+/g) || []).map(Number);
}

function pickHero(n) {
  const heroes = ['عادل', 'سامي', 'أمين', 'يوسف'];
  return heroes[n % heroes.length];
}

/**
 * يولّد HTML جاهزاً للطباعة A4 بمظهر الامتحان الرسمي التونسي.
 */
export function renderOfficialHtml(exam) {
  const h = exam.header;
  const senodsHtml = exam.senods
    .map((s) => {
      const acts = s.activities
        .map((a) => {
          let body = '';
          if (a.kind === 'free') {
            body = `<div class="lines">${'<div class="line"></div>'.repeat(a.freeLines || 3)}</div>`;
          } else if (a.question?.options) {
            body = `<div class="opts">${a.question.options.map((o) => `<span class="opt">⭕ ${o}</span>`).join(' ')}</div>`;
            body += `<div class="dots">. . . . . . . . . . . . . . . . . . . .</div>`;
          }
          return `
          <div class="activity">
            <div class="criterion-tag">${a.criterion}</div>
            <p class="instruction"><b>${a.instruction}</b></p>
            ${body}
          </div>`;
        })
        .join('');
      return `
      <div class="senod">
        <p class="senod-text"><b>${s.text}</b></p>
        ${acts}
      </div>
      ${exam.thresholds.filter((t) => t.afterSenod === s.num).map((t) => `<div class="threshold">${t.label}</div>`).join('')}`;
    })
    .join('');

  const tableCols = exam.scoringTable.columns.map((c) => `<th>${c}</th>`).join('');

  return `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head><meta charset="UTF-8"><title>${h.titleLine} — ${h.subjectLine}</title>
<style>
  @page { size: A4; margin: 12mm; }
  body { font-family: 'Noto Naskh Arabic','Traditional Arabic',Arial; font-size: 15px; line-height: 1.9; color: #000; }
  .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 6px; margin-bottom: 10px; }
  .header .row { display: flex; justify-content: space-between; font-weight: 700; }
  .meta { display: flex; justify-content: space-between; margin: 6px 0; }
  .senod-text { background: #f3f4f6; border: 1.5px solid #333; border-radius: 6px; padding: 6px 10px; }
  .activity { position: relative; margin: 8px 0; padding-inline-start: 8px; border-inline-start: 3px solid #999; }
  .criterion-tag { position: absolute; inset-inline-start: -3px; top: -6px; background: #e5e7eb; border: 1px solid #666; border-radius: 4px; font-size: 11px; font-weight: 800; padding: 0 6px; }
  .instruction { margin: 0 0 4px; }
  .opts { display: flex; flex-wrap: wrap; gap: 14px; margin: 4px 0; }
  .dots { color: #555; letter-spacing: 2px; }
  .lines .line { border-bottom: 1.5px dotted #444; height: 26px; }
  .threshold { text-align: center; font-weight: 800; border: 2px dashed #444; border-radius: 999px; width: fit-content; margin: 10px auto; padding: 2px 22px; }
  table.scoring { width: 100%; border-collapse: collapse; margin-top: 14px; }
  table.scoring th, table.scoring td { border: 1.5px solid #000; text-align: center; padding: 4px; font-size: 13px; }
  @media print { .no-print { display: none; } }
</style></head>
<body>
  <div class="header">
    <div class="row"><span>${h.schoolLine}</span><span>${h.levelLine}</span></div>
    <div style="font-size:18px;font-weight:800">${h.titleLine}</div>
    <div class="row"><span>${h.subjectLine}</span><span>${h.dateLine}</span></div>
  </div>
  <div class="meta">
    <span>${h.nameLine}</span>
    <span>${h.surnameLine}</span>
  </div>
  ${senodsHtml}
  <table class="scoring">
    <thead><tr><th colspan="${exam.scoringTable.columns.length}">${exam.scoringTable.title}</th></tr>
    <tr><th>${exam.scoringTable.minCriteriaLabel}</th><th>${exam.scoringTable.excellenceLabel}</th></tr>
    <tr>${tableCols}</tr></thead>
    <tbody><tr><td colspan="${exam.scoringTable.columns.length}" style="text-align:center">${exam.scoringTable.zeroRow}: 0</td></tr></tbody>
  </table>
  <button class="no-print" onclick="window.print()" style="position:fixed;top:8px;left:8px;padding:8px 18px;border-radius:8px;border:none;background:#3b6fd4;color:#fff;font-weight:700;cursor:pointer">🖨️ طباعة</button>
</body></html>`;
}