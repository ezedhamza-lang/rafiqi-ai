// READ-ONLY content audit of the answer keys, using the SAME loader the grader uses
// (getLessonPages) so the answers that the public API deliberately hides are visible.
// Checks only mechanical properties: presence, type coherence, membership in options.
import { getLessonPages } from '../src/services/curriculumService.js';

const BOOKS = [
  ['year1', 'math'], ['year1', 'anisi'], ['year1', 'science'], ['year1', 'production'],
  ['year2', 'math'], ['year2', 'math2'], ['year2', 'math-rasmi'], ['year2', 'anisi'], ['year2', 'science'], ['year2', 'production'], ['year2', 'french'],
  ['year3', 'math'], ['year3', 'anisi'], ['year3', 'science'], ['year3', 'production'],
  ['year4', 'math'], ['year4', 'anisi'], ['year4', 'science'], ['year4', 'production'],
  ['year5', 'math'], ['year5', 'math2'], ['year5', 'anisi'], ['year5', 'science'], ['year5', 'production'],
  ['year6', 'math'], ['year6', 'math-rasmi'], ['year6', 'math-tunsi'], ['year6', 'math-kras'], ['year6', 'anisi'], ['year6', 'science'], ['year6', 'production']
];

const raw = (b) => (b.answer !== undefined && b.answer !== null ? b.answer : b.correctAnswer !== undefined && b.correctAnswer !== null ? b.correctAnswer : b.correct !== undefined && b.correct !== null ? b.correct : undefined);

let pages = 0;
let blocks = 0;
let qBlocks = 0;
let checkable = 0;
let checkableWithAnswer = 0;
let answerOutsideOptions = [];
let mcqNoOptions = [];
let noAnswerAtAll = [];
let freeTextWithNumericAnswer = [];
const allPages = [];

for (const [gradeId, subjectId] of BOOKS) {
  let list;
  try {
    list = getLessonPages(subjectId, null, gradeId);
  } catch (e) {
    console.log(`${gradeId}/${subjectId}: LOADER THREW ${e.message}`);
    continue;
  }
  if (!Array.isArray(list)) { console.log(`${gradeId}/${subjectId}: loader returned ${typeof list}`); continue; }
  pages += list.length;
  allPages.push(...list);

  for (const page of list) {
    const bl = Array.isArray(page.blocks) ? page.blocks : [];
    blocks += bl.length;
    for (const [i, b] of bl.entries()) {
      const isQ = /question|quiz|test|exercise|eval/i.test(String(b.kind)) || (Array.isArray(b.options) && b.options.length);
      if (!isQ) continue;
      qBlocks += 1;
      const options = Array.isArray(b.options) ? b.options : null;
      const a = raw(b);
      const where = `${gradeId}/${subjectId} · ${page.id} · b${i}`;

      // `checkable` is DERIVED by sanitizeStudentPages() from the presence of an
      // answer key — it is not a field in the source files. Reproduce that rule.
      const isCheckable = a !== undefined;
      if (b.teacherOnly) continue;
      if (isCheckable) {
        checkable += 1;
        checkableWithAnswer += 1;

        if (options && options.length) {
          if (typeof a === 'number') {
            if (!Number.isInteger(a) || a < 0 || a >= options.length) answerOutsideOptions.push(`${where}: index ${a} خارج النطاق (0..${options.length - 1})`);
          } else {
            const asText = String(a);
            if (/^\d+$/.test(asText)) {
              if (Number(asText) >= options.length) answerOutsideOptions.push(`${where}: "${asText}" خارج النطاق`);
            } else if (!options.some((o) => String(o).trim() === asText.trim())) {
              answerOutsideOptions.push(`${where}: "${asText}" ليست ضمن الخيارات ${JSON.stringify(options).slice(0, 70)}`);
            }
          }
        } else if (b.kind === 'question' || b.kind === 'quiz') {
          // A numeric key on a question with no options is only a *suspicion*: many of
          // these are arithmetic items ("14 + 12 = ......") where a number is the
          // correct key. It is listed so it can be graded by the real service, not to
          // be counted as a defect.
          if (typeof a === 'number' || /^-?\d+(\.\d+)?$/.test(String(a))) freeTextWithNumericAnswer.push(`${where}: ${a}`);
        }
      } else {
        // a question the student can attempt but that can never be graded
        noAnswerAtAll.push(`${where} kind=${b.kind} options=${options ? options.length : 0} :: ${String(b.text || b.title || '').slice(0, 50)}`);
      }
      if (options && !options.length) mcqNoOptions.push(where);
    }
  }
}

const show = (title, arr, n = 8) => {
  console.log(`\n=== ${title}: ${arr.length} ===`);
  arr.slice(0, n).forEach((x) => console.log('  ' + x));
  if (arr.length > n) console.log(`  … +${arr.length - n} more`);
};

console.log(`pages: ${pages} · blocks: ${blocks} · question-ish: ${qBlocks}`);
console.log(`checkable blocks: ${checkable} · of which have an answer: ${checkableWithAnswer} (${checkable ? Math.round((checkableWithAnswer / checkable) * 100) : 0}%)`);
show('checkable with NO answer', noAnswerAtAll, 10);
show('answer not among the options', answerOutsideOptions, 10);
show('options array empty on a question', mcqNoOptions, 6);
show('free-text question whose key is numeric', freeTextWithNumericAnswer, 6);

// ── verdict on the numeric keys: grade each one through the real service ──────────
// A numeric key is only a defect if the production grader cannot accept the number a
// learner would type. This calls gradeBlockAnswer — the same function the
// POST /api/student/lesson/check endpoint uses — so the answer is measured, not argued.
{
  const { gradeBlockAnswer } = await import('../src/services/lessonAnswerService.js');
  let checked = 0;
  const ungradable = [];
  for (const ref of freeTextWithNumericAnswer) {
    // ref looks like: "year1/math · y1a3 · b3: 5"
    const m = ref.match(/^(\S+)\s+·\s+(\S+)\s+·\s+b(\d+):\s*(.+)$/);
    if (!m) { ungradable.push(`unparsed reference: ${ref}`); continue; }
    const [, book, pageId, idxRaw] = m;
    const idx = Number(idxRaw);
    const page = allPages.find((p) => p.id === pageId);
    if (!page) { ungradable.push(`${book}: page ${pageId} not found`); continue; }
    const block = (page.blocks || [])[idx];
    if (!block) { ungradable.push(`${book} ${pageId}: block index ${idx} missing`); continue; }
    const key = raw(block);
    try {
      const res = gradeBlockAnswer({ ...block, options: null }, String(key));
      checked += 1;
      if (!res || res.graded !== true || res.correct !== true) {
        ungradable.push(`${book} ${pageId} b${idx}: key=${key} graded=${JSON.stringify(res)}`);
      }
    } catch (e) {
      ungradable.push(`${book} ${pageId} b${idx}: key=${key} threw ${e.message.slice(0, 60)}`);
    }
  }
  console.log(`\n=== numeric keys graded by the real service: ${checked} checked · ${ungradable.length} ungradable ===`);
  ungradable.slice(0, 8).forEach((x) => console.log('  ✗ ' + x));
  if (checked && !ungradable.length) console.log('  ✓ every numeric key is accepted when the learner types that number (no answer-type mismatch)');
}
