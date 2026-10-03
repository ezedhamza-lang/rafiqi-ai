// مصفوفة المواصفات + التقرير التحليلي — SPEC D8 + A4 + C4 + B2 (شريحة ١).
//
// خيط التوليد الإلزامي: معيار ← مؤشر ← صيغة سؤال ← مستوى تملك ← نقاط **لكل سؤال**
// (قرار المستخدم: حقل criterion إجباري من مخطّط المعايير القابل للتهيئة + تقرير
// معلّم تحليلي). الإسناد حتمي من الكود لا من الـPrompt:
//   - الرياضيات: الرموز الرسمية M1–M4/D/HC من criterion-map (مصدر رسمي S1).
//   - بقية المواد: شبكة التنقيط (مع1..) من criteria-grids — ترشيح بنصّ السؤال ثم
//     اشتقاق بالصيغة، ومعيار التمييز (excellence) لا يُسند أبدًا (§A5: للأقصى فقط).
// كل صفّ يحمل source؛ الأرقام (عتبات/مستويات) من الشبكة المهيّأة لا مُنسوبة للوزارة
// بلا سند (القاعدة الذهبية 1-2). نصوص «المؤشر/الأخطاء المتوقعة» تصنيف داخلي
// موثّق [داخلي] قابل للتهيئة — لا ادّعاء وزاري.

import { criteriaGrid, scaleCriteria, DEFAULT_CRITERIA } from './criteria-grids.js';
import { MATH_CRITERIA, GRID_ID_TO_KEY, criteriaDisplay, mapMathCriterion } from './criterion-map.js';

const TASHKEEL_RE = /[\u064B-\u0652\u0670\u0640]/g;

/** هل هذه المادة شبكتها شبكة الرياضيات (يردّ الرموز الرسمية M1..D)؟ */
const isMathSubject = (subject) => criteriaGrid(subject) === DEFAULT_CRITERIA.math;

/** تطبيع للترشيح: تشكيل + همزات + ى/ؤئ (نفس منطق criterion-map). */
const norm = (s) => String(s || '')
  .replace(TASHKEEL_RE, '')
  .replace(/[أإآٱ]/g, 'ا')
  .replace(/ى/g, 'ي')
  .replace(/ؤ/g, 'و')
  .replace(/ئ/g, 'ي');

// ── 1) صلاحية وإسناد المعيار ─────────────────────────────────────────────

/** هل القيمة عضو مشروع في مخطّط المعايير لهذه المادة؟ */
export function criterionValid(subject, criterion, grid = []) {
  const c = String(criterion || '').trim();
  if (!c) return false;
  if (isMathSubject(subject)) return Object.values(MATH_CRITERIA).some((x) => x.code === c);
  return grid.some((x) => x.id === c);
}

// ترشيح قوي: نصّ المهمة ← دلالة المعيار — كل الأنماط بصيغة norm() المطبَّع:
// أ→ا، ى→ي، ؤ→و، ئ→ي، إزالة الشدّة والتشكيل (كما في criterion-map).
const HINTS = [
  { re: /(اصلح|اشطب|تصريف خاطي|الخطا|خطا في)/, want: /اصلاح|تصحيح|خطا/ },
  { re: /(علل|لماذا|فسر|برر|اذكر السبب)/, want: /تعليل|لماذا|سبب/ },
  { re: /(اقرا|اقرو|جهر)/, want: /جهر|قراءة/ },
  { re: /(حلل|وضعية)/, want: /تحليل|وضعية/ },
  { re: /(رايك|رايي|توافق|ماذا كنت|اكتب|حرر|اشرح|اعرب)/, want: /تصر|ادباء|راي|تعبير|انتاج|بناء|رأي|إبداء/ },
  { re: /(استخرج|اكمل|املا|اختر|ضع علامة|ما الذي|ما هو|اين|متى|كيف|مع من|باي|من النص)/, want: /معالجة|فهم|نص|بنود|مفردات|لغة/ }
];

/** اشتقاق حتمي لمعيار السؤال من مخطّط المادة — لا يُسند معيار التمييز أبدًا. */
function heuristicCriterion(q, grid) {
  const pool = grid.filter((c) => !c.excellence);
  const rows = pool.length ? pool : grid;
  if (!rows.length) return null;
  const prompt = norm(q?.prompt);
  for (const h of HINTS) {
    if (!h.re.test(prompt)) continue;
    const hit = rows.find((c) => h.want.test(norm(c.label)));
    if (hit) return hit.id;
  }
  const type = String(q?.type || '');
  if (type === 'OPEN') {
    const expr = rows.find((c) => /(تصر|ادباء|راي|تعبير|انتاج|بناء)/.test(norm(c.label)));
    return (expr || rows[rows.length - 1]).id;
  }
  if (['FILL_BLANK', 'EXTRACT', 'MATCHING'].includes(type)) {
    const comp = rows.find((c) => /(معالجة|فهم|نص|بنود|مفردات)/.test(norm(c.label)));
    if (comp) return comp.id;
  }
  return rows[0].id;
}

/**
 * إسناد المعيار لكل سؤال (D8): القيمة الصريحة إن كانت مشروعية، وإلا الاشتقاق.
 * @returns {string|null} null ⇐ لا يوجد مخطّط معايير (يصير CRITERION_MISSING)
 */
export function assignCriterion(q, { subject, grid = [] } = {}) {
  const given = String(q?.criterion || '').trim();
  if (criterionValid(subject, given, grid)) return given;
  if (isMathSubject(subject)) return MATH_CRITERIA[mapMathCriterion(q)].code;
  return heuristicCriterion(q, grid);
}

/** مفتاح شبكة الرياضيات ← الرمز الرسمي لسؤال يحمل M-code. */
const KEY_TO_GRID_ID = Object.fromEntries(Object.entries(GRID_ID_TO_KEY).map(([gid, key]) => [key, gid]));

function gridIdFor(q, subject) {
  if (!isMathSubject(subject)) return String(q?.criterion || '');
  const code = String(q?.criterion || '');
  const key = Object.keys(MATH_CRITERIA).find((k) => MATH_CRITERIA[k].code === code);
  if (!key) return '';
  if (key === 'MAT_MENTAL') return '__component__'; // مكوّن مستقل لا معيار
  return KEY_TO_GRID_ID[key] || '';
}

// ── 2) نصوص المؤشر والأخطاء المتوقعة [داخلي — قابلة للتهيئة] ──────────────

const MEANING = [
  { re: /صحة الحساب/, ind: 'دقّة إنجاز العمليات ونواتجها', err: 'أخطاء الطرح/الاقتراض، ناتج غير مطابق، خطأ نقل' },
  { re: /تأويل/, ind: 'اختيار المعنى الصحيح واستعماله في السياق', err: 'اختيار لا يستند إلى النصّ، تأويل حرفي خاطئ' },
  { re: /وحدات القياس|النقود/, ind: 'استعمال الوحدة والقيمة المناسبة (منها النقود التونسيّة)', err: 'وحدة ناقصة أو زائدة، ملخّط 1 دينار/1000 مليم، قطعة نقدية غير مستعملة' },
  { re: /هندس/, ind: 'استعمال خواصّ الأشكال في الوصف والرسم', err: 'خاصيّة غير مستعملة، رسم بلا قياس، خلط الأضلاع' },
  { re: /الدقّة|الدقة/, ind: 'دقّة القراءة والكتابة والنتيجة', err: 'تسريب في النقل أو الكتابة' },
  { re: /تحليل وضعية/, ind: 'استخراج المعلومة من المشهد ووظيفتها', err: 'معلومة منسوبة لغير مكانها في المشهد' },
  { re: /تعليل/, ind: 'ربط الجواب بسبب وارد في المعطيات', err: 'جواب بلا سبب، سبب من خارج السند' },
  { re: /اصلاح|إصلاح/, ind: 'اكتشاف الخطأ وإبداله بالصواب', err: 'تصحيح بلا استخراج للخطأ الأصلي' },
  { re: /جهر|قراءة/, ind: 'قراءة سليمة جهريّة للنصّ', err: 'وقوف ونطق خاطئان' },
  { re: /معالجة النص/, ind: 'استخراج المعلومة وفهمها من النصّ', err: 'جواب من خارج النصّ' },
  { re: /تصر|ادباء|راي|رأي/, ind: 'التعبير عن موقف مدعوم بدليل من النصّ', err: 'رأي بلا دليل' },
  { re: /تحليل|فهم/, ind: 'فهم المحتوى واستثماره في المهمّة', err: 'إجابة سطحية غير مستندة' }
];

const meaningOf = (label) => MEANING.find((m) => m.re.test(norm(label))) || null;

// ── 3) بناء المصفوفة ─────────────────────────────────────────────────────

/**
 * مصفوفة المواصفات (D8): صفّ لكل معيار في المخطّط + أسئلته ونقاطه وتشخيصه.
 * @param {{questions:Array, grid:Array, subject:string, targetPoints:number}} args
 * @returns {{rows:Array, component:Array, unmatched:Array, covered:number, standards:number, sum:number}}
 */
export function buildSpecMatrix({ questions = [], grid = [], subject = '', targetPoints = 20 } = {}) {
  // التحجيم إلى هدف الورقة (10/15/20) — العتبات تُحجَّم كشبكة التنقيط نفسها (§7)
  const scaled = scaleCriteria(grid.length ? grid : criteriaGrid(subject), targetPoints);
  const rows = scaled.map((c) => {
    const meaning = meaningOf(c.label);
    const display = criteriaDisplay(c.id, subject);
    return {
      criterion: c.id,
      officialCode: display?.officialCode || null,
      source: display?.source || 'داخلي – شبكة التنقيط (criteria-grids)',
      label: c.label,
      excellence: !!c.excellence,
      questionNos: [],
      types: {},
      points: 0,
      mastery: { ...c.mastery },
      thresholds: { below: c.mastery?.below ?? 0, min: c.mastery?.min ?? 0, max: c.mastery?.max ?? 0 },
      indicator: meaning?.ind || `يتجلّى في مهامّ «${c.label}»`,
      expectedErrors: meaning?.err || '—',
      diagnosis: ''
    };
  });

  const component = [];
  const unmatched = [];
  let sum = 0;
  questions.forEach((q, i) => {
    const pts = Number(q?.points) || 0;
    sum += pts;
    const gid = gridIdFor(q, subject);
    if (gid === '__component__') { component.push(i + 1); return; }
    const row = rows.find((r) => r.criterion === gid);
    if (!row) { unmatched.push(i + 1); return; }
    row.questionNos.push(i + 1);
    const t = String(q?.type || 'UNKNOWN');
    row.types[t] = (row.types[t] || 0) + 1;
    row.points += pts;
  });

  const target = Number(targetPoints) || 20;
  rows.forEach((r) => {
    r.share = target ? Math.round((r.points / target) * 100) / 100 : 0;
    r.formats = Object.entries(r.types).map(([t, n]) => `${t}×${n}`).join(' · ');
    if (!r.questionNos.length) {
      r.diagnosis = r.excellence
        ? 'معيار تمييز: لا يُمنح إلّا عند التملّك الأقصى — أسئلته اختيارية (§A5)'
        : 'لا أسئلة تقيس هذا المعيار — راجع توازن الورقة';
    } else if (r.share > 0.35) {
      r.diagnosis = `تركيز نقاط مرتفع (${Math.round(r.share * 100)}%) — تحقّق من التوازن`;
    } else {
      r.diagnosis = `تغطية منتظمة: ${r.questionNos.length} سؤالًا، ${Math.round(r.share * 100)}% من العدد`;
    }
  });

  const standards = rows.filter((r) => !r.excellence).length;
  const covered = rows.filter((r) => !r.excellence && r.questionNos.length).length;
  return { rows, component, unmatched, covered, standards, sum };
}

// ── 4) التقرير التحليلي للمعلّم (C4) ─────────────────────────────────────

/**
 * سطور التقرير التحليلي: معيار ← مؤشر ← صيغة ← نقاط ← مستويات وعتبات ←
 * أخطاء متوقعة ← تشخيص (تُرفق بتقرير المعلّم report).
 * @returns {string[]}
 */
export function analyticalReport(matrix = {}) {
  const { rows = [], component = [], unmatched = [], covered = 0, standards = 0, sum = 0 } = matrix;
  if (!rows.length) return [];
  const lines = ['التقرير التحليلي — مصفوفة المواصفات (معيار ← مؤشر ← صيغة ← نقاط ← عتبات):'];
  rows.forEach((r) => {
    const code = r.officialCode ? `${r.officialCode} · ` : '';
    const qs = r.questionNos.length
      ? `أسئلة: ${r.questionNos.map((n) => `س${n}`).join('،')} (${r.formats}) · ${r.points}ن (${Math.round(r.share * 100)}%)`
      : 'لا أسئلة (0ن)';
    lines.push(
      `${code}${r.criterion} ${r.label} [${r.source}] — مؤشر: ${r.indicator} · ${qs} · ` +
      `المستويات: انعدام 0 / دون الأدنى ${r.thresholds.below}ن / الأدنى ${r.thresholds.min}ن / الأقصى ${r.thresholds.max}ن · ` +
      `أخطاء متوقعة: ${r.expectedErrors} · ${r.diagnosis}`
    );
  });
  lines.push(`التغطية: ${covered}/${standards} معيارًا أساسيًّا مقاسًا · مجموع أسئلة المصفوفة: ${sum}ن`);
  if (component.length) lines.push(`مكوّن مستقل (لا معيار): الحساب الذهني — أسئلة ${component.map((n) => `س${n}`).join('،')} (§A2)`);
  if (unmatched.length) lines.push(`أسئلة خارج المصفوفة: ${unmatched.map((n) => `س${n}`).join('،')} — راجع إسنادها`);
  return lines;
}
