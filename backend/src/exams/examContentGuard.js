// حارس ورقة الامتحان الرسمية — مصدر القواعد الوحيد (يُستدعى من الواجهة والخادم).
//
// لماذا ملف مستقل؟ لأن قواعد «الورقة الصالحة» كانت موزّعة: الواجهة تمنع
// الحفظ عند نقص جدول الإسناد، والخادم يصدّر ورقة بلا سند (الباب الخلفي الذي
// اكتُشف في 04-10-2026). القاعدة الواحدة تُستعمل في الاثنين ⇒ لا تفترق.
//
// القواعد (مطابقة لسلوك الواجهة الحالي — لا أشدّ ولا أضعف):
//  1. أسئلة مقفلة بلا جدول إسناد ⇒ يُمنع (ورقة لا تُصحَّح ⇒ كل تسليم «بانتظار»)
//  2. سؤال يشير إلى كفاية غير موجودة ⇒ يُمنع (سند يتيم: نقاط السؤال لا تُحتسب
//     أبدًا لأن الدرجة تُبنى من جدول الإسناد ⇒ نزع نقاط دون بيان)
//  3. مجموع جدول الإسناد ≠ مجموع نقاط الأسئلة ⇒ **تحذير فقط** (لا منع):
//     قياس على 342 ورقة بنك أظهر أن أسئلة البنك نقاطها في جدول الإسناد
//     (Σ نقاط الأسئلة = 0)، فمنعَها كان سيكسر كل البنك.-panel الجاهزية في
//     الواجهة يعرض هذا التحذير، وهذا سلوكها.
// ملاحظة: غياب مفتاح إجابة لسؤال مقفول **ليس** سبب منع — عندها يُصحَّح يدويًّا
//   بصراحة (needsManualGrading)، وهذا سلوك صادق مقصود.
import { QUESTION_TYPES } from '../services/officialExamService.js';
import { ApiError } from '../middleware/errorHandler.js';

const CLOSED_TYPES = new Set(Object.values(QUESTION_TYPES).filter((t) => t !== QUESTION_TYPES.OPEN));

function isClosed(q) {
  return q?.type ? CLOSED_TYPES.has(q.type) : false;
}

/** مفتاح الإجابة موجود؟ (نفس منطق officialExamService.hasAnswerKey تقريبًا) */
function hasKey(q) {
  if (q.correct !== undefined && q.correct !== null && q.correct !== '') return true;
  const a = q.correctAnswer;
  if (a === undefined || a === null) return false;
  return String(a).trim() !== '';
}

/**
 * يفحص محتوى ورقة رسمية ويعيد مشاكل الحجب.
 * @returns {{ blocking: boolean, code: string|null, messageAr: string|null, detail: object }}
 */
export function inspectExamContent(content) {
  const questions = Array.isArray(content?.questions) ? content.questions : [];
  const criteria = Array.isArray(content?.criteria) ? content.criteria : [];
  const closed = questions.filter(isClosed);
  const pointsSum = questions.reduce((s, q) => s + Number(q?.points || 0), 0);
  const criteriaMax = criteria.reduce((s, c) => s + Number(c?.mastery?.max || 0), 0);
  const target = Number(content?.totalPoints) || pointsSum || 20;
  const missingKeys = closed.filter((q) => !hasKey(q)).length;

  const fail = (code, messageAr, detail = {}) => ({ blocking: true, code, messageAr, warnings: [], detail });

  // 1) مقفول بلا جدول إسناد
  if (closed.length > 0 && criteria.length === 0) {
    return fail(
      'NO_CRITERIA',
      `لا يمكن حفظ الاختبار: ${closed.length} سؤال مقفول بلا جدول إسناد — أضِف جدول الإسناد (زر «إنشاء جدول إسناد آلي» ينشئه لك) أو اجعل الأسئلة مفتوحة.`,
      { closed: closed.length }
    );
  }

  // 2) سؤال يشير إلى كفاية غير موجودة
  if (criteria.length > 0) {
    const ids = new Set(criteria.map((c) => String(c?.id ?? '').trim()).filter(Boolean));
    const orphans = questions.filter((q) => {
      const ref = q?.criterion !== undefined && q?.criterion !== null && String(q.criterion).trim() !== ''
        ? String(q.criterion).trim()
        : null;
      return ref ? !ids.has(ref) : true;
    });
    if (orphans.length > 0) {
      return fail(
        'ORPHAN_CRITERION',
        `لا يمكن حفظ الاختبار: ${orphans.length} سؤال بلا كفاية صالحة في جدول الإسناد — كل سؤال يجب أن يشير إلى كفاية موجودة.`,
        { orphans: orphans.length }
      );
    }
  }

  // 3) Σ جدول الإسناد ≠ Σ نقاط الأسئلة ⇒ تحذير (لا منع) — انظر التعليق أعلاه
  const warnings = [];
  if (criteria.length > 0 && criteriaMax !== pointsSum) {
    warnings.push(`SIGMA_MISMATCH: مجموع جدول الإسناد (${criteriaMax}) لا يساوي مجموع نقاط الأسئلة (${pointsSum}) — تحقّق من الورقة (ورقة ${target} نقطة)`);
  }
  if (missingKeys > 0) {
    warnings.push(`MISSING_ANSWER_KEYS: ${missingKeys} سؤال مقفول بلا مفتاح إجابة ⇒ سيُصحَّح يدويًّا (لا صفر تلقائي)`);
  }

  return {
    blocking: false,
    code: null,
    messageAr: null,
    warnings,
    detail: { questions: questions.length, closed: closed.length, open: questions.length - closed.length, criteria: criteria.length, pointsSum, criteriaMax, target, missingKeys }
  };
}

/** يرمي ApiError برسالة عربية واضحة + كود المشكلة في details. */
export function assertExamContentPublishable(content, { status = 400 } = {}) {
  const inspection = inspectExamContent(content);
  if (!inspection.blocking) return inspection;
  throw new ApiError(status, inspection.messageAr, { code: inspection.code, ...inspection.detail });
}
