// اختبارات شريحة الرياضيات الموسّعة (§B2/§B3/§D11/§D12 في spec-exam-standards):
//   1) إسناد المعيار الرسمي لكل سؤال (M1–M4 + مصدر موسَّم)
//   2) قاعدة «لا يكشف سؤال لاحق إجابة سؤال سابق»
//   3) محقّق الرياضيات الموسّع strict: ربط السندات/نقود/هندسة/قياس/مساحة عمودية
//   4) السلوك القديم دون strict لم يتغيّر (وحدات الاختبار الحالية سليمة)
import { describe, it, expect } from 'vitest';
import { MATH_CRITERIA, mapMathCriterion, criteriaTable, criteriaDistribution } from '../src/exams/criterion-map.js';
import { checkAnswerChain } from '../src/exams/structure.js';
import { runSubjectValidators } from '../src/exams/subject-validators.js';

const codes = (list) => list.map((i) => i.code);

describe('criteria.js — إسناد المعايير الرسمية (§B2)', () => {
  it('الشبكة موسَّمة: رمز ظاهر + مصدر رسمي لكل معيار', () => {
    expect(MATH_CRITERIA.MAT_INTERPRET).toMatchObject({ code: 'M1', source: 'رسمي – S1' });
    expect(MATH_CRITERIA.MAT_CALC.code).toBe('M2');
    expect(MATH_CRITERIA.MAT_MEASURE.code).toBe('M3');
    expect(MATH_CRITERIA.MAT_GEOMETRY.code).toBe('M4');
    // الحساب الذهني مكوّن مستقل لا معيار
    expect(MATH_CRITERIA.MAT_MENTAL.kind).toBe('component');
    expect(MATH_CRITERIA.MAT_MENTAL.code).toBe('HC');
  });

  it('التصنيف حتمي: هندسة / قياس / صحة حساب / تأويل', () => {
    expect(mapMathCriterion({ prompt: 'احسب محيط المستطيل الذي طوله 5 سم وعرضه 3 سم' })).toBe('MAT_GEOMETRY');
    expect(mapMathCriterion({ prompt: 'حوّل 25 مترًا إلى سنتيمترات: 25 م = .... سم' })).toBe('MAT_MEASURE');
    expect(mapMathCriterion({ prompt: 'أنجز العملية عموديًّا: 2450 − 1955 = ....' })).toBe('MAT_CALC');
    expect(mapMathCriterion({ prompt: 'أيّ عملية تُستعمل لمعرفة ما يبقى من مبلغ سيف بعد الشراء؟' })).toBe('MAT_INTERPRET');
    expect(mapMathCriterion({ prompt: 'هل الخضار أغلى من اللحم في السند؟' })).toBe('MAT_INTERPRET');
    // وضعية نقود فعلية = توظيف وحدات القياس رسميًا (M3)
    expect(mapMathCriterion({ prompt: 'كم يبقى لسيف بعد أن دفع 1275 مليمًا من مبلغه؟' })).toBe('MAT_MEASURE');
    // أمر تنفيذ صريح مع أرقام يبقى M2 حتى لو ذُكرت وحدة نقدية (§B2)
    expect(mapMathCriterion({ prompt: 'أنجزي العملية عموديًّا: 2450 − 930 = …. مليمًا.' })).toBe('MAT_CALC');
    // سؤال حكم نصّي بلا أرقام يبقى تأويلًا ولو ذُكر مبلغ (§B2)
    expect(mapMathCriterion({ prompt: 'هل يكفي مبلغ رحاب الأصليّ لشراءِ الكراسِ والقلم معًا ؟' })).toBe('MAT_INTERPRET');
  });

  it('جدول التوزيع والنقاط حسب المعيار (تقرير المعلّم)', () => {
    const qs = [
      { prompt: 'أنجز: 500 − 250 = ....', points: 3 },
      { prompt: 'حوّل 5 م إلى سم', points: 2 },
      { prompt: 'أيّ عملية تختار؟', points: 1 }
    ];
    expect(criteriaTable(qs)).toBe('س1:M2 · س2:M3 · س3:M1');
    const dist = criteriaDistribution(qs);
    expect(dist.MAT_CALC).toEqual({ points: 3, count: 1 });
    expect(dist.MAT_MEASURE).toEqual({ points: 2, count: 1 });
  });
});

describe('structure.js — قاعدة السلسلة §D11', () => {
  it('يكشف إجابة سابقة مكرّرة في سؤال لاحق', () => {
    const issues = checkAnswerChain(
      [
        { prompt: 'ما لون العصفور في النصّ؟', correctAnswer: 'الحمراء' },
        { prompt: 'اختر العبارة الصحيحة:', options: ['الحمراء أجمل الألوان', 'الزرقاء'] }
      ],
      []
    );
    expect(codes(issues)).toContain('ANSWER_CHAIN_LEAK');
    expect(issues[0].qIndex).toBe(1);
  });

  it('لا يُشير إذا كانت الإجابة متاحة من السند أصلًا (ملء/استخراج)', () => {
    const issues = checkAnswerChain(
      [
        { prompt: 'أكمل: يسقي المربي .... كل صباح', correctAnswer: 'الزهور' },
        { prompt: '«الزهور» جمع لكلمة:', options: ['زهرة', 'زهور'] }
      ],
      [{ text: 'يسقي المربي الزهورَ كل صباح قبل الشروق.' }]
    );
    expect(issues).toHaveLength(0);
  });

  it('الأرقام المحضة مستثناة (سلسلة حلّ مشروعة من معطيات السند)', () => {
    const issues = checkAnswerChain(
      [
        { prompt: 'احسب: 700 − 205 = ....', correctAnswer: '495' },
        { prompt: 'أضف إلى 495 قيمة أخرى ثمّ احسب المجموع.' }
      ],
      [{ text: 'لدى سيف 700 مليمًا اشترى بـ 205 مليمًا.' }]
    );
    expect(issues).toHaveLength(0);
  });

  it('الإجابات القصيرة (صواب/خطأ) ليست كشفًا', () => {
    const issues = checkAnswerChain(
      [
        { prompt: 'الحقل فيه مزارع؟', correctAnswer: 'صواب' },
        { prompt: 'صواب أم خطأ: الحقل فيه مزارع؟', options: ['صواب', 'خطأ'] }
      ],
      []
    );
    expect(issues).toHaveLength(0);
  });
});

// ————— محقّق الرياضيات الموسّع strict —————

const scopeLessons = [
  { title: 'أتعرّفُ الشّبكةَ ومكوّناتِها', competencies: ['حلّ وضعيات بتوظيف خاصيّات الأشكال الهندسيّة والمسالك'] },
  { title: 'أتعرّفُ العلاقةَ بينَ المترْ والسّنتيمترْ', competencies: ['حلّ وضعيات بتوظيف وحدات القيس (الأطوال، الكتل، الزمن، النقود)'] },
  { title: 'أُدرّبُ على حلّ المسائل', competencies: ['توظيف مكتسباتي في حلّ وضعيات من الحياة اليوميّة'] }
];
const blueprint = { subject: 'math', grade: 'year3', scopeLessons };

const goodStimuli = [
  { id: 's1', text: 'في الصباح اشترت رحابُ من الدكّان كراسًا بـ 250 مليمًا وقلمًا بـ 150 مليمًا ودفعت ورقة من 5 دنانير.' },
  { id: 's2', text: 'بعد التسوّق ذهبت رحابُ إلى حديقة الحيّ: طولُ الممرِّ 25 مترًا وعرضُه 8 مترًا على شبكةٍ مربّعة.' }
];
const goodQuestions = [
  { type: 'OPEN', prompt: 'كم تكلّف الكراس والقلم معًا بالمليم؟', correctAnswer: '400 مليمًا', sindId: 's1', points: 3 },
  { type: 'MCQ', prompt: 'أيّ عملية تُستعمل لمعرفة ما تبقّى من ورقة 5 دنانير؟', options: ['5000 + 400', '5000 − 400', '400 − 5000'], correctAnswer: '5000 − 400', sindId: 's1', points: 3 },
  { type: 'FILL_BLANK', prompt: 'أنجز العملية عموديًّا: 1250 − 640 = ....', correctAnswer: '610', layout: 'vertical', sindId: 's1', points: 3 },
  { type: 'FILL_BLANK', prompt: 'حوّل 5 مترًا إلى سنتيمترات: 5 م = .... سم', correctAnswer: '500', sindId: 's1', points: 3 },
  { type: 'OPEN', prompt: 'ارسم على الشبكة مسارًا من 6 عقدٍ إلى اليمين ثمّ 3 عقدٍ إلى الأسفل.', correctAnswer: 'رسم صحيح', layout: 'drawing', sindId: 's2', points: 4 },
  { type: 'MCQ', prompt: 'ما مجموع طول الممرّ وعرضه بالمليم إن كان 1 م = 1000 مليم؟', options: ['33000', '20000', '40000'], correctAnswer: '33000', sindId: 's2', points: 4 }
];

const run = (over = {}) => runSubjectValidators({
  blueprint, questions: goodQuestions, stimuli: goodStimuli, strict: true, ...over
});

describe('math strict — الورقة المطابقة تمرّ بلا أخطاء', () => {
  it('لا أخطاء (لا MONEY_MISSING ولا GEOMETRY_MISSING ولا ربط ولا مساحة)', () => {
    const { issues } = run();
    expect(issues.filter((i) => i.severity === 'error')).toHaveLength(0);
  });
});

describe('math strict — الفحوصات الموجّهة (§B3/§D5/§D12)', () => {
  it('سند واحد في y3+ → MATH_STIMULUS_LINKAGE', () => {
    const { issues } = run({ stimuli: [goodStimuli[0]] });
    expect(codes(issues)).toContain('MATH_STIMULUS_LINKAGE');
  });

  it('السند الثاني منفصل سياقيًّا → MATH_STIMULUS_DISJOINT', () => {
    const { issues } = run({
      stimuli: [goodStimuli[0], { id: 's2', text: 'يشرح المعلّم قواعد النحوَ والإملاءَ في الحصّةِ الصباحية.' }]
    });
    expect(codes(issues)).toContain('MATH_STIMULUS_DISJOINT');
  });

  it('النقود في تعلمات الوحدة بلا سؤال مالي → MONEY_MISSING', () => {
    const noMoney = goodQuestions.map((q, i) => (i <= 1
      ? { ...q, prompt: `سؤال رياضي عادي رقم ${i}: احسب ${i + 10} + ${i + 5} = ....`, correctAnswer: String(i * 11), layout: i === 2 ? 'vertical' : q.layout }
      : { ...q, prompt: q.prompt.replace(/مليم|دينار|دفع|نقدية|مبلغ|شراء|تبقّى|ادّخار|الكراس|القلم/g, 'عنصر') }));
    const { issues } = run({ questions: noMoney });
    expect(codes(issues)).toContain('MONEY_MISSING');
  });

  it('قيمة نقدية خاطئة في التساوي → MONEY_VALUE_INVALID', () => {
    const { issues } = run({
      stimuli: [{ id: 's1', text: '250 مليمًا يساوي 25 دينارًا في هذا الوصف الخاطئ.' }, goodStimuli[1]]
    });
    expect(codes(issues)).toContain('MONEY_VALUE_INVALID');
  });

  it('قطعة نقدية غير متداولة → MONEY_DENOM_INVALID', () => {
    const { issues } = run({
      questions: goodQuestions.map((q, i) => (i === 0
        ? { ...q, prompt: 'لدى رحاب قطعة نقدية من 300 مليمًا: كم دينارًا تعادل؟', correctAnswer: '0.3' }
        : q))
    });
    expect(codes(issues)).toContain('MONEY_DENOM_INVALID');
  });

  it('الهندسة في تعلمات الوحدة بلا سؤال هندسي → GEOMETRY_MISSING', () => {
    const { issues } = run({
      questions: goodQuestions.map((q, i) => (i === 4
        ? { ...q, prompt: 'أكمل: 8 + 7 = ....', correctAnswer: '15', layout: undefined }
        : q))
    });
    expect(codes(issues)).toContain('GEOMETRY_MISSING');
  });

  it('عنصر هندسي بلا فعل تحليل → GEOMETRY_NOT_MEASURED (تحذير)', () => {
    const { issues } = run({
      questions: goodQuestions.map((q, i) => (i === 4
        ? { ...q, prompt: 'انظر إلى الشكل الهندسي في السند وقل: هل هو جميل؟' }
        : q))
    });
    const hit = issues.find((i) => i.code === 'GEOMETRY_NOT_MEASURED');
    expect(hit).toBeTruthy();
    expect(hit.severity).toBe('warn');
  });

  it('وحدات القياس في التعلمات بلا سؤال قياس → MEASURE_MISSING', () => {
    const { issues } = run({
      questions: goodQuestions.map((q, i) => (i === 3
        ? { ...q, prompt: 'احسب: 900 − 450 = ....', correctAnswer: '450' }
        : i === 5
          ? { ...q, prompt: 'ما مجموع الرقمين التاليين: 25 + 8 = ؟', options: ['33', '17', '25'], correctAnswer: '33' }
          : q))
    });
    expect(codes(issues)).toContain('MEASURE_MISSING');
  });

  it('طلب عمودي مع layout آخر → VERTICAL_SPACE_MISSING', () => {
    const { issues } = run({
      questions: goodQuestions.map((q, i) => (i === 2 ? { ...q, layout: 'horizontal' } : q))
    });
    expect(codes(issues)).toContain('VERTICAL_SPACE_MISSING');
  });

  it('ورقة عمليات y3+ بلا أي مساحة عمودية → NO_VERTICAL_WORK_SPACE', () => {
    const { issues } = run({
      questions: goodQuestions.map((q, i) => (i === 2 ? { ...q, layout: undefined } : q))
    });
    expect(codes(issues)).toContain('NO_VERTICAL_WORK_SPACE');
  });
});

describe('math دون strict — الوحدات القائمة لم تتغيّر', () => {
  it('كل الفحوصات الموسّعة صامتة خارج requireStructure', () => {
    const { issues } = runSubjectValidators({
      blueprint, questions: [{ type: 'MCQ', prompt: '1 + 1 = ?', options: ['2', '3'], correctAnswer: '2' }],
      stimuli: [], strict: false
    });
    expect(codes(issues)).not.toContain('MATH_STIMULUS_LINKAGE');
    expect(codes(issues)).not.toContain('MONEY_MISSING');
    expect(codes(issues)).not.toContain('GEOMETRY_MISSING');
    expect(codes(issues)).not.toContain('MEASURE_MISSING');
    expect(codes(issues)).not.toContain('NO_VERTICAL_WORK_SPACE');
  });
});
