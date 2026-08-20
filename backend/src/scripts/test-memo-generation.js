#!/usr/bin/env node
/**
 * سكريبت اختبار يدوي لتوليد مذكرة والتحقق من الناتج.
 * الاستعمال:
 *   node src/scripts/test-memo-generation.js "رياضيات" "السنة الأولى أساسي" "تعيين موقع شيء في الفضاء: أمام - وراء"
 *   node src/scripts/test-memo-generation.js "قراءة" "السنة الأولى أساسي" "حرف الميم"
 *   node src/scripts/test-memo-generation.js --methodologies
 */
import { listMethodologies } from '../services/methodologyResolver.js';
import { generateMemo, buildMemoContent, resolveBook, findLesson } from '../services/lessonMemoService.js';
import { resolveMethodology } from '../services/methodologyResolver.js';

const [subject, level, lessonTitle] = process.argv.slice(2);

if (process.argv.includes('--methodologies')) {
  console.log('بروفايلات المنهجية المتوفّرة:');
  for (const m of listMethodologies()) {
    console.log(`- ${m.title}  [${m.file}]`);
    console.log(`    ينطبق على: ${JSON.stringify(m.appliesTo)}`);
  }
  process.exit(0);
}

if (!subject || !lessonTitle) {
  console.error('الاستعمال: node src/scripts/test-memo-generation.js <المادة> <المستوى> <عنوان الدرس>');
  console.error('        أو: node src/scripts/test-memo-generation.js --methodologies');
  process.exit(1);
}

async function main() {
  const levelValue = level || 'السنة الأولى أساسي';
  console.log(`توليد مذكرة: ${subject} — ${levelValue} — "${lessonTitle}"\n`);

  const book = resolveBook(subject, levelValue);
  console.log(`[1/4] الكتاب المحدَّد: ${book ? `${book.bookId} (${book.gradeTitle} — ${book.subjectTitle})` : 'غير موجود'}`);
  if (!book) process.exit(2);

  const lesson = findLesson(book.subjectId, levelValue, lessonTitle, book.gradeId);
  console.log(`[2/4] الدرس: ${lesson ? `${lesson.id} — ${lesson.title}` : 'غير موجود في المنهج'}`);
  if (!lesson) process.exit(3);

  const methodology = resolveMethodology({ subject, level: levelValue });
  console.log(`[3/4] منهجية: ${methodology.title}\n`);

  console.log('[4/4] محتوى المذكرة:');
  const content = buildMemoContent(methodology, lesson, { subject: book.subjectTitle, level: levelValue, lessonTitle, lessonType: '', unit: '' });
  console.log(JSON.stringify(content, null, 2).slice(0, 6000));

  console.log('\n===== حفظ في قاعدة البيانات =====');
  const result = await generateMemo({ teacherId: 1, subject, level: levelValue, lessonTitle });
  console.log(`حالة: ${result.cached ? 'مسترجعة من الذاكرة' : 'بُنيت جديدًا'}`);
  console.log(`المعرّف: ${result.memo.id} — المنهجية: ${result.memo.methodologyId}`);
}

main().catch((e) => {
  console.error('فشل التوليد:', e.message);
  process.exit(4);
});
