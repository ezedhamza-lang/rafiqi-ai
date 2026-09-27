// READ-ONLY content-asset guard.
//
// Every image reference in a served file is resolved against the real static roots.
// A missing reference is classified — it is never silently tolerated and no asset is
// ever invented:
//
//   RECOVERABLE  the file exists under a different extension (`.jpg` vs `.png`) or
//                in another root ⇒ the REFERENCE is wrong and must be corrected.
//                Any RECOVERABLE reference fails this check.
//   FOLDER_GAP   the parent folder exists nowhere in any root ⇒ an asset family that
//                was never committed. Only these may appear in KNOWN_GAPS.
//   REAL_MISSING no candidate file anywhere ⇒ a genuine content gap. Only these may
//                appear in KNOWN_GAPS.
//
// Exit code 1 = a NEW or FIXABLE asset problem exists. Exit 0 = the tree is clean or
// every remaining gap is a documented, counted, still-open content gap.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const HERE = path.dirname(fileURLToPath(import.meta.url));        // backend/scripts
const BACKEND = path.resolve(HERE, '..');                        // backend
const REPO = path.resolve(BACKEND, '..');                        // repo root
const PUBLIC = path.join(REPO, 'frontend', 'public');

const IMG = /"(\/[^"]+\.(?:png|jpe?g|webp|gif|svg|avif))"/gi;
const EXT = /\.(png|jpe?g|webp|gif|svg|avif)$/i;

// Static roots exactly as index.js mounts them, plus the SPA public dir and src assets.
const ROOTS = [
  path.join(BACKEND, 'curriculum/assets-books'),   // /assets/books
  path.join(BACKEND, 'uploads/assets'),             // /assets
  path.join(BACKEND, 'uploads/images'),             // /images
  path.join(BACKEND, 'uploads/media'),
  path.join(BACKEND, 'uploads/svg'),
  path.join(BACKEND, 'uploads/intaj'),
  path.join(BACKEND, 'uploads/science'),
  path.join(BACKEND, 'uploads'),
  path.join(BACKEND, 'curriculum'),
  PUBLIC,
  path.join(REPO, 'frontend', 'src')
];

// ── open content gaps, with the measured reference count ────────────────────────
// Recorded in docs/MASTER-ISSUES.md as ISS-022b (CONTENT_ASSET_GAP): these two asset
// folders were never committed to the repository. The counts are measured, and the
// check FAILS if one of them changes — that is the point: the number can only go down
// by producing the asset, never up by adding another reference. Do not delete an entry
// to silence this check.
const KNOWN_GAPS = [
  { prefix: '/assets/books/anisi-lessons/',   refs: 28,  issue: 'ISS-022b' },
  { prefix: '/assets/books/anisi-workbook/', refs: 139, issue: 'ISS-022b' }
];

const reg = JSON.parse(fs.readFileSync(path.join(BACKEND, 'curriculum/registry.json'), 'utf8'));
const served = [];
for (const g of reg.grades) {
  for (const s of g.subjects) {
    if (s.bookFile) served.push(path.join(BACKEND, 'curriculum', g.dir, s.bookFile));
    if (s.lessonsFile) served.push(path.join(BACKEND, 'curriculum', g.dir, s.lessonsFile));
  }
}
const storiesDir = path.join(BACKEND, 'content/stories');
for (const f of fs.readdirSync(storiesDir)) served.push(path.join(storiesDir, f));

// index every image file that exists, by lowercase basename
const byName = new Map();
function index(dir) {
  if (!fs.existsSync(dir)) return;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { index(p); continue; }
    if (!EXT.test(e.name)) continue;
    const k = e.name.toLowerCase();
    if (!byName.has(k)) byName.set(k, []);
    byName.get(k).push(p);
  }
}
for (const root of ROOTS) index(root);

function resolve(url) {
  const clean = decodeURIComponent(url.split('?')[0]).replace(/^\/+/, '');
  for (const root of ROOTS) {
    const c = path.join(root, clean);
    try { if (fs.existsSync(c) && fs.statSync(c).isFile()) return c; } catch { /* ignore */ }
  }
  return null;
}

const refs = new Map();   // url → Set(served file, repo-relative)
let total = 0;
for (const f of served) {
  if (!fs.existsSync(f)) { console.error(`!! served file missing on disk: ${f}`); continue; }
  const raw = fs.readFileSync(f, 'utf8');
  IMG.lastIndex = 0;
  let m;
  while ((m = IMG.exec(raw))) {
    total += 1;
    const url = m[1].split('?')[0];
    if (!refs.has(url)) refs.set(url, new Set());
    refs.get(url).add(path.relative(REPO, f).replace(/\\/g, '/'));
  }
}

const recoverable = [];
const folderGap = [];
const realMissing = [];
let resolved = 0;

for (const [url, files] of refs) {
  if (resolve(url)) { resolved += 1; continue; }
  const clean = decodeURIComponent(url).replace(/^\/+/, '');
  const base = path.basename(clean);
  const stem = base.replace(EXT, '');
  const folder = path.dirname(clean);

  // a file with the same name but another extension, or the same stem elsewhere
  const sameStem = [];
  for (const [k, v] of byName) if (k.replace(EXT, '') === stem.toLowerCase()) sameStem.push(...v);
  if (sameStem.length) {
    recoverable.push({ url, files: [...files], candidates: sameStem.slice(0, 3) });
    continue;
  }
  const folderExists = ROOTS.some((r) => fs.existsSync(path.join(r, folder)));
  const entry = { url, files: [...files], folder };
  if (!folderExists) folderGap.push(entry); else realMissing.push(entry);
}

const gapFor = (url) => KNOWN_GAPS.find((g) => url.startsWith(g.prefix)) || null;

console.log(`served files          : ${served.length}`);
console.log(`image references      : ${total}`);
console.log(`  unique urls         : ${refs.size}`);
console.log(`  resolved as written : ${resolved}`);
console.log(`  RECOVERABLE         : ${recoverable.length}   ← reference wrong, asset exists`);
console.log(`  FOLDER_GAP          : ${folderGap.length}    ← asset family never committed`);
console.log(`  REAL_MISSING        : ${realMissing.length}    ← no candidate anywhere`);
console.log(`  total references still unresolved: ${recoverable.length + folderGap.length + realMissing.length}`);

const undocumentedGaps = [];
for (const e of [...folderGap, ...realMissing]) {
  const g = gapFor(e.url);
  if (!g) { undocumentedGaps.push(e); continue; }
  g.seen = (g.seen || new Set());
  g.seen.add(e.url);
}

if (recoverable.length) {
  console.log('\n✗ RECOVERABLE references — fix the reference, do not create assets:');
  for (const e of recoverable.slice(0, 20)) {
    console.log(`  ${e.url}`);
    console.log(`      in: ${e.files.slice(0, 2).join(', ')}`);
    console.log(`      asset exists: ${e.candidates.map((c) => path.relative(REPO, c)).join(', ')}`);
  }
}

console.log('\nDocumented open gaps:');
for (const g of KNOWN_GAPS) {
  const seen = g.seen ? g.seen.size : 0;
  const ok = seen === g.refs;
  console.log(`  ${ok ? '✓' : '✗'} ${g.prefix}  expected ${g.refs}, found ${seen}  (${g.issue})`);
  if (!ok) process.exitCode = 1;
}

if (undocumentedGaps.length) {
  console.log('\n✗ UNDOCUMENTED gaps — add them to KNOWN_GAPS in this file AND to MASTER-ISSUES.md:');
  for (const e of undocumentedGaps.slice(0, 20)) console.log(`  ${e.url}  (in: ${e.files.slice(0, 1).join(', ')})`);
  process.exitCode = 1;
}

if (recoverable.length) process.exitCode = 1;
if (!process.exitCode) console.log('\n✓ no fixable reference errors; every remaining gap is a documented content gap');
console.log('\nreport: run `npm run check:content-images`');
