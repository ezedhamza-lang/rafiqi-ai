/**
 * اختبار شامل: توليد مذكرة لكل سنة/مادة/درس
 * Usage: node scripts/test-all-memos.mjs
 */
import { fileURLToPath } from 'url';
import path from 'path';
import { getLessonPages, loadRegistry, findGradeByLevel } from '../src/services/curriculumService.js';
import { resolveBookCandidates, generateMemo, lessonIsDigitized } from '../src/services/lessonMemoService.js';
import { normalizeSubject } from '../src/services/methodologyResolver.js';
import { normalizeArabic } from '../src/services/curriculumService.js';

const LEVELS = [
  'السنة الأولى أساسي',
  'السنة الثانية أساسي',
  'السنة الثالثة أساسي',
  'السنة الرابعة أساسي',
  'السنة الخامسة أساسي',
  'السنة السادسة أساسي'
];

function yearOf(level) {
  const m = String(level || '').match(/السنة\s+(الأولى|الثانية|الثالثة|الرابعة|الخامسة|السادسة)/);
  if (!m) return '';
  return { الأولى: '1', الثانية: '2', الثالثة: '3', الرابعة: '4', الخامسة: '5', السادسة: '6' }[m[1]] || '';
}

const results = [];
let totalPass = 0;
let totalFail = 0;
let totalSkip = 0;

for (const level of LEVELS) {
  const yearNum = yearOf(level);
  const gradeId = `year${yearNum}`;
  console.log(`\n${'='.repeat(60)}`);
  console.log(`📘 ${level}`);
  console.log(`${'='.repeat(60)}`);

  const registry = loadRegistry();
  const grade = (registry.grades || []).find((g) => g.id === gradeId);
  if (!grade) {
    console.log(`  ❌ Grade ${gradeId} not found in registry`);
    continue;
  }

  for (const subject of grade.subjects || []) {
    if (!subject.lessonsFile && !subject.bookFile) {
      console.log(`  ⏭️  ${subject.title} (${subject.id}) — no lessonsFile, skipped`);
      totalSkip++;
      results.push({ level, subject: subject.title, status: 'SKIP', reason: 'no lessonsFile' });
      continue;
    }

    // Get lessons for this subject
    const pages = getLessonPages(subject.id, level, gradeId);
    if (!pages || !pages.length) {
      console.log(`  ⏭️  ${subject.title} (${subject.id}) — 0 lessons, skipped`);
      totalSkip++;
      results.push({ level, subject: subject.title, status: 'SKIP', reason: '0 lessons' });
      continue;
    }

    // Pick first lesson
    const firstLesson = pages[0];
    const lessonTitle = firstLesson.title;

    // Check if digitized
    if (!lessonIsDigitized(firstLesson)) {
      console.log(`  ⚠️  ${subject.title} — "${lessonTitle}" — NOT DIGITIZED`);
      totalSkip++;
      results.push({ level, subject: subject.title, lesson: lessonTitle, status: 'SKIP', reason: 'not digitized' });
      continue;
    }

    // Try generate
    try {
      const res = await generateMemo({
        teacherId: 'test',
        subject: subject.title,
        level,
        lessonTitle
      });
      if (res.memo) {
        console.log(`  ✅ ${subject.title} — "${lessonTitle}" — OK`);
        totalPass++;
        results.push({ level, subject: subject.title, lesson: lessonTitle, status: 'PASS' });
      } else {
        console.log(`  ❌ ${subject.title} — "${lessonTitle}" — NO MEMO returned`);
        totalFail++;
        results.push({ level, subject: subject.title, lesson: lessonTitle, status: 'FAIL', reason: 'no memo returned' });
      }
    } catch (e) {
      console.log(`  ❌ ${subject.title} — "${lessonTitle}" — ${e.code || 'ERROR'}: ${e.message}`);
      totalFail++;
      results.push({ level, subject: subject.title, lesson: lessonTitle, status: 'FAIL', reason: e.code || e.message });
    }
  }
}

console.log(`\n${'='.repeat(60)}`);
console.log(`📊 النتيجة الإجمالية`);
console.log(`${'='.repeat(60)}`);
console.log(`  ✅ نجاح: ${totalPass}`);
console.log(`  ❌ فشل: ${totalFail}`);
console.log(`  ⏭️  تخطي: ${totalSkip}`);
console.log(`  المجموع: ${totalPass + totalFail + totalSkip}`);

// Summary table of failures
const failures = results.filter((r) => r.status === 'FAIL');
if (failures.length) {
  console.log(`\n📋 تفاصيل الفشل:`);
  for (const f of failures) {
    console.log(`  • ${f.level} / ${f.subject} / "${f.lesson}" — ${f.reason}`);
  }
}

const skips = results.filter((r) => r.status === 'SKIP');
if (skips.length) {
  console.log(`\n⏭️  المواد المخطاة:`);
  for (const s of skips) {
    console.log(`  • ${s.level || ''} / ${s.subject} — ${s.reason}`);
  }
}
