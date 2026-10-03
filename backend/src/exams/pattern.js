// نماذج مرجعية وأنماط الورقة (Spec A §12-13,§73-76,§119-120,§128-129,§154-157).
//
// الورقة المولّدة يجب أن تبقى من «العائلة البنائية» لنموذجها المرجعي:
//   - نفس التسلسل الهرمي (سندات ← مهام ← أسئلة) لا عائلة أخرى
//   - نفس عائلة الاستجابة (إفراط الاختيار من متعدد أمام نموذج إنتاج مفتوح = انجراف)
//   - نفس البيانات المعلنة (الثلاثي/السنة/المادة) — القفل من المعلّم لا من النموذج
//
// لا محتوى هنا: تُقارن البنية فقط (§12) — النموذج المرجعي يُمرَّر ككائن exam جاهز.

/** البصمة البنائية لورقة: عدد السندات + توزيع أنواع الأسئلة + عائلة الاستجابة. */
export function structureSignature(exam = {}) {
  const questions = Array.isArray(exam.questions) ? exam.questions : [];
  const stimuli = Array.isArray(exam.stimuli) ? exam.stimuli : (Array.isArray(exam.passages) ? exam.passages : []);
  const types = {};
  questions.forEach((q) => {
    const t = String(q?.type || 'UNKNOWN');
    types[t] = (types[t] || 0) + 1;
  });
  const openTypes = ['OPEN', 'EXTRACT', 'FILL_BLANK', 'ORDER', 'TRUE_FALSE'];
  const openCount = questions.filter((q) => openTypes.includes(String(q?.type))).length;
  return {
    stimuli: stimuli.length,
    questions: questions.length,
    types,
    openCount,
    mcqCount: types.MCQ || 0,
    openRatio: questions.length ? Math.round((openCount / questions.length) * 100) / 100 : 0,
    term: exam.term ?? exam.trimester ?? null,
    grade: exam.grade ?? exam.blueprint?.grade ?? null,
    subject: exam.subject ?? exam.blueprint?.subject ?? null
  };
}

/**
 * مقارنة ورقة مولّدة بنموذجها المرجعي (§154-157).
 * @returns {{status:'pass'|'fail', issues:Array<{code,severity,message}>}}
 */
export function comparePatterns(reference = {}, generated = {}) {
  const issues = [];
  const r = structureSignature(reference);
  const g = structureSignature(generated);

  // §156: قفل البيانات — الثلاثي المعلَن من المعلّم لا يتغيّر في التوليد
  if (r.term !== null && g.term !== null && Number(r.term) !== Number(g.term)) {
    issues.push({ code: 'METADATA_MISMATCH', severity: 'error', message: `الثلاثي المولّد (${g.term}) يخالف الثلاثي المرجعي (${r.term}) (§156)` });
  }
  // §157: توافق السنة الدراسية
  if (r.grade && g.grade && r.grade !== g.grade) {
    issues.push({ code: 'GRADE_MISMATCH', severity: 'error', message: `السنة المولّدة (${g.grade}) تخالف السنة المرجعية (${r.grade}) (§157)` });
  }

  // §154: عائلة بنيوية — انحسار شديد في عدد السندات = انجراف نمط
  if (r.stimuli > 0 && g.stimuli < Math.ceil(r.stimuli / 2)) {
    issues.push({ code: 'PATTERN_DRIFT', severity: 'error', message: `الورقة المولّدة تحوي ${g.stimuli} سند مقابل ${r.stimuli} في النموذج المرجعي — انجراف بنائي (§154)` });
  }

  // §155: عائلة الاستجابة — نموذج إنتاج مفتوح لا يُستبدل بحزم اختيار فقط
  if (r.openCount > 0 && g.questions > 0 && g.mcqCount === g.questions) {
    issues.push({ code: 'RESPONSE_PATTERN_DRIFT', severity: 'error', message: 'النموذج المرجعي يحوي استجابات مفتوحة والمولّد كلها اختيار من متعدد (§155)' });
  } else if (r.openCount > 0 && g.openRatio < r.openRatio * 0.5) {
    issues.push({ code: 'RESPONSE_PATTERN_DRIFT', severity: 'warn', message: `تنقص نسبة الاستجابات المفتوحة (${g.openRatio}) عن النموذج المرجعي (${r.openRatio}) (§155)` });
  }

  return { status: issues.some((i) => i.severity === 'error') ? 'fail' : 'pass', issues, reference: r, generated: g };
}

/** قفل البيانات المعلنة (§156,§157) — مستدعى وحده حين يُمرَّر سياق مرجعي. */
export function metadataLock(reference = {}, generated = {}) {
  return comparePatterns(reference, generated).issues.filter((i) => ['METADATA_MISMATCH', 'GRADE_MISMATCH'].includes(i.code));
}
