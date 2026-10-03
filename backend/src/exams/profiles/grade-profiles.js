// ملفات السنوات — Grade Profiles (Spec §11-§13,§27,§41).
//
// السنة تقرّر لغة السند وطول التعليمية وأنواع المهام المسموحة — لا ذوق الـLLM.
// «ما يناسب الأولى لا يصح نسخه إلى السادسة»: نفس المادة تتغيّر بتغيّر السنة.
// (الملف هو نقل `GRADE_PROFILE` القديم من generation.js + حقول إضافية قابلة للتوسعة.)

export const GRADE_PROFILES = {
  year1: {
    id: 'year1',
    label: 'السنة الأولى ابتدائي (6 سنوات)',
    ageBand: '6',
    language: 'تعليمات من جملة واحدة قصيرة جدًّا، كلمات مألوفة، أرقام 0-99، أسئلة قصيرة، تفضيل الأسئلة المصوّرة/التصنيف/المطابقة/الاختيار',
    languageQuant: 'أرقام 0-99، محسوس وبصري، تعليمات جملة واحدة، تفضيل المطابقة والتصنيف والاختيار',
    maxPrompt: 120,
    visualDependence: 'high',
    scaffolding: 'full',
    allowedTypes: ['MCQ', 'TRUE_FALSE', 'MATCHING', 'FILL_BLANK', 'EXTRACT', 'ORDER'],
    // طول نصّ القراءة (§6 MASTER): y3+ ≥ 10 أسطر قاعدة تصميمية معلنة؛ y1-2 تقدير
    // تصميمي أدنى (نصّ السنة الأولى قصير بالفعل). يُطبَّق فقط على مواد textStimulus.
    minStimulusLines: 4,
    readingItems: [], // السنة الأولى: الفهم المباشر والصور — بلا قرينة/رأي إلزامية
    scienceItems: [] // y1: allowedTypes بلا OPEN — تعليل/إصلاح الخطأ يبدأان من y2 (§C7)
  },
  year2: {
    id: 'year2',
    label: 'السنة الثانية ابتدائي (7 سنوات)',
    ageBand: '7',
    language: 'تعليمات قصيرة، جمل قصيرة، معطيات محسوسة، وفضّل «و… ثم» في الإنتاج الكتابي متى كان ذلك هو المستعمل في البرنامج (§15)',
    languageQuant: 'أرقام إلى 999، معطيات محسوسة، عملية واحدة في الخطوة، تعليمات قصيرة',
    maxPrompt: 150,
    visualDependence: 'high',
    scaffolding: 'high',
    allowedTypes: ['MCQ', 'TRUE_FALSE', 'MATCHING', 'FILL_BLANK', 'EXTRACT', 'ORDER', 'OPEN'],
    minStimulusLines: 6,
    readingItems: ['evidence'], // السنة الثانية: استخراج قرينة صريحة — التعليل والرأي في y3+
    scienceItems: ['justification', 'errorFix'] // §C7: تعليل + اكتشف/أصلح الخطأ (y2 فما فوق)
  },
  year3: {
    id: 'year3',
    label: 'السنة الثالثة ابتدائي (8 سنوات)',
    ageBand: '8',
    language: 'نص قصير متماسك، مفردات مشروحة سياقيًّا، تعليمات واضحة غير تقنية',
    languageQuant: 'مسائل خطوة واحدة إلى خطوتين، جداول بسيطة، تعليمات واضحة',
    maxPrompt: 220,
    visualDependence: 'medium',
    scaffolding: 'medium',
    allowedTypes: ['MCQ', 'TRUE_FALSE', 'MATCHING', 'FILL_BLANK', 'EXTRACT', 'ORDER', 'OPEN'],
    minStimulusLines: 10, // §6 MASTER: السنة الثالثة انتقال — نصّ ≥ 10 أسطر مشكّل
    minStimulusWords: 120, // §C9: نصّ القراءة 120-200 كلمة (متوسط المكتبة 150)
    maxStimulusWords: 200,
    readingItems: ['evidence', 'justification', 'opinion'], // §8-§10: قرينة + تعليل + رأي
    scienceItems: ['justification', 'errorFix']
  },
  year4: {
    id: 'year4',
    label: 'السنة الرابعة ابتدائي (9 سنوات)',
    ageBand: '9',
    language: 'نص سند قصير وسؤال فهم ولغة وقواعد بسيطة ومناسبة للبرنامج',
    languageQuant: 'نص سند قصير وسؤال على معطياته، مسائل بخطوة واحدة، مصطلحات البرنامج',
    maxPrompt: 260,
    visualDependence: 'medium',
    scaffolding: 'medium',
    allowedTypes: ['MCQ', 'TRUE_FALSE', 'MATCHING', 'FILL_BLANK', 'EXTRACT', 'ORDER', 'OPEN'],
    minStimulusLines: 10,
    minStimulusWords: 120,
    maxStimulusWords: 200,
    readingItems: ['evidence', 'justification', 'opinion'],
    scienceItems: ['justification', 'errorFix']
  },
  year5: {
    id: 'year5',
    label: 'السنة الخامسة ابتدائي (10 سنوات)',
    ageBand: '10',
    language: 'نص سند قصير متماسك وأسئلة فهم ولغة وقواعد وإنتاج كتابي مناسبة للبرنامج',
    languageQuant: 'مسائل من خطوة إلى خطوتين، نص سند، مصطلحات البرنامج الرسمية',
    maxPrompt: 300,
    visualDependence: 'low',
    scaffolding: 'medium',
    allowedTypes: ['MCQ', 'TRUE_FALSE', 'MATCHING', 'FILL_BLANK', 'EXTRACT', 'ORDER', 'OPEN'],
    minStimulusLines: 10,
    minStimulusWords: 120,
    maxStimulusWords: 200,
    readingItems: ['evidence', 'justification', 'opinion'],
    scienceItems: ['justification', 'errorFix']
  },
  year6: {
    id: 'year6',
    label: 'السنة السادسة ابتدائي (11 سنة)',
    ageBand: '11',
    language: 'نصوص أطول وفهم مقروء وقواعد وتحويل صرفي مناسبة للبرنامج، لغة أدق',
    languageQuant: 'وضعيات متعددة المراحل عند الحاجة (§20,§21)، تناسب وكسور ووحدات حسب البرنامج، لغة أدق',
    maxPrompt: 340,
    visualDependence: 'low',
    scaffolding: 'independent',
    allowedTypes: ['MCQ', 'TRUE_FALSE', 'MATCHING', 'FILL_BLANK', 'EXTRACT', 'ORDER', 'OPEN'],
    minStimulusLines: 10,
    minStimulusWords: 120,
    maxStimulusWords: 200,
    readingItems: ['evidence', 'justification', 'opinion'],
    scienceItems: ['justification', 'errorFix']
  }
};

export const DEFAULT_GRADE = 'year3';

/** ملف السنة من رمزها (غير المعروف ← السنة الثالثة مع لغة محايدة). */
export function getGradeProfile(grade) {
  const raw = String(grade ?? '').trim();
  return GRADE_PROFILES[raw] || GRADE_PROFILES[DEFAULT_GRADE];
}
