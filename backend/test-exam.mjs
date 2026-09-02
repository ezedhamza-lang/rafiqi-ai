import { generateStandardsExam } from './src/services/standardsExamService.js';
import { assembleOfficialExam, renderOfficialHtml } from './src/services/officialExamTemplateService.js';

// Simulate the route handler exactly
const gradeId = 'year1';
const subject = 'math';
const trimester = 3;
const seed = 'test123';
const schoolName = 'مدرسة الاختبار';
const format = 'html';

const paper = generateStandardsExam({
  gradeId: gradeId || 'year1',
  subject: subject || 'math',
  seed: seed ?? null
});
console.log('Paper error:', paper.error);
if (paper.error) {
  console.log('Would return 400:', { error: paper.error });
  process.exit(0);
}

const exam = assembleOfficialExam(paper, {
  gradeId: gradeId || 'year1',
  trimester: Number(trimester) || 3
});
if (schoolName) exam.header.schoolLine = `مدرسة : ${schoolName}`;

if ((format || 'html') === 'json') {
  console.log('Would return JSON');
} else {
  const html = renderOfficialHtml(exam);
  console.log('HTML generated, length:', html.length);
  console.log('Content-Type would be: text/html; charset=utf-8');
  console.log('Preview:', html.substring(0, 500));
}