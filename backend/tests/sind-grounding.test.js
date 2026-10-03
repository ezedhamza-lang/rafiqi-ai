// اختبارات الانحدار الإلزامية لطبقة السند (Spec A §152-161) + الكاشف §7,§150-151.
//
// الوحدات هنا تعمل بلا قاعدة بيانات وبلا شبكة:
//   sind.js      → بنية السند ورسم الأدلّة (§3-5)
//   grounding.js → ORPHAN_QUESTION_DETECTOR + قواعد الأرقام/الوحدات/الجدول/الأشكال (§42-47)
//   pattern.js   → عائلة النموذج المرجعي وقفل البيانات (§154-157)
//   exam-pipeline → الفحص الكامل الذي يرفض/يعتمد (§66)
//
// كل اختبار يذكر القسم الذي يحققه، ويكتب REJECT/PASS بترجمتها العملية
// (approved=false / errors>0 مقابل approved=true / errors=0).

import { describe, it, expect } from 'vitest';
import { buildSind, buildStimuli, extractNumbers, buildEvidenceGraph, toAsciiDigits } from '../src/exams/sind.js';
import { bindAndCheck, checkAgainstSind, isDerivable, groundingReport, normWord } from '../src/exams/grounding.js';
import { comparePatterns, structureSignature, metadataLock } from '../src/exams/pattern.js';
import { validateExam, assertPublishable } from '../src/exams/exam-pipeline.js';
import { buildBlueprint } from '../src/exams/exam-blueprint.js';
import { scopeLessonsForTrimester } from '../src/exams/curriculum-index.js';

// المادة = الرياضيات: كل سيناريوهات هذا الملف حسابي (§42,§158) — لا مزج مادة بلغة أخرى.
const LEVEL = 'year3';
const SUBJECT = 'math';
const TERM = 1;

const blueprint = (over = {}) =>
  buildBlueprint({ level: LEVEL, subject: SUBJECT, trimester: TERM, questionCount: 4, targetPoints: 10, ...over });

/** درس حقيقي من نطاق المنهج — لا اختلاق (§2). */
function lesson() {
  const { lessons } = scopeLessonsForTrimester({ level: LEVEL, subject: SUBJECT, trimester: TERM });
  return lessons.find((l) => (l.competencies || []).length && (l.objectives || []).length) || lessons[0];
}

/** سؤال عقدي صالح (§76) — يستعمل درسًا حقيقيًّا ويتجاوز فحص المنهج. */
function question(over = {}) {
  const l = lesson();
  return {
    id: 'q1',
    grade: LEVEL,
    subject: SUBJECT,
    term: TERM,
    domain: l.domain || null,
    lesson: l.title,
    competency: l.competencies[0] || l.title,
    objective: l.objectives[0] || l.title,
    type: 'MCQ',
    difficulty: 2,
    points: 2.5,
    estimatedTime: 2,
    prompt: 'ما مجموع 12 و 8 ؟',
    options: ['20', '22', '18'],
    correctAnswer: '20',
    ...over
  };
}

/** اختبار سنّدي كامل يمرّ بخطّ أنابيب التدقيق الحقيقي. */
function examOf(stimuli, questions, over = {}) {
  return validateExam({
    blueprint: blueprint(),
    questions,
    stimuli,
    stimulusRequired: true,
    durationMinutes: 30,
    ...over
  });
}

const errorsOf = (res) => res.issues.filter((i) => i.severity === 'error');

/* ══════════════════════════════════════════════════════════════════
   0) بنية السند نفسها (§3-5,§42)
   ══════════════════════════════════════════════════════════════════ */
describe('بناء السند: أرقامه ووحداته ووقفه (§3-5,§42)', () => {
  it('extractNumbers تفهم الأرقام العربية والهندية والعشرية وفواصل الآلاف (§42)', () => {
    expect(extractNumbers('لديه 500 مليم و320 سنتيمًا')).toEqual([320, 500]);
    expect(extractNumbers('قرأ ٧ كتبًا و١٢ دفترًا')).toEqual([7, 12]);
    expect(extractNumbers('الثمن 2.5 دينارًا')).toEqual([2.5]);
    expect(extractNumbers('1,200 تلميذ')).toEqual([1200]);
    expect(extractNumbers('بلا أرقام')).toEqual([]);
    expect(toAsciiDigits('٢٠٢٦')).toBe('2026');
  });

  it('buildSind يقفل السند بعد بنائه ويحمل أرقامه ورسم أدلةه (§4,§19)', () => {
    const s = buildSind({ id: 's1', title: 'السند 1', text: 'في المكتبة 135 كتابًا و145 دفترًا.', purpose: 'الجمع' });
    expect(s.locked).toBe(true);
    expect(s.version).toBe(1);
    expect(s.numbers).toEqual([135, 145]);
    const graph = buildEvidenceGraph(s);
    expect(graph.sindId).toBe('s1');
    expect(graph.sind_purpose).toBe('الجمع');
    expect(graph.availableEvidenceIds).toEqual(expect.arrayContaining(['s1:root', 's1:n1', 's1:n2']));
  });

  it('buildStimuli يرفض السند الفارغ ولا يترك ورقة بلا أصل (§18)', () => {
    const { stimuli, invalid } = buildStimuli([{ id: 's1', text: '' }, { id: 's2', text: 'نص سند صالح يحوي معطيات.' }]);
    expect(stimuli).toHaveLength(1);
    expect(invalid).toHaveLength(1);
    expect(buildStimuli(null).stimuli).toEqual([]);
  });
});

/* ══════════════════════════════════════════════════════════════════
   1) اختبارات الانحدار العشرة (§152-161)
   ══════════════════════════════════════════════════════════════════ */
describe('§152-161: اختبارات الانحدار الإلزامية', () => {
  it('§152: سند «135 كتابًا» + سؤال «احسب 73-28» ← REJECT', () => {
    const sind = buildSind({ id: 's1', text: 'في مكتبة المدرسة 135 كتابًا.' });
    const found = checkAgainstSind(question({ prompt: 'احسب 73 − 28' }), sind, 0);
    expect(found.some((f) => ['ORPHAN_QUESTION', 'NUMBER_NOT_IN_SIND'].includes(f.code) && f.severity === 'error')).toBe(true);

    const res = examOf([sind], [question({ prompt: 'احسب 73 − 28' })]);
    expect(res.approved).toBe(false);
    expect(errorsOf(res).some((e) => ['ORPHAN_QUESTION', 'NUMBER_NOT_IN_SIND'].includes(e.code))).toBe(true);
    expect(res.audit.find((a) => a.id === 'grounding').status).toBe('fail');
  });

  it('§153: سند «500 مليم … 320 مليمًا» + سؤال بعديمهما ← PASS', () => {
    const sind = buildSind({ id: 's1', text: 'اشترى أحمد كراسة بـ500 مليم وكان ثمن الكراسة 320 مليمًا، ولديه 150 مليمًا أخرى.' });
    const q = question({ prompt: 'إذا دفع 500 مليم وكان ثمن الكراسة 320 مليمًا، كم بقي له؟', options: ['180', '820', '150'], correctAnswer: '180' });
    const res = examOf([sind], [q]);
    expect(res.approved).toBe(true);
    expect(res.status).toBe('needs_review');
    expect(errorsOf(res).filter((e) => e.code.startsWith('ORPHAN') || e.code === 'NUMBER_NOT_IN_SIND')).toHaveLength(0);
    expect(res.questions[0].sindId).toBe('s1');
  });

  it('§154: مرجع بخمسة سندات ومولّد بسند واحد ← PATTERN_DRIFT، والعائلة نفسها PASS', () => {
    const ref = { stimuli: Array.from({ length: 5 }, (_, i) => ({ id: `s${i + 1}` })), questions: [question(), question({ id: 'q2' })] };
    const drifted = { stimuli: [{ id: 's1' }], questions: [question()] };
    const bad = comparePatterns(ref, drifted);
    expect(bad.status).toBe('fail');
    expect(bad.issues.map((i) => i.code)).toContain('PATTERN_DRIFT');

    const same = comparePatterns(ref, { stimuli: Array.from({ length: 5 }, (_, i) => ({ id: `s${i + 1}` })), questions: [question(), question({ id: 'q2' })] });
    expect(same.status).toBe('pass');
  });

  it('§155: مرجع باستجابة مفتوحة ومولّد كلها اختيار من متعدد ← RESPONSE_PATTERN_DRIFT', () => {
    const ref = { stimuli: [{ id: 's1' }], questions: [question({ type: 'OPEN', prompt: 'اكتب بأسلوبك', options: undefined, correctAnswer: undefined }), question({ id: 'q2' })] };
    const allMcq = { stimuli: [{ id: 's1' }], questions: [question(), question({ id: 'q2', prompt: 'ما عكس دافئ؟', options: ['بارد', 'دافئ', 'جاف'], correctAnswer: 'بارد' })] };
    const cmp = comparePatterns(ref, allMcq);
    expect(cmp.status).toBe('fail');
    expect(cmp.issues.map((i) => i.code)).toContain('RESPONSE_PATTERN_DRIFT');
  });

  it('§156: مرجع في الثلاثي الثالث ومولّد في الثلاثي الأول ← METADATA_MISMATCH', () => {
    const cmp = comparePatterns({ stimuli: [], questions: [], term: 3 }, { stimuli: [], questions: [], term: 1 });
    expect(cmp.status).toBe('fail');
    expect(cmp.issues.map((i) => i.code)).toContain('METADATA_MISMATCH');
    expect(metadataLock({ term: 3 }, { term: 1 })).toHaveLength(1);
    expect(metadataLock({ term: 1 }, { term: 1 })).toHaveLength(0);
  });

  it('§157: مرجع السنة الثالثة ومولّد بالسنة الرابعة ← GRADE_MISMATCH', () => {
    const cmp = comparePatterns({ stimuli: [], questions: [], grade: 'year3', term: 1 }, { stimuli: [], questions: [], grade: 'year4', term: 1 });
    expect(cmp.status).toBe('fail');
    expect(cmp.issues.map((i) => i.code)).toContain('GRADE_MISMATCH');
  });

  it('§158: رقم في السؤال غير موجود في السند وغير ناتج عنه ← REJECT (يرجع أيضًا من خط الأنابيب)', () => {
    const sind = buildSind({ id: 's1', text: 'في الفصل الأول 24 تلميذًا و18 تلميذة، وفي الفصل المقابل 40 تلميذًا.' });
    const found = checkAgainstSind(question({ prompt: 'ما عدد التلاميذ ؟', options: ['42', '40', '6'], correctAnswer: '42', points: 2.5 }), sind, 0);
    // 42 = 24 + 18 ← مسموح بالاشتقاق §8، أما 70 فلا
    expect(found.filter((f) => f.severity === 'error')).toHaveLength(0);
    const unsourced = checkAgainstSind(question({ prompt: 'احسب 70 و90' }), sind, 0);
    expect(unsourced.some((f) => f.severity === 'error')).toBe(true);
    expect(isDerivable(42, [24, 18])).toBe(true);
    expect(isDerivable(70, [24, 18])).toBe(false);
  });

  it('§159: «العرض الثاني» والسند فيه الأول والثالث فقط ← REJECT', () => {
    const sind = buildSind({ id: 's1', text: 'نُظّم عرض الأول في المدرسة وعرض الثالث في الحي.' });
    const found = checkAgainstSind(question({ prompt: 'كم تلميذًا حضر عرض الثاني ؟' }), sind, 0);
    expect(found.some((f) => f.code === 'ORDINAL_NOT_IN_SIND' && f.severity === 'error')).toBe(true);
    // نفس السؤال مع وجود العرض الثاني في السند ← لا خطأ
    const ok = buildSind({ id: 's1', text: 'نُظّم عرض الأول ثم عرض الثاني ثم عرض الثالث.' });
    expect(checkAgainstSind(question({ prompt: 'كم تلميذًا حضر عرض الثاني ؟' }), ok, 0).some((f) => f.code === 'ORDINAL_NOT_IN_SIND')).toBe(false);
  });

  it('§160: «أكمل الجدول» والسند بلا جدول ← REJECT', () => {
    const sind = buildSind({ id: 's1', text: 'في المدرسة 120 كتابًا و45 دفترًا في المكتبة.' });
    const found = checkAgainstSind(question({ prompt: 'أكمل الجدول الآتي بالأرقام المناسبة.' }), sind, 0);
    expect(found.some((f) => f.code === 'MISSING_TABLE' && f.severity === 'error')).toBe(true);
    const withTable = buildSind({ id: 's1', text: 'الجدول: في المدرسة 120 كتابًا و45 دفترًا.' });
    expect(checkAgainstSind(question({ prompt: 'أكمل الجدول الآتي بالأرقام المناسبة.' }), withTable, 0).some((f) => f.code === 'MISSING_TABLE')).toBe(false);
  });

  it('§161: «ألون المضلع» والسند بلا أشكال هندسية ← REJECT', () => {
    const sind = buildSind({ id: 's1', text: 'في الحقيبة 9 أقلام و6 ممحاة.' });
    const found = checkAgainstSind(question({ prompt: 'ألون المضلع المطابق للون الأزرق.' }), sind, 0);
    expect(found.some((f) => f.code === 'MISSING_SHAPE' && f.severity === 'error')).toBe(true);
    const withShapes = buildSind({ id: 's1', text: 'ارسم مربعًا ومثلثًا ودائرة في الدفتر.' });
    expect(checkAgainstSind(question({ prompt: 'ألون المضلع المطابق للون الأزرق.' }), withShapes, 0).some((f) => f.code === 'MISSING_SHAPE')).toBe(false);
  });
});

/* ══════════════════════════════════════════════════════════════════
   2) الكاشف: لا سؤال يتيم ولا مرجع خارجي (§7,§150,§151,§18)
   ══════════════════════════════════════════════════════════════════ */
describe('ORPHAN_QUESTION_DETECTOR والتأصيل (§7,§150-151)', () => {
  it('اختبار سنّدي بلا سند ← NO_STIMULUS + عقد النشر يرفض السند الناقص (§18,§105)', () => {
    const res = examOf([], [question()]);
    expect(res.approved).toBe(false);
    expect(res.issues.map((i) => i.code)).toContain('NO_STIMULUS');
    expect(res.audit.find((a) => a.id === 'grounding').status).toBe('fail');
    expect(assertPublishable({ blueprint: blueprint(), questions: res.questions, stimuli: [], stimulusRequired: true }).missing).toContain('stimuli');
    expect(assertPublishable({ blueprint: blueprint(), questions: res.questions, stimuli: [{ id: 's1', text: 'سند' }], stimulusRequired: true }).ok).toBe(true);
  });

  it('الربط يختار السند الذي يغطّي معطيات السؤال ويكتب sindId (§7-8)', () => {
    const s1 = buildSind({ id: 's1', text: 'في المكتبة 135 كتابًا.' });
    const s2 = buildSind({ id: 's2', text: 'في الفصل 24 تلميذًا و18 تلميذة.' });
    const g = bindAndCheck([s1, s2], [
      question({ id: 'q1', prompt: 'احسب العدد الجملي للتلاميذ.', options: ['42', '6', '432'], correctAnswer: '42' }),
      question({ id: 'q2', prompt: 'احسب 73 − 28' })
    ], { requireStimulus: true });

    expect(g.questions[0].sindId).toBe('s2'); // 24 + 18 = 42 مستمد من s2
    expect(g.issues.filter((i) => i.severity === 'error')).toHaveLength(1); // q2 يتيم
    expect(g.grounded).toBe(1);
    const report = groundingReport(g);
    expect(report.total).toBe(2);
    expect(report.orphanRate).toBe(0.5);
  });

  it('سند معلن غير موجود ← CROSS_SIND_REFERENCE (§151: لا تلوث خارجي)', () => {
    const s1 = buildSind({ id: 's1', text: 'في المكتبة 135 كتابًا و145 دفترًا.' });
    const g = bindAndCheck([s1], [question({ sindId: 's999' })], { requireStimulus: true });
    expect(g.issues.map((i) => i.code)).toContain('CROSS_SIND_REFERENCE');
  });

  it('الاشتقاق مسموح: مجموع من السند يعدّ تأسيسًا لا يتيمًا (§8)', () => {
    const sind = buildSind({ id: 's1', text: 'في المدرسة 135 بنتًا و145 ولدًا.' });
    const res = examOf([sind], [question({ prompt: 'كم العدد الجملي للتلاميذ ؟', options: ['280', '10', '290'], correctAnswer: '280' })]);
    expect(res.approved).toBe(true);
    expect(errorsOf(res).filter((e) => e.code === 'ORPHAN_QUESTION')).toHaveLength(0);
  });

  it('تبديل الوحدة النقدية بلا مبرر ← UNIT_MISMATCH (§45)', () => {
    const sind = buildSind({ id: 's1', text: 'ثمن الكتاب 500 مليم وثمن الدفتر 320 مليم.' });
    const found = checkAgainstSind(question({ prompt: 'ما ثمن الكتاب بالدينار ؟' }), sind, 0);
    expect(found.some((f) => f.code === 'UNIT_MISMATCH' && f.severity === 'error')).toBe(true);
  });

  it('مقياس التأصيل يظهر في التقرير ولا يُخفى (§66,§168)', () => {
    const sind = buildSind({ id: 's1', text: 'في المكتبة 120 كتابًا و45 دفترًا و165 قلمًا.' });
    const res = examOf([sind], [question({ prompt: 'ما مجموع 120 و 45 ؟', options: ['165', '75', '5400'], correctAnswer: '165' })]);
    expect(res.audit.find((a) => a.id === 'grounding').detail).toContain('1/1');
    expect(res.report.join('\n')).toContain('ارتباط الأسئلة بالسند');
  });

  it('اختبار بلا سند ولا طلب سند ← لا فحص ولا رفض (توافق خلفي §66)', () => {
    const res = validateExam({ blueprint: blueprint(), questions: [question()] });
    expect(res.approved).toBe(true);
    expect(res.audit.find((a) => a.id === 'grounding').status).toBe('pass');
  });
});

/* ══════════════════════════════════════════════════════════════════
   3) تكامل الأدوات الثانوية (توقّعات صغيرة تحمي من الرجوع)
   ══════════════════════════════════════════════════════════════════ */
describe('أدوات ثانوية: تطبيع الكلمات والبصمة البنائية', () => {
  it('normWord يوحّد الهمزة والتاء والألف والتشكيل ويلغي «ال»', () => {
    expect(normWord('الكتاب')).toBe(normWord('كِتَاب'));
    expect(normWord('مدرسة')).toBe(normWord('المدرسة'));
    expect(normWord('مدرسة')).toBe('مدرسه');
  });

  it('structureSignature يرصد توزيع الأنواع والسندات والثلاثي', () => {
    const sig = structureSignature({ stimuli: [{ id: 's1' }], questions: [question(), question({ id: 'q2', type: 'OPEN', options: undefined, correctAnswer: undefined })], term: 1, grade: LEVEL });
    expect(sig.stimuli).toBe(1);
    expect(sig.questions).toBe(2);
    expect(sig.types.MCQ).toBe(1);
    expect(sig.types.OPEN).toBe(1);
    expect(sig.term).toBe(1);
    expect(sig.grade).toBe(LEVEL);
  });
});
