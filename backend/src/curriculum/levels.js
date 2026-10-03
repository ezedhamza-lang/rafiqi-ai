// سجلّ المستويات الرسمي الوحيد في الخلفية (المرحلة B).
//
// كان有三 مصادر متفرقة: tenancyBootstrap (10 مستويات، بلا إعدادي)،
// public/levels (13)، وcurriculum-index (6 titles للمنهج). النتيجة: معلّم يختار
// «السنة الأولى إعدادي» ولا يُنشأ له قسم تلقائيًا، والمعلمون يرون قوائم مختلفة.
//
// القاعدة:
//  • OFFICIAL_LEVELS = العناوين الرسمية لأقسام المنصة (13: 6 ابتدائي + 3 إعدادي + 4 ثانوي)
//  • memoLevel()      = المفتاح الذي يفهمه مولّد المذكرات («السنة X أساسي»)
//  • gradeIdFor()     = مفتاح المحتوى year1..year6
// كل من يحتاج مستوى يستورد من هنا — لا تُكرَّر القوائم في ملف آخر.
import { normalizeArabic } from '../services/curriculumService.js';
import { resolveGradeId } from '../exams/curriculum-index.js';

const ORD = ['الأولى', 'الثانية', 'الثالثة', 'الرابعة', 'الخامسة', 'السادسة'];

export const PRIMARY_LEVELS = ORD.map((o) => `السنة ${o} ابتدائي`);
export const MIDDLE_LEVELS = ['السنة الأولى إعدادي', 'السنة الثانية إعدادي', 'السنة الثالثة إعدادي'];
export const SECONDARY_LEVELS = ORD.slice(0, 4).map((o) => `السنة ${o} ثانوي`);

/** كل المستويات الرسمية بترتيب العرض. */
export const OFFICIAL_LEVELS = [...PRIMARY_LEVELS, ...MIDDLE_LEVELS, ...SECONDARY_LEVELS];

/** المعرّفات الداخلية للمحتوى التفاعلي (بطاقات، قصص). */
export const GRADE_IDS = ['year1', 'year2', 'year3', 'year4', 'year5', 'year6'];

/** ترتيب السنوات العربية (للطباعة: الأولى→السادسة). */
export const ORDINAL_AR = ORD;

/** رقم السنة من نصّ مستوى: «السنة الثانية ابتدائي» → 2 (عبر محلّل المنهج المجرَّب). */
export function levelOrdinal(level) {
  const raw = String(level ?? '').trim();
  if (!raw) return null;
  const gid = resolveGradeId(raw);
  if (gid && /^year\d$/.test(gid)) return Number(gid.slice(4));
  // سنوات-secondary خارج year1..year6 (العاشرة)
  const n = normalizeArabic(raw);
  const words = { العاشره: 10, التاسعه: 9, الثامنه: 8, السابعه: 7 };
  for (const [w, v] of Object.entries(words)) if (n.includes(w)) return v;
  return null;
}

/** نوع المرحلة: ابتدائي | إعدادي | ثانوي | null */
export function levelStage(level) {
  const n = normalizeArabic(String(level ?? ''));
  if (/ابتدائي/.test(n)) return 'primary';
  if (/اعدادي/.test(n)) return 'middle';
  if (/ثانوي/.test(n)) return 'secondary';
  return null;
}

/**
 * يوحّد أي صيغة واردة (رسمية/أساسي/سنة أولى/year3) إلى العنوان الرسمي مع احترام المرحلة.
 * يُرجع null إذا لم تُعرف الصيغة — ولا يخترع مستوى.
 */
export function canonicalLevel(level) {
  const raw = String(level ?? '').trim();
  if (!raw) return null;
  const exact = OFFICIAL_LEVELS.find((l) => l === raw);
  if (exact) return exact;
  const n = normalizeArabic(raw);
  const normOfficial = OFFICIAL_LEVELS.find((l) => normalizeArabic(l) === n);
  if (normOfficial) return normOfficial;

  const stage = levelStage(raw);
  const ord = levelOrdinal(raw);
  if (!ord) return null;
  if (stage === 'primary') return ord <= 6 ? PRIMARY_LEVELS[ord - 1] : null;
  if (stage === 'middle') return ord <= 3 ? MIDDLE_LEVELS[ord - 1] : null;
  if (stage === 'secondary') return ord <= 4 ? SECONDARY_LEVELS[ord - 1] : null;
  // بلا مرحلة: yearN أو «السنة X» ⇒ ابتدائي (.Content convention)
  return ord <= 6 ? PRIMARY_LEVELS[ord - 1] : null;
}

/** مفتاح مولّد المذكرات: «السنة الثانية ابتدائي» ⇒ «السنة الثانية أساسي». */
export function memoLevel(level) {
  const canonical = canonicalLevel(level);
  if (!canonical) return String(level ?? '').trim();
  if (levelStage(canonical) !== 'primary') return canonical;
  const ord = levelOrdinal(canonical);
  return ord ? `السنة ${ORD[ord - 1]} أساسي` : canonical;
}

/** مفتاح المحتوى year1..year6 أو null. */
export function gradeIdFor(level) {
  const canonical = canonicalLevel(level);
  if (!canonical || levelStage(canonical) !== 'primary') return null;
  const ord = levelOrdinal(canonical);
  return ord && ord <= 6 ? `year${ord}` : null;
}

/** تسمية للعرض؛ النصوص غير المعروفة تُحترم كما هي. */
export function levelLabel(level, lang = 'ar') {
  const canonical = canonicalLevel(level);
  if (!canonical) {
    const raw = String(level ?? '').trim();
    if (!raw) return '—';
    if (lang === 'en') {
      const g = GRADE_IDS.indexOf(raw.toLowerCase());
      if (g >= 0) return `Grade ${g + 1}`;
    }
    return raw;
  }
  if (lang === 'en') {
    const ord = levelOrdinal(canonical) ?? 1;
    const stage = levelStage(canonical);
    const stageEn = stage === 'primary' ? 'primary' : stage === 'middle' ? 'middle' : 'secondary';
    return `Grade ${ord} (${stageEn})`;
  }
  return canonical;
}

export default {
  OFFICIAL_LEVELS,
  PRIMARY_LEVELS,
  MIDDLE_LEVELS,
  SECONDARY_LEVELS,
  GRADE_IDS,
  canonicalLevel,
  memoLevel,
  gradeIdFor,
  levelLabel,
  levelOrdinal,
  levelStage
};