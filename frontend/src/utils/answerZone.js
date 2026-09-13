// إزالة التشكيل وتوحيد الحروف لمطابقة أنماط العربية المضمّمة في نصوص الدروس
export function stripTashkeel(t) {
  return String(t || '')
    .replace(/[\u064B-\u0652\u0670\u0640]/g, '')
    .replace(/[أإآٱ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي');
}

// نوع مكان الإجابة المناسب للسؤال: جدول حقيقي / مساحة عملية / مساحة رسم / سطور كتابة
export function guessAnswerZone(b) {
  if (!b) return 'writing';
  const hay = stripTashkeel(`${b.title || ''} ${b.text || ''}`);
  if (Array.isArray(b.rows) && b.rows.length) return 'table';
  if (/ارسم|اربط|وصل(ه|ها|هما|هم)?|لون|قص|الصق|انشئ|تمثيل بالعمود|رسم(ة)? بياني/.test(hay)) return 'drawing';
  if (/احسب|حساب|عملية|عمليات|عمودي|الناتج|ناتج|مجموع|حاصل|طرح|ضرب|قسمة|اوجد|يساوي|تقدير|=|كم\b|كم /.test(hay)) return 'math';
  if (/جدول/.test(hay)) return 'table';
  return 'writing';
}
