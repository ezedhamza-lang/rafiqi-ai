// محقّق الإجابات (§48,§52) — عقد موحّد لكل الأسئلة المغلقة:
//   { valid, expectedAnswer, acceptedAnswers, explanation, confidence, issues }
// لا يعتمد على string equality خام: يطبّق عربيًّا (تشكيل/همزات/تأنيث) ويعتبر
// كل الصيغ المقبولة (acceptedAnswers) — ولا يقبل تشابهًا عشوائيًّا (§48).

import { normalizeArabic } from '../services/curriculumService.js';

function asArray(v) {
  if (Array.isArray(v)) return v.filter(Boolean);
  if (v === undefined || v === null || v === '') return [];
  return String(v).split('|').map((s) => s.trim()).filter(Boolean);
}

/**
 * يتحقّق من إجابة تلميذ.
 * @param {object} q السؤال (correctAnswer / acceptedAnswers)
 * @param {*} studentAnswer إجابة التلميذ
 * @returns {{valid:boolean, expectedAnswer:*, acceptedAnswers:Array, explanation:string, confidence:number, issues:string[]}}
 */
export function verifyAnswer(q, studentAnswer) {
  const type = String(q?.type || '').toUpperCase();
  const expected = q?.correctAnswer ?? q?.correct ?? null;
  const accepted = asArray(q?.acceptedAnswers);
  const issues = [];
  const base = { expectedAnswer: expected, acceptedAnswers: accepted, issues };

  if (studentAnswer === undefined || studentAnswer === null || studentAnswer === '') {
    return { ...base, valid: false, explanation: 'لا إجابة', confidence: 1 };
  }

  const allAccepted = [expected, ...accepted].filter((x) => x !== undefined && x !== null && String(x) !== '').map(String);

  if (type === 'MCQ' || type === 'TRUE_FALSE') {
    const got = normalizeArabic(studentAnswer);
    const hit = allAccepted.some((a) => normalizeArabic(a) === got);
    return {
      ...base,
      valid: hit,
      explanation: hit ? 'مطابقة للإجابة النموذجية' : 'لا تطابق مع الإجابة النموذجية',
      confidence: 1
    };
  }

  if (type === 'FILL_BLANK' || type === 'EXTRACT') {
    const got = normalizeArabic(studentAnswer);
    const hit = allAccepted.some((a) => normalizeArabic(a) === got);
    return {
      ...base,
      valid: hit,
      explanation: hit ? 'مطابقة (بعد تطبيع عربي)' : 'لا تطابق',
      confidence: 1
    };
  }

  if (type === 'ORDER') {
    const expectedSeq = (Array.isArray(expected) ? expected : asArray(q?.orderItems)).map(normalizeArabic);
    const given = Array.isArray(studentAnswer) ? studentAnswer.map(normalizeArabic) : [];
    const hit = expectedSeq.length > 0 && expectedSeq.length === given.length && expectedSeq.every((v, i) => v === given[i]);
    return { ...base, valid: hit, explanation: hit ? 'الترتيب صحيح' : 'الترتيب غير صحيح', confidence: 1 };
  }

  if (type === 'OPEN') {
    // إجابة مفتوحة: تصحيح يدوي بمعايير §47 — لا نُحسم فيها آليًّا هنا
    issues.push('OPEN_REQUIRES_MANUAL');
    const gotNorm = normalizeArabic(studentAnswer);
    const exact = allAccepted.some((a) => normalizeArabic(a) === gotNorm);
    return {
      ...base,
      valid: exact ? true : null, // null ← يحتاج مصحِّحًا (لا نرفض ولا نقبل آليًّا)
      explanation: exact ? 'مطابقة حرفية للنموذج' : 'تصحيح يدوي — قارن بمعايير التصحيح',
      confidence: exact ? 1 : 0
    };
  }

  issues.push('UNSUPPORTED_TYPE');
  return { ...base, valid: false, explanation: `نوع سؤال غير مدعوم: ${type}`, confidence: 0 };
}
