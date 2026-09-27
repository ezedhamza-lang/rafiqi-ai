// READ-ONLY: cross-year contamination check for the reading stories, plus the rate
// limiter behind the 429s seen on /exercises.
import fs from 'fs';

const load = (f) => JSON.parse(fs.readFileSync(`content/stories/${f}`, 'utf8'));
const y3 = load('y3-reading-stories-data.json');
const y4 = load('y4-reading-stories-data.json');
const y5 = load('y5-reading-stories-data.json');
const y6 = load('y6-word-lessons-data.json');

const norm = (s) => String(s || '').replace(/[\sً-ٟـ]/g, '');
const titleOf = (s) => s.title || s.storyTitle || '';

function compare(a, b, na, nb) {
  const ta = new Map(a.map((x) => [norm(titleOf(x)), x]));
  const tb = new Map(b.map((x) => [norm(titleOf(x)), x]));
  const shared = [...ta.keys()].filter((k) => k && tb.has(k));
  const sameId = a.filter((x) => b.some((y) => y.id === x.id)).length;
  const sameText = a.filter((x) => b.some((y) => norm(y.text) === norm(x.text) && norm(x.text).length > 40)).length;
  console.log(`\n${na} (${a.length}) vs ${nb} (${b.length})`);
  console.log(`  identical ids: ${sameId}`);
  console.log(`  identical titles: ${shared.length}`);
  console.log(`  identical body text (>40 chars): ${sameText}`);
  if (shared.length) console.log(`  examples: ${shared.slice(0, 5).map((k) => ta.get(k).title).join(' | ')}`);
  if (sameText) {
    const ex = a.filter((x) => b.some((y) => norm(y.text) === norm(x.text) && norm(x.text).length > 40)).slice(0, 3);
    for (const x of ex) console.log(`    · "${x.title}" (${x.id}) == "${b.find((y) => norm(y.text) === norm(x.text)).id}"`);
  }
}

compare(y3, y4, 'year3 reading', 'year4 reading');
compare(y4, y5, 'year4 reading', 'year5 reading');
compare(y5, y6, 'year5 reading', 'year6 word');
compare(y3, y5, 'year3 reading', 'year5 reading');

// grade/period/subject fields: does any story declare a different year?
console.log('\n=== declared year fields inside the reading story files ===');
for (const [name, arr] of [['y3', y3], ['y4', y4], ['y5', y5], ['y6', y6]]) {
  const fields = new Set();
  arr.forEach((s) => Object.keys(s).forEach((k) => fields.add(k)));
  const withGrade = arr.filter((s) => s.grade || s.year || s.level).length;
  const periods = [...new Set(arr.map((s) => s.period).filter(Boolean))];
  const subjects = [...new Set(arr.map((s) => s.subject).filter(Boolean))];
  console.log(`  ${name}: n=${arr.length} · withGradeField=${withGrade} · periods=${periods.join(',')} · subjects=${subjects.join(',')}`);
  console.log(`      fields: ${[...fields].join(', ')}`);
  // grammar field can reveal a foreign-year label
  const grammars = [...new Set(arr.map((s) => s.grammar).filter(Boolean))].slice(0, 6);
  console.log(`      grammar values: ${grammars.join(' | ')}`);
}

console.log('\n=== rate limiter config ===');
const files = ['src/index.js', 'src/middleware/rateLimit.js', 'src/middleware/security.js'];
for (const f of files) {
  if (!fs.existsSync(f)) continue;
  const t = fs.readFileSync(f, 'utf8');
  const lines = t.split('\n');
  lines.forEach((l, i) => {
    if (/rateLimit|windowMs|max\s*[:=]|standardHeaders|legacyHeaders/.test(l)) {
      console.log(`  ${f}:${i + 1}: ${l.trim().slice(0, 120)}`);
    }
  });
}
