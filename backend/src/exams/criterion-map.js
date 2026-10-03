// إسناد المعايير الرسمية — Criterion Map (قرار المستخدم 2026-10-03: العرض
// «الاثنان مع وسم المصدر»).
//
// رمز رسمي ظاهر للمعلّم (M1..M4, D, HC) + رمز داخلي في البنك (MAT_*/مع1..5)
// + حقل source يمنع الخلط بين الرسمي والتصميمي. الحساب الذهني يبقى **مكوّنًا
// مستقلًّا** (HC/MAT_MENTAL) لا معيارًا — كما تصفه الوثيقة الرسمية S1.
// المرجع: S1 ص11 (معايير الحد الأدنى الأربعة + معيار التمييز).
//
// لا يُخلط بـ criteria-grids.js (شبكة النقاط والتحجيم — id مع1..5 هي الطبقة
// البرمجية للتنقيط): هذا الملف طبقة **المعنى والإسناد** — أي سؤال يقيس أي معيار.
// (يستورد criteria-grids لتمييز شبكة الرياضيات عند نسبة الرموز الرسمية — لا حلقة.)

import { criteriaGrid, DEFAULT_CRITERIA } from './criteria-grids.js';

/** شبكة الرياضيات الرسمية: رمز ظاهر ← معيار ← مصدر ← رمز داخلي. */
export const MATH_CRITERIA = {
  MAT_INTERPRET: { code: 'M1', label: 'التأويل الملائم', source: 'رسمي – S1', kind: 'standard' },
  MAT_CALC: { code: 'M2', label: 'صحة الحساب', source: 'رسمي – S1', kind: 'standard' },
  MAT_MEASURE: { code: 'M3', label: 'استعمال وحدات القياس (يشمل النقود)', source: 'رسمي – S1', kind: 'standard' },
  MAT_GEOMETRY: { code: 'M4', label: 'استعمال خواص الأشكال الهندسية', source: 'رسمي – S1', kind: 'standard' },
  MAT_PRECISION: { code: 'D', label: 'الدقّة', source: 'رسمي – معيار تمييز', kind: 'distinction' },
  MAT_MENTAL: { code: 'HC', label: 'الحساب الذهني', source: 'رسمي – مكوّن مستقل (لا معيار)', kind: 'component' }
};

/** رمز الشبكة الداخلي (مع1..5 في criteria-grids) ← المفتاح الرسمي. */
export const GRID_ID_TO_KEY = {
  مع1: 'MAT_INTERPRET',
  مع2: 'MAT_CALC',
  مع3: 'MAT_MEASURE',
  مع4: 'MAT_GEOMETRY',
  مع5: 'MAT_PRECISION'
};

/**
 * بيانات العرض المزدوج لرمز شبكة (مع1..) — للمعلّم في الواجهة (§B2):
 * الرمز الرسمي الظاهر + المصدر، والرمز الداخلي يبقى للتنقيط.
 * الرموز M1..D **وثائق رسمية S1 لشبكة الرياضيات فقط** — إن حُدّد subject وشبكته
 * ليست شبكة الرياضيات تُرجع null (لا نُنسب رمز رسمي لغير حامله §القاعدة الذهبية).
 * @param {string} gridId رمز الشبكة مع1..
 * @param {string} [subject] راسم المادة — يُمرَّر فيمنع نسبة الرمز لغير الرياضيات
 * @returns {{officialCode:string, source:string}|null}
 */
export function criteriaDisplay(gridId, subject) {
  if (subject !== undefined && subject !== null && String(subject).trim() !== '') {
    if (criteriaGrid(subject) !== DEFAULT_CRITERIA.math) return null;
  }
  const key = GRID_ID_TO_KEY[String(gridId || '').trim()];
  if (!key) return null;
  const c = MATH_CRITERIA[key];
  return { officialCode: c.code, source: c.source };
}

const norm = (s) => String(s || '')
  .replace(/[\u064B-\u0652\u0670\u0640]/g, '')
  .replace(/[أإآٱ]/g, 'ا')
  .replace(/ى/g, 'ي')
  .replace(/ؤ/g, 'و')
  .replace(/ئ/g, 'ي');

// كل الأنماط بصيغة النصّ بعد norm() أعلاه: أ→ا، ى→ي، إزالة الشدّة والتشكيل.
const GEO = /(شبكة|مسالك|مثلث|مستطيل|مربع|دائرة|معين|متوازي|محيط|مساحة|زوايا?|اضلاع|ضلع|قطر|اشكال|هندسي|رسم هندسي)/;
const UNITS = /(سنتيم|متر|مليم|دينار|قطعة نقدية|ورقة نقدية|ثمن|سعر|مبلغ|وزن|كتل|لتر|زمن|طول|عرض|قياس|قيس|وحدة|حول)/;
const MONEY = /(مليم|دينار|قطعة نقدية|ورقة نقدية|ثمن|سعر|مبلغ|ادخار|شراء|بيع|باقي)/;
const CALC_EXEC = /(انجز|عمودي|افقي|احسب|الناتج|مجموع|اجمع|اطرح|قسم|اضرب|صحح الحساب)/;
// تأويل صريح لا يُلغى بوجود أرقام («أيّ عملية… 930 مليمًا» يبقى تأويلًا)
const INTERP_STRONG = /اي\s*عملية|اختر العملية|لماذا|فسّ?ر|علّ?ل|رايك|اقل عدد|كيف ن/;
// إشارة ضعيفة (سؤال نصّي) — لا تُصنَّف تأويلًا إن حويت أرقامًا
const INTERP_WEAK = /ما الذي|هل .+\؟/;
const OPERATOR = /[+\-−×÷*/]=?|=\s*\d/;

/**
 * أي معيار رسمي يقيسه هذا السؤال (الرياضيات) — تصنيف حتمي من نصّ المهمة.
 * الترتيب (مُعدَّل 2026-10-03 ليضمن ظهور M2): هندسة ← تأويل صريح ← تأويل نصّي
 * بلا أرقام ← **تنفيذ حساب صريح (أنجز/عمودي/احسب…) مع أرقام ← M2** ← قياس/نقود
 * ← أرقام مع عمليّة ← تأويل افتراضي. سؤال «أنجز العملية عموديًّا … مليمًا» يقيس
 * صحة الحساب لا القياس: الأمر هنا تنفيذ الحساب نفسه.
 * @param {object} q سؤال بعد التطبيع
 * @returns {string} مفتاح من MATH_CRITERIA
 */
export function mapMathCriterion(q) {
  const prompt = norm(q?.prompt);
  const body = prompt + ' ' + norm(Array.isArray(q?.options) ? q.options.join(' ') : '');

  if (GEO.test(prompt)) return 'MAT_GEOMETRY';
  if (INTERP_STRONG.test(prompt)) return 'MAT_INTERPRET';
  if (INTERP_WEAK.test(prompt) && !/\d/.test(prompt)) return 'MAT_INTERPRET';
  if (/\d/.test(prompt) && CALC_EXEC.test(prompt)) return 'MAT_CALC';
  if (UNITS.test(prompt) || MONEY.test(prompt)) return 'MAT_MEASURE';
  if (/\d/.test(prompt) && OPERATOR.test(prompt)) return 'MAT_CALC';
  if (GEO.test(body)) return 'MAT_GEOMETRY';
  return 'MAT_INTERPRET';
}

/** جدول التوزيع لصفّ التدقيق: «س1:M3 · س2:M1 …» مع الرمز الرسمي. */
export function criteriaTable(questions = []) {
  return questions.map((q, i) => {
    const key = mapMathCriterion(q);
    return `س${i + 1}:${MATH_CRITERIA[key].code}`;
  }).join(' · ');
}

/** توزيع النقاط حسب المعيار (للقرير التحليلي للمعلّم §45). */
export function criteriaDistribution(questions = []) {
  const acc = {};
  questions.forEach((q) => {
    const key = mapMathCriterion(q);
    if (!acc[key]) acc[key] = { points: 0, count: 0 };
    acc[key].points += Number(q?.points) || 0;
    acc[key].count += 1;
  });
  return acc;
}
