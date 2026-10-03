// مخطّط الاختبار — Exam Blueprint (§10,§51,§58,§59,§118,§119).
//
// المخطّط هو العقد بين المدرس والمحرّك قبل أي توليد: السنة + المادة + الثلاثي +
// نوع التقييم + النطاق (دروس/وحدات) + المكتسبات المستهدفة + عدد الأسئلة +
// المجموع + المدة + توزيع الصعوبة. لا سؤال يُخلَق قبل قبول المخطّط (§1).
// يبنيه `buildBlueprint` من مدخلات المدرس وفهرس المنهج، ويدقّقه `validateBlueprint`
// (§51: تغطية، منطقية العدد، إفراط نوع واحد، تكرار، مستوى) قبل توليد الأسئلة.

import { getScope, scopeLessonsForTrimester, resolveGradeId, gradeTitle, trimesterPeriods, matchesScopeText } from './curriculum-index.js';
import { subjectLabel, curriculumSubjectIds } from './subject-labels.js';
import { TARGET_POINTS } from './points-engine.js';
import { GENERATABLE_TYPES } from './question-validator.js';
import { normalizeArabic } from '../services/curriculumService.js';

// مدة السؤال التقريبية بالدقائق بحسب الجنس والسن (§38): السنة الصغرى أبطأ
const MINUTES_PER_TYPE = {
  MCQ: 1.5, TRUE_FALSE: 1, FILL_BLANK: 2, EXTRACT: 2.5, ORDER: 2.5, OPEN: 6, MATCHING: 2.5, ORDERING: 2.5
};

const issue = (severity, code, message) => ({ severity, code, message });

/**
 * يبني مخطّطًا من مدخلات المدرس + فهرس المنهج (§62).
 * @param {object} input { level, subject, trimester, assessmentType, domains,
 *   questionCount, targetPoints, durationMinutes, difficulty ('balanced'|1..5), competencies }
 */
export function buildBlueprint(input = {}) {
  const gradeId = resolveGradeId(input.level);
  const trimester = [1, 2, 3].includes(Number(input.trimester)) ? Number(input.trimester) : null;
  const questionCount = Math.min(Math.max(Number(input.questionCount) || 8, 1), 20);
  const targetPoints = TARGET_POINTS.includes(Number(input.targetPoints)) ? Number(input.targetPoints) : 20;
  // مدة صريحة تُقيَّد [5..120]؛ غيابها → تقدير 2.5 د/سؤال (كانت القيمة الفارغة تصير 5 د)
  const requestedDuration = Number(input.durationMinutes) || 0;
  const durationMinutes = requestedDuration
    ? Math.min(Math.max(requestedDuration, 5), 120)
    : estimateDuration(questionCount);
  const { lessons: allLessons, warnings } = scopeLessonsForTrimester({ level: gradeId, subject: input.subject, trimester });

  // فلترة النطاق على وحدة/درس محدّد (§58): درس غير مطابق → يبقى النطاق كاملًا مع تحذير
  // صريح (لا تضييق صامت يجعل التوليد من دروس أخرى).
  let lessons = allLessons;
  const lessonTitle = String(input.lessonTitle || '').trim();
  if (lessonTitle && allLessons.length) {
    const hits = allLessons.filter((l) => matchesScopeText(lessonTitle, normalizeArabic(l.title)));
    if (hits.length) lessons = hits;
    else warnings.push(`الدرس «${lessonTitle}» غير موجود في نطاق هذا الثلاثي — أُبقي النطاق كاملاً (${allLessons.length} درسًا)`);
  }
  const unitFilter = Array.isArray(input.domains) && input.domains.length
    ? input.domains.map(String)
    : null;
  if (unitFilter && allLessons.length) {
    const unitHits = lessons.filter((l) => unitFilter.includes(String(l.unitId || '')) || unitFilter.includes(String(l.domain || '')));
    if (unitHits.length) lessons = unitHits;
    else warnings.push('الوحدات المختارة لا تطابق أي درس في النطاق — أُبقي النطاق كاملاً');
  }

  const blueprint = {
    curriculumVersion: 'TN-2026-2027',
    grade: gradeId,
    gradeLabel: gradeTitle(gradeId),
    subject: input.subject || null,
    subjectLabel: subjectLabel(input.subject),
    trimester,
    assessmentType: input.assessmentType || 'written', // written|oral|practical|diagnostic|formative|unit|term|cumulative|remedial
    questionCount,
    targetPoints,
    durationMinutes,
    difficulty: input.difficulty || 'balanced',
    types: Array.isArray(input.types) && input.types.length ? input.types.filter((t) => GENERATABLE_TYPES.includes(t)) : [...GENERATABLE_TYPES],
    scopeLessonIds: lessons.map((l) => l.id),
    scopeLessons: lessons.map((l) => ({ id: l.id, title: l.title, unitId: l.unitId, period: l.period, competencies: l.competencies.slice(0, 4) })),
    competencies: Array.isArray(input.competencies) && input.competencies.length ? input.competencies : [...new Set(lessons.flatMap((l) => l.competencies))],
    domains: Array.isArray(input.domains) && input.domains.length ? input.domains : [...new Set(lessons.map((l) => l.domain).filter(Boolean))],
    // قسم الحساب الذهني المستقل (§A2,§D6,§C13) — اختياري ويُطلب صراحةً:
    // افتراضاته 4 عمليات في س1 + 8 في س2-3، ≤ 10 دقائق، تنقيطه 0→4 (§D6 قرار 6).
    ...(input.mentalMath
      ? {
          mentalMath: {
            title: 'الحساب الذهني',
            points: 4,
            minutes: 10,
            ops: { s1: 4, s2: 8, s3: 8 },
            ...(typeof input.mentalMath === 'object' ? input.mentalMath : {})
          }
        }
      : {}),
    warnings
  };
  return blueprint;
}

function estimateDuration(count) {
  // تقدير مبدئي إن لم يحدّد المدرس: 2.5 د/سؤال ابتدائي
  return Math.max(10, Math.round(Number(count || 8) * 2.5));
}

/**
 * يدقّق المخطّط قبل التوليد (§51).
 * @returns {{valid:boolean, issues:Array}} error يمنع التوليد، warn تُعرض (§65).
 */
export function validateBlueprint(bp = {}) {
  const issues = [];
  if (!bp.grade) issues.push(issue('error', 'BP_GRADE', 'السنة الدراسية مطلوبة في المخطّط'));
  if (!bp.subject) issues.push(issue('error', 'BP_SUBJECT', 'المادة مطلوبة في المخطّط'));
  if (!bp.trimester) issues.push(issue('error', 'BP_TERM', 'الثلاثي مطلوب — لا توليد بلا فترة (§57)'));
  if (!curriculumSubjectIds(bp.subject).length) issues.push(issue('error', 'BP_SUBJECT_UNKNOWN', 'رمز المادة غير معروف'));

  const scope = getScope({ level: bp.grade, subject: bp.subject });
  if (!scope.available) {
    issues.push(issue('warn', 'BP_NO_CURRICULUM', scope.warnings[0] || 'لا سند منهجي — التوليد ممكن لكن بلا ضمان مطابقة (§55)'));
  } else if (!bp.scopeLessonIds?.length) {
    issues.push(issue('error', 'BP_SCOPE_EMPTY', `لا دروس في نطاق ${bp.gradeLabel} / ${bp.subjectLabel} للثلاثي ${bp.trimester} — لا توليد (§57)`));
  }

  if (!(bp.questionCount >= 1 && bp.questionCount <= 20)) issues.push(issue('error', 'BP_COUNT', 'عدد الأسئلة من 1 إلى 20'));
  if (!TARGET_POINTS.includes(Number(bp.targetPoints))) issues.push(issue('error', 'BP_TARGET', `المجموع يجب أن يكون ${TARGET_POINTS.join(' أو ')} (§7)`));

  const maxMinutes = bp.questionCount * 5;
  if (Number(bp.durationMinutes) > maxMinutes * 2) {
    issues.push(issue('warn', 'BP_DURATION', `المدة ${bp.durationMinutes} د كبيرة جدًّا على ${bp.questionCount} سؤالًا (§38)`));
  }
  if (bp.grade && ['year1', 'year2'].includes(bp.grade) && bp.questionCount > 12) {
    issues.push(issue('warn', 'BP_COUNT_HIGH', 'أكثر من 12 سؤالًا للسنة الصغرى يرهق الطفل (§39)'));
  }

  // إفراط نوع واحد (§51)
  if (Array.isArray(bp.types) && bp.types.length === 1 && bp.questionCount > 4) {
    issues.push(issue('warn', 'BP_TYPE_MONO', `كل الأسئلة من نوع ${bp.types[0]} — وزّع الأنواع حسب المكتسب (§30)`));
  }

  return { valid: !issues.some((i) => i.severity === 'error'), issues };
}

/**
 * تحليل تغطية اختبار جاهز (§9,§37,§118): يُعرض للمدرس بعد التوليد.
 * @returns {{coverageBySkill, coverageByDomain, coverageByDifficulty, coverageByType, pointsByShare, timeEstimate, readingLoad, warnings}}
 */
export function analyzeCoverage(questions = [], bp = {}) {
  const warnings = [];
  const total = questions.reduce((s, q) => s + (Number(q.points) || 0), 0) || 1;

  const group = (keyFn) => {
    const map = new Map();
    questions.forEach((q) => {
      const k = keyFn(q) || 'غير محدّد';
      map.set(k, (map.get(k) || 0) + (Number(q.points) || 0));
    });
    return Object.fromEntries([...map.entries()].map(([k, v]) => [k, { points: v, share: Math.round((v / total) * 100) }]));
  };

  const coverageBySkill = group((q) => q.competency);
  const coverageByDomain = group((q) => q.domain || q.lesson);
  const coverageByDifficulty = group((q) => (q.difficulty ? `مستوى ${q.difficulty}` : null));
  const coverageByType = group((q) => q.type);

  // 70%+ حول مكتسب واحد مع تعدد ممكن = تركيز مفرط (§9)
  const realSkills = Object.entries(coverageBySkill).filter(([k]) => k !== 'غير محدّد');
  if (questions.length >= 4) {
    if (realSkills.length === 1) {
      warnings.push(issue('warn', 'COV_CONCENTRATED', `كل النقاط (${realSkills[0][1].share}%) حول مكتسب واحد — الاختبار يجب أن يقيس أكثر من مكتسب (§9)`));
    } else if (realSkills.length === 0) {
      warnings.push(issue('warn', 'COV_NO_SKILL', 'لا مكتسب مرتبط بالأسئلة — عيّن المكتسب لكل سؤال (§11)'));
    }
    const top = realSkills.sort((a, b) => b[1].points - a[1].points)[0];
    if (top && top[1].share > 70) warnings.push(issue('warn', 'COV_TOP_HEAVY', `«${top[0]}» يحمل ${top[1].share}% من النقاط (§9)`));
  }

  // الزمن والحمل (§37,§38)
  const timeEstimate = Math.round(questions.reduce((s, q) => s + (MINUTES_PER_TYPE[String(q.type || '').toUpperCase()] || 2), 0));
  if (bp.durationMinutes && timeEstimate > Number(bp.durationMinutes) * 1.3) {
    warnings.push(issue('warn', 'TIME_OVER', `الزمن المقدَّر ${timeEstimate} د يتجاوز المدة المعلنة ${bp.durationMinutes} د (§38)`));
  }
  const readingLoad = questions.reduce((s, q) => s + String(q.prompt || '').length, 0);
  if (['year1', 'year2'].includes(bp.grade)) {
    if (readingLoad > 900) warnings.push(issue('error', 'LOAD_HIGH', `حمل قراءة ${readingLoad} حرفًا على سنة صغرى — REJECT (§39)`));
    else if (readingLoad > 500) warnings.push(issue('warn', 'LOAD_ELEVATED', `حمل قراءة مرتفع للسنة الصغرى (${readingLoad} حرفًا)`));
  } else if (readingLoad > 2600) {
    warnings.push(issue('warn', 'LOAD_HIGH', `حمل قراءة مرتفع (${readingLoad} حرفًا) (§39)`));
  }

  return { coverageBySkill, coverageByDomain, coverageByDifficulty, coverageByType, timeEstimate, readingLoad, warnings };
}

/** قائمة دروس النطاق للمخطط — تُعرض للمدرس لاختيار الوحدات (§58,§62). */
export function blueprintScopeOptions({ level, subject, trimester } = {}) {
  const { lessons, warnings } = scopeLessonsForTrimester({ level, subject, trimester });
  const units = new Map();
  for (const l of lessons) {
    const key = l.unitId || l.domain || '—';
    if (!units.has(key)) units.set(key, { id: key, title: l.unitTitle || l.domain || key, lessons: [] });
    units.get(key).lessons.push({ id: l.id, title: l.title, period: l.period });
  }
  return { trimesterPeriods: trimesterPeriods(trimester), units: [...units.values()], warnings };
}
