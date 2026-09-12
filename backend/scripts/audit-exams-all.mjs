import { buildExam, collectGradeQuestions, SUBJECT_KEYS, gradeSubjectBooks } from '../src/services/examBuilder.js';

const ANSWER_MARK = /(الإجابة|الجواب|الحل)\s*[:：=]|⟵|←/;
const EMOJI = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/u;
const PLACEHOLDER = /التحضير|سيظهر هنا|واصل التقدم|لم ينشا/;
const GRADES = ['year1', 'year2', 'year3', 'year4', 'year5', 'year6'];
const SEEDS = [11, 42, 77];

let totalIssues = 0;
const noPool = [];
const lines = [];
for (const g of GRADES) {
  const per = [];
  for (const s of SUBJECT_KEYS) {
    const bookIds = gradeSubjectBooks(g, s);
    const poolSize = collectGradeQuestions(g, s).length;
    for (const seed of SEEDS) {
      const exam = buildExam(g, seed, 8, s);
      const tag = `${g}/${s}#${seed}`;
      if (!exam) {
        // مخزون=0 ⇒ فجوة محتوى مفهومة (كتاب غير مرقمن)؛ مخزون>0 مع فشل بناء ⇒ خلل حقيقي
        if (poolSize > 0) { per.push(`${tag}: لا يبني رغم أن المخزون=${poolSize}`); totalIssues++; }
        continue;
      }
      if (!exam.items.length) { per.push(`${tag}: عناصر فارغة مع مخزون=${poolSize}`); totalIssues++; continue; }
      const prompts = exam.items.map((q) => q.prompt);
      const leaks = prompts.filter((p) => ANSWER_MARK.test(p) || /⟵|←/.test(p)).length;
      if (leaks) { per.push(`${tag}: تسريب إجابات=${leaks}`); totalIssues++; }
      const dup = prompts.length - new Set(prompts.map((p) => p.trim())).size;
      if (dup) { per.push(`${tag}: مكرر=${dup}`); totalIssues++; }
      const emoji = prompts.filter((p) => EMOJI.test(p)).length;
      if (emoji) { per.push(`${tag}: إيموجي=${emoji}`); totalIssues++; }
      const ph = prompts.filter((p) => PLACEHOLDER.test(p)).length;
      if (ph) { per.push(`${tag}: حشو قالب=${ph}`); totalIssues++; }
      const missingField = exam.items.filter((q) => !q.field).length;
      if (missingField) { per.push(`${tag}: خانة بلا وصف=${missingField}`); totalIssues++; }
      const badTable = exam.items.filter((q) => q.kind === 'table' && !(q.rows || []).length).length;
      const badPairs = exam.items.filter((q) => q.kind === 'match-pairs' && !(q.pairs || []).length).length;
      if (badTable || badPairs) { per.push(`${tag}: جدول/ربط بلا بيانات`); totalIssues++; }
      if (!exam.title.includes(exam.subject)) { per.push(`${tag}: عنوان بلا مادة (${exam.title})`); totalIssues++; }
    }
    per.push(`  ${s}: مخزون=${poolSize} كتب=[${bookIds.join(',')}]`);
  }
  lines.push(`${g}:\n  ${per.join('\n  ')}`);
}
console.log(lines.join('\n'));
console.log('\nمستوى/مادة بلا محتوى مرقمن (اختبار غير ممكن):');
for (const n of noPool) console.log('  • ' + n);
console.log(`\nTOTAL ISSUES: ${totalIssues} | exams checked: ${GRADES.length * SUBJECT_KEYS.length * SEEDS.length}`);
process.exit(totalIssues ? 1 : 0);
