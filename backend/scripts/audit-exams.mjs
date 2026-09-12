import fs from 'fs';
import { pathToFileURL } from 'url';

/**
 * فاحص الاختبارات: 10 اختبارات لكل سنة (60 اختبارًا) — يبحث عن:
 * أسئلة مكررة داخل نفس الاختبار، تسريب إجابات، إيموجي/تنسيق ملوث،
 * عناصر بلا مكان إجابة المناسب (جدول بلا شبكة/ربط بلا أزواج/اختيار بلا خيارات)،
 * فترة/سنة خاطئة، اختبار فقير.
 * node scripts/audit-exams.mjs  (من مجلد backend)
 */
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'audit';
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://x:x@localhost:5/x';
const base = pathToFileURL(process.cwd() + '/').href;
const { buildExam } = await import(base + 'src/services/examBuilder.js');
const { normalizeArabic } = await import(base + 'src/services/curriculumService.js');

const YEARS = ['year1', 'year2', 'year3', 'year4', 'year5', 'year6'];
const ANSWER_MARK = /(الإجابة|الجواب|الحل)\s*[:：=]|⟵|←/;
const EMOJI = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}]/u;
const out = [];
let total = 0;
for (const grade of YEARS) {
  let ok = 0;
  for (let i = 0; i < 10; i++) {
    const seed = 1000 + i * 137 + grade.length;
    const exam = buildExam(grade, seed, i % 2 ? 8 : 10);
    const issues = [];
    if (!exam) { issues.push('لا توجد أسئلة مرقمنة'); }
    else {
      if (exam.items.length < 5) issues.push('فقير: ' + exam.items.length + ' سؤال');
      if (!exam.period && exam.items.some((q) => q.period)) issues.push('فترة ضائعة');
      const seen = new Set();
      for (const q of exam.items) {
        const k = normalizeArabic(q.prompt);
        if (seen.has(k)) issues.push('تكرار: ' + q.prompt.slice(0, 32));
        seen.add(k);
        if (ANSWER_MARK.test(q.prompt)) issues.push('تسريب إجابة: ' + q.prompt.slice(0, 32));
        if (EMOJI.test(q.prompt)) issues.push('إيموجي: ' + q.prompt.slice(0, 24));
        if (q.kind === 'table' && (!q.rows || !q.rows.length)) issues.push('جدول بلا شبكة');
        if (q.kind === 'match-pairs' && (!q.pairs || q.pairs.length < 2)) issues.push('ربط بلا أزواج');
        if (q.kind === 'question' && q.prompt.includes('اختار') && (!q.options || q.options.length < 2)) issues.push('اختيار بلا خيارات');
        if (q.kind === 'picture-choice' && (!q.options || q.options.length < 2)) issues.push('اختيار صورة بلا خيارات');
        if (!q.source.startsWith(grade + '/')) issues.push('تسرب سنة: ' + q.source);
        if (!q.field) issues.push('بلا مكان إجابة');
      }
      const dupAcrossGrades = exam && exam.items.some((q) => !q.source.startsWith(grade));
      if (dupAcrossGrades) issues.push('مصدر خارج السنة');
    }
    total += issues.length;
    if (!issues.length) ok++;
    else out.push(`${grade}/#${i} [seed=${seed}]: ` + [...new Set(issues)].slice(0, 4).join(' | '));
  }
  out.push(`#### ${grade}: ${ok}/10 نظيف`);
}
fs.writeFileSync('audit-exams-report.txt', out.join('\n') + '\nTOTAL: ' + total, 'utf8');
console.log('TOTAL ISSUES:', total);
process.exitCode = total ? 1 : 0;
