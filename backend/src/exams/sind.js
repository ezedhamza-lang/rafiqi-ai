// بنية السند (stimulus) — طبقة الأصل في محرّك التقويم التونسي (Spec A §3-5,§19,§42-46,§53,§105).
//
// قاعدة «السند هو الأصل»: لا سؤال بلا سند، ولا رقم خارج السند (§42)، ولا تغيير
// في الوحدات/الأسماء/الترتيب من السند إلى السؤال (§44-46). هذه الوحدة حتمية
// بالكامل (تحليل نصّي بلا LLM) وتُستدعى من مسار التوليد ومن المدقّق.
//
// العقد:
//   buildSind(raw, i)      → { id, title, text, numbers, units, names, purpose, version, locked }
//   buildStimuli(list, bp) → مصفوفة سندات مُطبَّعة + أخطاء إن كان النصّ ناقصًا
//   buildEvidenceGraph(s)  → عُقد الأدلّة المتاحة للأسئلة (evidence ids) + sind_purpose
//   extractNumbers(text)   → أرقام حقيقية (عربية/هندية/عشرية/ آلاف)

const ARABIC_INDIAN = '٠١٢٣٤٥٦٧٨٩';
const PERSIAN = '۰۱۲۳۴۵۶۷۸۹';

/** تحويل الأرقام العربية/الفارسية إلى ASCII لتوحيد المقارنة. */
export function toAsciiDigits(text) {
  let out = '';
  const s = String(text ?? '');
  for (const ch of s) {
    const a = ARABIC_INDIAN.indexOf(ch);
    const p = PERSIAN.indexOf(ch);
    if (a >= 0) out += String(a);
    else if (p >= 0) out += String(p);
    else out += ch;
  }
  return out;
}

/**
 * استخراج الأرقام الحقيقية من نصّ (§42): صيحة، عشرية، وبفواصل الآلاف.
 * يعيد أرقامًا فريدة غير سالبة مرتبة تصاعديًّا.
 */
export function extractNumbers(text) {
  const s = toAsciiDigits(text)
    .replace(/٬/g, '')       // فاصل آلاف عربي
    .replace(/(?<=\d),(?=\d{3}\b)/g, ''); // 1,200 ← 1200
  const found = [];
  const re = /(\d+(?:\.\d+)?)/g;
  let m;
  while ((m = re.exec(s)) !== null) {
    const n = Number(m[1]);
    if (Number.isFinite(n) && n >= 0) found.push(Math.round(n * 1000) / 1000);
  }
  return [...new Set(found)].sort((a, b) => a - b);
}

/** الوحدات المذكورة في النصّ (مليم/دينار/سم/م/كلغ…) — لفحص اتساق الوحدات §45. */
const UNIT_TOKENS = ['مليم', 'دينار', 'درهم', 'سنتيم', 'كلغ', 'غ', 'مجم', 'سم', 'م', 'كم', 'مل', 'لتر', 'درجة', 'سنة', 'شهر', 'يوم', 'ساعة'];
export function extractUnits(text) {
  const s = toAsciiDigits(String(text ?? '').replace(/[ًٌٍَُِّْـ]/g, ''));
  return [...new Set(UNIT_TOKENS.filter((u) => new RegExp(`(^|[^\\u0621-\\u064A])${u}($|[^\\u0621-\\u064A])`).test(s)))];
}

/** أسماء الأعلام/الكيانات المذكورة (توافق السند مع السؤال §46). */
const NAME_HINT = /(المدرسة|الحي|المكتبة|الحديقة|الفا|المعلّم|المعلم|الأستاذ|الأستاذة|المربي)/g;
export function extractNames(text) {
  const s = String(text ?? '');
  return [...new Set((s.match(NAME_HINT) || []))];
}

/**
 * بناء سند قابلّ للاستعمال (§3): نصّ + أرقامه + وحداته + أسماؤه + غرضه،
 * وقفل `locked` بعد البناء (§19,§53): لا تعديل لاحق — التغيير يحتاج بناء جديد.
 */
export function buildSind(raw, i = 0) {
  const text = String(raw?.text ?? '').trim();
  const id = String(raw?.id || `s${i + 1}`).trim();
  const title = String(raw?.title || `السند ${i + 1}`).trim();
  return {
    id,
    title,
    text,
    numbers: extractNumbers(text),
    units: extractUnits(text),
    names: extractNames(text),
    purpose: String(raw?.purpose || '').trim(),
    image: raw?.image || null,
    version: Number(raw?.version) || 1,
    locked: true
  };
}

/**
 * تطبيع مصفوفة سندات خام (مخرَج النموذج/المعلّم) — بلا سند صالح يُعدّ فشلًا §18.
 * @returns {{ stimuli: Array, invalid: Array }} invalid = أسباب رفض السندات الناقصة
 */
export function buildStimuli(list) {
  const invalid = [];
  const raw = Array.isArray(list) ? list : [];
  const stimuli = [];
  raw.forEach((s, i) => {
    if (!s || typeof s !== 'object') {
      invalid.push(`السند ${i + 1}: ليس كائنًا`);
      return;
    }
    const built = buildSind(s, i);
    if (!built.text || built.text.length < 8) {
      invalid.push(`السند ${i + 1}: نصّ فارغ أو أقصر من 8 أحرف`);
      return;
    }
    stimuli.push(built);
  });
  return { stimuli, invalid };
}

/**
 * رسم الأدلّة (§4,§7): كل رقم/كيان في السند عقدة متاحة للأسئلة بـ `evidence_ids`،
 * ورأس الرسم يحمل `sind_purpose` (غرض السند التربوي) الذي يُستدعى في تبرير السؤال §84.
 */
export function buildEvidenceGraph(sind) {
  const s = sind && typeof sind === 'object' ? sind : buildSind(sind);
  const nodes = [{ id: `${s.id}:root`, kind: 'sind', value: s.title }];
  (s.numbers || []).forEach((n, i) => {
    nodes.push({ id: `${s.id}:n${i + 1}`, kind: 'quantity', value: n });
  });
  (s.units || []).forEach((u, i) => {
    nodes.push({ id: `${s.id}:u${i + 1}`, kind: 'unit', value: u });
  });
  (s.names || []).forEach((nm, i) => {
    nodes.push({ id: `${s.id}:e${i + 1}`, kind: 'entity', value: nm });
  });
  return {
    sindId: s.id,
    sind_purpose: s.purpose || '',
    nodes,
    edges: nodes.slice(1).map((n) => ({ from: `${s.id}:root`, to: n.id })),
    availableEvidenceIds: nodes.map((n) => n.id)
  };
}

/** معرّفات الأدلّة المتاحة لمجموعة سندات — تُمرَّر إلى ORPHAN_QUESTION_DETECTOR. */
export function availableEvidence(stimuli = []) {
  return stimuli.flatMap((s) => buildEvidenceGraph(s).availableEvidenceIds);
}
