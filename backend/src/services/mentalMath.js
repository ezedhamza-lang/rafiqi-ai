/**
 * وحدة الحساب الذهني — نظام تربوي (وعي عددي + استراتيجيات + طلاق + تكيّف)
 * لا يعتمد على AI ولا على مولّد عمليات عشوائي أعمى:
 * كل نشاط يحمل: المهارة المستهدفة، الاستراتيجية المستهدفة، التفسير التربوي،
 * والأخطاء المتوقعة مصنّفة (كِلّ العد / خلل منزلي / قلب أرقام).
 */

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const pick = (rng, arr) => arr[Math.floor(rng() * arr.length) % arr.length];
const ri = (rng, min, max) => min + Math.floor(rng() * (max - min + 1));

// ==================== الاستراتيجيات ====================
export const STRATEGIES = {
  count_on: {
    label: 'العدّ التصاعدي',
    explain: (a, b) => `نبدأ من ${a} ونعدّ ${b} خطوات إلى الأمام.`
  },
  make_ten: {
    label: 'تكوين عشرة',
    explain: (a, b) => `نأخذ من ${b} ما يُكمل ${a} عشرةً: ${a} + ${10 - a} = 10، ثم 10 + ${b - (10 - a)} = ${a + b}.`
  },
  near_double: {
    label: 'المضاعف القريب',
    explain: (a, b) => {
      const hi = Math.max(a, b);
      const lo = Math.min(a, b);
      return `${hi} + ${hi} = ${2 * hi}، ثم نطرح الفرق ${hi - lo} ⇒ ${a + b}.`;
    }
  },
  compensation: {
    label: 'التعويض (الاقتراب من عدد مستدير)',
    explain: (a, b) => {
      const r = Math.round(a / 10) * 10;
      const d = a - r;
      return d >= 0
        ? `${a} قريبة من ${r}: نحسب ${r} + ${b} = ${r + b} ثم نطرح ${d} ⇒ ${a + b}.`
        : `${a} قريبة من ${r}: نحسب ${r} + ${b} = ${r + b} ثم نضيف ${-d} ⇒ ${a + b}.`;
    }
  },
  round_subtract: {
    label: 'الطرح قرب عدد مستدير',
    explain: (a, b) => {
      const r = Math.round(b / 10) * 10;
      const d = r - b;
      return d >= 0
        ? `نطرح ${r} ثم نعيد ${d}: ${a} − ${r} = ${a - r}، ثم ${a - r} + ${d} = ${a - b}.`
        : `نطرح ${r} ثم نطرح الباقي ${-d}: ${a} − ${r} = ${a - r}، ثم ${a - r} − ${-d} = ${a - b}.`;
    }
  },
  place_split: {
    label: 'التفكيك حسب القيمة المكانية',
    explain: (a, b) => `${a} = ${Math.floor(a / 10) * 10} + ${a % 10}، و${b} = ${Math.floor(b / 10) * 10} + ${b % 10}: العشرات ${Math.floor(a / 10) * 10 + Math.floor(b / 10) * 10}، والآحاد ${a % 10 + b % 10} ⇒ ${a + b}.`
  },
  inverse_sub: {
    label: 'العلاقة العكسية (الجمع ↔ الطرح)',
    explain: (a, b) => `لأن ${b} + ${a - b} = ${a}، فإن ${a} − ${b} = ${a - b}.`
  },
  doubles: {
    label: 'مضاعفات معروفة',
    explain: (a) => `${a} + ${a} = ${2 * a} (ضعف العدد).`
  },
  money_change: {
    label: 'الباقي بالنقود (العد إلى المستدير)',
    explain: (paid, price) => `من ${price} نصعد إلى ${Math.ceil(price / 10) * 10} ثم إلى ${paid}: الباقي ${paid - price}.`
  },
  decimal_bonds: {
    label: 'أصدقاء العشرة العشريّة',
    explain: (a, b) => `${a} + ${b} = ${(a + b).toFixed(1)} — يكملان معًا إلى عدد كامل.`
  }
};

// ==================== سلّم المهارات والتدرّج حسب السنة ====================
export const SKILL_LADDER = [
  { id: 'quantity', name: 'فهم الكميات والأعداد' },
  { id: 'bonds5', name: 'تكوين 5' },
  { id: 'bonds10', name: 'تكوين 10' },
  { id: 'decompose', name: 'التفكيك والتركيب' },
  { id: 'doubles', name: 'المضاعفات وأنصافها' },
  { id: 'add_sub_mental', name: 'الجمع والطرح الذهني' },
  { id: 'place_value', name: 'القيمة المكانية' },
  { id: 'compensation', name: 'التعويض والأعداد المستديرة' },
  { id: 'inverse_ops', name: 'العلاقة العكسية بين العمليات' },
  { id: 'strategy_choice', name: 'اختيار الاستراتيجية الأنسب' },
  { id: 'life_math', name: 'الحساب الذهني في الحياة (نقود/قياس)' }
];

export const GRADE_PLAN = {
  year1: { max: 10, skills: ['quantity', 'bonds5', 'bonds10'], strategies: ['count_on', 'make_ten'], kinds: ['direct', 'fill', 'tf', 'chain'] },
  year2: { max: 20, skills: ['bonds10', 'decompose', 'doubles', 'add_sub_mental'], strategies: ['make_ten', 'near_double', 'count_on', 'doubles'], kinds: ['direct', 'fill', 'chain', 'tf'] },
  year3: { max: 100, skills: ['add_sub_mental', 'place_value', 'compensation'], strategies: ['place_split', 'compensation', 'round_subtract', 'make_ten'], kinds: ['direct', 'fill', 'chain', 'choose_strategy', 'number_line'] },
  year4: { max: 100, skills: ['doubles', 'inverse_ops', 'life_math', 'compensation'], strategies: ['doubles', 'inverse_sub', 'money_change', 'compensation'], kinds: ['direct', 'fill', 'choose_strategy', 'money', 'tf'] },
  year5: { max: 1000, skills: ['place_value', 'compensation', 'inverse_ops'], strategies: ['place_split', 'compensation', 'round_subtract', 'inverse_sub'], kinds: ['direct', 'fill', 'chain', 'choose_strategy', 'number_line'] },
  year6: { max: 1000, skills: ['strategy_choice', 'life_math', 'inverse_ops'], strategies: ['compensation', 'decimal_bonds', 'money_change', 'place_split', 'inverse_sub'], kinds: ['direct', 'fill', 'choose_strategy', 'money', 'chain'] }
};

// ==================== توليد نشاط واحد ====================
function planAdd(rng, max, strategies) {
  if (strategies.includes('decimal_bonds') && rng() < 0.25) {
    const da = ri(rng, 1, 9) / 2;
    const db = Number((Math.ceil(da) - da + (da < 5 ? 0 : 0)).toFixed(1)) || 0.5;
    return { a: da, b: db, strategy: 'decimal_bonds', decimal: true };
  }
  let a = ri(rng, 2, Math.min(max - 2, Math.floor(max * 0.7)));
  let b = ri(rng, 2, Math.max(2, max - a));
  let strategy = 'count_on';
  if (strategies.includes('make_ten') && a <= 9 && b <= 9 && a + b > 10) strategy = 'make_ten';
  else if (strategies.includes('near_double') && a <= 12 && b <= 12 && Math.abs(a - b) <= 2 && a !== b) strategy = 'near_double';
  else if (strategies.includes('compensation') && (a % 10 === 9 || a % 10 === 8 || b % 10 === 9 || b % 10 === 8)) strategy = 'compensation';
  else if (strategies.includes('place_split') && a >= 20 && b >= 20) strategy = 'place_split';
  else if (a + b <= 10) strategy = strategies.includes('make_ten') ? 'make_ten' : 'count_on';
  return { a, b, strategy };
}

export function buildItem(rng, gradeId, idx) {
  const plan = GRADE_PLAN[gradeId] || GRADE_PLAN.year3;
  const max = plan.max;
  const skill = pick(rng, plan.skills);
  const strategies = plan.strategies;
  const kind = pick(rng, plan.kinds);
  const id = `${gradeId}-${idx}`;

  if (kind === 'money' && strategies.includes('money_change')) {
    const price = ri(rng, Math.max(5, Math.floor(max * 0.3)), max);
    const paid = price <= 20 ? 20 : price <= 50 ? 50 : price <= 100 ? 100 : 200;
    const answer = paid - price;
    return {
      id, kind, skill, strategy: 'money_change',
      prompt: `دفعتَ ${paid} مليمًا و اشتريتَ شيئًا بـ ${price} مليمًا. كم يسترجُ البائعُ لك؟`,
      answer, explain: STRATEGIES.money_change.explain(paid, price),
      hint: 'اصعد من الثمن إلى أقرب عشرة ثم إلى المبلغ المدفوع.',
      similar: { prompt: `نفس السؤال بثمن آخر: paid=${paid}, price=${paid - ri(rng, 3, 15)}`, answer: ri(rng, 3, 15) }
    };
  }
  if (kind === 'tf' || kind === 'chain') {
    const { a, b, strategy } = planAdd(rng, max, strategies);
    const truth = a + b;
    if (kind === 'chain') {
      const c = ri(rng, 1, 4);
      return {
        id, kind: 'chain', skill, strategy,
        prompt: `سلسلة ذهنية: ${a} + ${b} − ${c} = ؟`,
        answer: truth - c,
        explain: `أولًا ${a} + ${b} = ${truth} (بالاستراتيجية: ${STRATEGIES[strategy]?.label || strategy})، ثم ${truth} − ${c} = ${truth - c}.`,
        hint: 'أنجز أول خطوتين ثم انطلق من النتيجة.',
        similar: { prompt: `${a} + ${b} − ${c + 1} = ؟`, answer: truth - c - 1 }
      };
    }
    const off = pick(rng, [1, -1, 10, -10]);
    const shown = truth + off;
    return {
      id, kind: 'tf', skill, strategy,
      prompt: `صحيح أم خطأ؟ ${a} + ${b} = ${shown}`,
      answer: shown === truth ? 'صح' : 'خطأ',
      truth,
      explain: shown === truth ? `صحيح: ${STRATEGIES[strategy]?.explain?.(a, b) || ''}` : `خطأ — ${STRATEGIES[strategy]?.explain?.(a, b) || `النتيجة الصواب ${truth}.`}`,
      hint: 'احسبها باستراتيجية تكوين العشرة أو التعويض ثم قارن.',
      similar: { prompt: `${a} + ${b} = ${truth + pick(rng, [2, -2])}؟`, answer: 'خطأ', truth }
    };
  }
  if (kind === 'fill') {
    const { a, b, strategy } = planAdd(rng, max, strategies);
    const sum = a + b;
    const hide = rng() < 0.5 ? b : a;
    return {
      id, kind: 'fill', skill, strategy,
      prompt: `أُكمل العدد الناقص: ${hide === b ? `${a} + .. = ${sum}` : `${sum} − ${a} = ..`}`,
      answer: hide,
      explain: `استعملنا ${STRATEGIES[strategy]?.label}: ${STRATEGIES[strategy]?.explain?.(a, b) || `${a} + ${b} = ${sum}.`}`,
      hint: hide === b ? `كم ينقص ${a} لتصل إلى ${sum}؟` : `ما العدد الذي مع ${a} يصنع ${sum}؟`,
      similar: { prompt: `${a + 1} + .. = ${sum + 1}`, answer: b }
    };
  }
  if (kind === 'choose_strategy') {
    const { a, b, strategy } = planAdd(rng, max, strategies);
    const opts = ['تكوين العشرة', 'التعويض (عدد مستدير)', 'العدّ خطوة خطوة', 'التفكيك حسب المنازل'];
    const map = { make_ten: 'تكوين العشرة', compensation: 'التعويض (عدد مستدير)', count_on: 'العدّ خطوة خطوة', place_split: 'التفكيك حسب المنازل', near_double: 'التعويض (عدد مستدير)', round_subtract: 'التعويض (عدد مستدير)', inverse_sub: 'التفكيك حسب المنازل' };
    const best = map[strategy] || 'تكوين العشرة';
    return {
      id, kind: 'choose_strategy', skill: 'strategy_choice', strategy,
      prompt: `بأي طريقة تحسب ${a} ${rng() < 0.5 ? '+' : '−'} ${b} بأفضل سرعة وفهم؟`,
      options: opts, answer: best,
      explain: `الاستراتيجية الأنسب هنا: ${STRATEGIES[strategy]?.label || best}. ${STRATEGIES[strategy]?.explain?.(a, b) || ''}`,
      hint: 'فكّر: هل أحد العددين قريب من عشرة أو مستدير؟',
      similar: { prompt: `وبالنسبة لـ ${a + 5} + ${b + 2}؟`, answer: best }
    };
  }
  if (kind === 'number_line') {
    const start = ri(rng, 5, Math.floor(max * 0.6));
    const step = ri(rng, 3, 9);
    return {
      id, kind: 'number_line', skill, strategy: 'count_on',
      prompt: `على خط الأعداد: انطلقتَ من ${start} وتقدّمتَ ${step} خطوات. عند أي عدد تقف؟`,
      answer: start + step, visual: { from: start, step },
      explain: `نبدأ من ${start} (لا من 1!) ثم نعدّ ${step}: ${Array.from({ length: Math.min(step, 6) }, (_, k) => start + k + 1).join(' ، ')}${step > 6 ? ' …' : ''}.`,
      hint: 'ابدأ القفز من العدد نفسه لا من الصفر.',
      similar: { prompt: `من ${start + 2} تقدّم ${step} خطوات؟`, answer: start + 2 + step }
    };
  }
  const { a, b, strategy } = planAdd(rng, max, strategies);
  const sub = strategies.includes('inverse_sub') && rng() < 0.35 && b < a;
  return {
    id, kind: 'direct', skill, strategy,
    prompt: `أحسب ذهنيًا: ${sub ? `${a} − ${b}` : `${a} + ${b}`}`,
    answer: sub ? a - b : a + b,
    sub,
    explain: sub
      ? `${STRATEGIES.inverse_sub.explain(a, b)}`
      : `${STRATEGIES[strategy]?.label ? `الاستراتيجية: ${STRATEGIES[strategy].label}. ` : ''}${STRATEGIES[strategy]?.explain?.(a, b) || `${a} + ${b} = ${a + b}.`}`,
    hint: strategy === 'make_ten' ? 'كم ينقص الأول ليصير عشرة؟' : 'حاول أن تجمع العشرات أولا ثم الآحاد.',
    similar: { prompt: sub ? `${a + 1} − ${b}` : `${a + 1} + ${b}`, answer: sub ? a + 1 - b : a + 1 + b }
  };
}

export function buildSession(gradeId, seed, count = 6) {
  const rng = mulberry32(seed);
  const items = [];
  for (let i = 0; i < count; i++) items.push(buildItem(rng, gradeId, i));
  return items;
}

// ==================== تعهّد المكتسبات (استدعاء قبلي مقصود وليس حسابًا ذهنيًا) ====================
// أنشطة قصيرة يهيّئ بها المعلّم ما يحتاجه درس اليوم: روابط الجمع إلى 5 و10،
// تفكيك العدد إلى عشرات وآحاد، عدد المنازل، مقارنة كميات، قراءة وكتابة عدد.
const PREREQ_POOL = {
  year1: ['bonds5', 'bonds10', 'compare', 'read'],
  year2: ['bonds10', 'decompose', 'compare', 'read'],
  year3: ['decompose', 'place', 'bonds10', 'seq10'],
  year4: ['place', 'decompose', 'doublesSmall', 'seq10'],
  year5: ['place', 'decompose', 'seq100', 'doublesSmall'],
  year6: ['seq100', 'place', 'decompose', 'doublesSmall']
};

export function buildPrereqItem(rng, gradeId, idx) {
  const pool = PREREQ_POOL[gradeId] || PREREQ_POOL.year3;
  const type = pick(rng, pool);
  const id = `p-${gradeId}-${idx}`;
  if (type === 'bonds5') {
    const a = ri(rng, 1, 4);
    return { id, type: 'bonds', skill: 'bonds5', prompt: `أكمل لتصل إلى 5: ${a} + .. = 5`, answer: 5 - a, explain: `${a} ينقصها ${5 - a} لتكمل الخمسة.` };
  }
  if (type === 'bonds10') {
    const a = ri(rng, 1, 9);
    return { id, type: 'bonds', skill: 'bonds10', prompt: `أكمل لتصل إلى 10: ${a} + .. = 10`, answer: 10 - a, explain: `عشرة أصدقاء: ${a} مع ${10 - a} تكوّل عشرة.` };
  }
  if (type === 'decompose') {
    const tens = ri(rng, 1, gradeId === 'year1' ? 2 : 9);
    const ones = ri(rng, 2, 9);
    const n = tens * 10 + ones;
    return { id, type: 'decompose', skill: 'decompose', prompt: `فكّك العدد: ${n} = ${tens * 10} + ..`, answer: ones, explain: `${n} فيها ${tens} عشرات و${ones} آحادًا.` };
  }
  if (type === 'place') {
    const t = ri(rng, 2, 9);
    const o = ri(rng, 1, 9);
    const n = t * 10 + o;
    return {
      id, type: 'place', skill: 'place_value',
      prompt: `في العدد ${n}: كم عدد العشرات؟`,
      answer: t, explain: `${n} = ${t} عشرات و${o} آحادًا.`
    };
  }
  if (type === 'compare') {
    const a = ri(rng, 2, gradeId === 'year1' ? 9 : 20);
    const b = ri(rng, 1, 9);
    return { id: id + 'c', type: 'compare', skill: 'quantity', prompt: `ما الفارق بين ${Math.max(a, b)} و${Math.min(a, b)}؟`, answer: Math.max(a, b) - Math.min(a, b), explain: `نطرح الأصغر من الأكبر: ${Math.max(a, b)} − ${Math.min(a, b)} = ${Math.max(a, b) - Math.min(a, b)}.` };
  }
  if (type === 'read') {
    const t = ri(rng, 1, 8);
    const o = ri(rng, 1, 9);
    const n = t * 10 + o;
    const words = [`${['', 'عشرة', 'عشرتان', 'ثلاث عشرات', 'أربع عشرات', 'خمس عشرات', 'ست عشرات', 'سبع عشرات', 'ثماني عشرات', 'تسع عشرات'][t]} و${['', 'واحد', 'اثنان', 'ثلاثة', 'أربعة', 'خمسة', 'ستة', 'سبعة', 'ثمانية', 'تسعة'][o]}`];
    return { id, type: 'read', skill: 'quantity', prompt: `اكتب بالأرقام: ${words[0]}`, answer: String(n), explain: `${words[0]} = ${n}.` };
  }
  if (type === 'seq10') {
    const s = ri(rng, 1, 8) * 10;
    return { id, type: 'chain', skill: 'place_value', prompt: `سلسلة بالعشرات: ${s} ، ${s + 10} ، ${s + 20} ، ..`, answer: s + 30, explain: 'نزيد عشرة في كل خطوة.' };
  }
  if (type === 'seq100') {
    const s = ri(rng, 1, 7) * 100;
    return { id, type: 'chain', skill: 'place_value', prompt: `سلسلة بالمئات: ${s} ، ${s + 100} ، ${s + 200} ، ..`, answer: s + 300, explain: 'نزيد مئة في كل خطوة.' };
  }
  const d = ri(rng, 2, 6);
  return { id, type: 'doubles', skill: 'doubles', prompt: `ضعف العدد ${d} = ؟`, answer: 2 * d, explain: `${d} + ${d} = ${2 * d}.` };
}

export function buildPrereqSession(gradeId, seed, count = 4) {
  const rng = mulberry32((seed ^ 0x5eed) >>> 0);
  const out = [];
  for (let i = 0; i < count; i++) out.push(buildPrereqItem(rng, gradeId, i));
  return out;
}

/** أنشطة مذكرة: تعهّد المكتسبات (روابط/تفكيك/منازل) */
export function memoPrereqItems(gradeId, lessonId, n = 3) {
  let seed = 13;
  for (const ch of String(lessonId || '')) seed = (seed * 31 + ch.charCodeAt(0)) >>> 0;
  return buildPrereqSession(gradeId, seed, n);
}

/** أنشطة مذكرة: حساب ذهني بطرق اليوم (موجّه لموضوع الدرس) */
export function memoMentalItems(gradeId, lessonId, n = 3, lessonTitle = '') {
  let seed = 7;
  for (const ch of String(lessonId || '')) seed = (seed * 31 + ch.charCodeAt(0)) >>> 0;
  const rng = mulberry32(seed);
  const plan = GRADE_PLAN[gradeId] || GRADE_PLAN.year3;
  const savedKinds = plan.kinds;
  plan.kinds = ['direct', 'fill', 'chain'];
  const out = [];
  const dec = /عشري|كسري/.test(lessonTitle);
  const measure = /قياس|الطول|الكتلة|السعة/.test(lessonTitle);
  for (let i = 0; i < n; i++) {
    if (dec) {
      const da = ri(rng, 2, 9) / 10;
      const dacs = (Number(da.toFixed(1)) + '').replace('.', ',');
      const dbc = (Number((1 - da).toFixed(1)) + '').replace('.', ',');
      const half = ri(rng, 2, 9) * 5;
      const q4 = pick(rng, [400, 800, 1200, 2000]);
      const q = pick(rng, ['add', 'half', 'quarter']);
      const it = q === 'add'
        ? { prompt: `أحسب ذهنيًا: ${dacs} + ${dbc} = ؟`, answer: 1, strategy: 'أصدقاء الواحد العشري', explain: `${dacs} ينقصها ${dbc} ليُكمل واحدًا صحيحًا.` }
        : q === 'half'
          ? { prompt: `نصف العدد ${half * 2} = ؟`, answer: half, strategy: 'نصف مضاعف معروف', explain: `${half * 2} : 2 = ${half}.` }
          : { prompt: `ربع العدد ${q4} = ؟`, answer: q4 / 4, strategy: 'نصفُ النصف', explain: `نصف ${q4} هو ${q4 / 2}، ونصفه الثاني ${q4 / 4}.` };
      out.push(it);
      continue;
    }
    if (measure) {
      const conv = pick(rng, [
        { prompt: 'كم سنتمترًا في 3 م؟', answer: 300, strategy: 'جدول التحويل', explain: '1 م = 100 سم ⇒ 3 م = 300 سم.' },
        { prompt: 'كم دقيقة في نصف ساعة؟', answer: 30, strategy: 'نصف 60', explain: '60 : 2 = 30 د.' },
        { prompt: '1 كغ و 250 غ = كم غرامًا؟', answer: 1250, strategy: 'توحيد الوحدة', explain: '1 كغ = 1000 غ، + 250 = 1250 غ.' }
      ]);
      out.push(conv);
      continue;
    }
    const it = buildItem(rng, gradeId, 100 + i);
    out.push({ prompt: it.prompt, answer: it.answer, strategy: STRATEGIES[it.strategy]?.label || '', explain: it.explain, hint: it.hint });
  }
  plan.kinds = savedKinds;
  return out;
}

// ==================== تحليل المحاولة ====================
export function analyzeAttempt(item, studentAnswer, ms, hintUsed) {
  const num = Number(studentAnswer);
  let correct = false;
  if (item.answer !== undefined) {
    if (typeof item.answer === 'string') correct = String(studentAnswer).trim() === item.answer;
    else correct = Number.isFinite(num) && num === item.answer;
  }
  const diff = Number.isFinite(num) && typeof item.answer === 'number' ? num - item.answer : null;
  let errorPattern = null;
  if (!correct && diff !== null && diff !== 0) {
    if (Math.abs(diff) <= 2) errorPattern = 'off_by_count';
    else if (Math.abs(diff) % 10 === 0) errorPattern = 'place_value';
    else if (String(Math.abs(diff)).length === 1 && diff !== 0) errorPattern = 'off_by_count';
    else errorPattern = 'other';
  }
  const slowForSize = ms > 12000 && typeof item.answer === 'number' && item.answer <= 20;
  return { correct, errorPattern, reliesOnCounting: slowForSize, hintUsed: !!hintUsed };
}

// ==================== الطلاقة والتكيّف ====================
export function fluencyFor(stats) {
  const acc = stats.attempts ? stats.correct / stats.attempts : 0;
  const timeScore = stats.avgMs ? Math.max(0, Math.min(1, 1 - stats.avgMs / 15000)) : 0.5;
  return +(0.75 * acc + 0.15 * Math.min(1, stats.attempts / 8) + 0.1 * timeScore).toFixed(3);
}

export function buildReport(attemptRows) {
  const bySkill = {};
  for (const row of attemptRows) {
    const s = (bySkill[row.skill] = bySkill[row.skill] || { attempts: 0, correct: 0, msSum: 0, patterns: {}, strategies: {} });
    s.attempts += 1;
    if (row.correct) s.correct += 1;
    if (row.ms) s.msSum += row.ms;
    if (row.errorPattern) s.patterns[row.errorPattern] = (s.patterns[row.errorPattern] || 0) + 1;
    s.strategies[row.strategy] = (s.strategies[row.strategy] || 0) + 1;
  }
  const skills = Object.entries(bySkill).map(([id, s]) => {
    const accuracy = s.attempts ? +(s.correct / s.attempts).toFixed(2) : 0;
    const avgMs = s.attempts ? Math.round(s.msSum / s.attempts) : 0;
    const fluency = fluencyFor({ attempts: s.attempts, correct: s.correct, avgMs });
    const level = s.attempts < 5 ? 'مبتدئ' : accuracy >= 0.85 ? 'متمكّن' : accuracy >= 0.6 ? 'متدرّب' : 'يحتاج دعمًا';
    const notes = [];
    if ((s.patterns.off_by_count || 0) >= 2) notes.push('يَميل إلى كِلِّ العدّ — درّبه على تكوين العشرة والتعويض');
    if ((s.patterns.place_value || 0) >= 2) notes.push('خلل في القيمة المكانية — نشاط منازل (عشرات/آحاد) قبل النتائج');
    if (notes.length === 0 && accuracy >= 0.85 && s.attempts >= 8) notes.push('جاهز للترقية إلى المهارة التالية في السلّم');
    return { skill: id, name: (SKILL_LADDER.find((k) => k.id === id) || { name: id }).name, attempts: s.attempts, accuracy, avgMs, fluency, level, notes };
  });
  const mastered = skills.filter((x) => x.level === 'متمكّن').map((x) => x.name);
  const needSupport = skills.filter((x) => x.level === 'يحتاج دعمًا' || x.notes.length).map((x) => x.name);
  const ladderNow = skills.length ? skills.sort((a, b) => b.fluency - a.fluency)[0] : null;
  return { skills, mastered, needSupport, next: ladderNow ? `تدريب موجّه في: «${ladderNow.name}»${(ladderNow.notes[0] || '')}` : 'ابدأ بجلسة حساب ذهني قصيرة (5 دقائق) — عدّ تصاعدي وتكوين العشرة', strategyMix: skills.length ? Object.assign({}, ...skills.map((s) => ({ [s.skill]: s.name }))): {} };
}
