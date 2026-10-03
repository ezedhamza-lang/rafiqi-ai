// معجم المواد المركزي — المصدر الوحيد لتسمية المادة في الواجهة والاختبارات (§79).
// القاعدة: داخل البيانات يُخزَّن الرمز (arabic/math…)، وفي النص الظاهر للتلميذ
// أو المدرس أو ورقة الطباعة تظهر التسمية العربية فقط — لا «arabic» أبدًا (§78).
// لا تكرّر هذا القاموس في ملف آخر: كل من يحتاج تسمية يستورد من هنا.

export const SUBJECT_LABELS = {
  // مواد الاختبارات الرسمية (OfficialExams + بنك الاختبارات)
  arabic: 'اللغة العربية',
  math: 'الرياضيات',
  anisi: 'القراءة',
  reading: 'القراءة',
  science: 'الإيقاظ العلمي',
  production: 'الإنتاج الكتابي',
  handwriting: 'الخط والإملاء',
  french: 'اللغة الفرنسية',
  english: 'اللغة الإنجليزية',
  islamic: 'التربية الإسلامية',
  // تغطية بقية رموز المنصة (gradeService/docx) لئلا يسقط أي رمز على القيمة الخام
  MATH: 'الرياضيات',
  READING: 'القراءة والنصوص',
  ANISI: 'أنيسي — القراءة',
  SCIENCE: 'الإيقاظ العلمي',
  STORIES: 'القصص والمجال الأخلاقي',
  PRODUCTION: 'الإنتاج الكتابي',
  FRENCH: 'اللغة الفرنسية',
  ENGLISH: 'اللغة الإنجليزية',
  CIVIC: 'التربية المدنية',
  SPORTS: 'التربية البدنية',
  ART: 'التربية التشكيلية',
  TECH: 'التربية التكنولوجية',
  MUSIC: 'التربية الموسيقية',
  QURAN: 'التربية القرآنية',
  GENERAL: 'نشاط عام',
  // أسماء عربية مخزّنة أحيانًا كقيمة مباشرة
  'قواعد اللغة': 'قواعد اللغة',
  'الإنتاج الكتابي': 'الإنتاج الكتابي'
};

// تسمية المادة لعرضها في الورقة/القائمة: تُمرَّر الرمز أو الاسم الخام.
// إن كان المدخل خامًّا غير معروف (اسم عربي مضبوط مسبقًا) يُمرَّر كما هو فلا نُفسد نصًّا عربيًّا صحيحًا.
export function subjectLabel(code) {
  const raw = String(code ?? '').trim();
  if (!raw) return '';
  if (SUBJECT_LABELS[raw]) return SUBJECT_LABELS[raw];
  const upper = raw.toUpperCase();
  if (SUBJECT_LABELS[upper]) return SUBJECT_LABELS[upper];
  // قيمة عربية خامّة (مثل «الرياضيات» المخزّنة في بعض السجلات): تبقى كما هي
  if (/[\u0600-\u06FF]/.test(raw)) return raw;
  return raw;
}

// خريطة رموز الاختبارات ← رموز فهرس المنهج (curriculum/registry.json) لاستعلام النطاق (§55).
// الرمز غير المذكور يساوي نفسه (math → math).
export const SUBJECT_TO_CURRICULUM = {
  arabic: ['anisi', 'production'], // «اللغة العربية» في ورقة الاختبار تُغطّيها كتبا القراءة والإنتاج
  reading: ['anisi'],
  READING: ['anisi'],
  ANISI: ['anisi'],
  handwriting: ['production'],
  MATH: ['math'],
  SCIENCE: ['science'],
  PRODUCTION: ['production'],
  'اللغة العربية': ['anisi', 'production'],
  'الرياضيات': ['math'],
  'القراءة': ['anisi'],
  'الإيقاظ العلمي': ['science'],
  'الإنتاج الكتابي': ['production']
};

// المواد الكمّية التي يقيسها الحساب داخل أسئلتها (§79): رياضيات وحدها.
// غيرها (لغة/قراءة/علوم/لغات/إسلامية…) اختباره بلا عملية حسابية — خلط المواد مرفوض
// في المدقّق `validateExam` وفي برومبت التوليد (§55): «اختبار العربية محتواه عربي».
const QUANTITATIVE_SUBJECTS = new Set(['math', 'MATH', 'الرياضيات']);

export function isQuantitativeSubject(code) {
  const raw = String(code ?? '').trim();
  if (!raw) return false;
  return QUANTITATIVE_SUBJECTS.has(raw) || QUANTITATIVE_SUBJECTS.has(raw.toUpperCase());
}

export function curriculumSubjectIds(code) {
  const raw = String(code ?? '').trim();
  if (!raw) return [];
  if (SUBJECT_TO_CURRICULUM[raw]) return SUBJECT_TO_CURRICULUM[raw];
  const upper = raw.toUpperCase();
  if (SUBJECT_TO_CURRICULUM[upper]) return SUBJECT_TO_CURRICULUM[upper];
  return [raw.toLowerCase()];
}
