// معجم تسمية المادة في الواجهة (مرآة backend/src/exams/subject-labels.js — §78,§79).
// داخل البيانات يُخزَّن الرمز (arabic/math/…)، وفي النص الظاهر تظهر التسمية فقط —
// لا «arabic» أبدًا. المصدر المرجعي للعربية هو الباكند؛ أي رمز جديد يُضاف هناك ثم هنا.
// لا تكرّر هذا القاموس في ملف آخر: كل من يحتاج تسمية يستورد من هنا.

const AR = {
  // مواد الاختبارات (OfficialExams + بنك الاختبارات)
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
  // بقية رموز المنصة
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
  GENERAL: 'نشاط عام'
};

const EN = {
  arabic: 'Arabic',
  math: 'Mathematics',
  anisi: 'Reading',
  reading: 'Reading',
  science: 'Science discovery',
  production: 'Writing production',
  handwriting: 'Handwriting & spelling',
  french: 'French',
  english: 'English',
  islamic: 'Islamic education',
  MATH: 'Mathematics',
  READING: 'Reading & texts',
  ANISI: 'Anisi (reading)',
  SCIENCE: 'Science discovery',
  STORIES: 'Stories',
  PRODUCTION: 'Writing production',
  FRENCH: 'French',
  ENGLISH: 'English',
  CIVIC: 'Civic education',
  SPORTS: 'Physical education',
  ART: 'Arts',
  TECH: 'Technology',
  MUSIC: 'Music',
  QURAN: 'Quran education',
  GENERAL: 'General'
};

/**
 * تسمية المادة للعرض.
 * @param {string} code رمز المادة الخام (arabic / MATH / «الرياضيات» …)
 * @param {string} lang 'ar' | 'en' (الافتراضي ar — لغة المنصة)
 * @returns {string} التسمية، أو القيمة الخام إن لم تُعرف (وإن كانت عربية خامّة تبقى كما هي)
 */
export function subjectLabel(code, lang = 'ar') {
  const raw = String(code ?? '').trim();
  if (!raw) return '';
  const dict = lang === 'en' ? EN : AR;
  if (dict[raw]) return dict[raw];
  const upper = raw.toUpperCase();
  if (dict[upper]) return dict[upper];
  // قيمة خامّة (اسم عربي مخزَّن مباشرة): لا نُفسدها
  if (/[؀-ۿ]/.test(raw)) return raw;
  return raw;
}

export default subjectLabel;
