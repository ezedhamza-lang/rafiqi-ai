import { listBooks } from '../src/services/curriculumService.js';
import { collectGradeQuestions } from '../src/services/examBuilder.js';

const y6 = listBooks().filter((b) => b.gradeId === 'year6');
console.log('YEAR6 BOOKS:', y6.map((b) => `${b.subjectId}|${b.subject}|key=${b.subjectKey}|scan=${b.scanReady}|paper=${b.paperStyle}|pages=${b.totalPages}`).join('\n  '));
const mathKeys = [...new Set(y6.map((b) => b.subjectKey))];
console.log('UNIQUE SUBJECTS for teacher dropdown:', JSON.stringify(mathKeys));
console.log('math books grouped under key «رياضيات»:', y6.filter((b) => b.subjectKey === 'رياضيات').length);

const pool = collectGradeQuestions('year6');
console.log('Y6 exam pool questions:', pool.length);
const sources = [...new Set(pool.map((q) => q.source.split('/')[1]))];
console.log('Books contributing questions:', JSON.stringify(sources));
const leaky = pool.filter((q) => /الإجابة|الجواب|الحل\s*[:=]/.test(q.prompt)).length;
console.log('answer leaks in pool:', leaky);
for (const g of ['year2', 'year5']) {
  const books = listBooks().filter((b) => b.gradeId === g && b.subjectKey === 'رياضيات');
  console.log(`${g}: math-family books =`, books.map((b) => b.subjectId).join(','), '| pool =', collectGradeQuestions(g).length);
}
