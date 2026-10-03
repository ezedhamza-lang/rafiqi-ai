// جداول معايير التقويم الرسمية + تحجيمها لأي هدف نقاط (§47,§7,§79,§84).
//
// الشبكات هنا هي المصدر الوحيد للمعايير: تستوردها خدمة تصدير DOCX
// (officialDocxService) ويستعملها محرّك الاختبارات — لا تكرار في ملف آخر.
// المقياس الرسمي مبنيّ على مجموع 20؛ الاختبار قد يكون 10 أو 15 أو 20 (§7)
// فتُحجَّم القيم بنفس النسبة مع بقاء المجموع = الهدف بالضبط حتى لا يظهر
// للتصحيح جدول «15/20» أو «12/20» كاذب (§125).

export const DEFAULT_CRITERIA = {
  arabic: [
    { id: 'مع1', label: 'القراءة الجهرية', mastery: { none: 0, below: 1.5, min: 3, max: 4.5 } },
    { id: 'مع2', label: 'معالجة النص', mastery: { none: 0, below: 2, min: 4, max: 6 } },
    { id: 'مع3', label: 'التصرف في النص وإبداء الرأي', excellence: true, mastery: { none: 0, below: 1, min: 2.5, max: 4.5 } }
  ],
  math: [
    { id: 'مع1', label: 'التأويل الملائم', mastery: { none: 0, below: 1, min: 2, max: 3 } },
    { id: 'مع2', label: 'صحة الحساب', mastery: { none: 0, below: 2, min: 4, max: 6 } },
    { id: 'مع3', label: 'استعمال وحدات القياس', mastery: { none: 0, below: 1, min: 2, max: 3 } },
    { id: 'مع4', label: 'خصائص الأشكال الهندسية', mastery: { none: 0, below: 1, min: 2, max: 3 } },
    { id: 'مع5', label: 'الدقة', excellence: true, mastery: { none: 0, below: 1, min: 3, max: 5 } }
  ],
  science: [
    { id: 'مع1', label: 'تحليل وضعية', mastery: { none: 0, below: 1.5, min: 3, max: 5 } },
    { id: 'مع2', label: 'تعليل إجابة', mastery: { none: 0, below: 1.5, min: 3, max: 5 } },
    { id: 'مع3', label: 'إصلاح خطأ', mastery: { none: 0, below: 1, min: 2.5, max: 5 } },
    { id: 'مع4', label: 'التميز العلمي', excellence: true, mastery: { none: 0, below: 1, min: 2, max: 5 } }
  ],
  french: [
    { id: 'مع1', label: 'الفهم القرائي', mastery: { none: 0, below: 1.5, min: 3, max: 5 } },
    { id: 'مع2', label: 'اللغة والمفردات', mastery: { none: 0, below: 1.5, min: 3, max: 5 } },
    { id: 'مع3', label: 'الإنتاج الكتابي', mastery: { none: 0, below: 1, min: 2.5, max: 5 } },
    { id: 'مع4', label: 'التميز اللغوي', excellence: true, mastery: { none: 0, below: 1, min: 2, max: 5 } }
  ],
  islamic: [
    { id: 'مع1', label: 'الحفظ والاستظهار', mastery: { none: 0, below: 1.5, min: 3, max: 5 } },
    { id: 'مع2', label: 'الفهم', mastery: { none: 0, below: 1.5, min: 3, max: 5 } },
    { id: 'مع3', label: 'السلوك والقيم', mastery: { none: 0, below: 1, min: 2.5, max: 5 } },
    { id: 'مع4', label: 'التميز', excellence: true, mastery: { none: 0, below: 1, min: 2, max: 5 } }
  ],
  production: [
    { id: 'مع1', label: 'الملاءمة', mastery: { none: 0, below: 1, min: 2, max: 3 } },
    { id: 'مع2', label: 'سلامة بناء النص', mastery: { none: 0, below: 2, min: 4, max: 6 } },
    { id: 'مع3', label: 'التصرف في نمط الكتابة', mastery: { none: 0, below: 2, min: 4, max: 6 } },
    { id: 'مع4', label: 'الثراء والطرافة', excellence: true, mastery: { none: 0, below: 1, min: 2, max: 5 } }
  ]
};

// رمز المادة (كما يُخزَّن في المنصة) ← شبكة المعايير. غير المذكور → arabic.
const SUBJECT_GRID = {
  arabic: 'arabic', anisi: 'arabic', reading: 'arabic', ANISI: 'arabic', READING: 'arabic',
  'اللغة العربية': 'arabic', 'القراءة': 'arabic',
  handwriting: 'production', 'الخط والإملاء': 'production', PRODUCTION: 'production',
  'الإنتاج الكتابي': 'production',
  math: 'math', MATH: 'math', 'الرياضيات': 'math',
  science: 'science', SCIENCE: 'science', 'الإيقاظ العلمي': 'science',
  french: 'french', FRENCH: 'french', 'اللغة الفرنسية': 'french',
  english: 'french', ENGLISH: 'french', 'اللغة الإنجليزية': 'french',
  islamic: 'islamic', QURAN: 'islamic', 'التربية الإسلامية': 'islamic'
};

/** شبكة المعايير الخام لمادة ما (نسخة طرية — لا تعدّلها). */
export function criteriaGrid(subject) {
  const raw = String(subject ?? '').trim();
  const key = SUBJECT_GRID[raw] || SUBJECT_GRID[raw.toUpperCase()];
  return DEFAULT_CRITERIA[key || 'arabic'];
}

const half = (x) => Math.round((Number(x) || 0) * 2) / 2;

/**
 * يحجّم شبكة معايير إلى هدف نقاط (10/15/20) بنسبة ثابتة مع تقريب 0.5
 * وتصحيح الانحراف على أكبر معيار — يضمن Σ max = الهدف بالضبط (§7).
 */
export function scaleCriteria(grid, target = 20) {
  const src = Array.isArray(grid) ? grid : [];
  const t = half(target) || 20;
  const sum = src.reduce((s, c) => s + (Number(c?.mastery?.max) || 0), 0);
  const copy = () => src.map((c) => ({ ...c, mastery: { ...c.mastery } }));
  if (!src.length || !sum) return copy();
  if (sum === t) return copy();

  const f = t / sum;
  const scaled = copy().map((c) => ({
    ...c,
    mastery: {
      ...c.mastery,
      none: 0,
      below: half((Number(c.mastery.below) || 0) * f),
      min: half((Number(c.mastery.min) || 0) * f),
      max: half((Number(c.mastery.max) || 0) * f)
    }
  }));
  // حراس الترتيب: 0 ≤ below ≤ min ≤ max بعد التقريب
  scaled.forEach((c) => {
    c.mastery.min = Math.min(c.mastery.min, c.mastery.max);
    c.mastery.below = Math.min(c.mastery.below, c.mastery.min);
    c.mastery.none = 0;
  });
  // تصحيح انحراف المجموع على أكبر معيار (بخطوة 0.5 ودون كسر الترتيب)
  let diff = half(t - scaled.reduce((s, c) => s + c.mastery.max, 0));
  let guard = 0;
  while (Math.abs(diff) >= 0.5 && guard < 40) {
    guard += 1;
    let idx = 0;
    scaled.forEach((c, i) => { if (c.mastery.max > scaled[idx].mastery.max) idx = i; });
    const c = scaled[idx];
    const next = half(c.mastery.max + (diff > 0 ? 0.5 : -0.5));
    if (next >= c.mastery.min && next >= 0) {
      c.mastery.max = next;
    } else {
      // أكبر معيار بلغ الحد — انتقل للتالي
      const other = scaled.findIndex((x, i) => i !== idx && (diff > 0 || x.mastery.max > x.mastery.min));
      if (other < 0) break;
      scaled[other].mastery.max = half(scaled[other].mastery.max + (diff > 0 ? 0.5 : -0.5));
    }
    diff = half(t - scaled.reduce((s, x) => s + x.mastery.max, 0));
  }
  return scaled;
}

/** معايير جاهزة لمادة + هدف نقاط (مصدر واحد للاختبار ومسار التصحيح). */
export function criteriaFor(subject, target = 20) {
  return scaleCriteria(criteriaGrid(subject), target);
}
