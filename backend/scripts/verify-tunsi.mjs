import { listBooks, getLessonPages } from '../src/services/curriculumService.js';
import { resolveBookCandidates, findLesson } from '../src/services/lessonMemoService.js';
import { collectGradeQuestions, gradeSubjectBooks } from '../src/services/examBuilder.js';

const y6 = listBooks().filter((b) => b.gradeId === 'year6' && b.subjectKey === 'رياضيات');
console.log('year6 math books:', y6.map((b) => `${b.subjectId}(pages=${b.totalPages},lessons=${b.lessonsCount},scan=${b.scanReady})`).join(' | '));
const tunsi = getLessonPages('math-tunsi', null, 'year6');
console.log('tunsi pages:', tunsi.length, '| first:', tunsi[0]?.id, tunsi[0]?.title.slice(0, 40));
const cand = resolveBookCandidates('رياضيات', 'السنة السادسة أساسي');
console.log('memo candidates order:', cand.map((c) => c.subjectId).join(','));
const hit = findLesson('math-tunsi', 'السنة السادسة أساسي', 'أتعرّف قابلية قسمة عدد صحيح طبيعيّ على 3 و 9', 'year6');
console.log('findLesson in tunsi:', hit ? `${hit.id} ✓` : 'NOT FOUND');
console.log('gradeSubjectBooks:', gradeSubjectBooks('year6', 'رياضيات').join(','));
const pool = collectGradeQuestions('year6', 'رياضيات');
const byBook = {};
for (const q of pool) byBook[q.source.split('/')[1]] = (byBook[q.source.split('/')[1]] || 0) + 1;
console.log('exam pool:', pool.length, JSON.stringify(byBook));
const blob = JSON.stringify(tunsi.map((p) => ({ b: (p.blocks || []).filter((x) => !x.teacherOnly) })));
console.log('student leak check:', /"answer"|أتحقق[^.]{0,20}=\s*[\d]/.test(blob) ? 'LEAK!' : 'clean ✓');
