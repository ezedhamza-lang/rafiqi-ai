// صور المناهج تُخدم الآن بصيغة WebP (أصغر ~95%) مع بقاء PNG الأصلي
// احتياطياً (تصدير/متصفحات قديمة). المسار المُولَّد ثابت: نفس الاسم بامتداد
// .webp — وأي ملف مفقود يرجع تلقائياً للأصل عبر restoreOriginalImg.
export function imgSrc(p) {
  if (typeof p !== 'string') return p;
  if (!p.startsWith('/curriculum/')) return p;
  return p.replace(/\.(png|jpe?g)$/i, '.webp');
}

export function restoreOriginalImg(e, original) {
  const el = e.currentTarget;
  if (!original || el.dataset.fallbackTried) return false;
  el.dataset.fallbackTried = '1';
  el.src = original;
  return true;
}