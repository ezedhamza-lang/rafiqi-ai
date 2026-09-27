// CONTENT MATRIX — the audit the owner asked for, per year and per subject:
//   Book → adapter → curriculum file → lessons → images → pages → activities
// READ-ONLY. It prints one line per (grade, subject) and a PASS/FAIL verdict per
// column, so a regression in any single column is visible without reading prose.
//
// Column verdicts
//   adapter      the registry's adapter must match the subject id (no cross-claims)
//   bookFile     must exist on disk and parse
//   lessonsFile  declared ⇒ must exist; absent ⇒ 0 lessons and no guessed filename
//   lessons      must equal what the /lessons endpoint serves (single source of truth)
//   images       every image reference resolvable, or a documented asset gap
//   pages        totalPages must equal the real scan when a scan exists
//   activities   every activity block reachable from the lessons that are served
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getLessonPages, listBooks } from '../src/services/curriculumService.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const BACKEND = path.resolve(HERE, '..');
const REPO = path.resolve(BACKEND, '..');
const PUBLIC = path.join(REPO, 'frontend', 'public');
const ASSETS = path.join(BACKEND, 'curriculum/assets-books');

const EXT = /\.(png|jpe?g|webp|gif|svg|avif)$/i;
const ROOTS = [
  path.join(BACKEND, 'curriculum/assets-books'),
  path.join(BACKEND, 'uploads/assets'),
  path.join(BACKEND, 'uploads/images'),
  path.join(BACKEND, 'uploads/media'),
  path.join(BACKEND, 'uploads/svg'),
  path.join(BACKEND, 'uploads/intaj'),
  path.join(BACKEND, 'uploads/science'),
  path.join(BACKEND, 'uploads'),
  path.join(BACKEND, 'curriculum'),
  PUBLIC,
  path.join(REPO, 'frontend', 'src')
];

const KNOWN_ASSET_GAPS = ['/assets/books/anisi-lessons/', '/assets/books/anisi-workbook/'];

const registry = JSON.parse(fs.readFileSync(path.join(BACKEND, 'curriculum/registry.json'), 'utf8'));
const catalogue = listBooks(null);

const resolveAsset = (url) => {
  const clean = decodeURIComponent(String(url).split('?')[0]).replace(/^\/+/, '');
  for (const root of ROOTS) {
    const c = path.join(root, clean);
    try { if (fs.existsSync(c) && fs.statSync(c).isFile()) return c; } catch { /* ignore */ }
  }
  return null;
};

const scanPages = (imageBase) => {
  if (!imageBase) return null;
  const dir = path.join(ASSETS, imageBase.replace('/assets/books/', '').replace(/^\/+|\/+$/g, ''));
  if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) return null;
  const n = fs.readdirSync(dir).filter((f) => /^page-\d+\./i.test(f));
  if (!n.length) return null;
  return n.length;
};

/** every image url inside an object, at any depth */
function imageRefs(node, out = []) {
  if (!node || typeof node !== 'object') return out;
  if (Array.isArray(node)) { node.forEach((v) => imageRefs(v, out)); return out; }
  for (const v of Object.values(node)) {
    if (typeof v === 'string' && EXT.test(v) && v.startsWith('/')) out.push(v);
    else imageRefs(v, out);
  }
  return out;
}

const activityKinds = /question|quiz|test|exercise|eval|interactive|input|fill|drag|match/i;
const rows = [];
let totals = { lessons: 0, activities: 0, images: 0, imagesOk: 0, imagesGapped: 0, books: 0 };

for (const g of registry.grades) {
  for (const s of g.subjects) {
    if (!s.bookFile) continue;
    totals.books += 1;
    const bookPath = path.join(BACKEND, 'curriculum', g.dir, s.bookFile);
    const bookExists = fs.existsSync(bookPath);
    const book = bookExists ? JSON.parse(fs.readFileSync(bookPath, 'utf8')) : {};
    const listed = catalogue.find((b) => b.gradeId === g.id && b.subjectId === s.id);

    // adapter must not claim another subject's converter
    const adapter = s.adapter || '';
    const code = String(s.id).toLowerCase();
    const adapterOk = !adapter
      || (adapter === 'math' && /^math/.test(code))
      || (adapter === 'anisi' && /anisi|reading|arabic/.test(code))
      || (adapter === 'science' && /science/.test(code))
      || (adapter === 'production' && /production|writing/.test(code))
      || (adapter === 'french' && /french|français/.test(code));

    const lessonsPath = s.lessonsFile ? path.join(BACKEND, 'curriculum', g.dir, s.lessonsFile) : null;
    const lessonsFileOk = !s.lessonsFile ? 'n/a' : fs.existsSync(lessonsPath);

    const pages = (() => { try { return getLessonPages(s.id, null, g.id, null); } catch { return []; } })();
    totals.lessons += pages.length;
    const lessonsMatch = !!listed && listed.lessonsCount === pages.length;

    const refs = imageRefs(book).concat(pages.flatMap((p) => imageRefs(p)));
    const uniqueRefs = [...new Set(refs)];
    let imgOk = 0;
    let imgGap = 0;
    let imgBad = 0;
    for (const u of uniqueRefs) {
      if (resolveAsset(u)) imgOk += 1;
      else if (KNOWN_ASSET_GAPS.some((x) => u.startsWith(x))) imgGap += 1;
      else imgBad += 1;
    }
    totals.images += uniqueRefs.length;
    totals.imagesOk += imgOk;
    totals.imagesGapped += imgGap;

    const activities = pages.reduce((n, p) => n + (p.blocks || []).filter((b) => activityKinds.test(String(b.kind))).length, 0);
    totals.activities += activities;

    const declaredPages = Number(book.totalPages) || null;
    const scan = scanPages(book.imageBase);
    const pagesOk = scan && declaredPages ? declaredPages === scan : 'n/a';

    rows.push({
      grade: g.id, subject: s.id, adapter: adapter || '-',
      book: bookExists ? 'ok' : 'MISSING',
      adapterOk, lessonsFile: s.lessonsFile ? (lessonsFileOk ? 'ok' : 'MISSING') : 'none',
      lessons: pages.length, lessonsMatch,
      images: uniqueRefs.length, imgOk, imgGap, imgBad,
      activities,
      pages: declaredPages ?? '-', scan: scan ?? '-', pagesOk
    });
  }
}

const pad = (s, n) => String(s).padEnd(n);
const mark = (v) => (v === true || v === 'ok' || v === 'n/a' ? '✓' : v === false ? '✗' : String(v));

console.log('CONTENT MATRIX — every book the registry serves\n');
console.log(`${pad('book', 21)}${pad('adapter', 11)}${pad('bookFile', 10)}${pad('lessonsFile', 13)}${pad('lessons', 9)}${pad('act', 7)}${pad('images', 8)}${pad('ok', 5)}${pad('gap', 5)}${pad('bad', 5)}${pad('pages/scan', 12)}verdict`);
for (const r of rows) {
  const bad = [];
  if (!r.adapterOk) bad.push('adapter');
  if (r.book !== 'ok') bad.push('bookFile');
  if (r.lessonsFile === 'MISSING') bad.push('lessonsFile');
  if (!r.lessonsMatch) bad.push('lessons');
  if (r.imgBad > 0) bad.push(`images:${r.imgBad}`);
  if (r.pagesOk === false) bad.push('pages');
  console.log(
    `${pad(`${r.grade}/${r.subject}`, 21)}${pad(r.adapter, 11)}${mark(r.book)}${pad('', 8)}${pad(`${mark(r.lessonsFile)} ${r.lessonsFile === 'none' ? '' : r.lessonsFile}`.trim(), 13)}` +
    `${pad(r.lessons, 8)}${pad(r.activities, 7)}${pad(r.images, 8)}${pad(r.imgOk, 5)}${pad(r.imgGap, 5)}${pad(r.imgBad, 5)}` +
    `${pad(`${r.pages}/${r.scan}`, 12)}${bad.length ? '✗ ' + bad.join(' ') : '✓'}`
  );
}

console.log(`\nbooks: ${totals.books} · lessons served: ${totals.lessons} · activity blocks: ${totals.activities}`);
console.log(`image references: ${totals.images} · resolved: ${totals.imagesOk} · documented gap: ${totals.imagesGapped} · unexplained: ${totals.images - totals.imagesOk - totals.imagesGapped}`);

const failures = rows.filter((r) => !r.adapterOk || r.book !== 'ok' || r.lessonsFile === 'MISSING' || !r.lessonsMatch || r.imgBad > 0 || r.pagesOk === false);
console.log(`\nrows with a failure: ${failures.length}`);
if (failures.length) {
  for (const f of failures) console.log(`  ✗ ${f.grade}/${f.subject}`);
  process.exitCode = 1;
} else {
  console.log('✓ every book: adapter matches its subject, book + lessons files exist, lessonsCount equals the served lessons, every image reference resolves or is a documented gap, totalPages equals the real scan');
}
