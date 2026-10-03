// اختبارات محرك التقويم التربوي التونسي — المرحلة A (§133).
//
// جزء أول خالص: وحدات المحرّك (src/exams/*) تُختبر بلا قاعدة بيانات وبلا شبكة —
//   فهرس المنهج للسنوات 1-6، المخطّط، عقد السؤال، التنقيط، التكرار، الإجابات،
//   خط أنابيب التدقيق والتقرير الصادق، والمولّد.
// جزء ثانٍ حيّ: المسار الكامل POST /teacher/exams/generate-ai + بوابة النشر §125
//   بمزوّد مُحاكى عبر __setCallProvider (لا نداء شبكة حقيقي) + تنقية النسخة التلميذية.
//
// ملاحظة مهمة: نصوص سيناريوهات §133 (TEST 01-20) غير محفوظة داخل الريبو —
// وُصفت في مواصفة المستخدم في المحادثة. التغطية هنا مبنية على السلوك الموثّق
// في plan.md وأولويات §131، وكل اختبار يذكر القسم الذي يحققه.

import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import fs from 'fs';
import { fileURLToPath } from 'url';
import request from 'supertest';
import { resetDatabase, seedTestData, login } from './helpers.js';

import {
  getScope, scopeLessonsForTrimester, guardCurriculum, trimesterPeriods, resolveGradeId
} from '../src/exams/curriculum-index.js';
import { subjectLabel } from '../src/exams/subject-labels.js';
import {
  buildBlueprint, validateBlueprint, analyzeCoverage, blueprintScopeOptions
} from '../src/exams/exam-blueprint.js';
import { validateQuestion, GENERATABLE_TYPES } from '../src/exams/question-validator.js';
import { findDuplicates, similarity } from '../src/exams/duplicate-detector.js';
import { distributePoints, verifyTotal, totalPoints, TARGET_POINTS } from '../src/exams/points-engine.js';
import { verifyAnswer } from '../src/exams/answer-verifier.js';
import { validateExam, assertPublishable, auditReportLines, teacherReportLines } from '../src/exams/exam-pipeline.js';
import { parseGeneratedPayload, normalizeGeneratedQuestions, buildExamPrompt } from '../src/exams/generation.js';
import { criteriaFor } from '../src/exams/criteria-grids.js';
import {
  __setCallProvider, __resetCallProvider, savePlatformAiKey
} from '../src/services/aiService.js';

const LEVEL = 'year3';
const SUBJECT = 'arabic';
const TERM = 1;

const BANK_FILE = fileURLToPath(new URL('../content/banks/official-exams-bank.json', import.meta.url));

function authHeader(token) {
  return { Authorization: `Bearer ${token}` };
}

/** درس حقيقي من نطاق المنهج (لا اختلاق — §2). */
function lessonFixture(level = LEVEL, subject = SUBJECT, trimester = TERM) {
  const { lessons } = scopeLessonsForTrimester({ level, subject, trimester });
  return lessons.find((l) => (l.competencies || []).length && (l.objectives || []).length) || lessons[0];
}

/**
 * مخرج نموذج واقعي مطابق لعقد السؤال §76: 8 أسئلة متنوّعة (لا إفراط نوع §30)
 * كلها داخل نطاق المخطّط، بمجموع 20 نقطة وصعوبة 1..5.
 */
function rawQuestions() {
  const l = lessonFixture();
  const common = {
    grade: LEVEL,
    subject: SUBJECT,
    term: TERM,
    lesson: l.title,
    competency: l.competencies[0] || l.title,
    objective: l.objectives[0] || l.title,
    domain: l.domain || null
  };
  return [
    { ...common, id: 'q1', type: 'MCQ', difficulty: 1, points: 2, estimatedTime: 2, prompt: 'كم كتابًا رتّب المكتبي على الرف الأول ؟', options: ['155', '175', '45'], correctAnswer: '155' },
    { ...common, id: 'q2', type: 'MCQ', difficulty: 2, points: 2, estimatedTime: 2, prompt: 'أيّ الكلمات الآتية تدل على مكان القراءة في المدرسة ؟', options: ['المكتبة', 'المطبخ', 'الحديقة'], correctAnswer: 'المكتبة' },
    { ...common, id: 'q3', type: 'TRUE_FALSE', difficulty: 1, points: 1.5, estimatedTime: 1, prompt: 'هل كلمة «المدرسة» فعل ؟', correctAnswer: 'خطأ' },
    { ...common, id: 'q4', type: 'FILL_BLANK', difficulty: 2, points: 2, estimatedTime: 2, prompt: 'أكمل من السند: أعاد التلاميذ ‏…‏ كتابًا.', correctAnswer: '45' },
    { ...common, id: 'q5', type: 'EXTRACT', difficulty: 3, points: 2, estimatedTime: 3, prompt: 'اقرأ السند واستخرج اسم المكان الذي رتّب فيه المكتبي الكتب.', correctAnswer: 'المكتبة', acceptedAnswers: ['المكتبة'] },
    { ...common, id: 'q6', type: 'ORDER', difficulty: 3, points: 2.5, estimatedTime: 3, prompt: 'رتّب أحداث العمل في المكتبة كما وردت في السند.', orderItems: ['رتّب المكتبي الكتب على الرف', 'وضع الأقلام في الحقائب', 'وزّع القلم على التلاميذ'] },
    { ...common, id: 'q7', type: 'OPEN', difficulty: 4, points: 4, estimatedTime: 6, prompt: 'اشرح بأسلوبك الخاص كيف تساعدك المكتبة في تحسين قراءتك.', expectedResponseType: 'جملة', answerLines: 4 },
    { ...common, id: 'q8', type: 'MCQ', difficulty: 2, points: 4, estimatedTime: 2, prompt: 'ماذا يفعل التلاميذ في المكتبة ؟', options: ['يقرؤون', 'يلعبون', 'ينامون'], correctAnswer: 'يقرؤون' }
  ];
}

/** مخرج معيب متعمّد: إجابة خارج البدائل + بلا هدف تعليمي + سؤال مكرّر حرفياً. */
function badQuestions() {
  const bad = {
    grade: LEVEL, subject: SUBJECT, term: TERM, type: 'MCQ', difficulty: 2, points: 2,
    prompt: 'كم قلمًا وزّع المكتبي على التلاميذ ؟', options: ['54', '58', '64'], correctAnswer: '999'
  };
  return [{ ...bad, id: 'b1' }, { ...bad, id: 'b2' }];
}

/** سند حقيقي للّعبة (§105): كل أرقام الأسئلة واردة فيه أو ناتجة عنه (§42).
 *  نصّ قراءة s3: 10 أسطر مشكّلين تشكيلًا تامًّا (§6,§7 — بنية الورقة تُفحص في مسار التوليد). */
function rawStimulus() {
  return {
    id: 's1',
    title: 'السند 1: مكتبة المدرسة',
    text: [
      'فِي مَكْتَبَةِ الْمَدْرَسَةِ كُتُبٌ كَثِيرَةٌ وَأَدَوَاتُ تَعَلُّمٍ مُّتَنَوِّعَةٌ.',
      'رَتَّبَ الْمُكَتَبِيُّ الْكُتُبَ عَلَى رُفُوفٍ نَظِيفَةٍ وَهُوَ يَبْتَسِمُ.',
      '1200 كِتَابًا وَ45 دَفْتَرًا وُضِعَتْ فِي مَكْتَبَةِ الْمَدْرَسَةِ.',
      'رَتَّبَ الْمُكَتَبِيُّ 155 كِتَابًا عَلَى الرَّفِّ الْأَوَّلِ بِتَرْتِيبٍ جَمِيلٍ.',
      'وَرَتَّبَ 175 كِتَابًا عَلَى الرَّفِّ الثَّانِي فَأَكْمَلَ الْعَمَلَ.',
      'وَفِي الْخِزَانَةِ 10 حَقَائِبَ، وَفِي كُلِّ حَقِيبَةٍ 3 أَقْلَامٍ مُّتَشَبِّهَةٍ.',
      'ثُمَّ وَزَّعَ الْمُكَتَبِيُّ 165 قَلَمًا عَلَى التَّلَامِيذِ فِي الْفَصْلِ.',
      'يَقْرَأُ التَّلَامِيذُ الْكُتُبَ فِي الْمَكْتَبَةِ وَيَسْتَعِيرُونَ مَا يُحِبُّونَ.',
      'وَيَذْهَبُونَ إِلَى الْمَكْتَبَةِ كُلَّ يَوْمٍ قَبْلَ دُخُولِ الْحِصْصِ.',
      'تَسْعَدُ الْمَكْتَبَةُ التَّلَامِيذَ عَلَى تَحْسِينِ قِرَاءَتِهِمْ وَإِنْشَائِهِمْ.'
    ].join('\n'),
    purpose: 'قراءة معطيات وجمع الأعداد'
  };
}

/** مخرج المزوّد الحقيقي الآن: كائن فيه السندات والأسئلة معًا (§1). */
function rawExam() {
  return { stimuli: [rawStimulus()], questions: rawQuestions() };
}

function badStimulus() {
  return {
    id: 's1',
    title: 'السند 1: حصص الفصل',
    text: 'في المدرسة 9 أقسام و6 فصول. تجمع المكتبة 58 كتابًا ويحتوي كل فصل على 64 دفترًا.',
    purpose: 'العمليات على الأعداد'
  };
}

function badExam() {
  return { stimuli: [badStimulus()], questions: badQuestions() };
}

function blueprintOf(over = {}) {
  return buildBlueprint({ level: LEVEL, subject: SUBJECT, trimester: TERM, questionCount: 8, targetPoints: 20, ...over });
}

/* ══════════════════════════════════════════════════════════════════
   1) فهرس المنهج — سند «Curriculum Guard» (§2,§55,§57)
   ══════════════════════════════════════════════════════════════════ */
describe('فهرس المنهج: صحة السنوات 1-6 والنطاق الثلاثي', () => {
  for (const g of ['year1', 'year2', 'year3', 'year4', 'year5', 'year6']) {
    it(`${g}: الرياضيات والقراءة لهما سند منهجي حقيقي (لا تخمين §55)`, () => {
      for (const s of ['math', 'anisi']) {
        const scope = getScope({ level: g, subject: s });
        expect(scope.available, `${g}/${s} متاح`).toBe(true);
        expect(scope.lessons.length, `${g}/${s} دروس`).toBeGreaterThan(0);
        expect(scope.gradeId).toBe(g);
      }
    });
  }

  it('سنة بلا ملف دروس ← نطاق من skills-map نفسه مع تنبيه صريح (year4 أنيسي §2,§55)', () => {
    const scope = getScope({ level: 'year4', subject: 'anisi' });
    expect(scope.available).toBe(true);
    expect(scope.lessons.length).toBeGreaterThan(0);
    expect(scope.hasPeriodInfo).toBe(false);
    expect(scope.warnings.join(' ')).toContain('skills-map');
    expect(scope.warnings.join(' ')).toContain('بلا فلترة فترات');
    expect(validateBlueprint(buildBlueprint({ level: 'year4', subject: 'anisi', trimester: 1 })).valid).toBe(true);
  });

  it('أُشكال skills-map الثلاثة تُقرأ: {} ومتّحدة وفصول (§55)', () => {
    // شكلا المحتوى الفعلي: { lessons: {…} } و { chapters: { ch1… } } وخريطة مسطّحة { y3m01… }.
    // قراءة `sm.lessons` وحده كانت تترك الرياضيات في سنوات 3-6 والعلوم في 2-3-6 بلا أهداف.
    const math3 = getScope({ level: 'year3', subject: 'math' });
    expect(math3.lessons[0].objectives.length, 'أهداف ريا year3').toBeGreaterThan(0);
    expect(math3.lessons[0].competencies.length, 'كفايات ريا year3').toBeGreaterThan(0);
    expect(getScope({ level: 'year6', subject: 'math' }).lessons[0].objectives.length).toBeGreaterThan(0);
    // العلوم بلا ملف دروس ← النطاق من فصول skills-map مع تنبيه صريح
    const sci3 = getScope({ level: 'year3', subject: 'science' });
    expect(sci3.available).toBe(true);
    expect(sci3.objectives.length).toBeGreaterThan(0);
    expect(sci3.warnings.join(' ')).toContain('بلا فلترة فترات');
    // ملف بغلّافه لا يُقرأ مرتين ولا يُدخل مفاتيح meta
    const anisi4 = getScope({ level: 'year4', subject: 'anisi' });
    expect(anisi4.lessons.every((l) => l.id !== '_meta')).toBe(true);
  });

  it('resolveGradeId يفهم الرموز والنص العربي والرقم', () => {
    expect(resolveGradeId('year3')).toBe('year3');
    expect(resolveGradeId('السنة الثالثة')).toBe('year3');
    expect(resolveGradeId('3')).toBe('year3');
    expect(resolveGradeId('مستوى غريب')).toBeNull();
    expect(resolveGradeId('')).toBeNull();
  });

  it('الثلاثي t يقابل الفترتين {2t−1, 2t} (6 فترات/سنة)', () => {
    expect(trimesterPeriods(1)).toEqual([1, 2]);
    expect(trimesterPeriods(2)).toEqual([3, 4]);
    expect(trimesterPeriods(3)).toEqual([5, 6]);
    expect(trimesterPeriods(0)).toBeNull();
    expect(trimesterPeriods(4)).toBeNull();
  });

  it('نطاق أي ثلاثي لا يُدخل دروسًا خارج فتراته (§57)', () => {
    for (const [g, s] of [['year1', 'math'], ['year3', 'math'], ['year6', 'math']]) {
      expect(getScope({ level: g, subject: s }).hasPeriodInfo, `${g}/${s} فترات`).toBe(true);
      for (const t of [1, 2, 3]) {
        const periods = trimesterPeriods(t);
        const { lessons } = scopeLessonsForTrimester({ level: g, subject: s, trimester: t });
        expect(lessons.length, `${g}/${s} ثلاثي ${t}`).toBeGreaterThan(0);
        for (const l of lessons) {
          if (l.period) expect(periods, `${g}/${s} درس ${l.title}`).toContain(l.period);
        }
      }
    }
  });

  it('الحارس: درس داخل النطاق → ok ومعرّف مطابق', () => {
    const l = lessonFixture('year3', 'math', 1);
    const g = guardCurriculum({ level: 'year3', subject: 'math', trimester: 1, lessonTitle: l.title });
    expect(g.status).toBe('ok');
    expect(g.matchedLessonId).toBe(l.id);
  });

  it('الحارس: بلا مكتسب ولا هدف ولا درس → unknown لا رفض (§55 لا تخمن)', () => {
    expect(guardCurriculum({ level: 'year1', subject: 'math', trimester: 1 }).status).toBe('unknown');
  });

  it('الحارس: محتوى ليس من المنهج → out برسالة محدّدة (§56)', () => {
    const g = guardCurriculum({ level: 'year3', subject: 'math', trimester: 1, competency: 'الجاذبية الأرضية وقوانين نيوتن' });
    expect(g.status).toBe('out');
    expect(g.reason).toBeTruthy();
  });

  it('تسمية المادة مركزية: لا «arabic» في أي نص ظاهر (§78)', () => {
    expect(subjectLabel('arabic')).toBe('اللغة العربية');
    expect(subjectLabel('math')).toBe('الرياضيات');
    expect(subjectLabel('MATH')).toBe('الرياضيات');
    expect(subjectLabel('')).toBe('');
  });
});

/* ══════════════════════════════════════════════════════════════════
   2) المخطّط قبل أي توليد (§1,§10,§51,§58)
   ══════════════════════════════════════════════════════════════════ */
describe('المخطّط: لا سؤال يُخلَق قبل قبوله', () => {
  it('مخطّط صالح لسنة 3 / عربية / ثلاثي 1 ونطاق حقيقي', () => {
    const bp = blueprintOf();
    expect(bp.grade).toBe('year3');
    expect(bp.gradeLabel).toBe('السنة الثالثة');
    expect(bp.subjectLabel).toBe('اللغة العربية');
    expect(bp.scopeLessonIds.length).toBeGreaterThan(0);
    const v = validateBlueprint(bp);
    expect(v.valid).toBe(true);
    expect(v.issues.filter((i) => i.severity === 'error')).toHaveLength(0);
  });

  it('مجموع خارج 10/15/20 → رفض (§7)', () => {
    const v = validateBlueprint({ ...blueprintOf(), targetPoints: 17 });
    expect(v.valid).toBe(false);
    expect(v.issues.map((i) => i.code)).toContain('BP_TARGET');
  });

  it('بلا ثلاثي ← لا توليد (§57)', () => {
    const bp = buildBlueprint({ level: LEVEL, subject: SUBJECT, trimester: 9 });
    expect(bp.trimester).toBeNull();
    expect(validateBlueprint(bp).issues.map((i) => i.code)).toContain('BP_TERM');
  });

  it('بلا مادة أو سنة ← رفض محدّد لا عام', () => {
    const v = validateBlueprint(buildBlueprint({ trimester: 1 }));
    const codes = v.issues.map((i) => i.code);
    expect(codes).toContain('BP_GRADE');
    expect(codes).toContain('BP_SUBJECT');
  });

  it('درس غير موجود ← تحذير صريح مع بقاء النطاق كاملاً (لا تضييق صامت §58)', () => {
    const narrowed = buildBlueprint({ level: 'year3', subject: 'math', trimester: 1, lessonTitle: 'درس غير موجود إطلاقا' });
    expect(narrowed.warnings.join(' ')).toContain('غير موجود في نطاق هذا الثلاثي');
    const full = buildBlueprint({ level: 'year3', subject: 'math', trimester: 1 });
    expect(narrowed.scopeLessonIds.length).toBe(full.scopeLessonIds.length);
  });

  it('المدة والعدد مقيّدان: [5..120] و1..20', () => {
    expect(buildBlueprint({ level: 'year3', subject: 'math', trimester: 1, durationMinutes: 3 }).durationMinutes).toBe(5);
    expect(buildBlueprint({ level: 'year3', subject: 'math', trimester: 1, durationMinutes: 999 }).durationMinutes).toBe(120);
    expect(buildBlueprint({ level: 'year3', subject: 'math', trimester: 1, questionCount: 99 }).questionCount).toBe(20);
    expect(buildBlueprint({ level: 'year3', subject: 'math', trimester: 1, questionCount: -5 }).questionCount).toBe(1);
    // بلا مدة صريحة: 8 أسئلة × 2.5 د (القيمة الفارغة لا تصير 5 د)
    expect(buildBlueprint({ level: 'year3', subject: 'math', trimester: 1 }).durationMinutes).toBe(20);
  });

  it('خيارات النطاق تعود مجمّعة في وحدات مع فترات الثلاثي (§58,§62)', () => {
    const o = blueprintScopeOptions({ level: 'year3', subject: 'math', trimester: 1 });
    expect(o.units.length).toBeGreaterThan(0);
    expect(o.units[0].lessons.length).toBeGreaterThan(0);
    expect(o.trimesterPeriods).toEqual([1, 2]);
  });

  it('تركيز كلي على مكتسب واحد → تحذير لا صمت (§9)', () => {
    const c = analyzeCoverage(rawQuestions(), { grade: LEVEL, durationMinutes: 20 });
    expect(c.warnings.map((w) => w.code)).toContain('COV_CONCENTRATED');
  });
});

/* ══════════════════════════════════════════════════════════════════
   3) عقد السؤال والتحقق الفردي (§26,§28,§31,§39,§41,§50,§123,§124)
   ══════════════════════════════════════════════════════════════════ */
describe('مدقّق السؤال الفردي', () => {
  const base = () => ({ ...rawQuestions()[0] });

  it('سؤال اختيار سليم داخل النطاق بلا أخطاء', () => {
    const r = validateQuestion(base());
    expect(r.valid).toBe(true);
    expect(r.issues.filter((i) => i.severity === 'error')).toHaveLength(0);
  });

  it('الإجابة ليست ضمن البدائل → REJECT (§26)', () => {
    const r = validateQuestion({ ...base(), correctAnswer: '999' });
    expect(r.valid).toBe(false);
    expect(r.issues.map((i) => i.code)).toContain('ANSWER_NOT_OPTION');
  });

  it('خياران يتطابقان بعد التطبيع = أكثر من إجابة صحيحة → REJECT (§26,§91)', () => {
    const r = validateQuestion({ ...base(), options: ['صواب', 'صَوَاب', 'خطأ'], correctAnswer: 'صواب' });
    const codes = r.issues.map((i) => i.code);
    expect(codes).toContain('MULTIPLE_CORRECT');
    expect(codes).toContain('OPTIONS_DUPLICATE');
    expect(r.valid).toBe(false);
  });

  it('الإجابة مكتوبة داخل السؤال → REJECT (§28)', () => {
    const r = validateQuestion({ ...base(), prompt: 'العاصمة هي تونس ؟', options: ['تونس', 'بنزرت'], correctAnswer: 'تونس' });
    expect(r.valid).toBe(false);
    expect(r.issues.map((i) => i.code)).toContain('ANSWER_LEAKED');
  });

  it('صح/خطأ بجواب ليس «صواب» ولا «خطأ» → REJECT (§27)', () => {
    const r = validateQuestion({ ...rawQuestions()[2], correctAnswer: 'نعم' });
    expect(r.issues.map((i) => i.code)).toContain('TF_ANSWER');
    expect(r.valid).toBe(false);
  });

  it('سؤال بلا هدف تعليمي لا يدخل الاختبار (§123)', () => {
    const hard = validateQuestion({ ...base(), objective: '' });
    expect(hard.valid).toBe(false);
    expect(hard.issues.map((i) => i.code)).toContain('OBJECTIVE_MISSING');
    const soft = validateQuestion({ ...base(), objective: '' }, { requireObjective: false });
    expect(soft.valid).toBe(true);
    expect(soft.issues.map((i) => i.code)).toContain('OBJECTIVE_MISSING');
  });

  it('نقاط غير موجبة → خطأ، وبخطوة غير 0.5 → تنبيه (§46)', () => {
    expect(validateQuestion({ ...base(), points: 0 }).issues.map((i) => i.code)).toContain('POINTS_INVALID');
    const stepped = validateQuestion({ ...base(), points: 1.3 });
    expect(stepped.issues.map((i) => i.code)).toContain('POINTS_STEP');
    expect(stepped.valid).toBe(true);
  });

  it('لغة تقنية على السنة الصغرى → REJECT (§39,§41)', () => {
    const r = validateQuestion(
      { ...base(), grade: 'year1', prompt: 'حلّل البنية الصرفية للجملة الآتية بدقة.' },
      { runGuard: false }
    );
    expect(r.valid).toBe(false);
    expect(r.issues.map((i) => i.code)).toContain('TECHNICAL_LANGUAGE');
  });

  it('سؤال طويل جدا على السنة الأولى → REJECT (§39)', () => {
    const r = validateQuestion({ ...base(), grade: 'year1', prompt: 'س'.repeat(320) }, { runGuard: false });
    expect(r.issues.map((i) => i.code)).toContain('PROMPT_TOO_LONG');
    expect(r.valid).toBe(false);
  });

  it('نص مؤقت (placeholder) → REJECT لا يُطبع', () => {
    const r = validateQuestion({ ...base(), prompt: 'السؤال سيظهر هنا' }, { runGuard: false });
    expect(r.issues.map((i) => i.code)).toContain('PLACEHOLDER');
  });

  it('محتوى خارج المنهج → REJECT لا تخمين (§55)', () => {
    const r = validateQuestion({ ...base(), lesson: 'الجاذبية الأرضية', competency: null, objective: null });
    expect(r.valid).toBe(false);
    expect(r.issues.map((i) => i.code)).toContain('OUT_OF_CURRICULUM');
  });

  it('بلا سند كافٍ → تنبيه لا رفض صامت (§55 لا تخمن)', () => {
    const r = validateQuestion({ ...base(), lesson: null, competency: null, objective: null });
    const cur = r.issues.find((i) => i.code === 'CURRICULUM_UNKNOWN');
    expect(cur, 'CURRICULUM_UNKNOWN موجود').toBeTruthy();
    expect(cur.severity).toBe('warn');
  });

  it('أنواع غير قابلة للتوليد محصورة (§31): لا MATCHING ولا ORDERING', () => {
    expect(GENERATABLE_TYPES).toEqual(['MCQ', 'TRUE_FALSE', 'FILL_BLANK', 'EXTRACT', 'ORDER', 'OPEN']);
    expect(GENERATABLE_TYPES).not.toContain('MATCHING');
    expect(GENERATABLE_TYPES).not.toContain('ORDERING');
    const r = validateQuestion({ ...base(), type: 'MATCHING' });
    expect(r.issues.map((i) => i.code)).toContain('TYPE_UNKNOWN');
    expect(r.valid).toBe(false);
  });

  it('سؤال ترتيب بلا عنصرين → REJECT', () => {
    const r = validateQuestion({ ...rawQuestions()[5], orderItems: ['وحيد'] });
    expect(r.issues.map((i) => i.code)).toContain('ORDER_FEW');
  });
});

/* ══════════════════════════════════════════════════════════════════
   4) التنقيط (§7,§8,§46) + التكرار (§53,§110) + الإجابات (§48,§52)
   ══════════════════════════════════════════════════════════════════ */
describe('محرّك النقاط: Σ = الهدف بالضبط', () => {
  it('توزيع على كل هدف 10/15/20 يحترم خطوة 0.5 والحد الأدنى 0.5', () => {
    const types = ['MCQ', 'MCQ', 'TRUE_FALSE', 'FILL_BLANK', 'EXTRACT', 'ORDER', 'OPEN', 'MCQ'];
    for (const t of TARGET_POINTS) {
      const r = distributePoints(types.map((type) => ({ type, points: 0 })), t);
      expect(verifyTotal(r.questions, t), `الهدف ${t}`).toMatchObject({ ok: true, total: t });
      expect(r.questions.every((q) => q.points >= 0.5)).toBe(true);
      expect(r.questions.every((q) => Math.round(q.points * 2) / 2 === q.points)).toBe(true);
    }
  });

  it('verifyTotal يكشف الانحراف (§7: لا 12/20 ولا مجموع 17.5)', () => {
    const v = verifyTotal([{ points: 2 }], 20);
    expect(v.ok).toBe(false);
    expect(v.total).toBe(2);
    expect(v.drift).toBe(-18);
  });

  it('totalPoints يجمع ويقرّب لخطوة 0.5', () => {
    expect(totalPoints([{ points: 1.4 }, { points: 1.4 }])).toBe(3);
    expect(totalPoints([])).toBe(0);
  });

  it('مصفوفة المعايير تُحرَّق لتجمع إلى الهدف نفسه (§46)', () => {
    for (const t of TARGET_POINTS) {
      const grid = criteriaFor('arabic', t);
      const sum = grid.reduce((s, c) => s + (Number(c.mastery?.max) || 0), 0);
      expect(sum, `معايير ${t}`).toBe(t);
      expect(grid.length).toBeGreaterThan(0);
    }
  });
});

describe('كاشف التكرار', () => {
  it('النص نفسه → تكرار صلب (REJECT عند التدقيق)', () => {
    const d = findDuplicates([{ prompt: 'الأرض كوكب جميل جدا' }, { prompt: 'الأرض كوكب جميل جدا' }]);
    expect(d).toHaveLength(1);
    expect(d[0].level).toBe('duplicate');
  });

  it('نصوص أسئلة مختلفة → لا تكرار ولا تنبيه', () => {
    expect(findDuplicates(rawQuestions())).toHaveLength(0);
  });

  it('سؤالا «أكمل» مختلفان ليسا تكرارًا — رمز واحد لا يكفي للحكم (§2)', () => {
    const d = findDuplicates([
      { prompt: 'أكمل: 5 م = .... سم' },
      { prompt: 'أكمل: 96 − 47 = ....' }
    ]);
    expect(d).toHaveLength(0);
    // النص نفسه بعد التطبيع يبقى تكرارًا مؤكدًا حتى لو كان قصيرًا
    expect(similarity('أكمل: 5 م = .... سم', 'أكمل:  5 م = .... سم')).toBe(1);
  });

  it('التشابه بعد التطبيع العربي = 1 للنص نفسه', () => {
    expect(similarity('القراءة الجهْرية', 'القراءة الجهرية')).toBe(1);
    expect(similarity('الأرض كوكب', 'الشمس نجم')).toBeLessThan(0.6);
  });
});

describe('محرّق الإجابات: تطبيع عربي لا مطابقة خام', () => {
  it('التشكيل والهمزات لا تُغيّر الحكم (§48)', () => {
    expect(verifyAnswer({ type: 'FILL_BLANK', correctAnswer: 'مَدِينَة' }, 'مدينة').valid).toBe(true);
    expect(verifyAnswer({ type: 'MCQ', correctAnswer: 'الرَّحْمَن' }, 'الرحمن').valid).toBe(true);
    expect(verifyAnswer({ type: 'FILL_BLANK', correctAnswer: 'مَدِينَة' }, 'قرية').valid).toBe(false);
  });

  it('كل الصيغ في acceptedAnswers مقبولة', () => {
    const q = { type: 'FILL_BLANK', correctAnswer: 'المدرسة', acceptedAnswers: ['مدرسة', 'المعهد'] };
    expect(verifyAnswer(q, 'المعهد').valid).toBe(true);
    expect(verifyAnswer(q, 'المدرسة').valid).toBe(true);
    expect(verifyAnswer(q, 'الثانوية').valid).toBe(false);
  });

  it('لا إجابة → غير صحيحة (لا اعتماد صامت)', () => {
    expect(verifyAnswer({ type: 'MCQ', correctAnswer: 'أ' }, '').valid).toBe(false);
    expect(verifyAnswer({ type: 'MCQ', correctAnswer: 'أ' }, null).valid).toBe(false);
  });

  it('الإجابة المفتوحة لا تُحسم آليًا — تصحيح يدوي (§47)', () => {
    const r = verifyAnswer({ type: 'OPEN', correctAnswer: 'النموذج' }, 'إجابة التلميذ مختلف تماما');
    expect(r.valid).toBeNull();
    expect(r.issues).toContain('OPEN_REQUIRES_MANUAL');
  });

  it('الترتيب يُقارن بالسلسلة كاملة', () => {
    const q = { type: 'ORDER', orderItems: ['أول', 'ثاني', 'ثالث'] };
    expect(verifyAnswer(q, ['أول', 'ثاني', 'ثالث']).valid).toBe(true);
    expect(verifyAnswer(q, ['ثالث', 'ثاني', 'أول']).valid).toBe(false);
  });
});

/* ══════════════════════════════════════════════════════════════════
   5) خط أنابيب التدقيق + التقرير الصادق + عقد النشر (§49,§66,§106,§125,§126)
   ══════════════════════════════════════════════════════════════════ */
describe('تدقيق الاختبار الكامل والتقرير', () => {
  it('اختبار نظيف → معتمد للمراجعة فقط «needs_review» لا نشر مباشر (§61)', () => {
    const bp = blueprintOf();
    const res = validateExam({ blueprint: bp, questions: rawQuestions(), durationMinutes: bp.durationMinutes });
    expect(res.issues.filter((i) => i.severity === 'error')).toHaveLength(0);
    expect(res.approved).toBe(true);
    expect(res.status).toBe('needs_review');
    expect(res.status).not.toBe('published');
    expect(totalPoints(res.questions)).toBe(20);
    expect(res.audit.find((a) => a.id === 'points').status).toBe('pass');
    expect(res.audit.find((a) => a.id === 'scope').status).toBe('pass');
    expect(res.audit.find((a) => a.id === 'review').status).toBe('warn');
    expect(res.report.some((l) => l.startsWith('✓'))).toBe(true);
  });

  it('نقاط غير مطابقة → تُعيد توزيع آليًّا للهدف ثم pass (§7)', () => {
    const bp = blueprintOf();
    const cheap = rawQuestions().map((q) => ({ ...q, points: 1 }));
    const res = validateExam({ blueprint: bp, questions: cheap, durationMinutes: bp.durationMinutes });
    expect(verifyTotal(res.questions, 20).ok).toBe(true);
    expect(res.issues.some((i) => i.code === 'POINTS_REDISTRIBUTED' && i.severity === 'warn')).toBe(true);
    expect(res.audit.find((a) => a.id === 'points').status).toBe('pass');
  });

  it('اختبار بلا أسئلة → REJECT محدّد لا «نجاح»', () => {
    const res = validateExam({ blueprint: blueprintOf(), questions: [] });
    expect(res.approved).toBe(false);
    expect(res.status).toBe('rejected');
    expect(res.issues.map((i) => i.code)).toContain('NO_QUESTIONS');
  });

  it('تكرار حرفی → REJECT (§53)', () => {
    const bp = blueprintOf();
    const qs = [...rawQuestions(), { ...rawQuestions()[0], id: 'qX' }];
    const res = validateExam({ blueprint: bp, questions: qs, durationMinutes: bp.durationMinutes });
    expect(res.approved).toBe(false);
    expect(res.issues.some((i) => i.code === 'DUPLICATE' && i.severity === 'error')).toBe(true);
    expect(res.report.join('\n')).toContain('✗');
  });

  it('سؤال خارج نطاق المخطّط المعلن → REJECT (§57)', () => {
    const bp = { ...blueprintOf(), scopeLessonIds: ['y3m01'], scopeLessons: [{ id: 'y3m01', title: 'درس واحد معلن' }] };
    const qs = rawQuestions().map((q, i) => (i === 0 ? { ...q, lesson: 'درس آخر غير موجود هنا', competency: null, domain: null } : q));
    const res = validateExam({ blueprint: bp, questions: qs, durationMinutes: bp.durationMinutes });
    expect(res.approved).toBe(false);
    expect(res.issues.some((i) => i.code === 'OUT_OF_SCOPE')).toBe(true);
  });

  it('التقرير يحمل ✓/⚠/✗ ولا يقول «تم إنشاء الاختبار بنجاح» (§66,§126)', () => {
    const bp = blueprintOf();
    const res = validateExam({ blueprint: bp, questions: badQuestions(), durationMinutes: bp.durationMinutes });
    expect(res.approved).toBe(false);
    expect(res.status).toBe('rejected');
    const lines = res.report.join('\n');
    expect(lines).toContain('✗');
    expect(lines).not.toContain('تم إنشاء الاختبار بنجاح');
    expect(auditReportLines([
      { id: 'a', label: 'فحص', status: 'pass' },
      { id: 'b', label: 'خطر', status: 'warn' },
      { id: 'c', label: 'فشل', status: 'fail' }
    ])).toEqual(['✓ فحص', '⚠ خطر', '✗ فشل']);
  });

  /* — نقاء المادة (§55,§79): «اختبار العربية محتواه عربي» — */
  it('محتوى حسابي في اختبار لغة → REJECT «خلط المواد» (§55,§79)', () => {
    const bp = blueprintOf();
    const qs = rawQuestions().map((q, i) => (i === 0
      ? { ...q, prompt: 'ما مجموع 120 و 45 ؟', options: ['165', '175', '155'], correctAnswer: '165' }
      : q));
    const res = validateExam({ blueprint: bp, questions: qs, durationMinutes: bp.durationMinutes });
    expect(res.approved).toBe(false);
    expect(res.issues.some((i) => i.code === 'SUBJECT_MIX' && i.severity === 'error')).toBe(true);
    expect(res.audit.find((a) => a.id === 'subject').status).toBe('fail');
  });

  it('سند بوضعية حسابية في اختبار لغة → REJECT (§55)', () => {
    const bp = blueprintOf();
    const res = validateExam({
      blueprint: bp,
      questions: rawQuestions(),
      stimuli: [{ id: 's1', title: 'السند 1', text: 'احسب المجموع 12 + 8 ثم اكتب الناتج في دفترك.' }],
      stimulusRequired: true,
      durationMinutes: bp.durationMinutes
    });
    expect(res.approved).toBe(false);
    expect(res.issues.some((i) => i.code === 'SUBJECT_MIX')).toBe(true);
  });

  it('سؤال يحمل رمز مادة أخرى من مادة المخطّط → REJECT SUBJECT_MISMATCH (§55)', () => {
    const bp = blueprintOf();
    const qs = rawQuestions().map((q, i) => (i === 1 ? { ...q, subject: 'math' } : q));
    const res = validateExam({ blueprint: bp, questions: qs, durationMinutes: bp.durationMinutes });
    expect(res.approved).toBe(false);
    expect(res.issues.some((i) => i.code === 'SUBJECT_MISMATCH' && i.severity === 'error')).toBe(true);
  });

  it('اختبار رياضيات يقبل المحتوى الحسابي — لا رفض ظالم (§79)', () => {
    const bp = blueprintOf({ subject: 'math' });
    const l = lessonFixture(LEVEL, 'math', TERM);
    const q = {
      id: 'q1', grade: LEVEL, subject: 'math', term: TERM,
      lesson: l.title, competency: l.competencies[0] || l.title, objective: l.objectives[0] || l.title,
      domain: l.domain || null, type: 'MCQ', difficulty: 2, points: 2, estimatedTime: 2,
      prompt: 'ما مجموع 120 و 45 ؟', options: ['165', '175', '155'], correctAnswer: '165'
    };
    const res = validateExam({ blueprint: bp, questions: [q], durationMinutes: bp.durationMinutes });
    expect(res.issues.some((i) => i.code === 'SUBJECT_MIX')).toBe(false);
    expect(res.audit.find((a) => a.id === 'subject').status).toBe('pass');
  });
});

describe('عقد النشر §125', () => {
  const bp = blueprintOf();
  const good = () => validateExam({ blueprint: bp, questions: rawQuestions() }).questions;

  it('اختبار مكتمل وسليم قابل للنشر', () => {
    const r = assertPublishable({ blueprint: bp, questions: good() });
    expect(r.ok).toBe(true);
    expect(r.missing).toEqual([]);
  });

  it('سؤال ترتيب بـorderItems صحيح يُنشر بلا correctAnswer (§125)', () => {
    const r = assertPublishable({ blueprint: bp, questions: good() });
    expect(r.missing).not.toContain('answers');
  });

  it('اختبار بلا مخطّط → حقول ناقصة (لا نشر بلا سند)', () => {
    const r = assertPublishable({ questions: good() });
    expect(r.ok).toBe(false);
    expect(r.missing).toContain('grade');
    expect(r.missing).toContain('subject');
    expect(r.missing).toContain('term');
  });

  it('اختيار بلا إجابة → answers ناقصة', () => {
    const qs = good().map((q, i) => (i === 0 ? { ...q, correctAnswer: '' } : q));
    expect(assertPublishable({ blueprint: bp, questions: qs }).missing).toContain('answers');
  });

  it('مجموع ≠ الهدف → pointsTotal ناقصة', () => {
    const qs = good().map((q) => ({ ...q, points: 1 }));
    expect(assertPublishable({ blueprint: bp, questions: qs }).missing).toContain('pointsTotal');
  });

  it('سؤال بلا نص → prompt ناقصة', () => {
    const qs = good().map((q, i) => (i === 0 ? { ...q, prompt: '' } : q));
    expect(assertPublishable({ blueprint: bp, questions: qs }).missing).toContain('prompt');
  });
});

/* ══════════════════════════════════════════════════════════════════
   6) المولّد: قراءة المخرج وتطبيقه على المخطّط (§1,§31,§76,§89)
   ══════════════════════════════════════════════════════════════════ */
describe('مولّد الاختبار', () => {
  it('يقرأ JSON كاملًا أو مصفوفة داخل نص أو كائن questions — ويرفض النص الحر', () => {
    expect(parseGeneratedPayload('[{"prompt":"أ"}]')).toHaveLength(1);
    expect(parseGeneratedPayload('هنا الشرح قبل الإخراج\n[{"prompt":"أ"},{"prompt":"ب"}]')).toHaveLength(2);
    expect(parseGeneratedPayload('{"questions":[{"prompt":"أ"}]}')).toHaveLength(1);
    expect(parseGeneratedPayload('لا يوجد أي JSON هنا')).toBeNull();
    expect(parseGeneratedPayload('')).toBeNull();
    expect(parseGeneratedPayload(null)).toBeNull();
  });

  it('يُطبِّع المخرج إلى عقد السؤال §76 ويرفض ما بلا نص', () => {
    const out = normalizeGeneratedQuestions([
      { prompt: 'سؤال', type: 'MCQ', options: ['أ', 'ب', 'ج'], correctAnswer: 1, points: 2 },
      { type: 'MCQ', options: ['أ', 'ب'] },
      { prompt: 'مطابقة', type: 'MATCHING' }
    ], { grade: 'year3', subject: 'math', trimester: 1 });

    expect(out).toHaveLength(2); // السؤال بلا نص يُهمل
    expect(out[0].correctAnswer).toBe('ب'); // الرقم يتحول إلى متن الاختيار
    expect(out[0].correct).toBe('ب');       // gradeOfficialExam يقرأ correct
    expect(out[0].grade).toBe('year3');
    expect(out[0].term).toBe(1);

    // النوع غير القابل للتوليد يسقط على MCQ ثم يُرفض لغياب البدائل — لا قبول صامت
    expect(out[1].type).toBe('MCQ');
    expect(validateQuestion(out[1], { runGuard: false }).valid).toBe(false);
  });

  it('برومبت التوليد يحمل المخطّط وتسمية المادة لا الرمز (§1,§78)', () => {
    const bp = buildBlueprint({ level: LEVEL, subject: SUBJECT, trimester: TERM, questionCount: 6, targetPoints: 15, durationMinutes: 30 });
    const p = buildExamPrompt(bp, {});
    expect(p.user).toContain('اللغة العربية');
    expect(p.user).not.toContain('arabic');
    expect(p.user).toContain('15 نقطة');
    expect(p.user).toContain('6');
    expect(p.user).toContain('دروس ونطاق المنهج الرسمي');
    expect(p.maxTokens).toBeGreaterThan(0);
  });

  it('برومبت المادة غير الكمّية يمنع السند الحسابي والخلط (§55,§79)', () => {
    const arabic = buildExamPrompt(buildBlueprint({ level: LEVEL, subject: 'arabic', trimester: TERM, questionCount: 6, targetPoints: 15 }), {});
    expect(arabic.user).not.toContain('مشهد موصوف بالأرقام'); // القاعدة القديمة كانت تسرّب الحساب
    expect(arabic.user).toContain('لا وضعية عددية ولا عملية حسابية');
    expect(arabic.user).toContain('لا تخلطه بأسئلة حساب');
    const math = buildExamPrompt(buildBlueprint({ level: LEVEL, subject: 'math', trimester: TERM, questionCount: 6, targetPoints: 15 }), {});
    expect(math.user).toContain('وضعية عددية');
    expect(math.user).toContain('عملية حسابية على أرقامه');
  });

  it('إعادة المحاولة تمرّر سبب الرفض للموديل (تغذية راجعة §49)', () => {
    const bp = blueprintOf();
    const fb = buildExamPrompt(bp, { previousIssues: 'الإجابة ليست ضمن البدائل' });
    expect(fb.user).toContain('إخراجك السابق رُفض');
    expect(fb.user).toContain('الإجابة ليست ضمن البدائل');
  });

  it('برومبت رياضيات y3+ يعلن قواعد المدقّق الموسّع: ترتيب/كشف/D5/D12 (§D5,§D11,§D12)', () => {
    const bp = buildBlueprint({ level: 'year4', subject: 'math', trimester: TERM, questionCount: 8, targetPoints: 20 });
    bp.scopeLessons = [{ title: 'الأعداد والنقود', competencies: ['يدخر مبلغًا', 'يشتري بثمنًا'] }];
    const p = buildExamPrompt(bp, {});
    expect(p.user).toContain('orderItems'); // سؤال الترتيب بلا عناصر يُرفض — يُقال له
    expect(p.user).toContain('correctAnswer');
    expect(p.user).toContain('§D11'); // لا يكشف سؤال لاحق إجابة سؤال سابق
    expect(p.user).toContain('§D5'); // سنّان مترابطان
    expect(p.user).toContain('§D12'); // مساحة العملية العمودية
    expect(p.user).toContain('§B3-نقود'); // وضعية نقود فعلية حين في التعلمات
  });

  it('برومبت غير مشدّد لا يُلقِّم قواعد لا يفحصها المدقّق (لا §D5/§B3 للغة)', () => {
    const arabic = buildExamPrompt(buildBlueprint({ level: LEVEL, subject: 'arabic', trimester: TERM, questionCount: 6, targetPoints: 15 }), {});
    expect(arabic.user).toContain('orderItems'); // قاعدة عامة (ORDER مسموح في كل المواد)
    expect(arabic.user).not.toContain('§D5');
    expect(arabic.user).not.toContain('§B3-نقود');
    expect(arabic.user).not.toContain('§D12');
  });
});

/* ══════════════════════════════════════════════════════════════════
   6ب) تقرير المعلّم الموجز — يقرأه معلّم لا مدقّق (§126)
   ══════════════════════════════════════════════════════════════════ */
describe('تقرير المعلّم الموجز:3 أسطر لا جدار رموز', () => {
  const passRow = { id: 'blueprint', label: 'المخطّط مكتمل (سنة/مادة/ثلاثي/عدد/مجموع)', status: 'pass', detail: '' };
  const warnRow = { id: 'review', label: 'حالة المراجعة (التوليد الآلي لا يُنشر مباشرة)', status: 'warn', detail: 'يحتاج مراجعة' };

  it('ورقة بلا ملاحظات → نتيجة ✓ + «نجح الفحص في N وجهًا» بلا رموز §', () => {
    const lines = teacherReportLines([passRow, warnRow], []);
    expect(lines[0]).toContain('✓ جاهز للاعتماد');
    expect(lines.join('\n')).toContain('نجح الفحص في 1 وجهًا');
    expect(lines.join('\n')).not.toContain('§');
  });

  it('ورقة مرفوضة → نتيجة ✗ + عدّ الأخطاء + أخطاء مقروءة بلا (§42,§158)', () => {
    const audit = [
      passRow,
      { id: 'grounding', label: 'ارتباط الأسئلة بالسند (لا سؤال يتيم §7)', status: 'fail', detail: 'السؤال 1: 4000 ليست في السند (§42,§158)' }
    ];
    const issues = [{ severity: 'error', message: 'السؤال 1: 4000 ليست في السند ولا ناتجة عنه (§42,§158)' }];
    const lines = teacherReportLines(audit, issues);
    expect(lines[0]).toContain('✗ غير جاهز للاعتماد');
    expect(lines[0]).toContain('1 خطأ');
    expect(lines[1]).toContain('السؤال 1: 4000 ليست في السند');
    expect(lines.join('\n')).not.toContain('§');
    expect(lines.join('\n')).toContain('نجح الفحص في');
  });

  it('كثرة الملاحظات → حدّ8 + سطر «ملاحظات أخرى» لا جدار طويل', () => {
    const issues = Array.from({ length: 12 }, (_, i) => ({ severity: 'error', message: `ملاحظة ${i + 1}` }));
    const lines = teacherReportLines([], issues);
    expect(lines.length).toBeLessThanOrEqual(10); // نتيجة + 8 + «و… أخريات»
    expect(lines.join('\n')).toContain('ملاحظات أخرى');
    expect(lines.join('\n')).toContain('ملاحظة 8');
    expect(lines.join('\n')).not.toContain('ملاحظة 9');
  });
});

/* ══════════════════════════════════════════════════════════════════
   7) المسار الحيّ: التوليد + بوابة النشر + النسخة التلميذية
   ══════════════════════════════════════════════════════════════════ */
describe('المسار الحيّ: /teacher/exams/generate-ai وبوابة النشر', () => {
  let app;
  let teacherToken;
  let studentToken;
  let cleanExamId;
  let dirtyExamId;
  let bankBefore;

  beforeAll(async () => {
    ({ app } = await import('../src/index.js'));
    await resetDatabase();
    await seedTestData();
    teacherToken = (await login('teacher@test.tn', 'teacher123')).body.token;
    studentToken = (await login('student@test.tn', 'student123')).body.token;
    await savePlatformAiKey(1, 'exam-engine-test-platform-key');
    bankBefore = fs.readFileSync(BANK_FILE, 'utf8');
  });

  afterAll(() => __resetCallProvider());
  afterEach(() => __resetCallProvider());

  const generate = (body) => request(app)
    .post('/api/teacher/exams/generate-ai')
    .set(authHeader(teacherToken))
    .send(body);

  it('توليد سليم → 201 + needs_review + سند حقيقي مرتبط بكل سؤال (§1,§7,§61,§126)', async () => {
    __setCallProvider(async () => JSON.stringify(rawExam()));
    const res = await generate({
      subject: SUBJECT, level: LEVEL, trimester: TERM, count: 8, targetPoints: 20,
      classId: 1, durationMinutes: 40, title: 'اختبار بالذكاء الاصطناعي — تجريبي'
    });

    expect(res.status).toBe(201);
    expect(res.body.valid).toBe(true);
    expect(res.body.status).toBe('needs_review');
    expect(res.body.message).toContain('ينتظر مراجعتك واعتمادك');
    expect(res.body.message).not.toContain('بنجاح');
    expect(res.body.savedToBank).toBe(true);
    expect(res.body.issues.filter((i) => i.severity === 'error')).toHaveLength(0);

    const content = res.body.content;
    expect(content.status).toBe('needs_review');
    expect(content.source).toBe('ai-generated');
    expect(content.header, 'لا ترويسة وزارة التربية لاختبار غير رسمي (§4)').toBe('');
    expect(content.subjectLabel).toBe('اللغة العربية');
    expect(content.blueprint.grade).toBe('year3');
    expect(content.report.join('\n')).toContain('✓');
    // تقرير المعلّم الموجز بلا رموز § (يقرأه معلّم) + الفني الكامل محفوظ خلفه (§126)
    expect(res.body.report.join('\n')).not.toContain('§');
    expect(res.body.reportFull.join('\n')).toContain('§');
    expect(totalPoints(content.questions)).toBe(20);
    expect(content.questions.every((q) => q.criterion)).toBe(true);
    expect(Array.isArray(content.stimuli), 'السند محفوظ في المحتوى (§105)').toBe(true);
    expect(content.stimuli.length, 'اختبار سنّدي بلا سند = رفض (§18)').toBeGreaterThan(0);
    expect(content.stimulusRequired).toBe(true);
    expect(content.passages.length, 'نسخة passages للتوافق').toBeGreaterThan(0);
    expect(content.questions.every((q) => q.sindId), 'كل سؤال مرتبط بسندته (§7)').toBe(true);
    expect(res.body.title, 'لا «بالذكاء الاصطناعي» في عنوان يراه التلميذ (§5)').not.toContain('بالذكاء الاصطناعي');

    cleanExamId = res.body.id;
  });

  it('التوليد لا يكتب في ملف البنك المُرحَّد (حماية محتوى git)', () => {
    expect(fs.readFileSync(BANK_FILE, 'utf8')).toBe(bankBefore);
  });

  it('مخرج بلا سند (مصفوفة أسئلة فقط) → 201 صادق: valid:false + رفض «لا سند» (§18,§105)', async () => {
    __setCallProvider(async () => JSON.stringify(rawQuestions()));
    const res = await generate({
      subject: SUBJECT, level: LEVEL, trimester: TERM, count: 4, targetPoints: 10,
      title: 'اختبار بلا سند'
    });
    expect(res.status).toBe(201);
    expect(res.body.valid).toBe(false);
    expect(res.body.status).toBe('generated');
    expect(res.body.issues.some((i) => i.code === 'NO_STIMULUS'), 'رفض صريح لاختبار بلا سند (§18)').toBe(true);
    expect(res.body.message).toMatch(/^يوجد \d+ عناصر تحتاج إلى مراجعة$/);
    expect(res.body.content.stimuli, 'لا ندّعي سندًا غير موجود').toHaveLength(0);
    expect(res.body.savedToBank).toBe(false);
  });

  it('محاولة أولى بلا سند ثم ثانية كاملة → التغذية الراجعة تُصلح والسند يصل (§49)', async () => {
    const prompts = [];
    let calls = 0;
    __setCallProvider(async (prompt) => {
      prompts.push(String(prompt || ''));
      calls += 1;
      return JSON.stringify(calls === 1 ? rawQuestions() : rawExam());
    });
    const res = await generate({
      subject: SUBJECT, level: LEVEL, trimester: TERM, count: 8, targetPoints: 20,
      title: 'اختبار يتعافى بالتغذية الراجعة'
    });
    expect(res.status).toBe(201);
    expect(calls, 'محاولتان: أولى مرفوضة ثم ثانية بعد التغذية الراجعة').toBe(2);
    expect(prompts[1], 'سبب رفض السند يُقال للنموذج صراحةً').toContain('لم تُرجع أي سند صالح');
    expect(res.body.valid).toBe(true);
    expect(res.body.content.stimuli.length).toBeGreaterThan(0);
    expect(res.body.content.passages.length).toBeGreaterThan(0);
  });

  it('حفظ ورقة يدوية تشير إلى «سند» بلا سند → 400 برسالة محدّدة لا حفظ معيب (§7,§18)', async () => {
    const res = await request(app)
      .post('/api/teacher/exams')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({
        title: 'ورقة بلا سند',
        subject: 'math',
        trimester: 1,
        content: { questions: [{ id: 'q1', type: 'OPEN', prompt: 'حسب السند 1 كم عدد الكتب؟', points: 2 }] }
      });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('سند');
    expect(res.body.error).toContain('لا يوجد سند');
  });

  it('حفظ ورقة يدوية بلا إشارة سند → 201 (الحارس لا يعترض المسار السليم)', async () => {
    const res = await request(app)
      .post('/api/teacher/exams')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({
        title: 'ورقة يدوية سليمة',
        subject: 'math',
        trimester: 1,
        content: { questions: [{ id: 'q1', type: 'OPEN', prompt: 'ما مجموع العددين 2 و3 ؟', points: 2 }] }
      });
    expect(res.status).toBe(201);
    expect(res.body.id).toBeTruthy();
  });

  it('مخطّط غير صالح (بلا ثلاثي) → 400 برسالة محدّدة لا 500', async () => {
    const res = await generate({ subject: SUBJECT, level: LEVEL, trimester: 9 });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('الثلاثي');
  });

  it('بلا مادة → 400', async () => {
    const res = await generate({ level: LEVEL, trimester: 1 });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('المادة مطلوبة');
  });

  it('إخراج غير JSON بعد ثلاث محاولات → 502 صادق لا «نجاح» زائف', async () => {
    __setCallProvider(async () => 'هذا نص حر لا يحوي أي مصفوفة أسئلة.');
    const res = await generate({ subject: SUBJECT, level: LEVEL, trimester: TERM, count: 4 });
    expect(res.status).toBe(502);
    expect(res.body.error).toContain('تعذّر توليد صيغة الأسئلة');
  });

  it('فشل المزوّد → 502 صادق', async () => {
    __setCallProvider(async () => { throw new Error('provider down'); });
    const res = await generate({ subject: SUBJECT, level: LEVEL, trimester: TERM, count: 4 });
    expect(res.status).toBe(502);
    expect(res.body.error).toContain('تعذّر الاتصال بمزوّد الذكاء الاصطناعي');
  });

  it('مخرجات معيبة → 201 صادق: حالة generated + عدّ الملاحظات ولا حفظ في البنك (§126)', async () => {
    __setCallProvider(async () => JSON.stringify(badExam()));
    const res = await generate({ subject: SUBJECT, level: LEVEL, trimester: TERM, count: 2, targetPoints: 10 });

    expect(res.status).toBe(201);
    expect(res.body.valid).toBe(false);
    expect(res.body.status).toBe('generated');
    expect(res.body.savedToBank).toBe(false);
    expect(res.body.message).toMatch(/^يوجد \d+ عناصر تحتاج إلى مراجعة$/);
    expect(res.body.issues.some((i) => i.severity === 'error')).toBe(true);
    expect(res.body.content.status).toBe('generated');
    dirtyExamId = res.body.id;
  });

  it('بوابة النشر: اختبار generated لا يُنشر (409 مع السبب) — الذكاء الاصطناعي لا ينشر (§106)', async () => {
    const res = await request(app)
      .put(`/api/teacher/exams/${dirtyExamId}`)
      .set(authHeader(teacherToken))
      .send({ published: true });
    expect(res.status).toBe(409);
    expect(res.body.error).toContain('لا يمكن النشر');
    expect(res.body.error).toContain('generated');
  });

  it('إصلاح المدرس للمحتوى يُعيد الفحص: generated ← needs_review ثم يُنشر (§61 — لا مخرج مسدود)', async () => {
    const before = await request(app).get('/api/teacher/exams').set(authHeader(teacherToken));
    const row = before.body.find((e) => e.id === dirtyExamId);
    expect(row.content.status).toBe('generated');

    const { lessons } = scopeLessonsForTrimester({ level: LEVEL, subject: SUBJECT, trimester: TERM });
    const obj = (n) => (lessons[n] || lessons[0]).objectives[0] || (lessons[n] || lessons[0]).title;
    const fixed = {
      ...row.content,
      questions: [
        { ...row.content.questions[0], correctAnswer: '54', objective: obj(0) },
        { ...row.content.questions[1], prompt: 'كم يوماً في أسبوع ؟', options: ['سبعة', 'ستة', 'خمسة'], correctAnswer: 'سبعة', objective: obj(1) }
      ]
    };
    const put = await request(app)
      .put(`/api/teacher/exams/${dirtyExamId}`)
      .set(authHeader(teacherToken))
      .send({ title: row.title, content: fixed });
    expect(put.status).toBe(200);

    const mid = await request(app).get('/api/teacher/exams').set(authHeader(teacherToken));
    const fixedRow = mid.body.find((e) => e.id === dirtyExamId);
    expect(fixedRow.content.status, 'إعادة الفحص ترفع الحالة بعد الإصلاح').toBe('needs_review');
    expect(fixedRow.content.issues.filter((i) => i.severity === 'error')).toHaveLength(0);
    expect(totalPoints(fixedRow.content.questions), 'Σ = هدف المخطّط بعد إعادة التوزيع').toBe(10);

    const pub = await request(app)
      .put(`/api/teacher/exams/${dirtyExamId}`)
      .set(authHeader(teacherToken))
      .send({ published: true });
    expect(pub.status, 'النشر متاح بعد الإصلاح والمراجعة').toBe(200);

    const after = await request(app).get('/api/teacher/exams').set(authHeader(teacherToken));
    const pubRow = after.body.find((e) => e.id === dirtyExamId);
    expect(pubRow.published).toBe(true);
    expect(pubRow.content.status).toBe('published');
  });

  it('الاختبار السليم يُنشر بعد المراجعة → 200 وحالة published (§61)', async () => {
    const res = await request(app)
      .put(`/api/teacher/exams/${cleanExamId}`)
      .set(authHeader(teacherToken))
      .send({ published: true });
    expect(res.status).toBe(200);

    const list = await request(app).get('/api/teacher/exams').set(authHeader(teacherToken));
    const row = list.body.find((e) => e.id === cleanExamId);
    expect(row.content.status).toBe('published');
    expect(row.published).toBe(true);
  });

  it('التلميذ يرى الاختبار المنشور لقسمه بلا مفاتيح إجابة وبلا بيانات داخلية (§72,§100)', async () => {
    const list = await request(app).get('/api/teacher/student/official-exams').set(authHeader(studentToken));
    expect(list.status).toBe(200);
    expect(list.body.some((e) => e.id === cleanExamId)).toBe(true);

    const detail = await request(app)
      .get(`/api/teacher/student/official-exams/${cleanExamId}`)
      .set(authHeader(studentToken));
    expect(detail.status).toBe(200);

    const content = detail.body.content;
    expect(content.subjectLabel).toBe('اللغة العربية');
    expect(content.blueprint, 'المخطّط لا يظهر للتلميذ').toBeUndefined();
    expect(content.report).toBeUndefined();
    expect(content.issues).toBeUndefined();
    expect(content.audit).toBeUndefined();
    expect(content.questions.length).toBeGreaterThan(0);

    for (const q of content.questions) {
      expect(q.prompt, 'نص السؤال محفوظ').toBeTruthy();
      expect(q.correct, 'correct').toBeUndefined();
      expect(q.correctAnswer, 'correctAnswer').toBeUndefined();
      expect(q.acceptedAnswers, 'acceptedAnswers').toBeUndefined();
    }
  });

  it('نسخة المدرس تحفظ ما تُحذفه نسخة التلميذ (مفتاح الإجابة موجود للمصحّح)', async () => {
    const res = await request(app)
      .get(`/api/teacher/exams/${cleanExamId}/preview`)
      .set(authHeader(teacherToken));
    expect(res.status).toBe(200);
    const qs = res.body.content.questions;
    expect(qs.some((q) => q.acceptedAnswers)).toBe(true);
    // كل سؤال مغلق يحمل إجابته النموذجية — والترتيب يحمل سلسلته في orderItems
    expect(qs.every((q) => q.type === 'OPEN' || q.type === 'ORDER' || q.correct || q.correctAnswer)).toBe(true);
    expect(qs.find((q) => q.type === 'ORDER').orderItems.length).toBeGreaterThanOrEqual(2);
  });

  it('إلغاء النشر يعيد الحالة إلى approved لا draft', async () => {
    const res = await request(app)
      .put(`/api/teacher/exams/${cleanExamId}`)
      .set(authHeader(teacherToken))
      .send({ published: false });
    expect(res.status).toBe(200);
    const list = await request(app).get('/api/teacher/exams').set(authHeader(teacherToken));
    const row = list.body.find((e) => e.id === cleanExamId);
    expect(row.published).toBe(false);
    expect(row.content.status).toBe('approved');
  });
});



