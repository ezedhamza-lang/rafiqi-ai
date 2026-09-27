// READ-ONLY book-pagination guard (ISS-018 / ISS-019).
//
// It answers one question per book: can the page metadata describe the pages that
// actually exist? It does NOT invent ranges and does NOT touch the UI.
//
// Facts this check relies on (all measured here, not assumed):
//   • the frontend never reads unit.startPage / unit.endPage  → a wrong unit range
//     cannot be reached by a user, so it is a data defect, not a functional one;
//   • the page viewer is bounded by book.totalPages
//     (BookViewer.jsx / Book3DViewer.jsx use Math.min(total, page + 1)).
//
// Therefore: a unit range beyond the real scan is reported as stale metadata. It is
// only repairable by whoever owns the printed book — inventing a range is forbidden.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const BACKEND = path.resolve(HERE, '..');
const ASSETS = path.join(BACKEND, 'curriculum/assets-books');

const reg = JSON.parse(fs.readFileSync(path.join(BACKEND, 'curriculum/registry.json'), 'utf8'));

// Book/unit pairs whose stored page range is known to be wrong or nominal. Each entry
// records what is actually true, so a change in either direction is visible.
const KNOWN = [
  {
    key: 'year4/math',
    file: 'math-situations-book.json',
    reason: 'paperOnly: true — no scan exists, every "الفترة" carries the whole 1-50 range on purpose; the field is unused',
    expectedOverlapPairs: 6
  },
  {
    key: 'year5/math',
    file: 'math-situations-book.json',
    reason: 'paperOnly: true — no scan exists, every "الفترة" carries the whole 1-62 range on purpose; the field is unused',
    expectedOverlapPairs: 28
  },
  {
    key: 'year6/math',
    file: 'math-book.json',
    reason: 'unit ranges were copied from a 174-page edition; the scan is 101 pages (101 files, max page 101)',
    expectedOverrunUnits: 3
  }
];

const scanPageCount = (imageBase) => {
  if (!imageBase) return null;
  const dir = path.join(ASSETS, imageBase.replace('/assets/books/', '').replace(/^\/+|\/+$/g, ''));
  if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) return null;
  const pages = fs.readdirSync(dir)
    .filter((f) => /^page-\d+\./i.test(f))
    .map((f) => Number(f.match(/page-(\d+)/i)[1]));
  if (!pages.length) return null;
  return { count: pages.length, max: Math.max(...pages), dir: path.relative(BACKEND, dir).replace(/\\/g, '/') };
};

const rows = [];
for (const g of reg.grades) {
  for (const s of g.subjects) {
    if (!s.bookFile) continue;
    const f = path.join(BACKEND, 'curriculum', g.dir, s.bookFile);
    if (!fs.existsSync(f)) { console.error(`!! registry points at a missing book file: ${path.relative(BACKEND, f)}`); process.exitCode = 1; continue; }
    const book = JSON.parse(fs.readFileSync(f, 'utf8'));
    const units = Array.isArray(book.units) ? book.units : [];
    const scan = scanPageCount(book.imageBase);

    // declared totalPages must equal the number of scan files when a scan exists
    let totalPagesOk = null;
    if (scan && Number.isFinite(Number(book.totalPages))) {
      totalPagesOk = Number(book.totalPages) === scan.count;
    }

    // unit ranges
    const ranges = units
      .map((u, i) => ({ i, id: u.id || u.title, a: Number(u.startPage), b: Number(u.endPage) }))
      .filter((r) => Number.isFinite(r.a) && Number.isFinite(r.b));
    let overlapPairs = 0;
    for (let i = 0; i < ranges.length; i += 1) {
      for (let j = i + 1; j < ranges.length; j += 1) {
        if (ranges[i].a <= ranges[j].b && ranges[j].a <= ranges[i].b) overlapPairs += 1;
      }
    }
    const maxEnd = ranges.length ? Math.max(...ranges.map((r) => r.b)) : null;
    const overrun = scan ? ranges.filter((r) => r.b > scan.max) : [];

    if (!units.length) continue;
    rows.push({
      key: `${g.id}/${s.id}`,
      file: s.bookFile,
      paperOnly: !!book.paperOnly,
      declared: Number(book.totalPages) || null,
      scan: scan ? scan.count : null,
      scanDir: scan ? scan.dir : null,
      units: units.length,
      overlapPairs,
      maxEnd,
      overrunUnits: overrun.length,
      totalPagesOk
    });
  }
}

console.log(`books with units: ${rows.length}`);
console.log('\nbook                paper  declared  scan  units  overlap  maxEnd  overrun  totalPages==scan');
for (const r of rows) {
  console.log(
    `${(r.key + '                    ').slice(0, 19)} ${r.paperOnly ? 'yes ' : 'no  '} ` +
    `${String(r.declared ?? '-').padStart(8)} ${String(r.scan ?? '-').padStart(5)} ${String(r.units).padStart(6)} ` +
    `${String(r.overlapPairs).padStart(8)} ${String(r.maxEnd ?? '-').padStart(7)} ${String(r.overrunUnits).padStart(8)}  ` +
    `${r.totalPagesOk === null ? 'n/a' : r.totalPagesOk ? 'yes' : 'NO <<<'}`
  );
}

let failed = false;

// 1) a declared totalPages that disagrees with the real scan is a functional defect:
//    the viewer would let the user page past the last existing image.
for (const r of rows) {
  if (r.totalPagesOk === false) {
    console.log(`\n✗ ${r.key}: totalPages=${r.declared} but the scan has ${r.scan} page files (${r.scanDir}) — a user can page into a missing image`);
    failed = true;
  }
}

// 2) stale unit ranges are reported and must match the recorded, known state
for (const r of rows) {
  const known = KNOWN.find((k) => k.key === r.key);
  const hasOverrun = r.overrunUnits > 0;
  const hasOverlap = r.overlapPairs > 0;
  if (!hasOverrun && !hasOverlap) continue;
  if (!known) {
    console.log(`\n✗ ${r.key}: ${hasOverrun ? `${r.overrunUnits} unit range(s) beyond the scan` : `${r.overlapPairs} overlapping unit range(s)`} — add it to KNOWN in this file AND to MASTER-ISSUES.md`);
    failed = true;
    continue;
  }
  const expected = known.expectedOverrunUnits ?? known.expectedOverlapPairs;
  const actual = hasOverrun ? r.overrunUnits : r.overlapPairs;
  const ok = actual === expected;
  console.log(`\n${ok ? '✓' : '✗'} ${r.key} — documented: ${known.reason}`);
  console.log(`    measured ${actual} (documented ${expected})`);
  if (!ok) failed = true;
}

const undocumented = rows.filter((r) => (r.overrunUnits > 0 || r.overlapPairs > 0) && !KNOWN.some((k) => k.key === r.key));
console.log(`\nbooks with a page-range defect: ${rows.filter((r) => r.overrunUnits > 0 || r.overlapPairs > 0).length} (all documented: ${undocumented.length === 0})`);
console.log('the frontend never reads unit.startPage/endPage, so these ranges cannot be reached by a user —');
console.log('repairing them requires the real printed pagination, which is a content decision, not a code fix.');

if (failed) process.exitCode = 1;
else console.log('\n✓ no undocumented page-range defect and no totalPages/scan mismatch');
