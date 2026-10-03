// التأصيل ومنع السؤال اليتيم — ORPHAN_QUESTION_DETECTOR (Spec A §7-8,§42-47,§64-66,§150-151,§158-161).
//
// الوظيفة: لكل سؤال تابع لسند:
//   1) ما المعطيات التي يحتاجها؟            (أرقام/وحدات/كيانات/جدول/أشكال)
//   2) هل هذه المعطيات موجودة في السند؟     (أو ناتجة عنه بعملية حسابية §8)
//   3) هل أدخل معطيات جديدة غير موجودة؟    ← إن نعم: REJECT
//   4) هل يغيّر وحدة/اسمًا/ترتيبًا بلا مبرر؟ ← إن نعم: REJECT (أو تنبيه)
//
// كل الحسابات حتمية بلا LLM. `required ⊆ available` وإلا رفض (§7).

import { extractNumbers, toAsciiDigits } from './sind.js';

const eq = (a, b) => Math.abs(Number(a) - Number(b)) < 1e-6;

/** هل الرقم `target` موجود في السند أو ناتج عنه بعملية على رقمين (§8: يُسمح بالاشتقاق)؟ */
export function isDerivable(target, base = []) {
  const t = Number(target);
  if (!Number.isFinite(t)) return false;
  const nums = (base || []).map(Number).filter((n) => Number.isFinite(n));
  if (nums.some((n) => eq(n, t))) return true;
  for (const a of nums) {
    for (const b of nums) {
      if (eq(a + b, t) || eq(Math.abs(a - b), t) || eq(a * b, t)) return true;
      if (b !== 0 && eq(a / b, t)) return true;
    }
  }
  return false;
}

/**
 * كل النصوص التي **يقرأها التلميذ** فعليًّا (سؤال + بدائل + إجابات + ترتيب) لكشف
 * الأرقام والوحدات والكلمات. المكتسب والهدف metadata للمعلّم لا يقرأه التلميذ،
 * ونصوصهما قد تحوي أرقامًا («عدد ذي 4 أرقام») — إدخالها كان يولّد أرقامًا يتيمة
 * زائفة في اختبارات الرياضيات (§42 يخصّ ما يراه التلميذ وحده).
 */
export function questionText(q = {}) {
  return [
    q.prompt, q.text,
    ...(Array.isArray(q.options) ? q.options : []),
    ...(Array.isArray(q.acceptedAnswers) ? q.acceptedAnswers : []),
    ...(Array.isArray(q.orderItems) ? q.orderItems : []),
    // correctAnswer هو العقد §76 — `correct` مرآته (يُقرأ كبديل فقط حتى لا تُرث مرآة قديمة أرقامًا ميتة)
    q.correctAnswer ?? q.correct
  ].filter((x) => x !== undefined && x !== null).join(' \n ');
}

export function questionNumbers(q = {}) {
  return extractNumbers(questionText(q));
}

/** تطبيع كلمة عربية للمقارنة: إزالة الهمزة والتاء المربوطة والألف والتشكيل. */
export function normWord(w) {
  return toAsciiDigits(String(w ?? ''))
    .replace(/[ًٌٍَُِّْـ]/g, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/^ال/, '')
    .trim();
}

export function tokens(text) {
  return toAsciiDigits(String(text ?? ''))
    .replace(/[ًٌٍَُِّْـ]/g, '')
    .split(/[^\u0621-\u064Aa-zA-Z0-9]+/)
    .filter(Boolean);
}

const CURRENCIES = ['مليم', 'دينار', 'درهم', 'سنتيم'];
const SHAPE_WORDS = ['مضلع', 'مضلعات', 'مثلث', 'مثلثات', 'مربع', 'مربعات', 'دائرة', 'دوائر', 'مستطيل', 'مستطيلات', 'متوازي', 'أشكال', 'شكلين', 'اشكال'];
const ORDINAL_ROOTS = ['اول', 'ثاني', 'ثالث', 'رابع', 'خامس', 'سادس'];
const NAME_HINT = ['المدرسه', 'الحي', 'المكتبه', 'الحديقه', 'المعلم', 'الاستاذ', 'المربي'];

function hasToken(list, word) {
  const n = normWord(word);
  return list.some((t) => normWord(t) === n || normWord(t).includes(n));
}

/**
 * فحص محتوى السؤال مقابل سند واحد (§158-161,§44-47).
 * @returns {Array<{code:string, severity:'error'|'warn', message:string}>}
 */
export function checkAgainstSind(q, sind, qIndex = 0) {
  const found = [];
  const n = (m) => `السؤال ${qIndex + 1}: ${m}`;
  const qText = questionText(q);
  const sText = sind?.text || '';
  const qNums = questionNumbers(q);
  const sNums = sind?.numbers || extractNumbers(sText);

  // §42/§158: كل رقم في السند أو ناتج عنه — وإلا رفض
  const missing = qNums.filter((x) => !isDerivable(x, sNums));
  if (qNums.length && missing.length === qNums.length) {
    found.push({ code: 'ORPHAN_QUESTION', severity: 'error', message: n(`يتيم — أرقامه (${missing.join('، ')}) غير موجودة في السند «${sind?.title || ''}» (§7)`) });
  } else if (missing.length) {
    found.push({ code: 'NUMBER_NOT_IN_SIND', severity: 'error', message: n(`${missing.join('، ')} ليست في السند ولا ناتجة عنه (§42,§158)`) });
  }

  const qTok = tokens(qText);
  const sTok = tokens(sText);
  const qNorm = qTok.map(normWord);
  const sNorm = sTok.map(normWord);

  // §160: «أكمل الجدول» بوجود جدول
  if (hasToken(qTok, 'الجدول') || hasToken(qTok, 'جدول')) {
    if (!(hasToken(sTok, 'الجدول') || hasToken(sTok, 'جدول'))) {
      found.push({ code: 'MISSING_TABLE', severity: 'error', message: n('يطلب «الجدول» والسند بلا جدول (§160)') });
    }
  }

  // §161: «ألون المضلع» بوجود أشكال هندسية في السند
  const qShapes = SHAPE_WORDS.filter((w) => hasToken(qTok, w));
  if (qShapes.length) {
    const ok = SHAPE_WORDS.some((w) => hasToken(sTok, w));
    if (!ok) found.push({ code: 'MISSING_SHAPE', severity: 'error', message: n(`يذكر «${qShapes[0]}» والسند بلا أشكال هندسية (§161)`) });
  }

  // §159: «العرض الثاني» والسند فيه العرض الأول والثالث فقط
  for (let i = 0; i < qTok.length; i += 1) {
    const w = normWord(qTok[i]);
    const root = ORDINAL_ROOTS.find((r) => w === r || w === `ال${r}` || w.endsWith(r));
    if (!root) continue;
    const head = normWord(qTok[i - 1] || '');
    if (head.length < 3) continue;
    const headInSind = sNorm.some((t) => t === head || t.includes(head) || head.includes(t));
    if (!headInSind) continue; // لا علاقة له بالسند — يعالجه فحص الاستمرارية
    const ordinalInSind = sNorm.some((t) => t === root || t.endsWith(root));
    if (!ordinalInSind) {
      found.push({ code: 'ORDINAL_NOT_IN_SIND', severity: 'error', message: n(`«${qTok[i - 1]} ${qTok[i]}» والسند لا يحوي هذا الترتيب (§159)`) });
    }
    break;
  }

  // §45: تبديل الوحدة النقدية بلا مبرر
  const qCurr = CURRENCIES.filter((c) => hasToken(qTok, c));
  const sCurr = CURRENCIES.filter((c) => hasToken(sTok, c));
  const changed = qCurr.filter((c) => !sCurr.includes(c));
  if (qCurr.length && sCurr.length && changed.length) {
    found.push({ code: 'UNIT_MISMATCH', severity: 'error', message: n(`يستعمل «${changed[0]}» والسند يستعمل «${sCurr[0]}» (§45)`) });
  }

  // §46: السؤال ذكر صيغة تشبه اسمًا من السند (بسط/تصحيف/ملكية) دون ذكر صيغته الأصلية.
  // السؤال الذي لم يذكر الاسم أصلًا ليس «غيّر اسمًا» — القاعدة القديمة كانت تطلق التنبيه
  // على كل سؤال لا يعيد كل أسماء السند (ضجيج يراه المدرس في كل سؤال بلا قيمة §46).
  const sNames = NAME_HINT.filter((h) => hasToken(sTok, h));
  const changedName = sNames.find((h) => {
    if (hasToken(qTok, h)) return false; // الصيغة الأصلية واردة في السؤال ✓
    const hw = normWord(h);
    if (hw.length < 4) return false; // اسم قصير: التطابق الحرفي كافٍ (أعلاه)
    const root = hw.slice(0, 4);
    // السؤال يذكر بدائل تبدأ بجذر الاسم نفسه ← صيغة محرّفة
    return qNorm.some((w) => w !== hw && w.length >= 4 && w.startsWith(root));
  });
  if (changedName) {
    found.push({ code: 'NAME_CHANGED', severity: 'warn', message: n(`غيّر اسمًا من السند: «${changedName}» (§46)`) });
  }

  // §47: استمرارية السرد — لا تداخل كلمات محتوى بين السند والسؤال (تنبيه).
  // الجذر (4 أحرف) يعالج الاشتقاق العربي («رائحته/رائحة»، «السكان/وسكّان») بدل
  // المطابقة الحرفية الكاملة التي كانت تعطي تنبيهًا كاذبًّا على أسئلة سليمة.
  const contentWords = qNorm.filter((w) => w.length >= 4 && !['اسال', 'احسب', 'اكتب', 'اجب', 'التي', 'هذا', 'هذه'].includes(w));
  const overlapsSind = (w) => {
    if (sNorm.some((t) => t.includes(w) || w.includes(t))) return true;
    const root = w.slice(0, 4);
    return root.length === 4 && sNorm.some((t) => t.includes(root) || w.includes(t.slice(0, 4)));
  };
  if (contentWords.length && !contentWords.some(overlapsSind)) {
    found.push({ code: 'CONTINUITY', severity: 'warn', message: n('لا يتقاطع مع لغة السند — راجع استمرارية النص (§47)') });
  }

  return found;
}

/**
 * ORPHAN_QUESTION_DETECTOR + التأصيل لكل الأسئلة (§7).
 * يربط كل سؤال بالسند الذي يغطّي معطياته، ثم يفحصها. يعيد الأسئلة بعد إضافة `sindId`.
 *
 * @param {Array} stimuli سندات الاختبار (buildSind)
 * @param {Array} questions أسئلة الاختبار
 * @param {object} opts { requireStimulus: boolean } اختبار سنّدي بلا سند = رفض (§18)
 * @returns {{ questions:Array, issues:Array, grounded:number, total:number, groundedRate:number }}
 */
export function bindAndCheck(stimuli = [], questions = [], opts = {}) {
  const issues = [];
  const list = (questions || []).map((q) => ({ ...q }));
  // تطبيع الدخل: يقبل buildSind أو شكل passages القديم {id,title,text} (يعاد اشتقاق أرقامه §42)
  const sindList = (Array.isArray(stimuli) ? stimuli : [])
    .filter((s) => s && (s.text || s.title))
    .map((s, i) => ({
      ...s,
      id: String(s.id || `s${i + 1}`),
      title: String(s.title || `السند ${i + 1}`),
      text: String(s.text || ''),
      numbers: Array.isArray(s.numbers) && s.numbers.length ? s.numbers : extractNumbers(String(s.text || ''))
    }));

  if (!sindList.length) {
    // اختبار سنّدي بلا سند = رفض على مستوى الاختبار كله (§18,§105) — رسالة واحدة لا ضجيج
    if (opts.requireStimulus) {
      issues.push({ code: 'NO_STIMULUS', severity: 'error', message: 'لا سند في اختبار سنّدي — التوليد بلا سند مرفوض (§18,§105)' });
    }
    return { questions: list, issues, grounded: 0, total: list.length, groundedRate: list.length ? 0 : 1 };
  }

  const byId = new Map(sindList.map((s) => [s.id, s]));
  let grounded = 0;

  list.forEach((q, idx) => {
    const qNums = questionNumbers(q);

    // (أ) اختيار السند الذي يغطّي أكبر قدر من معطيات السؤال
    let best = null;
    let bestCovered = [];
    for (const s of sindList) {
      const covered = qNums.filter((x) => isDerivable(x, s.numbers || []));
      if (covered.length > bestCovered.length) { best = s; bestCovered = covered; }
      if (qNums.length && bestCovered.length === qNums.length) break;
    }
    if (!best) best = byId.get(q.sindId) || sindList[0];

    // (ب) الربط: سند معلن من النموذج يجب أن يكون موجودًا — لا مرجع خارجي (§151)
    if (q.sindId && !byId.has(q.sindId)) {
      issues.push({ code: 'CROSS_SIND_REFERENCE', severity: 'error', qIndex: idx, message: `السؤال ${idx + 1}: يحيل إلى سند غير موجود «${q.sindId}» (§151)` });
    }

    // (ج) الفحص المحتوائي مقابل السند المختار
    const checks = checkAgainstSind(q, best, idx);
    checks.forEach((c) => issues.push({ ...c, qIndex: idx }));

    const hardErr = checks.some((c) => c.severity === 'error');
    if (!hardErr) grounded += 1;
    list[idx] = { ...q, sindId: q.sindId && byId.has(q.sindId) ? q.sindId : best.id };
  });

  return {
    questions: list,
    issues,
    grounded,
    total: list.length,
    groundedRate: list.length ? Math.round((grounded / list.length) * 100) / 100 : 1
  };
}

/** تقرير التأصيل (§142-144,§168) — يُعرض للمعلّم لا للتلميذ. */
export function groundingReport(result = {}) {
  return {
    grounded: result.grounded || 0,
    total: result.total || 0,
    groundedRate: result.groundedRate ?? (result.total ? 0 : 1),
    orphanRate: result.total ? Math.round(((result.total - (result.grounded || 0)) / result.total) * 100) / 100 : 0,
    errors: (result.issues || []).filter((i) => i.severity === 'error').length,
    warnings: (result.issues || []).filter((i) => i.severity === 'warn').length
  };
}
