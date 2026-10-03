// تسمية المادة المعروضة: تتعامل مع كل الأشكال المخزنة (MATH / math / anisi…)
// وترجع التسمية العربية/الإنجليزية من معجم subjects، أو القيمة الخام إن لم تُعرف.
// الرموز غير الموجودة في i18n (arabic/math/french/islamic/handwriting…) تمرّ على
// utils/subjectLabels.js — لا نُرجع «arabic» خامًّا أبدًا للواجهة (§78).
import { subjectLabel as utilSubjectLabel } from './subjectLabels.js';

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
  const raw = String((i18n ? code : t) || '').trim();
  if (!raw) return '';
  const key = SUBJECT_KEYS[raw.toUpperCase()];
  if (key && i18n) return i18n(key);
  return utilSubjectLabel(raw, lang);
}
