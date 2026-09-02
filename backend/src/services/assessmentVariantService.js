// ===== المرحلة 3 — محرك الاختبارات بلا تكرار (Zero-Repetition Assessment) =====
//
// يولّد نسخاً متعددة من نفس الاختبار مع الحفاظ على الـBlueprint حرفياً:
// نفس الأسئلة، نفس الأنواع، نفس النقاط، نفس مستوى الصعوبة — لكن بترتيب
// أسئلة وخيارات مختلف لكل نسخة، فلا ينفع النسخ بين المقاعد.
//
// التوليد حتمي (deterministic): نفس الاختبار + نفس رقم النسخة = نفس النتيجة
// دائماً، فإعادة الطباعة لا تغيّر شيئاً.

/** مولد أرقام شبه عشوائي حتمي (mulberry32) */
function seededRandom(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashSeed(...parts) {
  let h = 2166136261;
  for (const part of parts) {
    const s = String(part);
    for (let i = 0; i < s.length; i += 1) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
  }
  return h >>> 0;
}

function shuffled(arr, rand) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * يبني نسخة واحدة من الاختبار:
 * - ترتيب أسئلة مخلوط (مع حفظ الترقيم الجديد)
 * - خيارات MCQ مخلوطة مع إعادة تعيين correctOption للنص الصحيح
 * - TRUE_FALSE: تبديل موضعي للخيارين مع تحديث correctAnswer
 */
export function buildVariant(questions, variantIndex, quizKey) {
  const rand = seededRandom(hashSeed(quizKey, 'variant', variantIndex));
  const ordered = shuffled(questions, rand);

  const transformed = ordered.map((q, _idx) => {
    const copy = { ...q };
    // إعادة ترقيم داخلي متسلسل — الشكل موحّد في كل النسخ
    copy.id = q.id;

    if ((q.type === 'MCQ' || q.type === 'TRUE_FALSE') && Array.isArray(q.options) && q.options.length > 1) {
      const correctText =
        q.type === 'MCQ'
          ? q.options[Number(q.correctOption)] ?? q.correctOption
          : q.correctAnswer;
      const shuffledOptions = shuffled(q.options, rand);
      copy.options = shuffledOptions;
      if (q.type === 'MCQ') {
        const newIdx = shuffledOptions.findIndex((o) => String(o) === String(correctText));
        copy.correctOption = newIdx >= 0 ? newIdx : q.correctOption;
      } else {
        copy.correctAnswer = correctText;
      }
    }
    return copy;
  });

  return transformed;
}

/**
 * يولّد count نسخاً من الاختبار. كل نسخة تحمل حرفاً (أ، ب، ج...) وتوقيعاً
 * حتمياً حتى لو طُبعت مرات متعددة.
 */
const VARIANT_LETTERS = ['أ', 'ب', 'ج', 'د', 'هـ', 'و', 'ز', 'ح'];

export function generateExamVariants(questions, count, quizKey) {
  const n = Math.max(1, Math.min(Number(count) || 1, 8));
  return Array.from({ length: n }, (_, i) => ({
    label: VARIANT_LETTERS[i] || `ن${i + 1}`,
    index: i,
    questions: buildVariant(questions, i, `${quizKey}`)
  }));
}