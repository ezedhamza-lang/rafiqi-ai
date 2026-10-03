// ملفات المواد — Subject Profiles (Spec §2-§10,§26,§40).
//
// كل مادة تربوية ملف مستقل يقرّر: نوع المثير، أنواع المهام، أنماط الاستجابة،
// ما هو ممنوع داخل أسئلتها، وقواعد البرومبت الخاصة بها، والمتحقّق المتخصص.
// «كيف نقيّم هذه المادة» لا تُكتب في الـPrompt صارمة — تُقرأ من هنا (ملفات بيانات).
// المحرّك العام يطبّق القواعد المشتركة أولًا ثم يمرّر النتيجة لمتحقّق المادة (PASS AND PASS).

/** دليل الأدلة بحسب المادة — يحكم رسم الأدلّة ونوعية التأصيل. */
export const EVIDENCE_KINDS = {
  numeric: 'رقمي (أرقام مشتقّة حتميًّا من المثير)',
  text: 'نصّي (كل معلومة واردة في النص المرجعي)',
  visual: 'مرصود (صورة/مشهد/تجربة/مخطط)',
  linguistic: 'لغوي (معجم/تراكيب/صرف من سياق)',
  rubric: 'منتج (إنتاج مكتوب يُقيَّم بسجّة)'
};

const GENERIC = {
  preferredTaskTypes: ['MCQ', 'TRUE_FALSE', 'FILL_BLANK', 'EXTRACT', 'ORDER', 'OPEN'],
  responseModes: ['mcq', 'short_text', 'matching', 'ordering', 'long_text'],
  forbidArithmetic: true, // غير الرياضيات: لا عملية حسابية في أسئلتها (§79)
  promptRules: [],
  validators: []
};

/**
 * خريطة المواد: الرمز ← الملف.
 * الرمز غير المذكور يقع على `default` (سلوك نصّي حذِر — لا حساب إلا في الرياضيات).
 */
export const SUBJECT_PROFILES = {
  math: {
    id: 'math',
    label: 'الرياضيات',
    evidenceKind: 'numeric',
    stimulusTypes: ['situation', 'table', 'diagram', 'figure', 'text'],
    stimulusHint: 'وضعية عددية أو جدول أرقام أو تمثيل بياني أو شكل هندسي موصوف بالتفصيل',
    preferredTaskTypes: ['MCQ', 'FILL_BLANK', 'TRUE_FALSE', 'ORDER', 'EXTRACT', 'OPEN'],
    responseModes: ['numeric', 'mcq', 'short_text', 'ordering', 'table', 'drawing', 'open'],
    forbidArithmetic: false,
    promptRules: [
      'السياق الرياضي يخدم المشكلة: لا قصة زائدة بلا وظيفة تقويمية',
      'عند هدف التفكير/الحل فضّل أثر الحل أو تفسيره لا الاختيار فقط (§30)',
      'كل رقم في السؤال أو بدائله وارد في المثير أو ناتج عنه بعملية على أرقامه (§42)'
    ],
    validators: ['math']
  },

  reading: {
    id: 'reading',
    label: 'القراءة',
    evidenceKind: 'text',
    stimulusTypes: ['text', 'image_text'],
    stimulusHint: 'نصّ قراءة مرجعي كامل ومتماسك (قصة/نص معلوماتي/حوار) بطول مناسب للسنة',
    textStimulus: true, // نصّ قراءة يُقاس بسطر قياسه (§6: y3+ ≥ 10 أسطر)
    minTashkeelRatio: 0.25, // تشكيل تام (§7): نصّ مشكّل ≈ 35%+ من الحروف، المجرّد ≈ صفر
    preferredTaskTypes: ['MCQ', 'TRUE_FALSE', 'EXTRACT', 'FILL_BLANK', 'ORDER', 'OPEN'],
    responseModes: ['short_text', 'mcq', 'matching', 'ordering', 'long_text'],
    forbidArithmetic: true,
    promptRules: [
      'النصّ المرجعي هو أصل كل سؤال: لا سؤال من خارج النصّ (§42)',
      'ترتيب الأسئلة: فهم مباشر ← استخراج من النص ← معجم في السياق ← ربط/استنتاج ← تعبير قصير',
      'النصّ للمستوى نفسه: طوله ومفرادته من ملف السنة لا من ذوقك'
    ],
    validators: ['reading']
  },

  science: {
    id: 'science',
    label: 'الإيقاظ العلمي',
    evidenceKind: 'visual',
    stimulusTypes: ['image', 'situation', 'experiment', 'diagram', 'sequence', 'table'],
    stimulusHint: 'مشهد موصوف/صورة موصوفة/وضعية حياتية/تجربة بسيطة قابلة للملاحظة (الحواس، الجسد، البيئة، الصحة، الظواهر)',
    preferredTaskTypes: ['MCQ', 'TRUE_FALSE', 'ORDER', 'FILL_BLANK', 'EXTRACT', 'OPEN'],
    responseModes: ['mcq', 'matching', 'classification', 'image_selection', 'short_text', 'ordering', 'drawing'],
    forbidArithmetic: true,
    promptRules: [
      'المثير مرصود: مهمة الطفل أن يلاحظ/يحدّد/يصنّف/يرتّب/يصف/يستدل من المشهد لا من حفظه',
      'لا تحوّل الإيقاظ إلى رياضيات: لا جمع ولا طرح ولا مسألة عددية',
      'لا نصًّا طويلًا مفروضًا على سنة صغيرة: التعليمات قصيرة وكلمة كلمة عند البداية'
    ],
    validators: ['science']
  },

  arabic: {
    id: 'arabic',
    label: 'اللغة العربية',
    evidenceKind: 'linguistic',
    stimulusTypes: ['text', 'situation', 'table'],
    stimulusHint: 'نصّ لغوي قصير (فقرة/جمل/قائمة كلمات/جدول تدريج) يخدم المكتسب المطلوب',
    textStimulus: true, // نصّ لغوي يُقاس بسطر وتشكيله (§6-§7)
    minTashkeelRatio: 0.25,
    preferredTaskTypes: ['MCQ', 'TRUE_FALSE', 'FILL_BLANK', 'EXTRACT', 'ORDER', 'OPEN'],
    responseModes: ['mcq', 'short_text', 'matching', 'ordering', 'long_text'],
    forbidArithmetic: true,
    promptRules: [
      'مفردات وتراكيب من برنامج السنة نفسها: لا مصطلح تقني ولا نصّ خارج السياق',
      'السؤال يقيس مكتسبًا لغويًّا (فهم/معجم/تراكيب/صرف/إملاء/إنتاج) لا معرفيًّا عشوائيًّا'
    ],
    validators: ['language']
  },

  production: {
    id: 'production',
    label: 'الإنتاج الكتابي',
    evidenceKind: 'rubric',
    stimulusTypes: ['prompt', 'image', 'text'],
    stimulusHint: 'محفّز إنتاج (صورة/وضعية/جملة بداية) مع خصائص الإنتاج المنتظر',
    preferredTaskTypes: ['OPEN', 'ORDER', 'FILL_BLANK'],
    responseModes: ['long_text', 'structured_steps'],
    forbidArithmetic: true,
    promptRules: [
      'الإنتاج الكتابي لا يُقوَّم بـMCQ: لكل مهمة إنتاج سجّة تقييم (ملاءمة/تنظيم/معجم/إملاء/ترابط)',
      'سجّة التقييم إلزامية عند وجود علامة على إنتاج مكتوب (§26)'
    ],
    validators: ['writing']
  },

  french: {
    id: 'french',
    label: 'اللغة الفرنسية',
    evidenceKind: 'text',
    stimulusTypes: ['text', 'audio_text', 'image_text'],
    textStimulus: true, // نصّ أجنبي يُقاس بطوله (بلا تشكيل عربي)
    stimulusHint: 'نصّ فرنسي قصير مناسب للسنة (dialogue/texte court) مع وضوح المفردات',
    preferredTaskTypes: ['MCQ', 'TRUE_FALSE', 'FILL_BLANK', 'ORDER', 'OPEN'],
    responseModes: ['mcq', 'short_text', 'matching', 'ordering', 'audio', 'long_text'],
    forbidArithmetic: true,
    promptRules: [
      'ما يفترض أن يستطيع التلميذ فعله في هذا المستوى هو المعيار: لا نصّ أطول من قدرته',
      'النصّ لا يُعامَل كنصّ رياضي: استخراج/فهم/مفردات/تراكيب حسب البرنامج'
    ],
    validators: []
  },

  english: {
    id: 'english',
    label: 'اللغة الإنجليزية',
    evidenceKind: 'text',
    stimulusTypes: ['text', 'image_text'],
    stimulusHint: 'Short age-appropriate English text (dialogue / simple passage) matching the grade level',
    textStimulus: true, // foreign-language passage: line-checked, no Arabic tashkeel
    preferredTaskTypes: ['MCQ', 'TRUE_FALSE', 'FILL_BLANK', 'ORDER', 'OPEN'],
    responseModes: ['mcq', 'short_text', 'matching', 'ordering', 'long_text'],
    forbidArithmetic: true,
    promptRules: [
      'Language tasks only: comprehension, vocabulary, structures — no arithmetic',
      'Complexity comes from the grade profile, not from the model\'s taste'
    ],
    validators: []
  },

  default: {
    id: 'default',
    label: 'مادة عامة',
    evidenceKind: 'text',
    stimulusTypes: ['text', 'situation', 'table'],
    stimulusHint: 'مثير نصّي حقيقي مناسب للمادة',
    ...GENERIC
  }
};

// رموز المواد ← مفاتيح الملفات (الرمز الخام غير المذكور يستعمل `default`).
const SUBJECT_KEYS = {
  math: 'math', MATH: 'math', الرياضيات: 'math',
  reading: 'reading', READING: 'reading', ANISI: 'reading', anisi: 'reading', القراءة: 'reading',
  science: 'science', SCIENCE: 'science', 'الإيقاظ العلمي': 'science', 'الإيقاظ': 'science',
  arabic: 'arabic', 'اللغة العربية': 'arabic',
  production: 'production', PRODUCTION: 'production', 'الإنتاج الكتابي': 'production',
  handwriting: 'arabic', french: 'french', FRENCH: 'french', 'اللغة الفرنسية': 'french',
  english: 'english', ENGLISH: 'english', 'اللغة الإنجليزية': 'english',
  islamic: 'default'
};

/** ملف المادة من رمزها (لا يرمي أبدًا — المجهول يستعمل الملف العام الحذِر). */
export function getSubjectProfile(code) {
  const raw = String(code ?? '').trim();
  const key = SUBJECT_KEYS[raw] || SUBJECT_KEYS[raw.toUpperCase()] || 'default';
  return SUBJECT_PROFILES[key] || SUBJECT_PROFILES.default;
}

/** هل المادة تمنع الحساب داخل أسئلتها؟ (يستعمله المدقّق وبرومبت التوليد). */
export function forbidsArithmetic(code) {
  return getSubjectProfile(code).forbidArithmetic !== false;
}
