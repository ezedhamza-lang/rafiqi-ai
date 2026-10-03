// كاشف التكرار (§53,§110) — لا يُسمح بثلاثة أسئلة تقيس نفس المكتسب بالصياغة نفسها.
// التشابه = تقاطع الرموز المطبَّقة (بعد تطبيع عربي: تشكيل/همزات/تأنيث) على النصوص.

import { normalizeArabic } from '../services/curriculumService.js';

function normText(text) {
  return normalizeArabic(text).replace(/\s+/g, ' ').trim();
}

function tokenSet(text) {
  return new Set(
    normalizeArabic(text)
      .split(/[^\u0621-\u064A0-9]+/)
      .filter((w) => w.length >= 3)
  );
}

export function similarity(a, b) {
  const na = normText(a);
  const nb = normText(b);
  if (!na || !nb) return 0;
  // نفس الصياغة حرفيًّا بعد التطبيع ← تكرار مؤكد (يغطّي النصوص القصيرة أيضًا).
  if (na === nb) return 1;
  const ta = tokenSet(a);
  const tb = tokenSet(b);
  // رمز واحد طويل لا يصنع تكرارًا: «أكمل: 5 م = .... سم» و«أكمل: 96 − 47 = ....»
  // يتشابهان في كلمة «أكمل» فقط ← كانا يُعلَّنان 100% متطابقين ويرفضان اختبارًا صحيحًا.
  // حكم التشابه يحتاج معطًى كافيًا لا تخمينًا (§2).
  if (ta.size < 2 || tb.size < 2) return 0;
  let inter = 0;
  for (const t of ta) if (tb.has(t)) inter += 1;
  return inter / Math.min(ta.size, tb.size);
}

/**
 * يبحث عن أسئلة متشابهة/مكرّرة داخل قائمة أسئلة.
 * @returns {Array<{a:number,b:number,ratio:number,level:'duplicate'|'similar'}>}
 *   duplicate (≈ نفس السؤال) → error عند تدقيق الاختبار
 *   similar (>0.6)           → warn (مقبول إن قاس مهارات مختلفة صراحة)
 */
export function findDuplicates(questions, { dupThreshold = 0.9, simThreshold = 0.6 } = {}) {
  const out = [];
  const list = Array.isArray(questions) ? questions : [];
  for (let i = 0; i < list.length; i += 1) {
    for (let j = i + 1; j < list.length; j += 1) {
      const ratio = similarity(list[i]?.prompt || '', list[j]?.prompt || '');
      if (ratio >= dupThreshold) out.push({ a: i, b: j, ratio, level: 'duplicate' });
      else if (ratio >= simThreshold) out.push({ a: i, b: j, ratio, level: 'similar' });
    }
  }
  return out;
}
