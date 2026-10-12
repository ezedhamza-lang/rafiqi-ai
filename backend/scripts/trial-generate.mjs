// توليد تجريبي: أربع ورقات حقيقية عبر خطّ التوليد الكامل (لا DB، بلا إنفاق —
// مزوّد مُحاكى يمرّر مخرجات محرّرة يدويًّا بنفس عقد المخرج §76).
// كل ورقة: buildBlueprint → buildExamPrompt (يُحفظ للمراجعة) → parse → normalize
// → validateExam(stimulusRequired + requireCount) → تقرير ✓/⚠/✗ صادق.
// المخرج: frontend/src/trial-papers.json لمعاينة بعين المستخدمين + اعتماد stdout.
// التشغيل: node scripts/trial-generate.mjs   (يخرج بـcode 1 إن رُفضت ورقة)

import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { buildBlueprint, validateBlueprint } from '../src/exams/exam-blueprint.js';
import {
  buildExamPrompt,
  parseGeneratedExamPayload,
  normalizeGeneratedStimuli,
  normalizeGeneratedQuestions
} from '../src/exams/generation.js';
import { validateExam, auditReportLines } from '../src/exams/exam-pipeline.js';
import { subjectLabel } from '../src/exams/subject-labels.js';
import { scopeLessonsForTrimester } from '../src/exams/curriculum-index.js';
import { criteriaFor } from '../src/exams/criteria-grids.js';
import { criteriaDisplay } from '../src/exams/criterion-map.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const PROMPT_DIR = process.env.RAFIQI_TRIAL_DIR || join(process.env.TEMP || '.', 'rafiqi-trial');
const PAPERS_OUT = join(HERE, '..', '..', 'frontend', 'src', 'trial-papers.json');

/* ═══════════════ محرّك المحتوى: المخرج كما يخرجه نموذج ملتزم بالبرومبت ═══════════ */

const TRIALS = [
  /* 1) الإيقاظ العلمي — السنة الأولى: طفل صغير، مشهد موصوف، بلا حساب (§79) */
  {
    key: 'science-y1',
    level: 'year1', subject: 'science', trimester: 1, questionCount: 6, targetPoints: 20, durationMinutes: 25,
    title: 'اختبار الفصل الأول — الإيقاظ العلمي',
    stimuli: [{
      id: 's1', title: 'السند 1: في حديقة المدرسة', stimulusType: 'situation',
      purpose: 'لاحِظوا: أين تقف رحاب؟ وماذا ترى وتسمع وتلمس من حولها؟',
      text: 'في حديقة المدرسة تقف رحاب أمام الشجرة الكبيرة. خلفها مقعد أزرق، وفوق الشجرة عصفور صغير، وإلى يمينها باب المدرسة الأحمر. تشمّ رحاب زهرًا أحمر، وتسمع صوت العصفور، وترى الباب الأحمر، وتلمس أوراق الشجرة.'
    }],
    questions: [
      { lessonIdx: 0, type: 'MCQ', difficulty: 1, points: 4, estimatedTime: 2, sindId: 's1',
        prompt: 'أين يقع المقعد الأزرق بالنسبة لرحاب ؟', options: ['أمامها', 'خلفها', 'فوقها'], correctAnswer: 'خلفها' },
      { lessonIdx: 0, type: 'TRUE_FALSE', difficulty: 2, points: 3, estimatedTime: 1, sindId: 's1',
        prompt: 'العصفور الصغير فوق الشجرة.', correctAnswer: 'صواب' },
      { lessonIdx: 1, type: 'FILL_BLANK', difficulty: 2, points: 3, estimatedTime: 2, sindId: 's1',
        prompt: 'باب المدرسة إلى يمين رحاب لونه ‏…‏.', correctAnswer: 'الأحمر' },
      { lessonIdx: 3, type: 'EXTRACT', difficulty: 3, points: 4, estimatedTime: 2, sindId: 's1',
        prompt: 'ما الذي تشمّه رحاب في الحديقة ؟', correctAnswer: 'زهرًا', acceptedAnswers: ['زهرًا', 'الزهر', 'زهر'] },
      { lessonIdx: 3, type: 'ORDER', difficulty: 2, points: 3, estimatedTime: 1, sindId: 's1',
        prompt: 'رتّب ما فعلته رحاب كما ورد في النص.',
        orderItems: ['تقف رحاب أمام الشجرة', 'تشمّ رحاب الزهر', 'تلمس أوراق الشجرة'] },
      { lessonIdx: 3, type: 'MCQ', difficulty: 2, points: 3, estimatedTime: 2, sindId: 's1',
        prompt: 'بأيّ حاسة ترى رحاب الباب الأحمر ؟', options: ['العين', 'الأذن', 'الأنف'], correctAnswer: 'العين' }
    ]
  },

  /* 2) القراءة — السنة الثالثة: نصّ ≥10 أسطر مشكّل تشكيلًا تامًّا، غير رقمي،
        يحمل فرص القياس الثلاث: قرينة + تعليل + إبداء الرأي (§6-§10) */
  {
    key: 'reading-y3',
    level: 'year3', subject: 'reading', trimester: 1, questionCount: 8, targetPoints: 20, durationMinutes: 40,
    title: 'اختبار الفصل الأول — القراءة',
    stimuli: [{
      id: 's1', title: 'السند 1: زيارة مكتبة الحيّ', stimulusType: 'text',
      purpose: 'اقرؤوا النصّ وتابعوا حدثَ اليوم مع مريم ونور.',
      text: [
        'فِي يَوْمِ الْأَحَدِ، ذَهَبَتْ مَرْيَمُ مَعَ صَدِيقَتِهَا نُورٍ إِلَى مَكْتَبَةِ الْحَيِّ.',
        'كَانَتِ الْمَكْتَبَةُ هَادِئَةً وَمُنَوَّرَةً، وَعَلَى رُفُوفِهَا تَفَّاحَاتٌ مِنَ الْكُتُبِ.',
        'جَلَسَتَا تَحْتَ نَافِذَةٍ وَاسِعَةٍ يَدْخُلُ مِنْهَا نُورُ الشَّمْسِ.',
        'فَتَحَتْ مَرْيَمُ قِصَّةً عَنْ طَيْرٍ يُسَافِرُ بَعِيدًا وَيَعُودُ إِلَى عُشِّهِ كُلَّ رَبِيعٍ.',
        'سَمِعَتْ نُورٌ صَوْتَ الْحَمَامَةِ فَوْقَ بَابِ الْمَكْتَبَةِ وَقَالَتْ: مَا أَجْمَلَ هَذَا الصَّوْتَ!',
        'قَرَأَتْ مَرْيَمُ أَبْيَاتًا مِنَ الْقِصَّةِ وَهِيَ تُحَاكِي صَوْتَ الْبَطَّةِ الَّتِي فِيهَا.',
        'ضَحِكَتْ نُورٌ مِنْ تَحَاكِيهَا، ثُمَّ سَأَلَتْ: لِمَاذَا يَعُودُ الطَّيْرُ إِلَى عُشِّهِ كُلَّ رَبِيعٍ؟',
        'أَجَابَتْ مَرْيَمُ: لِأَنَّ عُشَّهُ مَكَانٌ آمٌ لَهُ، وَهُنَالِكَ أَصْحَابُهُ وَطَعَامُهُ.',
        'اخْتَارَتْ نُورٌ كِتَابًا عَنِ الْأَزْهَارِ، وَاسْتَعَارَتْهُ مِنْ أُمِّ الْمَكْتَبَةِ لِتَقْرَأَهُ فِي الْبَيْتِ.',
        'أَعْطَتْ أُمُّ الْمَكْتَبَةِ لِكُلِّ وَاحِدَةٍ وَرَقَةً صَغِيرَةً لِتَكْتُبَا اسْمَيْهِمَا وَتَارِيخَ الزِّيَارَةِ.',
        'قَالَتْ مَرْيَمُ لِنُورٍ: هَلْ نَعُودُ إِلَى هَذِهِ الْمَكْتَبَةِ كُلَّ أُسْبُوعٍ مَعًا؟',
        'وَأَجَابَتْ نُورٌ بِفَرَحٍ: نَعَمْ، فَالْقِرَاءَةُ مَعَ الصَّدِيقِ أَحَلَى مِنَ الْقِرَاءَةِ وَحْدَهَا.'
      ].join('\n')
    }],
    questions: [
      { lessonIdx: 0, type: 'MCQ', difficulty: 1, points: 2, estimatedTime: 2, sindId: 's1',
        prompt: 'مع من ذهبت مريم إلى مكتبة الحيّ ؟', options: ['مع صديقتها نور', 'مع أمّها', 'وحدها'], correctAnswer: 'مع صديقتها نور' },
      { lessonIdx: 0, type: 'TRUE_FALSE', difficulty: 1, points: 1.5, estimatedTime: 1, sindId: 's1',
        prompt: 'كتبت مريم اسمها وتاريخ الزيارة على ورقة صغيرة.', correctAnswer: 'صواب' },
      { lessonIdx: 0, type: 'FILL_BLANK', difficulty: 2, points: 2, estimatedTime: 2, sindId: 's1',
        prompt: 'استعارت نور كتابًا عن ‏…‏ من أمّ المكتبة.', correctAnswer: 'الأزهار' },
      { lessonIdx: 1, type: 'EXTRACT', difficulty: 2, points: 2.5, estimatedTime: 3, sindId: 's1',
        prompt: 'اكتب من النصّ قرينةً تدلّ على أنّ المكان هادئ.',
        correctAnswer: 'كانت المكتبة هادئة', acceptedAnswers: ['كانت المكتبة هادئة', 'هادئة ومضيئة'] },
      { lessonIdx: 1, type: 'ORDER', difficulty: 3, points: 2.5, estimatedTime: 3, sindId: 's1',
        prompt: 'رتّب زيارة مريم ونور كما وردت في النصّ.',
        orderItems: ['الذهاب إلى مكتبة الحيّ', 'الجلوس تحت النافذة وبدء القراءة', 'استعارة كتاب عن الأزهار', 'كتابة الاسمين على الورقة'] },
      { lessonIdx: 0, type: 'MCQ', difficulty: 2, points: 3.5, estimatedTime: 2, sindId: 's1', competency: 'كفاية القيم',
        prompt: 'ماذا اقترحت مريم على نور في نهاية النصّ ؟',
        options: ['أن يعودا كل أسبوع معًا', 'أن تشترا كتابًا جديدًا', 'أن تغلقا الباب'], correctAnswer: 'أن يعودا كل أسبوع معًا' },
      { lessonIdx: 2, type: 'OPEN', difficulty: 3, points: 2.5, estimatedTime: 4, sindId: 's1',
        prompt: 'علّل: لماذا يعود الطائر إلى عشه كل ربيع ؟',
        correctAnswer: 'لأنّ عشه مكان آمّ له، وهناك أصحابه وطعامه.',
        expectedResponseType: 'جملة', answerLines: 2 },
      { lessonIdx: 2, type: 'OPEN', difficulty: 4, points: 3.5, estimatedTime: 5, sindId: 's1', competency: 'كفاية التعبير',
        prompt: 'هل توافق اختيار نور لكتاب الأزهار ؟ علّل رأيك.',
        expectedResponseType: 'جملة', answerLines: 3 }
    ]
  },

  /* 3) الرياضيات — السنة الثالثة: سندان مترابطان (§D5) + وضعية نقود فعلية (§B3)
        + قيس تحويل وحدات + هندسة بمساحة رسم + عملية عمودية بمساحة مستقلة (§D12)
        + لا كشف إجابة سابقة (§D11) + إسناد معيار رسمي لكل سؤال (§B2) */
  {
    key: 'math-y3',
    level: 'year3', subject: 'math', trimester: 1, questionCount: 8, targetPoints: 20, durationMinutes: 40,
    title: 'اختبار الفصل الأول — الرياضيات',
    stimuli: [
      {
        id: 's1', title: 'السند 1: تسوّق رحاب في دكّان الحيّ', stimulusType: 'situation',
        purpose: 'ما بقي من مبلغها بعد الشراء، وما تضافّه إلى ادّخارها.',
        text: 'لدى رحابَ في صندوقِ ادّخارِها مبلغٌ قدرُه 2450 مليمًا. اشترت من الدكّانِ كراسًا بـ 250 مليمًا وقلمًا بـ 680 مليمًا، فكان ثمنُهما معًا 930 مليمًا، ودفعتْ ثمنَهما من مبلغِها. ثمّ وجدتْ في طريقِها قطعةً نقديةً من 250 مليمًا فزادَتْها إلى ادّخارِها.'
      },
      {
        id: 's2', title: 'السند 2: ممرّ حديقة الحيّ وشبكة الرسم', stimulusType: 'situation',
        purpose: 'احسبوا الأطوال، وارسموا مسار رحاب على الشبكة.',
        text: 'بعد التسوّقِ، ذهبتْ رحابُ مع أبيها إلى حديقةِ الحيّ. طولُ ممرِّ الحديقةِ 25 مترًا وعرضُ ممرٍ آخرِ 8 أمتار، ويعلمُ أنّ 1 مترًا يساوي 100 سنتيمتر. رسمتْ رحابُ على شبكةٍ مربّعةٍ مسارًا: تحرّكتْ 6 عقدٍ إلى اليمين ثمّ 3 عقدٍ إلى الأسفل.'
      }
    ],
    questions: [
      { lessonIdx: 4, type: 'EXTRACT', difficulty: 1, points: 2, estimatedTime: 2, sindId: 's1',
        prompt: 'استخرج من السندّ مبلغ ادّخار رحاب في البداية.',
        correctAnswer: '2450 مليمًا', acceptedAnswers: ['2450 مليمًا', '2450'] },
      { lessonIdx: 4, type: 'MCQ', difficulty: 2, points: 3, estimatedTime: 3, sindId: 's1',
        prompt: 'فسّري: كيف استطاعت رحاب أن تشتري الكراس والقلم معًا وهي تملك 2450 مليمًا ؟',
        options: ['لأنّ ثمنَهما أقلّ من مبلغِها', 'لأنّ مبلغِها أقلّ من ثمنِهما', 'لأنّ الدكّان يعطي هدية مجانية'],
        correctAnswer: 'لأنّ ثمنَهما أقلّ من مبلغِها' },
      { lessonIdx: 3, type: 'FILL_BLANK', difficulty: 3, points: 3.5, estimatedTime: 4, sindId: 's1', layout: 'vertical',
        prompt: 'أنجزي العملية عموديًّا: 2450 − 930 = …. مليمًا.', correctAnswer: '1520' },
      { lessonIdx: 4, type: 'FILL_BLANK', difficulty: 3, points: 2.5, estimatedTime: 3, sindId: 's1',
        prompt: 'زادتْ رحابُ قطعةً نقديةً من 250 مليمًا إلى ما بقيَ لها: صار ادّخارها ‏…‏ مليمًا.',
        correctAnswer: '1770' },
      { lessonIdx: 4, type: 'TRUE_FALSE', difficulty: 2, points: 1.5, estimatedTime: 1, sindId: 's1',
        prompt: 'هل يكفي مبلغ رحاب الأصليّ لشراءِ الكراسِ والقلم معًا ؟', correctAnswer: 'صواب' },
      { lessonIdx: 2, type: 'FILL_BLANK', difficulty: 2, points: 2.5, estimatedTime: 3, sindId: 's2',
        prompt: 'حوّل طولَ الممرِّ إلى سنتيمترات: 25 م = …. سم.', correctAnswer: '2500' },
      { lessonIdx: 1, type: 'OPEN', difficulty: 3, points: 2.5, estimatedTime: 4, sindId: 's2', layout: 'drawing',
        prompt: 'ارسمي على الشبكة مسارَ رحاب: 6 عقدٍ إلى اليمين ثمّ 3 عقدٍ إلى الأسفل، ثمّ حدّدي المربعَ الأوّليّ الذي تكوّن.',
        correctAnswer: 'مسار صحيح: 6 عقدٍ إلى اليمين ثمّ 3 عقدٍ إلى الأسفل مع تحديد المربع الأوّلي.',
        expectedResponseType: 'جملة', answerLines: 2 },
      { lessonIdx: 2, type: 'MCQ', difficulty: 2, points: 2.5, estimatedTime: 3, sindId: 's2',
        prompt: 'ما مجموعُ طولِ الممرِّ وعرضِه ؟',
        options: ['33 م', '17 م', '25 م'], correctAnswer: '33 م' }
    ]
  },

  /* 4) اللغة العربية — السنة الثالثة: محتوى لغوي صرف، لا حساب البتّة (§55,§79) */
  {
    key: 'arabic-y3',
    level: 'year3', subject: 'arabic', trimester: 1, questionCount: 8, targetPoints: 20, durationMinutes: 40,
    title: 'اختبار الفصل الأول — اللغة العربية',
    stimuli: [{
      id: 's1', title: 'السند 1: حديقة مدرستنا', stimulusType: 'text',
      purpose: 'أزهارها ونظافتها وزراعة البذور — اقرؤوا النصّ وتابعوا.',
      text: [
        'حَدِيقَةُ مَدْرَسَتِنَا صَغِيرَةٌ لَكِنَّهَا جَمِيلَةٌ جِدًّا.',
        'فِيهَا أَزْهَارٌ حَمْرَاءُ وَصَفْرَاءُ، وَشَجَرَتَانِ كَبِيرَتَانِ مُظِلَّتَانِ.',
        'يَجْلِسُ التَّلَامِيذُ تَحْتَ الشَّجَرَتَيْنِ فِي اسْتِرَاحَةِ الْخَمِيسِ.',
        'يَسْقِي الْمُرَبِّي الزُّهُورَ كُلَّ صَبَاحٍ قَبْلَ دُخُولِ الْحِصْصِ.',
        'وَيَنْظِّفُ التَّلَامِيذُ أَرْضَ الْحَدِيقَةِ وَيَضَعُونَ الْقُمَامَةَ فِي السَّلَّةِ.',
        'نُحِبُّ حَدِيقَةَ مَدْرَسَتِنَا وَنَحْفَظُ عَلَى نَظَافَتِهَا.',
        'يَزْرَعُ الْمُرَبِّي مَعَ التَّلَامِيذِ بُذُورًا فِي رُكْنٍ مِنْ أَرْكَانِ الْحَدِيقَةِ.',
        'وَالْمَاءُ وَالشَّمْسُ يُسَاعِدَانِ الْبُذُورَ عَلَى النَّمَاءِ السَّرِيعِ.',
        'فِي كُلِّ رَبِيعٍ تَفْتَحُ أَزْهَارٌ جَدِيدَةٌ تُزْيِنُ أَرْضَ حَدِيقَتِنَا.',
        'نَقُولُ لِزُوَّارِنَا: ادْخُلُوا حَدِيقَةَ مَدْرَسَتِنَا وَاشْرَبُوا مِنْ هَوَائِهَا النَّقِيِّ.'
      ].join('\n')
    }],
    questions: [
      { lessonIdx: 25, type: 'MCQ', difficulty: 1, points: 2.5, estimatedTime: 2, sindId: 's1', competency: 'كفاية القراءة والفهم',
        prompt: 'أين يجلس التلاميذ في استراحة الخميس ؟',
        options: ['تحت الشجرتين', 'فوق السطح', 'خلف المدرسة'], correctAnswer: 'تحت الشجرتين' },
      { lessonIdx: 25, type: 'TRUE_FALSE', difficulty: 2, points: 2.5, estimatedTime: 1, sindId: 's1', competency: 'كفاية القراءة والفهم',
        prompt: 'حديقة مدرستنا كبيرة جدًّا.', correctAnswer: 'خطأ' },
      { lessonIdx: 25, type: 'FILL_BLANK', difficulty: 2, points: 2.5, estimatedTime: 2, sindId: 's1', competency: 'كفاية القراءة والفهم',
        prompt: 'يسقي المربي ‏…‏ كل صباح.', correctAnswer: 'الزهور' },
      { lessonIdx: 25, type: 'EXTRACT', difficulty: 3, points: 2.5, estimatedTime: 2, sindId: 's1', competency: 'كفاية القراءة والفهم',
        prompt: 'استخرج من النصّ لونين للأزهار في الحديقة.',
        correctAnswer: 'حمراء', acceptedAnswers: ['حمراء', 'صفراء', 'حمراء وصفراء'] },
      { lessonIdx: 25, type: 'MCQ', difficulty: 2, points: 2, estimatedTime: 2, sindId: 's1', competency: 'كفاية القراءة والفهم',
        prompt: '«الزهور» جمع لـ: ‏', options: ['زهرة', 'زهران', 'مزهرية'], correctAnswer: 'زهرة' },
      { lessonIdx: 25, type: 'OPEN', difficulty: 3, points: 2.5, estimatedTime: 3, sindId: 's1', competency: 'كفاية التعبير',
        prompt: 'اكتب جملتين تصف فيهما نظافة حديقة مدرستك.',
        expectedResponseType: 'جملة', answerLines: 2 },
      { lessonIdx: 25, type: 'OPEN', difficulty: 4, points: 4, estimatedTime: 4, sindId: 's1', competency: 'إنتاج كتابي',
        prompt: 'اشرح بأسلوبك كيف يساهم كل تلميذ في المحافظة على نظافة الحديقة.',
        expectedResponseType: 'جملة', answerLines: 4 },
      { lessonIdx: 25, type: 'FILL_BLANK', difficulty: 2, points: 1.5, estimatedTime: 1, sindId: 's1', competency: 'كفاية القراءة والفهم',
        prompt: 'أكمل: نحافظ على ‏…‏ الحديقة.', correctAnswer: 'نظافة' }
    ]
  }
];

/* ═══════════════════════════ التشغيل: خطّ التوليد الحقيقي ══════════════════════ */

function fullLesson(grade, subject, trimester, title) {
  const { lessons } = scopeLessonsForTrimester({ level: grade, subject, trimester });
  return lessons.find((l) => l.title === title) || lessons[0] || {};
}

const papers = [];
let failed = 0;

mkdirSync(PROMPT_DIR, { recursive: true });

for (const trial of TRIALS) {
  // 1) المخطّط أولًا (§1,§10)
  const blueprint = buildBlueprint({
    level: trial.level, subject: trial.subject, trimester: trial.trimester,
    questionCount: trial.questionCount, targetPoints: trial.targetPoints,
    durationMinutes: trial.durationMinutes, assessmentType: 'term'
  });
  const bpCheck = validateBlueprint(blueprint);
  if (!bpCheck.valid) {
    failed += 1;
    console.log(`✗ ${trial.key}: مخطّط مرفوض — ${bpCheck.issues.filter((i) => i.severity === 'error').map((i) => i.message).join('؛ ')}`);
    continue;
  }

  // 2) برومبت الطبقات (يُحفظ للمراجعة — لا نغيّره من السكربت)
  const prompt = buildExamPrompt(blueprint, {});
  writeFileSync(join(PROMPT_DIR, `${trial.key}.system.txt`), prompt.system, 'utf8');
  writeFileSync(join(PROMPT_DIR, `${trial.key}.user.txt`), prompt.user, 'utf8');

  // 3) مخرج «النموذج» (محاكاة): كائن JSON يمرّ بالمسار نفسه §89
  const payload = {
    stimuli: trial.stimuli,
    questions: trial.questions.map((q, i) => {
      const lesson = fullLesson(trial.level, trial.subject, trial.trimester, blueprint.scopeLessons[q.lessonIdx]?.title);
      return {
        ...q,
        lesson: lesson.title,
        // المكتسب: مكتسب السؤال الصريح إن أعطاه المؤلّف، وإلا مكتسب الدرس الأول (§9)
        competency: q.competency || (lesson.competencies || [])[0] || lesson.title,
        objective: (lesson.objectives || [])[0] || lesson.title,
        domain: lesson.domain || null
      };
    })
  };
  const parsed = parseGeneratedExamPayload(JSON.stringify(payload));
  const normStim = parsed ? normalizeGeneratedStimuli(parsed.stimuli, blueprint) : { stimuli: [], invalid: [] };
  const normQs = parsed ? normalizeGeneratedQuestions(parsed.questions, blueprint) : null;

  if (!normQs) {
    failed += 1;
    console.log(`✗ ${trial.key}: فشل قراءة المخرج`);
    continue;
  }

  // 4) التدقيق الكامل: سند إلزامي + عدّاد المخطّط (§18,§51)
  const validation = validateExam({
    blueprint,
    questions: normQs,
    stimuli: normStim.stimuli,
    stimulusRequired: true,
    durationMinutes: blueprint.durationMinutes,
    title: trial.title
  }, { requireCount: true, requireStructure: true }); // البنية: طول/تشكيل النص + تنويع الصيغ + فرص القراءة (§4,§6,§36) + §D11 السلسلة + §B3 رياضيات موسّعة + §D12 المساحات

  const errs = validation.issues.filter((i) => i.severity === 'error');
  const warns = validation.issues.filter((i) => i.severity === 'warn');
  if (!validation.approved) failed += 1;
  if (process.env.TRIAL_DEBUG) {
    console.log(`\n[TRIAL_DEBUG ${trial.key}]`);
    console.log(JSON.stringify(validation.issues, null, 2));
    console.log('COVERAGE:', JSON.stringify(validation.coverage));
  }

  console.log(`\n${validation.approved ? '✓' : '✗'} ${trial.key} — ${trial.title}`);
  console.log(`  مخطّط: ${blueprint.gradeLabel} / ${blueprint.subjectLabel} / الثلاثي ${blueprint.trimester} — ${blueprint.questionCount} سؤالًا / ${blueprint.targetPoints} نقطة / ${blueprint.durationMinutes} د`);
  console.log(`  تديق: ${errs.length} خطأ، ${warns.length} تنبيه، إصلاحات حتمية: ${(validation.repairNotes || []).length}`);
  for (const line of auditReportLines(validation.audit)) console.log(`  ${line}`);
  for (const e of errs) console.log(`  ✗ ${e.code}: ${e.message}`);

  papers.push({
    key: trial.key,
    title: trial.title,
    status: validation.status,
    approved: validation.approved,
    blueprintSummary: {
      grade: blueprint.grade, gradeLabel: blueprint.gradeLabel,
      subject: blueprint.subject, subjectLabel: blueprint.subjectLabel,
      trimester: blueprint.trimester, assessmentType: 'اختبار الفصل الأول',
      questionCount: blueprint.questionCount, targetPoints: blueprint.targetPoints,
      durationMinutes: blueprint.durationMinutes
    },
    stimuli: validation.stimuli,
    questions: validation.questions,
    // §B2: شبكة التنقيط مع البيانات المزدوجة (رسمي + مصدر) — كما يحفظه teacherContent
    criteria: criteriaFor(blueprint.subject, blueprint.targetPoints)
      .map((c) => ({ ...c, ...(criteriaDisplay(c.id, trial.subject) || {}) })),
    audit: validation.audit,
    report: validation.report,
    issues: validation.issues,
    repairNotes: validation.repairNotes || []
  });
}

mkdirSync(dirname(PAPERS_OUT), { recursive: true });
writeFileSync(PAPERS_OUT, JSON.stringify(papers, null, 2), 'utf8');
console.log(`\n${papers.length} ورقة محفوظة → ${PAPERS_OUT}`);
console.log(`برومبتات محفوظة → ${PROMPT_DIR}`);
console.log(failed ? `✗ فشل: ${failed} ورقة` : '✓ كل الأوراق سليمة (approved)');
process.exit(failed ? 1 : 0);
