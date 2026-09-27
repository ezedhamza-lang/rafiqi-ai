// READ-ONLY trace: why does year2/math-rasmi serve year2/math2's lessons?
// Walks registry -> curriculum mapping -> service -> API and prints each hop.
import fs from 'fs';
import { getLessonPages, listBooks } from '../src/services/curriculumService.js';

const reg = JSON.parse(fs.readFileSync('curriculum/registry.json', 'utf8'));
const y2 = reg.grades.find((g) => g.id === 'year2');

console.log('=== HOP 1: registry (year2, math family) ===');
for (const s of y2.subjects) {
  if (!/math/.test(s.id)) continue;
  console.log(`  id=${s.id}`);
  console.log(`     bookFile   = ${s.bookFile}`);
  console.log(`     lessonsFile= ${s.lessonsFile ?? '(absent)'}`);
  console.log(`     adapter    = ${s.adapter ?? '(absent)'}`);
}

console.log('\n=== HOP 2: the file the service would read ===');
for (const id of ['math', 'math2', 'math-rasmi']) {
  const s = y2.subjects.find((x) => x.id === id);
  const explicit = s.lessonsFile;
  const fallback = 'math-units.json'; // the literal in curriculumService.js:570
  const chosen = explicit || fallback;
  const full = `curriculum/${y2.dir}/${chosen}`;
  console.log(`  ${id.padEnd(10)} explicit=${String(explicit).padEnd(20)} → reads ${chosen.padEnd(20)} exists=${fs.existsSync(full)}`);
}

console.log('\n=== HOP 3: what getLessonPages returns for each ===');
const perBook = new Map();
for (const s of y2.subjects) {
  if (!/math/.test(s.id)) continue;
  const pages = getLessonPages(s.id, null, y2.id, null);
  const ids = pages.map((p) => p.id).join(',');
  perBook.set(s.id, ids);
  console.log(`  ${s.id.padEnd(10)} pages=${String(pages.length).padStart(3)}  first5=[${pages.slice(0, 5).map((p) => p.id).join(', ')}]`);
}

console.log('\n=== HOP 4: identity comparison ===');
const ids = [...perBook.entries()];
for (let i = 0; i < ids.length; i += 1) {
  for (let j = i + 1; j < ids.length; j += 1) {
    const [na, ia] = ids[i];
    const [nb, ib] = ids[j];
    if (ia === ib) console.log(`  ✗ ${na} and ${nb} serve the IDENTICAL lesson-id set (${ia ? ia.split(',').length : 0} ids)`);
  }
}

console.log('\n=== HOP 5: what the catalogue advertises (the UI button) ===');
for (const b of listBooks(null).filter((x) => x.gradeId === 'year2' && /math/.test(x.subjectId))) {
  console.log(`  ${b.subjectId.padEnd(10)} title="${b.title}" lessonsCount=${b.lessonsCount} hasImages=${b.hasImages}`);
}

console.log('\n=== HOP 6: other grades — is the same fallback reachable? ===');
for (const g of reg.grades) {
  for (const s of g.subjects) {
    if (s.lessonsFile) continue;
    const adapter = String(s.adapter || '').toLowerCase();
    const code = String(s.id || '').toLowerCase();
    const mathBranch = code === 'math' || adapter === 'math';
    const anisiBranch = code === 'anisi' || adapter === 'anisi' || adapter === 'reading';
    const scienceBranch = code === 'science' || adapter === 'science';
    const prodBranch = code === 'production' || adapter === 'production';
    const branch = mathBranch ? 'math-units.json' : anisiBranch ? 'anisi-lessons-full.json' : scienceBranch ? '(book chapters)' : prodBranch ? 'production-units.json' : '—';
    if (branch === '—') continue;
    const target = branch.startsWith('(') ? null : `curriculum/${g.dir}/${branch}`;
    const exists = target ? fs.existsSync(target) : null;
    console.log(`  ${g.dir}/${s.id.padEnd(10)} no lessonsFile → branch reads ${branch.padEnd(24)} exists=${exists}${exists && s.bookFile !== branch ? '   ← FALLBACK (other book content)' : ''}`);
  }
}
