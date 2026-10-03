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
  countWords,
  checkStimulusText,
  checkReadingItems,
  checkFormatVariety,
  checkStimulusMeta,
  checkScienceItems,
  formatLabelOf,
  checkFormatLabels,
  checkMentalShape
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
  'وَأَجَابَتْهَا أُمُّهَا بِابْتِسَامَةٍ: نَعَمْ، فَهَذِهِ أَحَبُّ مَكَانٍ إِلَيْكِ.',
  'لَعِبَتْ مَرْيَمُ بِالْمِنْجَلَةِ قُرْبَ الشَّجَرَةِ الْكَبِيرَةِ الَّتِي فِي وَسَطِ الْحَدِيقَةِ.',
  'وَجَدَتْ أُمُّهَا سَلَّةً صَغِيرَةً مَمْلُوءَةً أَوَّلًا ثُمَّ فَارِغَةً تَحْتَ الشَّجَرَةِ.',
  'سَاعَدَتْهَا أُمُّهَا فِي سَقْيِ الْأَزْهَارِ الْمُنْتَشِرَةِ فِي كُلِّ رُكْنٍ مِنْ أَرْكَانِ الْحَدِيقَةِ.',
  'وَأَقْتَبَسَتْ مِنَ الْيَوْمِ عِبْرَةً جَمِيلَةً: الْحَدِيقَةُ النَّظِيفَةُ سَرُّ الْمُجْتَمَعِ الْمُنْتَظِمِ.'
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
    expect(countLines(VOCALIZED)).toBe(14);
    expect(countLines(PLAIN_SHORT)).toBe(1);
    expect(countLines('سطر\n\n\nسطر\n')).toBe(2);
  });

  it('countWords: التشكيل لا يقطع الكلمة (§C9) — نصّ مشكّل ≥ 120 كلمة', () => {
    expect(countWords(VOCALIZED)).toBeGreaterThanOrEqual(120);
    expect(countWords(PLAIN_SHORT)).toBeLessThan(20);
    expect(countWords('')).toBe(0);
  });
});

describe('checkStimulusText: طول النصّ وتشكيله (§6-§7)', () => {
  const reading = getSubjectProfile('reading');
  const y3 = getGradeProfile('year3');
  const y1 = getGradeProfile('year1');
  const math = getSubjectProfile('math');

  it('نصّ y3 قصير ومجرّد → أخطاء: TEXT_TOO_SHORT + TASHKEEL_MISSING + WORDS_RANGE', () => {
    const issues = checkStimulusText({ stimuli: [{ text: PLAIN_SHORT }], gradeProfile: y3, subjectProfile: reading });
    expect(issues.map((i) => i.code)).toEqual(expect.arrayContaining(['TEXT_TOO_SHORT', 'TASHKEEL_MISSING']));
    expect(issues.every((i) => i.severity === 'error')).toBe(true);
  });

  it('نصّ y3 بأربعة عشر سطرًا مشكّلًا (≥120 كلمة) → بلا مشاكل', () => {
    const issues = checkStimulusText({ stimuli: [{ text: VOCALIZED }], gradeProfile: y3, subjectProfile: reading });
    expect(issues).toEqual([]);
  });

  it('نصّ قراءة أقلّ من 120 كلمة → WORDS_RANGE (§C9)', () => {
    const short = VOCALIZED.split('\n').slice(0, 8).join('\n');
    const issues = checkStimulusText({ stimuli: [{ text: short }], gradeProfile: y3, subjectProfile: reading });
    expect(issues.map((i) => i.code)).toContain('WORDS_RANGE');
    expect(issues.find((i) => i.code === 'WORDS_RANGE')?.severity).toBe('error');
  });

  it('نصّ قراءة أكثر من 200 كلمة → TEXT_TOO_LONG تحذير لا خطأ (§C9)', () => {
    const long = [...VOCALIZED.split('\n'), ...VOCALIZED.split('\n')].join('\n');
    const issues = checkStimulusText({ stimuli: [{ text: long }], gradeProfile: y3, subjectProfile: reading });
    const tooLong = issues.find((i) => i.code === 'TEXT_TOO_LONG');
    expect(tooLong?.severity).toBe('warn');
    expect(issues.map((i) => i.code)).not.toContain('WORDS_RANGE');
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

describe('checkScienceItems: تعليل + اكتشف/أصلح الخطأ (§C7)', () => {
  const science = getSubjectProfile('science');
  const y3 = getGradeProfile('year3');
  const y1 = getGradeProfile('year1');
  const q = (prompt) => ({ type: 'OPEN', prompt, points: 2, correctAnswer: 'جواب' });

  it('y3 بلا تعليل ولا إصلاح → MISSING_JUSTIFICATION + MISSING_ERROR_FIX (خطأان)', () => {
    const issues = checkScienceItems({ questions: [q('أين يقع بيت رحاب من المدرسة ؟')], gradeProfile: y3, subjectProfile: science });
    expect(issues.map((i) => i.code).sort()).toEqual(['MISSING_ERROR_FIX', 'MISSING_JUSTIFICATION']);
    expect(issues.every((i) => i.severity === 'error')).toBe(true);
  });

  it('صيغة ضعيفة وحدها «أين الخطأ؟ صحّح العبارة» → ERROR_FIX_PHRASING خطأ (0 نتيجة §C7)', () => {
    const issues = checkScienceItems({
      questions: [q('علّل: لماذا تنمو النباتات في الحديقة ؟'), q('أين الخطأ؟ صحّح العبارة.')],
      gradeProfile: y3, subjectProfile: science
    });
    const phrasing = issues.find((i) => i.code === 'ERROR_FIX_PHRASING');
    expect(phrasing?.severity).toBe('error');
    expect(issues.map((i) => i.code)).not.toContain('MISSING_ERROR_FIX');
    expect(issues.map((i) => i.code)).not.toContain('MISSING_JUSTIFICATION');
  });

  it('الصيغة القوية «اكتب التصرّف الخاطئ ثمّ أصلحه» + تعليل → بلا مشاكل', () => {
    const issues = checkScienceItems({
      questions: [q('علّل: لماذا تنمو النباتات ؟'), q('اكتب التصرّف الخاطئ ثمّ أصلحه في الجملة.')],
      gradeProfile: y3, subjectProfile: science
    });
    expect(issues).toEqual([]);
  });

  it('السنة الأولى (scienceItems فارغة) ومواد غير الإيقاظ → غير مطبّق', () => {
    expect(checkScienceItems({ questions: [], gradeProfile: y1, subjectProfile: science })).toEqual([]);
    expect(checkScienceItems({ questions: [], gradeProfile: y3, subjectProfile: getSubjectProfile('reading') })).toEqual([]);
  });
});

describe('formatLabelOf + checkFormatLabels: الصيغ من نصّ التعليمة (§C1,§C11)', () => {
  it('النوع + لسان التعليمة: فسّري←تعليل، اشرح←شرح، اكتب←تحرير', () => {
    expect(formatLabelOf({ type: 'MCQ', prompt: 'فسّري: كيف نمت النباتات من البذور ؟' })).toBe('تعليل');
    expect(formatLabelOf({ type: 'MCQ', prompt: 'اختر الإجابة الصحيحة.' })).toBe('اختيار من متعدد');
    expect(formatLabelOf({ type: 'TRUE_FALSE', prompt: 'حديقة نظيفة.' })).toBe('صواب أم خطأ');
    expect(formatLabelOf({ type: 'FILL_BLANK', prompt: 'أكمل: نحافظ على … الحديقة.' })).toBe('أكمل');
    expect(formatLabelOf({ type: 'EXTRACT', prompt: 'اكتب من النصّ قرينة.' })).toBe('استخراج');
    expect(formatLabelOf({ type: 'OPEN', prompt: 'اشرح بأسلوبك كيف يساهم كل تلميذ.' })).toBe('شرح');
    expect(formatLabelOf({ type: 'OPEN', prompt: 'هل توافق؟ علّل رأيك.' })).toBe('تعليل');
    expect(formatLabelOf({ type: 'OPEN', prompt: 'اكتب جملتين تصف فيهما النظافة.' })).toBe('تحرير');
  });

  const seven = [
    { type: 'MCQ', prompt: 'اختر.' }, { type: 'MCQ', prompt: 'اختر.' }, { type: 'MCQ', prompt: 'اختر.' },
    { type: 'FILL_BLANK', prompt: 'أكمل' }, { type: 'TRUE_FALSE', prompt: 'صواب' },
    { type: 'EXTRACT', prompt: 'استخرج' }, { type: 'ORDER', prompt: 'رتّب' }
  ];

  it('ورقة ≥7 أسئلة بأقلّ من 6 صيغ → FORMAT_FEW_LABELS تنبيه + جدول التكرار (§C1)', () => {
    const { issues, table, distinct } = checkFormatLabels(seven, 'reading');
    expect(distinct).toBe(5);
    expect(issues.map((i) => i.code)).toContain('FORMAT_FEW_LABELS');
    expect(issues.every((i) => i.severity === 'warn')).toBe(true);
    expect(table).toContain('ترتيب×1');
  });

  it('6 أسئلة و5 صيغ → لا تنبيه (الشرط ≥7 أسئلة) والجدول محفوظ', () => {
    const { issues, table } = checkFormatLabels(seven.slice(0, 6), 'reading');
    expect(issues).toEqual([]);
    expect(table).toContain('اختيار من متعدد×3');
  });

  it('§C11 العربية: «ضع علامة» فوق 20% → FORMAT_LABEL_LIMIT، ومواد أخرى لا تُطبّق', () => {
    const qs = [
      ...[1, 2, 3].map((n) => ({ type: 'MCQ', prompt: `ضع علامة ✓ في العبارة ${n}.` })),
      { type: 'TRUE_FALSE', prompt: 'صواب' },
      { type: 'FILL_BLANK', prompt: 'أكمل' },
      { type: 'EXTRACT', prompt: 'استخرج' },
      { type: 'ORDER', prompt: 'رتّب' },
      { type: 'OPEN', prompt: 'اكتب جملتين.' }
    ];
    const ar = checkFormatLabels(qs, 'arabic');
    const limit = ar.issues.find((i) => i.code === 'FORMAT_LABEL_LIMIT');
    expect(limit?.severity).toBe('warn');
    expect(ar.issues.map((i) => i.code)).not.toContain('FORMAT_FEW_LABELS'); // 6 صيغ ≥ 6
    const re = checkFormatLabels(qs, 'reading');
    expect(re.issues.map((i) => i.code)).not.toContain('FORMAT_LABEL_LIMIT');
  });
});

describe('checkMentalShape: قسم الحساب الذهني المستقل (§A2,§C13,§D6)', () => {
  const flagged = (n, pts) => Array.from({ length: n }, (_, i) => ({
    type: 'FILL_BLANK', prompt: `${10 + i} − 5 = …`, points: pts, component: 'mental', correctAnswer: '5'
  }));

  it('بلا قسم وبلا أسئلة معلّمة → لا يُشغَّل', () => {
    expect(checkMentalShape({ questions: [{ type: 'MCQ', prompt: 'س؟' }] })).toEqual({ ran: false, issues: [] });
    expect(checkMentalShape({})).toEqual({ ran: false, issues: [] });
  });

  it('قسم مطابق (عنوان + 10 د + 4 ن + ≤12 عملية) → بلا مشاكل', () => {
    const { ran, issues } = checkMentalShape({
      mentalMath: { title: 'الحساب الذهني', points: 4, minutes: 10 },
      questions: flagged(8, 0.5),
      targetPoints: 20
    });
    expect(ran).toBe(true);
    expect(issues).toEqual([]);
  });

  it('عنوان خاطئ + زمن 15 د + تنقيط 8 ن → ثلاثة MENTAL_SHAPE', () => {
    const { issues } = checkMentalShape({
      mentalMath: { title: 'قسم الأعداد', points: 4, minutes: 15 },
      questions: flagged(8, 1),
      targetPoints: 20
    });
    expect(issues.length).toBeGreaterThanOrEqual(3);
    expect(issues.every((i) => i.code === 'MENTAL_SHAPE' && i.severity === 'error')).toBe(true);
  });

  it('قسم مُعلن بلا أسئلة معلَّمة → MENTAL_SHAPE', () => {
    const { ran, issues } = checkMentalShape({ mentalMath: { title: 'الحساب الذهني', points: 4, minutes: 10 }, questions: [] });
    expect(ran).toBe(true);
    expect(issues.map((i) => i.code)).toContain('MENTAL_SHAPE');
  });

  it('قسم يستهلك الورقة كلها (Σبقية ≤ 0) → MENTAL_SHAPE (§A2: بقيّة 0→16)', () => {
    const { issues } = checkMentalShape({
      mentalMath: { title: 'الحساب الذهني', points: 20, minutes: 8 },
      questions: flagged(4, 5),
      targetPoints: 20
    });
    expect(issues.map((i) => i.code)).toContain('MENTAL_SHAPE');
  });
});

describe('validateExam: الشراائح الجديدة في المسار الحيّ', () => {
  it('§D8 الشريحة ١: مصفوفة المواصفات + تقرير تحليلي + criterion إجباري لكل سؤال', () => {
    const res = validateExam(examOf({}), { requireStructure: true });
    expect(res.specMatrix?.rows?.length).toBeGreaterThan(0);
    expect(res.analyticalReport?.length).toBeGreaterThan(1);
    expect(res.analyticalReport.join('\n')).toContain('التقرير التحليلي');
    expect(res.report.join('\n')).toContain('التغطية:');
    const row = res.audit.find((c) => c.id === 'specMatrix');
    expect(row?.status).toBe('pass');
    expect(res.questions.every((q) => !!q.criterion)).toBe(true);
    // لا رمز رسمي M لغير الرياضيات (المصدر رسمي للرياضيات فقط §القاعدة)
    expect(res.questions.every((q) => !/^[MD]/.test(String(q.criterion)))).toBe(true);
    expect(res.audit.find((c) => c.id === 'formatLabels')).toBeTruthy();
  });

  it('بدون requireStructure → لا مصفوفة ولا إسناد (opt-in نفسه)', () => {
    const res = validateExam(examOf({}));
    expect(res.specMatrix).toBeNull();
    expect(res.analyticalReport).toEqual([]);
    expect(res.audit.find((c) => c.id === 'specMatrix')).toBeUndefined();
    expect(res.questions.every((q) => !q.criterion)).toBe(true);
  });

  it('§C7 إيقاظ y3 بلا تعليل/إصلاح → MISSING_* + صف scienceItems فاشل', () => {
    const common = commonOf('year3', 'science');
    const bare = [
      { ...common, id: 'q1', type: 'MCQ', difficulty: 1, points: 3, estimatedTime: 2, sindId: 's1',
        prompt: 'أين يقع الماء من الهواء ؟', options: ['تحت', 'فوق', 'جانب'], correctAnswer: 'تحت' },
      { ...common, id: 'q2', type: 'TRUE_FALSE', difficulty: 1, points: 3, estimatedTime: 2, sindId: 's1',
        prompt: 'النباتات تحتاج إلى الماء.', correctAnswer: 'صواب' },
      { ...common, id: 'q3', type: 'FILL_BLANK', difficulty: 2, points: 3, estimatedTime: 2, sindId: 's1',
        prompt: 'الشمس مصدر … للنباتات.', correctAnswer: 'الضوء' },
      { ...common, id: 'q4', type: 'EXTRACT', difficulty: 2, points: 3, estimatedTime: 3, sindId: 's1',
        prompt: 'استخرج من السندّ اسمًا لحاسة.', correctAnswer: 'الشم' },
      { ...common, id: 'q5', type: 'ORDER', difficulty: 2, points: 4, estimatedTime: 3, sindId: 's1',
        prompt: 'رتّب مراحل النمو.', correctAnswer: 'بذرة ← نبتة ← شجرة',
        orderItems: ['بذرة', 'نبتة', 'شجرة'] },
      { ...common, id: 'q6', type: 'MCQ', difficulty: 2, points: 4, estimatedTime: 2, sindId: 's1',
        prompt: 'أيّ حاسة تشمّ رحاب الزهرة ؟', options: ['الشم', 'الذوق', 'البصر'], correctAnswer: 'الشم' }
    ];
    const res = validateExam(examOf({ level: 'year3', subject: 'science', questions: bare }), { requireStructure: true });
    const codes = res.issues.map((i) => i.code);
    expect(codes).toContain('MISSING_JUSTIFICATION');
    expect(codes).toContain('MISSING_ERROR_FIX');
    expect(res.audit.find((c) => c.id === 'scienceItems')?.status).toBe('fail');

    // بإضافة الفرصتين بالصيغ الصحيحة → يمرّ المحقّق
    const withItems = [
      ...bare,
      { ...common, id: 'q7', type: 'OPEN', difficulty: 3, points: 0, estimatedTime: 3, sindId: 's1',
        prompt: 'علّل: لماذا تحتاج النباتات إلى الماء ؟', correctAnswer: 'لأنّ الماء غذاء النبات.', answerLines: 2 },
      { ...common, id: 'q8', type: 'OPEN', difficulty: 3, points: 0, estimatedTime: 3, sindId: 's1',
        prompt: 'اكتب التصرّف الخاطئ ثمّ أصلحه: «النبات ينمو بلا ضوء».', correctAnswer: 'التصرّف الخاطئ ثمّ الإصلاح.', answerLines: 2 }
    ];
    const res2 = validateExam(examOf({ level: 'year3', subject: 'science', questions: withItems }), { requireStructure: true });
    const codes2 = res2.issues.map((i) => i.code);
    expect(codes2).not.toContain('MISSING_JUSTIFICATION');
    expect(codes2).not.toContain('MISSING_ERROR_FIX');
    expect(res2.audit.find((c) => c.id === 'scienceItems')?.status).not.toBe('fail');
  });
});
