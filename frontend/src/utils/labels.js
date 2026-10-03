// تسمية المادة المعروضة: تتعامل مع كل الأشكال المخزنة (MATH / math / anisi…)
// وترجع التسمية العربية/الإنجليزية من معجم subjects، أو القيمة الخام إن لم تُعرف.
// الرموز غير الموجودة في i18n (arabic/math/french/islamic/handwriting…) تمرّ على
// utils/subjectLabels.js — لا نُرجع «arabic» خامًّا أبدًا للواجهة (§78).
import { subjectLabel as utilSubjectLabel } from './subjectLabels.js';
import { levelLabel as utilLevelLabel } from './levels.js';

const SUBJECT_KEYS = {
  MATH: 'subjects.MATH',
  READING: 'subjects.READING',
  SCIENCE: 'subjects.SCIENCE',
  STORIES: 'subjects.STORIES',
  ANISI: 'subjects.ANISI',
  PRODUCTION: 'subjects.PRODUCTION',
  GENERAL: 'subjects.GENERAL'
};

export const SUBJECT_CODES = ['MATH', 'ANISI', 'SCIENCE', 'PRODUCTION', 'READING', 'STORIES'];

/**
 * تسمية المادة المعروضة.
 * يُستدعى بصيغتين: `subjectLabel(t, code)` (المعجم i18n) أو `subjectLabel(code)`
 * وحده كما في صفحات الجداول الزمنية — الصيغة ذات المعطى الواحد كانت تُرجع نصًّا فارغًا
 * (empty subject في الخلية). نتعرّف على المعطى الأول إن كان دالةً.
 */
export function subjectLabel(t, code, lang = 'ar') {
  const i18n = typeof t === 'function' ? t : null;
  // صيغة (code) أو (code, lang) —Previously كان المعنى الثاني دائمًا هو lang،
  // والأنسب أن يمرّ إلى utilSubjectLabel ليحترم لغة الواجهة.
  const raw = String((i18n ? code : t) || '').trim();
  const effLang = i18n ? (lang || 'ar') : (typeof code === 'string' ? code : lang || 'ar');
  if (!raw) return '';
  const key = SUBJECT_KEYS[raw.toUpperCase()];
  if (key && i18n) return i18n(key);
  return utilSubjectLabel(raw, effLang);
}

// ── طبقة التسمية الموحّدة (المرحلة A) ────────────────────────────────────────
// القاعدة: يُخزَّن الرمز (MATH / SENT / exam…) وتُعرض التسمية العربية فقط.
// ممنوع في الواجهة: {x.subject} أو {x.status} أو {x.kind} مباشرةً.
// statuses/kinds معرَّفة هنا لا في كل صفحة (كانت 4 معاجم متفرقة).

const STATUS = {
  // تكليفات
  DRAFT: ['مسودة', 'Draft'],
  PUBLISHED: ['منشور', 'Published'],
  CLOSED: ['مغلق', 'Closed'],
  // تسليمات امتحانات/دروس
  SENT: ['مُسلَّم', 'Submitted'],
  SUBMITTED: ['مُسلَّم', 'Submitted'],
  IN_REVIEW: ['قيد التصحيح', 'In review'],
  GRADED: ['مصحَّح', 'Graded'],
  CORRECTED: ['مصحَّح', 'Graded'],
  RETURNED: ['مُعاد', 'Returned'],
  // حصص
  SCHEDULED: ['مبرمَج', 'Scheduled'],
  LIVE: ['مباشر', 'Live'],
  ENDED: ['منتهية', 'Ended'],
  CANCELLED: ['ملغاة', 'Cancelled'],
  // اشتراكات وحسابات وطلبات
  ACTIVE: ['نشط', 'Active'],
  PENDING_PAYMENT: ['في انتظار الدفع', 'Pending payment'],
  PENDING_APPROVAL: ['بانتظار المصادقة', 'Pending approval'],
  EXPIRED: ['منتهي', 'Expired'],
  SUSPENDED: ['موقوف', 'Suspended'],
  REJECTED: ['مرفوض', 'Rejected'],
  APPROVED: ['مصادق عليه', 'Approved'],
  TRIAL: ['تجريبي', 'Trial']
};

const KIND = {
  quiz: ['اختبار سريع', 'Quick quiz'],
  exam: ['امتحان رسمي', 'Official exam'],
  assignment: ['واجب', 'Homework'],
  lesson: ['درس تفاعلي', 'Interactive lesson'],
  paper: ['ورقة ممسوحة', 'Scanned paper'],
  memo: ['مذكرة', 'Memo'],
  student: ['تلميذ', 'Student'],
  parent: ['ولي', 'Parent'],
  teacher: ['أستاذ', 'Teacher'],
  director: ['مدير مدرسة', 'School director']
};

function pickPair(dict, code, lang) {
  const raw = String(code ?? '').trim();
  if (!raw) return '—';
  if (dict[raw]) return lang === 'en' ? dict[raw][1] : dict[raw][0];
  const upper = raw.toUpperCase();
  if (dict[upper]) return lang === 'en' ? dict[upper][1] : dict[upper][0];
  // نص عربي مخزّن كما هو يُحترم؛ وإلا نُرجع الخام (لا «undefined» أمام المستخدم)
  if (/[؀-ۿ]/.test(raw)) return raw;
  return raw;
}

/** تسمية حالة (تكليف/تسليم/اشتراك/حصة). */
export function statusLabel(code, lang = 'ar') {
  return pickPair(STATUS, code, lang);
}

/** تسمية نوع العمل (امتحان رسمي/واجب/اختبار سريع…). */
export function kindLabel(code, lang = 'ar') {
  return pickPair(KIND, code, lang);
}

/** تسمية المستوى: «السنة الثانية ابتدائي» / year2 / «السنة الثانية أساسي» ⇒ الرسمي. */
export function levelLabel(level, lang = 'ar') {
  return utilLevelLabel(level, lang);
}

export const STATUS_CODES = Object.keys(STATUS);
export const KIND_CODES = Object.keys(KIND);
