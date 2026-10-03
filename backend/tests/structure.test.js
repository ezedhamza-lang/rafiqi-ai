// اختبارات بنية الورقة (structure.js) — MASTER PROMPT §4,§6,§7,§8-§10,§36.
// ضمانات في الكود لا في الـPrompt: طول نصّ القراءة بسطور السنة (y3+ ≥ 10)، تشكيل
// تام، فرص قياس صريحة في القراءة (قرينة + تعليل + رأي)، وتنويع الصيغ — كلّها
// opt-in عبر opts.requireStructure (مسار التوليد) بنمط requireCount.

import { describe, it, expect } from 'vitest';
import { buildBlueprint } from '../src/exams/exam-blueprint.js';
import { validateExam } from '../src/exams/exam-pipeline.js';
import { scopeLessonsForTrimester } from '../src/exams/curriculum-index.js';
import { getSubjectProfile, getGradeProfile } from '../src/exams/profiles/index.js';
import {
  tashkeelRatio,
  countLines,
  checkStimulusText,
  checkReadingItems,
  checkFormatVariety,
  checkStimulusMeta
} from '../src/exams/structure.js';

/* نصّ قراءة s3: 10 أسطر مشكّلين تشكيلًا تامًّا (§6,§7). */
const VOCALIZED = [
  'ذَهَبَتْ مَرْيَمُ وَأُمُّهَا إِلَى الْحَدِيقَةِ الْعَامَّةِ فِي صَبَاحِ الْجُمُعَةِ.',
  'كَانَتِ الْحَدِيقَةُ خَضْرَاءَ وَالْأَزْهَارُ مَفْتُوحَةٌ فِي كُلِّ رُكْنٍ.',
  'رَكِضَتْ مَرْيَمُ خَلْفَ الْفَرَاشَةِ وَضَحِكَتْ حَتَّى بَلَغَتِ النَّهْرَ الصَّغِيرَ.',
  'جَلَسَتْ أُمُّهَا تَحْتَ شَجَرَةِ الظِّلِّ وَقَرَأَتْ قِصَّةً قَصِيرَةً لِبِنْتِهَا.',
  'سَمِعَتْ مَرْيَمُ صَوْتَ عُصْفُورٍ صَغِيرٍ فِي فَوْقِ الْغُصْنِ الْعَالِي.',
  'نَظَرَتْ إِلَى الْعُصْفُورِ وَقَالَتْ لِأُمِّهَا: مَا جَمِيلٌ هَذَا الْعُصْفُورُ!',
  'سَقَتْ مَرْيَمُ الْأَزْهَارَ بِمَاءِ النَّهْرِ لِتَبْقَى حَيَّةً أَكْثَرَ.',
  'أَعْطَتْهَا أُمُّهَا قِطْعَةَ خُبْزٍ وَشَرِبَتَا مَعًا شَيْئًا مِنَ الْمَاءِ.',
  'قَالَتْ لِأُمِّهَا: هَلْ نَرْجِعُ كُلَّ جُمُعَةٍ إِلَى هَذِهِ الْحَدِيقَةِ الْجَمِيلَةِ؟',
  'وَأَجَابَتْهَا أُمُّهَا بِابْتِسَامَةٍ: نَعَمْ، فَهَذِهِ أَحَبُّ مَكَانٍ إِلَيْكِ.'
].join('\n');

const PLAIN_SHORT = 'ذهبت مريم مع أمها إلى الحديقة. لعبت قليلًا ثم عادت إلى البيت معها.';

function lessonFixture(level = 'year3', subject = 'reading') {
  const { lessons } = scopeLessonsForTrimester({ level, subject, trimester: 1 });
  return lessons.find((l) => (l.competencies || []).length && (l.objectives || []).length) || lessons[0];
}

function bpOf(level = 'year3', subject = 'reading', count = 6) {
  return buildBlueprint({ level, subject, trimester: 1, questionCount: count, targetPoints: 20 });
}

function commonOf(level = 'year3', subject = 'reading') {
  const l = lessonFixture(level, subject);
  return {
    grade: level,
    subject,
    term: 1,
    lesson: l.title,
    competency: l.competencies?.[0] || l.title,
    objective: l.objectives?.[0] || l.title,
    domain: l.domain || null
  };
}

/** أسئلة القراءة y3+ المكتملة: قرينة + تعليل + رأي + تنوّع صيغ (§8-§10). */
function fullQuestions(common) {
  return [
    { ...common, id: 'q1', type: 'MCQ', difficulty: 1, points: 3, estimatedTime: 3, sindId: 's1',
      prompt: 'أين ذهبت مريم مع أمها ؟', options: ['إلى الحديقة', 'إلى المدرسة', 'إلى السوق'], correctAnswer: 'إلى الحديقة' },
    { ...common, id: 'q2', type: 'TRUE_FALSE', difficulty: 1, points: 3, estimatedTime: 2, sindId: 's1',
      prompt: 'صحيح أم خطأ: ركضت مريم خلف الفراشة.', correctAnswer: 'صحيح' },
    { ...common, id: 'q3', type: 'EXTRACT', difficulty: 2, points: 3, estimatedTime: 4, sindId: 's1',
      prompt: 'اكتب من النصّ قرينةً تدلّ على أنّ مريم تهتمّ بالنباتات.',
      correctAnswer: 'سَقَتْ مَرْيَمُ الْأَزْهَارَ' },
    { ...common, id: 'q4', type: 'OPEN', difficulty: 2, points: 4, estimatedTime: 4, sindId: 's1',
      prompt: 'علّل: لماذا سقت مريم الأزهار ؟',
      correctAnswer: 'لِتَبْقَى حَيَّةً أَكْثَرَ — لأنّها تريد بقاءها حيّة.' },
    { ...common, id: 'q5', type: 'OPEN', difficulty: 3, points: 4, estimatedTime: 5, sindId: 's1',
      prompt: 'هل توافق تصرّف مريم في سقي الأزهار ؟ علّل رأيك.',
      correctAnswer: 'موقف وجيه مدعوم بتعليل مناسب (لا إجابة وحيدة).' },
    { ...common, id: 'q6', type: 'ORDER', difficulty: 2, points: 3, estimatedTime: 4, sindId: 's1',
      prompt: 'رتّب حدوث الأحداث كما وردت في النصّ.',
      correctAnswer: 'الذهاب إلى الحديقة ← الجلوس تحت الشجرة ← رؤية العصفور ← سقي الأزهار',
      options: ['الذهاب إلى الحديقة', 'الجلوس تحت الشجرة', 'رؤية العصفور', 'سقي الأزهار'] }
  ];
}

/** أسئلة أحادية القالب بلا فرص القياس الثلاث (§27). */
function monoQuestions(common) {
  return ['أ', 'ب', 'ج', 'د', 'هـ', 'و'].map((letter, i) => ({
    ...common, id: `q${i + 1}`, type: 'MCQ', difficulty: 1, points: 3, estimatedTime: 2, sindId: 's1',
    prompt: `سؤال ${i + 1} عن الحديقة: ماذا فعلت مريم في الحديقة ${letter} ؟`,
    options: ['ركضت', 'نامت', 'طبخت'], correctAnswer: 'ركضت'
  }));
}

function examOf({ text = VOCALIZED, level = 'year3', subject = 'reading', questions } = {}) {
  const common = commonOf(level, subject);
  return {
    blueprint: bpOf(level, subject, (questions || fullQuestions(common)).length),
    questions: questions || fullQuestions(common),
    stimuli: [{ id: 's1', title: 'السند 1: نزهة في الحديقة', text, purpose: 'نصّ قراءة مرجعي' }],
    stimulusRequired: true,
    durationMinutes: 40
  };
}

describe('توضيحات وحدويّة: التشكيل والأسطر', () => {
  it('tashkeelRatio: نصّ مشكّل مرتفع ومجرّد ≈ صفر', () => {
    expect(tashkeelRatio(VOCALIZED)).toBeGreaterThan(0.3);
    expect(tashkeelRatio(PLAIN_SHORT)).toBeLessThan(0.05);
    expect(tashkeelRatio('')).toBe(0);
  });

  it('countLines: السطور غير الفارغة فقط', () => {
    expect(countLines(VOCALIZED)).toBe(10);
    expect(countLines(PLAIN_SHORT)).toBe(1);
    expect(countLines('سطر\n\n\nسطر\n')).toBe(2);
  });
});

describe('checkStimulusText: طول النصّ وتشكيله (§6-§7)', () => {
  const reading = getSubjectProfile('reading');
  const y3 = getGradeProfile('year3');
  const y1 = getGradeProfile('year1');
  const math = getSubjectProfile('math');

  it('نصّ y3 قصير ومجرّد → خطآن: TEXT_TOO_SHORT + TASHKEEL_MISSING', () => {
    const issues = checkStimulusText({ stimuli: [{ text: PLAIN_SHORT }], gradeProfile: y3, subjectProfile: reading });
    expect(issues.map((i) => i.code)).toEqual(expect.arrayContaining(['TEXT_TOO_SHORT', 'TASHKEEL_MISSING']));
    expect(issues.every((i) => i.severity === 'error')).toBe(true);
  });

  it('نصّ y3 بعشرة أسطر مشكّل → بلا مشاكل', () => {
    const issues = checkStimulusText({ stimuli: [{ text: VOCALIZED }], gradeProfile: y3, subjectProfile: reading });
    expect(issues).toEqual([]);
  });

  it('مادة بلا textStimulus (رياضيات) → لا يُقاس بسطور قراءة', () => {
    const issues = checkStimulusText({ stimuli: [{ text: PLAIN_SHORT }], gradeProfile: y3, subjectProfile: math });
    expect(issues).toEqual([]);
  });

  it('السنة الأولى: عتبة أسطر أدنى (4) وتقييم بلا قرينة/رأي إلزامي', () => {
    const issues = checkStimulusText({
      stimuli: [{ text: ['سَطَرٌ أَوَّلٌ فِي نِصَافٍ.', 'سَطَرٌ ثَانٍ فِي مَدْرَسَتِي.', 'سَطَرٌ ثَالِثٌ لَعِبْتُ فِيهِ.', 'سَطَرٌ رَابِعٌ وَعُدْتُ.'].join('\n') }],
      gradeProfile: y1, subjectProfile: reading
    });
    expect(issues.filter((i) => i.code === 'TEXT_TOO_SHORT')).toEqual([]);
  });
});

describe('checkReadingItems: فرص القياس الثلاث في القراءة y3+ (§8-§10)', () => {
  const reading = getSubjectProfile('reading');
  const arabic = getSubjectProfile('arabic');
  const y3 = getGradeProfile('year3');
  const y1 = getGradeProfile('year1');

  it('أسئلة بلا قرينة/تعليل/رأي → ثلاثة أخطاء READING_ITEM_MISSING', () => {
    const common = commonOf();
    const bare = monoQuestions(common);
    const issues = checkReadingItems({ questions: bare, gradeProfile: y3, subjectProfile: reading });
    expect(issues).toHaveLength(3);
    expect(issues.every((i) => i.code === 'READING_ITEM_MISSING' && i.severity === 'error')).toBe(true);
  });

  it('الأسئلة الثلاثة المتوفرة → بلا مشاكل', () => {
    const common = commonOf();
    const issues = checkReadingItems({ questions: fullQuestions(common), gradeProfile: y3, subjectProfile: reading });
    expect(issues).toEqual([]);
  });

  it('مادة غير القراءة (اللغة العربية) → غير مطبّق', () => {
    const common = commonOf('year3', 'arabic');
    const issues = checkReadingItems({ questions: monoQuestions(common), gradeProfile: y3, subjectProfile: arabic });
    expect(issues).toEqual([]);
  });

  it('السنة الأولى → لا قرينة/رأي إلزامي', () => {
    const common = commonOf('year1');
    const issues = checkReadingItems({ questions: monoQuestions(common), gradeProfile: y1, subjectProfile: reading });
    expect(issues).toEqual([]);
  });
});

describe('checkFormatVariety: تنويع الصيغ — لا هيمنة قالب (§4,§36)', () => {
  it('ستّة أسئلة كلّها MCQ → خطأ FORMAT_MONOTONY', () => {
    const common = commonOf();
    const { issues } = checkFormatVariety(monoQuestions(common));
    const mono = issues.find((i) => i.code === 'FORMAT_MONOTONY');
    expect(mono?.severity).toBe('error');
  });

  it('تنويع الصيغ كامل (5 أنواع في 6 أسئلة) → بلا مشاكل', () => {
    const common = commonOf();
    const { issues, distinct, total } = checkFormatVariety(fullQuestions(common));
    expect(issues).toEqual([]);
    expect(distinct).toBe(5); // MCQ, TRUE_FALSE, EXTRACT, OPEN×2, ORDER
    expect(total).toBe(6);
  });

  it('صيغة تتجاوز 60% → تنبيه FORMAT_DOMINANT (وحدها تنبيه لا خطأ)', () => {
    const common = commonOf();
    const qs = [
      ...['1', '2', '3', '4', '5'].map((n) => ({
        ...common, id: `e${n}`, type: 'EXTRACT', points: 1, prompt: `استخرج العبارة ${n} من النصّ.`,
        correctAnswer: 'عبارة', sindId: 's1'
      })),
      { ...common, id: 'm1', type: 'MCQ', points: 1, prompt: 'اختر ما يناسب.', options: ['أ', 'ب', 'ج'], correctAnswer: 'أ', sindId: 's1' },
      { ...common, id: 'm2', type: 'MCQ', points: 1, prompt: 'اختر الجملة الصحيحة.', options: ['أ', 'ب', 'ج'], correctAnswer: 'ب', sindId: 's1' },
      { ...common, id: 't1', type: 'TRUE_FALSE', points: 1, prompt: 'صحيح أم خطأ: الجملة.', correctAnswer: 'صحيح', sindId: 's1' }
    ];
    const { issues } = checkFormatVariety(qs);
    expect(issues.map((i) => i.code)).toEqual(expect.arrayContaining(['FORMAT_SPARSE', 'FORMAT_DOMINANT']));
    expect(issues.every((i) => i.severity === 'warn')).toBe(true);
  });

  it('أسئلة أقلّ من 5 → لا تُلجأ إلى العتبة', () => {
    const { issues } = checkFormatVariety([
      { type: 'MCQ' }, { type: 'MCQ' }, { type: 'MCQ' }
    ]);
    expect(issues).toEqual([]);
  });
});

describe('checkStimulusMeta: السند بلسان التلميذ لا بلسان التخطيط', () => {
  const PURPOSES_CLEAN = [
    'لاحِظوا: أين تقف رحاب؟ وماذا ترى وتسمع وتلمس من حولها؟',
    'اقرؤوا النصّ وتابعوا حدثَ اليوم مع مريم ونور.',
    'ما بقي من مبلغها بعد الشراء، وما تضافّه إلى ادّخارها.',
    'أزهارها ونظافتها وزراعة البذور — اقرؤوا النصّ وتابعوا.'
  ];

  it('صيغة الهدف المنهاجي بعد النقطة (حالة المستخدم) → خطأ في الغرض', () => {
    const issues = checkStimulusMeta([{ purpose: 'الملاحظة: تحديد المواقع ووظائف الحواس' }]);
    expect(issues).toHaveLength(1);
    expect(issues[0].code).toBe('STIMULUS_META');
    expect(issues[0].severity).toBe('error');
    expect(issues[0].message).toContain('الغرض');
  });

  it('إشارات المقاطع § ولسان الكفاءات/المعايير في حقول السند الثلاثة', () => {
    const issues = checkStimulusMeta([
      { title: 'السند 1: وضعية (§B3-نقود)', text: 'نصّ عادي', purpose: 'حِساب' },
      { title: 'السند 2', text: 'نصّ يذكر كفاية القراءة والفهم', purpose: 'وصف' },
      { title: 'السند 3', text: 'نصّ', purpose: 'الأهداف الخمسة للدرس' }
    ]);
    expect(issues).toHaveLength(3);
    expect(issues.every((i) => i.code === 'STIMULUS_META' && i.severity === 'error')).toBe(true);
    expect(issues[0].message).toContain('العنوان');
    expect(issues[1].message).toContain('المتن');
    expect(issues[2].message).toContain('الغرض');
  });

  it('بعد تطبيع الهمزات والتشكيل: «الأهداف» و«المعايير» تُلتقط', () => {
    const issues = checkStimulusMeta([{ purpose: 'الأَهْدَاف التعلِيمية للمَعْيَار' }]);
    expect(issues).toHaveLength(1);
    expect(issues[0].code).toBe('STIMULUS_META');
  });

  it('أغراض بلسان التلميذ (نصوص التجربة الأربعة) → بلا مشاكل', () => {
    const issues = checkStimulusMeta(PURPOSES_CLEAN.map((purpose) => ({
      title: 'السند 1: في الحديقة', text: 'نصّ التلميذ العادي.', purpose
    })));
    expect(issues).toEqual([]);
  });

  it('الغرض بلا لسان منهجي (وحدات الاختبار القائمة) → بلا مشاكل', () => {
    expect(checkStimulusMeta([{ purpose: 'قراءة معطيات وجمع الأعداد' }])).toEqual([]);
    expect(checkStimulusMeta([{ purpose: 'نصّ قراءة مرجعي' }])).toEqual([]);
    expect(checkStimulusMeta([])).toEqual([]);
  });
});

describe('validateExam مع requireStructure: تُفرض فعليًّا في المسار الحيّ', () => {
  it('ورقة مكتملة → لا أخطاء بنية، وصفّات التدقيق الثلاثة موجودة', () => {
    const res = validateExam(examOf({}), { requireStructure: true });
    const codes = res.issues.map((i) => i.code);
    expect(codes).not.toEqual(expect.arrayContaining(['TEXT_TOO_SHORT', 'TASHKEEL_MISSING', 'READING_ITEM_MISSING', 'FORMAT_MONOTONY']));
    ['text', 'readingItems', 'formats'].forEach((id) => {
      const row = res.audit.find((c) => c.id === id);
      expect(row, `صفّ تدقيق ${id}`).toBeTruthy();
      expect(row.status).toBe('pass');
    });
  });

  it('ورقة ناقصة البنية → أخطاء + الصفّ فاشل (§6-§7,§36)', () => {
    const common = commonOf();
    const res = validateExam(examOf({ text: PLAIN_SHORT, questions: monoQuestions(common) }), { requireStructure: true });
    const codes = res.issues.map((i) => i.code);
    expect(codes).toEqual(expect.arrayContaining(['TEXT_TOO_SHORT', 'TASHKEEL_MISSING', 'READING_ITEM_MISSING', 'FORMAT_MONOTONY']));
    expect(res.approved).toBe(false);
    expect(res.audit.find((c) => c.id === 'text')?.status).toBe('fail');
    expect(res.audit.find((c) => c.id === 'formats')?.status).toBe('fail');
    expect(res.audit.find((c) => c.id === 'readingItems')?.status).toBe('fail');
  });

  it('بدون requireStructure → الفحوصات مُعطَّلة (نمط requireCount: لا تفاجئ الوحدات القائمة)', () => {
    const common = commonOf();
    const res = validateExam(examOf({ text: PLAIN_SHORT, questions: monoQuestions(common) }));
    const codes = res.issues.map((i) => i.code);
    expect(codes).not.toEqual(expect.arrayContaining(['TEXT_TOO_SHORT', 'TASHKEEL_MISSING', 'READING_ITEM_MISSING', 'FORMAT_MONOTONY']));
    expect(res.audit.find((c) => c.id === 'text')).toBeUndefined();
    expect(res.audit.find((c) => c.id === 'formats')).toBeUndefined();
  });

  it('نصّ منهجي داخل السند → STIMULUS_META + صف sanadMeta فاشل + عدم الاعتماد', () => {
    const ex = examOf({});
    ex.stimuli[0].purpose = 'الملاحظة: تحديد المواقع ووظائف الحواس';
    const res = validateExam(ex, { requireStructure: true });
    expect(res.issues.map((i) => i.code)).toContain('STIMULUS_META');
    const row = res.audit.find((c) => c.id === 'sanadMeta');
    expect(row?.status).toBe('fail');
    expect(res.approved).toBe(false);
  });

  it('بدون requireStructure → لا STIMULUS_META (نفس نمط opt-in)', () => {
    const ex = examOf({});
    ex.stimuli[0].purpose = 'الملاحظة: تحديد المواقع ووظائف الحواس';
    const res = validateExam(ex);
    expect(res.issues.map((i) => i.code)).not.toContain('STIMULUS_META');
    expect(res.audit.find((c) => c.id === 'sanadMeta')).toBeUndefined();
  });
});
