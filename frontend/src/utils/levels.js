// مرآة سجلّ المستويات الرسمي (backend/src/curriculum/levels.js) للعرض في الواجهة.
// تغطية: العنوان الرسمي (13) + صيغة «أساسي» + المفاتيح year1..year6 + نصوص مجهولة تُحترم.
// اختبار backend/tests/levels-taxonomy.test.js يقارن هذه المرآة بسجلّ الخلفية حرفًا بحرف.
const ORD = ['الأولى', 'الثانية', 'الثالثة', 'الرابعة', 'الخامسة', 'السادسة'];

// مرآة سجلّ الخلفية (backend/src/curriculum/levels.js) — الاختبار يقارنها حرفًا بحرف.
const PRIMARY = ORD.map((o) => `السنة ${o} ابتدائي`);
const MIDDLE = ['السنة الأولى إعدادي', 'السنة الثانية إعدادي', 'السنة الثالثة إعدادي'];
const SECONDARY = ORD.slice(0, 4).map((o) => `السنة ${o} ثانوي`);

export const OFFICIAL_LEVELS = [...PRIMARY, ...MIDDLE, ...SECONDARY];

/** صيغة المذكرات (أساسي) → صيغة الأقسام (ابتدائي) */
const BASIC_TO_OFFICIAL = {};
ORD.forEach((o) => {
  BASIC_TO_OFFICIAL[`السنة ${o} أساسي`] = `السنة ${o} ابتدائي`;
});

const GRADE_IDS = ['year1', 'year2', 'year3', 'year4', 'year5', 'year6'];

function ordinalOf(text) {
  const n = String(text)
    .replace(/[ً-ٰٟ]/g, '')
    .replace(/ة/g, 'ه')
    .replace(/[إأ]/g, 'ا');
  const m = n.match(/([1-9]|10)\s*(?:ال)?سنه/) || n.match(/سنه\s*([1-9]|10)/);
  if (m) return Number(m[1]);
  // مفاتيح بصيغة normalizeArabic (ة→ه) وإلا لم تُطابق «الثالثة» بعد التطبيع
  const words = { اولي: 1, ثانيه: 2, ثالثه: 3, رابعه: 4, خامسه: 5, سادسه: 6, سابعه: 7, ثامنه: 8, تاسعه: 9, عاشره: 10 };
  for (const [w, v] of Object.entries(words)) if (n.includes(w)) return v;
  const g = n.match(/year\s*([1-9]|10)/);
  if (g) return Number(g[1]);
  return null;
}

function stageOf(text) {
  const n = String(text).replace(/ة/g, 'ه').replace(/[إأ]/g, 'ا');
  if (n.includes('ابتدائي')) return 'primary';
  if (n.includes('اعدادي')) return 'middle';
  if (n.includes('ثانوي')) return 'secondary';
  return null;
}

/** يوحّد الصيغة إلى العنوان الرسمي أو null. */
export function canonicalLevel(level) {
  const raw = String(level ?? '').trim();
  if (!raw) return null;
  const exact = OFFICIAL_LEVELS.find((l) => l === raw);
  if (exact) return exact;
  if (BASIC_TO_OFFICIAL[raw]) return BASIC_TO_OFFICIAL[raw];
  const gi = GRADE_IDS.indexOf(raw.toLowerCase());
  if (gi >= 0) return OFFICIAL_LEVELS[gi];
  const stage = stageOf(raw);
  const ord = ordinalOf(raw);
  if (!ord) return null;
  if (stage === 'middle') return ord <= 3 ? OFFICIAL_LEVELS[6 + ord - 1] : null;
  if (stage === 'secondary') return ord <= 4 ? OFFICIAL_LEVELS[9 + ord - 1] : null;
  return ord <= 6 ? OFFICIAL_LEVELS[ord - 1] : null;
}

/**
 * تسمية المستوى للعرض — آمنة للاستعمال على أي قيمة:
 * ترمز الأكواد، وتُبقي العربية كما هي، ولا تُنتج أبدًا «undefined».
 */
export function levelLabel(level, lang = 'ar') {
  const canonical = canonicalLevel(level);
  if (!canonical) {
    const raw = String(level ?? '').trim();
    if (!raw) return '—';
    const gi = GRADE_IDS.indexOf(raw.toLowerCase());
    if (lang === 'en' && gi >= 0) return `Grade ${gi + 1}`;
    return raw;
  }
  if (lang === 'en') {
    const ord = ordinalOf(canonical) ?? 1;
    const stage = stageOf(canonical);
    return `Grade ${ord} (${stage === 'primary' ? 'primary' : stage === 'middle' ? 'middle' : 'secondary'})`;
  }
  return canonical;
}

export { GRADE_IDS };
export default levelLabel;