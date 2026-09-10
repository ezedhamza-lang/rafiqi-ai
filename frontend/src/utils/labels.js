// تسمية المادة المعروضة: تتعامل مع كل الأشكال المخزنة (MATH / math / anisi…)
// وترجع التسمية العربية/الإنجليزية من معجم subjects، أو القيمة الخام إن لم تُعرف.
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

export function subjectLabel(t, code) {
  const raw = String(code || '').trim();
  if (!raw) return '';
  const key = SUBJECT_KEYS[raw.toUpperCase()];
  return key ? t(key) : raw;
}
