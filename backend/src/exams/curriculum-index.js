// فهرس المنهج التونسي — سند «Curriculum Guard» (§2,§12,§55,§57).
//
// يقرأ registry.json + ملفات الدروس + skills-map لكل سنة/مادة ويُخرج نطاقًا
// منظّمًا (دروس + أهداف + كفايات + مؤشرات + فترات) يستعمله المخطّط والمدقّق:
//   1) نطاق الثلاثي: 6 فترات/سنة ⇦ الثلاثي t = الفترةان {2t−1, 2t}.
//   2) لا محتوى ⇦ `unknown` (تنبيه «لا تخمن» §55) — لا رفض صامت ولا اختلاق.
//   3) مكتسب خارج النطاق ⇦ `out` (§56: لا تسرّب مستوى آخر).
// لا يُعدَّل هذا الفهرس وقت التشغيل (نفس افتراض curriculumService): يُحمَّل ويُخزَّن.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { normalizeArabic } from '../services/curriculumService.js';
import { curriculumSubjectIds } from './subject-labels.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CURRICULUM_DIR = path.join(__dirname, '../../curriculum');

const GRADE_IDS = ['year1', 'year2', 'year3', 'year4', 'year5', 'year6'];
const GRADE_TITLES = ['السنة الأولى', 'السنة الثانية', 'السنة الثالثة', 'السنة الرابعة', 'السنة الخامسة', 'السنة السادسة'];

function readJson(abs) {
  if (!fs.existsSync(abs)) return null;
  try {
    return JSON.parse(fs.readFileSync(abs, 'utf8'));
  } catch {
    return null;
  }
}

/** «year3» | «السنة الثالثة» | 3 ← year3 — وإلا null. */
export function resolveGradeId(level) {
  const raw = String(level ?? '').trim();
  if (!raw) return null;
  if (GRADE_IDS.includes(raw)) return raw;
  const code = raw.toLowerCase();
  if (GRADE_IDS.includes(code)) return code;
  const digit = raw.match(/[1-6]/);
  const norm = normalizeArabic(raw);
  const idx = GRADE_TITLES.findIndex((t) => norm.includes(normalizeArabic(t)));
  if (idx >= 0) return GRADE_IDS[idx];
  // digit[0] لا digit[1]: match(/[1-6]/) بلا مجموعة تحويل (كانت تُرجع «yearundefined»)
  if (digit && (/^[1-6]$/.test(raw) || norm.includes('سنه') || norm.includes('سنة') || /^year|^s/i.test(code))) return `year${digit[0]}`;
  return null;
}

export function gradeTitle(gradeId) {
  const i = GRADE_IDS.indexOf(gradeId);
  return i >= 0 ? GRADE_TITLES[i] : gradeId || '';
}

/** تُطبَّع مفاتيح skills-map القصيرة (o/c/s/i) والطويلة (learningObjectives…). */
function normalizeSkillEntry(entry) {
  if (!entry || typeof entry !== 'object') {
    return { objectives: [], competencies: [], skills: [], indicators: [] };
  }
  const arr = (v) => (Array.isArray(v) ? v.filter(Boolean) : v ? [v] : []);
  return {
    objectives: arr(entry.learningObjectives || entry.o),
    competencies: arr(entry.competencies || entry.c),
    skills: arr(entry.skills || entry.s),
    indicators: arr(entry.indicators || entry.i)
  };
}

/** مُطبِّع شكل ملف الدروس: خريطة مسطّحة (y1m01: {…}) أو {units:[{lessons:[…]}]}. */
function normalizeLessonsFile(data) {
  const out = [];
  if (!data || typeof data !== 'object') return out;
  if (Array.isArray(data.units)) {
    for (const unit of data.units) {
      for (const lesson of unit?.lessons || []) {
        if (!lesson || typeof lesson !== 'object') continue;
        // أنيسي السنة الأولى كتاب حروف: الدرس مُسمّى بـ`letter`/`letter_name_full` لا `title`
        const title = lesson.title || lesson.letter_name_full || lesson.letter || lesson.name;
        if (!title) continue;
        const unitKey = unit.id || (unit.unit_number ? `u${unit.unit_number}` : null);
        out.push({
          id: String(lesson.id || `${unitKey || 'unit'}-l${out.length + 1}`),
          title: String(title),
          unitId: unitKey,
          unitTitle: unit.title || null,
          domain: lesson.domain || unit.title || null,
          period: Number(lesson.period) || null
        });
      }
    }
    return out;
  }
  for (const [key, val] of Object.entries(data)) {
    if (key.startsWith('_') || key === 'title' || key.endsWith('_title') || key === 'source_note') continue;
    if (!val || typeof val !== 'object' || Array.isArray(val) || !val.title) continue;
    out.push({
      id: String(val.id || key),
      title: String(val.title),
      unitId: val.unitId || val.axisId || null,
      unitTitle: val.domain || null,
      domain: val.domain || null,
      period: Number(val.period) || null
    });
  }
  return out;
}

const scopeCache = new Map();

/**
 * نطاق السنة+المادة: دروس (مع أهداف/كفايات/مؤشرات من skills-map) + تنبيهات.
 * لا يرمي أبدًا — النطاق غير المتاح يُعلَّم `available:false` فيقرّر المتقدّم ماذا يقول.
 */
export function getScope({ level, subject } = {}) {
  const gradeId = resolveGradeId(level);
  const cacheKey = `${gradeId || '?'}|${subject || '?'}`;
  if (scopeCache.has(cacheKey)) return scopeCache.get(cacheKey);

  const scope = {
    gradeId,
    gradeTitle: gradeTitle(gradeId),
    subject: subject || null,
    available: false,
    hasPeriodInfo: false,
    lessons: [],
    competencies: [],
    objectives: [],
    indicators: [],
    warnings: []
  };
  if (!gradeId) {
    scope.warnings.push(`مستوى غير معروف: «${level || ''}»`);
    scopeCache.set(cacheKey, scope);
    return scope;
  }

  const registry = readJson(path.join(CURRICULUM_DIR, 'registry.json')) || { grades: [] };
  const grade = (registry.grades || []).find((g) => g.id === gradeId);
  if (!grade) {
    scope.warnings.push(`السنة ${gradeId} غير موجودة في registry.json`);
    scopeCache.set(cacheKey, scope);
    return scope;
  }

  const candidateIds = curriculumSubjectIds(subject);
  const subjects = (grade.subjects || []).filter((s) => candidateIds.includes(s.id));
  if (!subjects.length) {
    scope.warnings.push(`مادة «${subject || ''}» غير مقرّرة في ${scope.gradeTitle} حسب فهرس المنهج`);
    scopeCache.set(cacheKey, scope);
    return scope;
  }

  const skillByLesson = new Map();
  // بطاقة الكفايات/الأهداف لكل درس — ثلاثة أشكال في المحتوى الفعلي:
  //   { lessons: { y3m01: {…} } } | { chapters: { ch1: {…} } } | خريطة مسطّحة { y3m01: {…}, _meta }
  // قراءة `sm.lessons` وحده كانت تتجاهل الرياضيات في السنوات 3-6 والعلوم في 2-3-6
  // → نطاق بلا أهداف ولا كفايات (حارس يكتفي بعنوان الدرس = سند ضعيف §55).
  const hasSkillFields = (e) => !!(e && typeof e === 'object' && (
    e.learningObjectives || e.o || e.competencies || e.c || e.skills || e.s || e.indicators || e.i
  ));
  const addSkills = (obj) => {
    for (const [lid, entry] of Object.entries(obj || {})) {
      if (lid === '_meta' || !hasSkillFields(entry)) continue; // لا نُدخل meta/بنية غير مهارات
      skillByLesson.set(lid, normalizeSkillEntry(entry));
    }
  };
  for (const s of subjects) {
    if (!s.skillsMapFile) continue;
    const sm = readJson(path.join(CURRICULUM_DIR, grade.dir || gradeId, s.skillsMapFile));
    if (!sm || typeof sm !== 'object') continue;
    addSkills(sm);
    addSkills(sm.lessons);
    addSkills(sm.chapters);
  }

  const lessons = [];
  let skillsOnly = false;
  for (const s of subjects) {
    if (!s.lessonsFile) continue;
    const data = readJson(path.join(CURRICULUM_DIR, grade.dir || gradeId, s.lessonsFile));
    for (const lesson of normalizeLessonsFile(data)) {
      const skills = skillByLesson.get(lesson.id) || { objectives: [], competencies: [], skills: [], indicators: [] };
      lessons.push({ ...lesson, ...skills });
    }
  }

  // لا ملف دروس لكن skills-map يحوي مدخلات دروس (year4 أنيسي: الكتاب وحدات فقط بلا بنية دروس):
  // نبني النطاق من مفاتيح skills-map — محتوى حقيقي مسجّل لا مُختلَق (§2). بلا فترة
  // ← يبقى كل مدخل مشمولًا في كل الثلاثيات مع تنبيه صريح أن الفلترة غير ممكنة.
  if (!lessons.length && skillByLesson.size) {
    skillsOnly = true;
    for (const [lid, entry] of skillByLesson) {
      lessons.push({
        id: lid,
        title: entry.objectives[0] || lid,
        unitId: String(lid).split('-')[0] || null,
        unitTitle: null,
        domain: null,
        period: null,
        ...entry
      });
    }
  }

  if (!lessons.length && !skillByLesson.size) {
    scope.warnings.push(`لا بيانات منهج (دروس/مهارات) لـ «${subject}» في ${scope.gradeTitle}`);
    scopeCache.set(cacheKey, scope);
    return scope;
  }

  scope.available = true;
  scope.lessons = lessons;
  scope.hasPeriodInfo = lessons.some((l) => l.period);
  const uniq = (list) => [...new Set(list.flatMap((x) => x).filter(Boolean))];
  scope.competencies = uniq(lessons.map((l) => l.competencies));
  scope.objectives = uniq(lessons.map((l) => l.objectives));
  scope.indicators = uniq(lessons.map((l) => l.indicators));
  // كفايات skills-map بلا درس مطابق (مواد بلا ملف دروس: year4/anisi…) — تدخل النطاق أيضًا
  for (const entry of skillByLesson.values()) {
    scope.competencies = [...new Set([...scope.competencies, ...entry.competencies])];
    scope.objectives = [...new Set([...scope.objectives, ...entry.objectives])];
    scope.indicators = [...new Set([...scope.indicators, ...entry.indicators])];
  }
  if (skillsOnly) {
    scope.warnings.push(`لا ملف دروس لـ «${subject}» في ${scope.gradeTitle} — بُني النطاق من ${lessons.length} مدخل في skills-map بلا فلترة فترات (§55)`);
  }

  scopeCache.set(cacheKey, scope);
  return scope;
}

/** فترات الثلاثي: t=1 ⇦ {1,2} … t=3 ⇦ {5,6}. */
export function trimesterPeriods(trimester) {
  const t = Number(trimester);
  if (!t || t < 1 || t > 3) return null;
  return [t * 2 - 1, t * 2];
}

function tokens(text) {
  return normalizeArabic(text)
    .split(/[^0-9\u0621-\u064A]+/)
    .filter((w) => w.length >= 3);
}

export function matchesScopeText(query, haystackNorm) {
  const q = normalizeArabic(query);
  if (!q) return false;
  if (haystackNorm.includes(q)) return true;
  const strong = tokens(query).filter((w) => w.length >= 4);
  return strong.some((w) => haystackNorm.includes(w));
}

/** نصوص درس واحد (عنوان/مجال/كفايات/أهداف/مؤشرات) لبناء م Haystack. */
function lessonHaystack(lessons) {
  return lessons
    .map((l) => `${l.title} ${l.domain || ''} ${(l.competencies || []).join(' ')} ${(l.objectives || []).join(' ')} ${(l.indicators || []).join(' ')}`)
    .join(' ~ ');
}

/**
 * حارس المنهج (§55,§57): يتحقّق أن المكتسب/الدرس/الهدف من نطاق السنة+المادة+الثلاثي.
 * وعي الفترة: يبحث أولًا في دروس الثلاثي نفسه؛ إن وُجد المحتوى خارج فتراته فقط
 * → REJECT برسالة «في الفترة X خارج الثلاثي Y» (لا تخمين — §2).
 * @returns {{status:'ok'|'out'|'unknown', reason:string, matchedLessonId?:string}}
 *   ok    ← له سند في النطاق
 *   out   ← محتوى منهجي مُتحقَّق منه أنه غير موجود هنا → REJECT
 *   unknown ← لا بيانات كافية → WARN («لا تخمن»)
 */
export function guardCurriculum({ level, subject, trimester, competency, objective, lessonTitle } = {}) {
  const scope = getScope({ level, subject });
  if (!scope.available) {
    return { status: 'unknown', reason: scope.warnings[0] || 'لا سند منهجي لهذا الاختيار' };
  }

  const queries = [competency, objective, lessonTitle].filter((x) => String(x || '').trim());
  if (!queries.length) {
    return { status: 'unknown', reason: 'لا مكتسب ولا هدف ولا درس محدّد — لا يمكن التحقق (§11: سؤال بلا هدف تعليمي لا يدخل)' };
  }

  const periods = trimesterPeriods(trimester);
  const hasPeriod = Boolean(periods && scope.hasPeriodInfo);
  const inTermLessons = hasPeriod
    ? scope.lessons.filter((l) => !l.period || periods.includes(l.period))
    : scope.lessons;

  // الكفايات/الأهداف/المؤشرات غير المنسوبة لدرس (مواد بلا ملف دروس) بلا فترة → تبقى مشمولة
  const attr = (key) => {
    const all = new Set(scope.lessons.flatMap((l) => l[key] || []));
    return (scope[key] || []).filter((x) => !all.has(x));
  };
  const loose = [...attr('competencies'), ...attr('objectives'), ...attr('indicators')].join(' ~ ');

  const inTermHay = normalizeArabic(`${lessonHaystack(inTermLessons)} ~ ${loose}`);
  const matchedInTerm = queries.find((q) => matchesScopeText(q, inTermHay));
  if (matchedInTerm) {
    let matchedLesson = null;
    if (lessonTitle) {
      matchedLesson = inTermLessons.find((l) => matchesScopeText(lessonTitle, normalizeArabic(l.title))) || null;
    }
    if (!matchedLesson && competency) {
      matchedLesson = inTermLessons.find((l) =>
        (l.competencies || []).some((c) => matchesScopeText(c, normalizeArabic(competency)) || matchesScopeText(competency, normalizeArabic(c)))
      ) || null;
    }
    return { status: 'ok', reason: '', matchedLessonId: matchedLesson?.id };
  }

  // خارج فترات الثلاثي لكن داخل السنة؟ → out برسالة الفترة (§57)
  if (hasPeriod) {
    const fullHay = normalizeArabic(`${lessonHaystack(scope.lessons)} ~ ${loose}`);
    if (queries.some((q) => matchesScopeText(q, fullHay))) {
      let outLesson = null;
      if (lessonTitle) {
        outLesson = scope.lessons.find((l) => matchesScopeText(lessonTitle, normalizeArabic(l.title))) || null;
      }
      if (!outLesson && competency) {
        outLesson = scope.lessons.find((l) =>
          (l.competencies || []).some((c) => matchesScopeText(c, normalizeArabic(competency)) || matchesScopeText(competency, normalizeArabic(c)))
        ) || null;
      }
      const p = outLesson?.period;
      return {
        status: 'out',
        reason: p && !periods.includes(p)
          ? `الدرس «${outLesson.title}» في الفترة ${p} خارج الثلاثي ${trimester} (فتراته: ${periods.join(' و')})`
          : `«${String(competency || objective || lessonTitle).slice(0, 80)}» خارج نطاق الثلاثي ${trimester} من ${scope.gradeTitle} — «${scope.subject}»`
      };
    }
  }

  return { status: 'out', reason: `«${String(competency || objective || lessonTitle).slice(0, 80)}» ليس من نطاق ${scope.gradeTitle} — «${scope.subject}»` };
}

/** دروس النطاق ضمن ثلاثي معيّن — لمخطّط التوليد (§10): period مجهول يبقى مشمولًا مع تنبيه. */
export function scopeLessonsForTrimester({ level, subject, trimester } = {}) {
  const scope = getScope({ level, subject });
  if (!scope.available) return { lessons: [], warnings: scope.warnings };
  const periods = trimesterPeriods(trimester);
  if (!periods || !scope.hasPeriodInfo) {
    return {
      lessons: scope.lessons,
      warnings: scope.hasPeriodInfo ? scope.warnings : [...scope.warnings, 'بيانات الفترات غير متاحة — تُدرَّس كل الدروس دون فلترة الثلاثي']
    };
  }
  const inTerm = scope.lessons.filter((l) => !l.period || periods.includes(l.period));
  const warnings = [...scope.warnings];
  if (!inTerm.length) warnings.push(`لا دروس في فترات الثلاثي ${trimester} — أُبعدت كل الدروس`);
  return { lessons: inTerm, warnings };
}
