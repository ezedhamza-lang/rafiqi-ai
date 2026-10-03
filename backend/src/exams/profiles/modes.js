// ملفات أنماط التقييم — Assessment Modes (Spec §22,§28).
// الوضع يضبط صرامة الأبواب وقواعد الإضافة: التقييم الثلاثي صارم، التكويني أكثر مرونة.

export const MODE_PROFILES = {
  written: {
    id: 'written',
    label: 'تقويم كتابي',
    strictness: 'STRICT',
    promptRules: ['ورقة كاملة: عدد الأسئلة والمجموع والمدة من المخطّط حرفًا (§51)']
  },
  term: {
    id: 'term',
    label: 'تقويم ثلاثي',
    strictness: 'STRICT',
    promptRules: ['التقويم الثلاثي يقيس مكتسبات الثلاثي وحده: لا محتوى خارج فتراته (§57)']
  },
  cumulative: {
    id: 'cumulative',
    label: 'تقويم تراكمي',
    strictness: 'STRICT',
    promptRules: ['التراكمي يمتدّ على الفترات السابقة المصرّح بها في المخطّط وحده']
  },
  formative: {
    id: 'formative',
    label: 'تقويم تكويني',
    strictness: 'BALANCED',
    promptRules: ['تقويم تكويني: تنبيهات وتغذية راجعة مفيدة، والرفض عند المحتوى الخاطئ وحده']
  },
  diagnostic: {
    id: 'diagnostic',
    label: 'تقويم تشخيصي',
    strictness: 'BALANCED',
    promptRules: ['تشخيصي: قيمة معلوماتية عالية — وزّع القياس على المحاور لا على سؤال واحد']
  },
  unit: { id: 'unit', label: 'تقويم وحدة', strictness: 'STRICT', promptRules: [] },
  remedial: { id: 'remedial', label: 'تقويم معالجي', strictness: 'BALANCED', promptRules: ['معالجي: مهارة واحدة محدّدة ومستهدف'] },
  oral: { id: 'oral', label: 'تقويم شفوي', strictness: 'BALANCED', promptRules: ['شفوي: مهام تعبير شفوي وقراءة مسموعة لا ورقة مطبوعة'] },
  practical: { id: 'practical', label: 'تقويم عملي', strictness: 'BALANCED', promptRules: ['عملي: ملاحظة أداء وخطوات لا اختيار فقط'] }
};

export function getModeProfile(assessmentType) {
  const raw = String(assessmentType ?? '').trim();
  return MODE_PROFILES[raw] || MODE_PROFILES.written;
}
