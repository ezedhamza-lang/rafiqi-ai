// محرّك التنقيط (§7,§8,§46) — القاعدة: Σ نقاط الأسئلة = عدد الاختبار بالضبط.
// التوزيع مرتبط بجنس المهمة لا بأرقام عشوائية (§8):
//   وضعية إدمج/مهمة مفتوحة > ترتيب/ربط > استخراج/إكمال > اختيار/صح-خطأ.
// الخطوة 0.5 (يُمنع 2.7 و1.3)، والهدف نفسه قابل للضبط 10/15/20 (§7).

export const TARGET_POINTS = [10, 15, 20];

const TYPE_WEIGHT = {
  OPEN: 3,
  ORDER: 2.2,
  EXTRACT: 1.8,
  FILL_BLANK: 1.5,
  MATCHING: 2.2,
  ORDERING: 2.2,
  TRUE_FALSE: 1,
  MCQ: 1
};

const STEP = 0.5;
const roundStep = (x) => Math.round(x / STEP) * STEP;

export function totalPoints(questions = []) {
  return roundStep(questions.reduce((s, q) => s + (Number(q.points) || 0), 0));
}

/** هل Σ = الهدف بالضبط؟ (§7: يُمنع 12/20 ومجموع 17.5) */
export function verifyTotal(questions = [], target = 20) {
  const total = totalPoints(questions);
  const t = roundStep(Number(target) || 20);
  return { ok: total === t, total, target: t, drift: roundStep(total - t) };
}

/**
 * يعيد توزيع نقاط الأسئلة ليصبح المجموع = الهدف بالضبط.
 * يحترم الوزن النسبي لكل جنس (§8) وخطوة 0.5 والحد الأدنى 0.5.
 * @returns {{questions:Array, target:number, total:number, changed:boolean}}
 */
export function distributePoints(questions = [], target = 20) {
  const list = (questions || []).map((q) => ({ ...q }));
  const t = roundStep(Number(target) || 20);
  if (!list.length) return { questions: list, target: t, total: 0, changed: false };

  const before = totalPoints(list);
  const weights = list.map((q) => TYPE_WEIGHT[String(q.type || '').toUpperCase()] || 1);
  const wSum = weights.reduce((s, w) => s + w, 0) || 1;

  // توزيع نسبي ثم تقريب لخطوة 0.5 مع بقاء الحد الأدنى 0.5
  let raw = list.map((q, i) => Math.max(STEP, roundStep((t * weights[i]) / wSum)));
  let diff = roundStep(t - raw.reduce((s, x) => s + x, 0));
  // تعويض الفارق على أكبر بند (أو أصغر عند السالب) تدريجيًّا بخطوات 0.5
  let guard = 0;
  while (Math.abs(diff) >= STEP && guard < 200) {
    guard += 1;
    if (diff > 0) {
      // المجموع أقل من الهدف ← نزيد أكبر بند (أعلى وزن جنسًا)
      let idx = 0;
      raw.forEach((v, i) => { if (v > raw[idx]) idx = i; });
      raw[idx] = roundStep(raw[idx] + STEP);
    } else {
      // المجموع أكبر من الهدف ← نُنقص بندًا قابلًا للإنقاص، نبدأ بالأكثر تجاوزًا
      // لقيمتِه النسبية (t×w/Σw). لا نُنقص القيمة المطلقة الأصغر ولا نُكبّر أحدًا:
      // الفرع القديم كان يُكبّر أكبر بند عند اقتراب الأصغر من 0.5 فيمشي الحلّ في
      // اتجاه معاكس إلى أن يقفز الحارس 200 مرة — ناتجه: هدف 10 على 8 أسئلة أعطى
      // سؤالًا واحدًا بـ102 نقطة ومجموع 110 (كانت تُرفض اختبارات 10 نقاط).
      const exact = raw.map((_, i) => (t * weights[i]) / wSum);
      let idx = -1;
      let worst = -Infinity;
      raw.forEach((v, i) => {
        if (v - STEP < STEP) return; // الحد الأدنى 0.5 مقدّس
        if (v - exact[i] > worst) { worst = v - exact[i]; idx = i; }
      });
      if (idx === -1) break; // كل القيم عند الحد الأدنى والهدف أصغر منها — لا حلّ
      raw[idx] = roundStep(raw[idx] - STEP);
    }
    diff = roundStep(t - raw.reduce((s, x) => s + x, 0));
  }

  list.forEach((q, i) => { q.points = raw[i]; });
  const total = totalPoints(list);
  return { questions: list, target: t, total, changed: total !== before || list.some((q, i) => q.points !== questions[i]?.points) };
}
