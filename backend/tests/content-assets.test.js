import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BACKEND = path.join(__dirname, '..');
const REPO = path.join(BACKEND, '..');
const PUBLIC = path.join(REPO, 'frontend', 'public');

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

const registry = JSON.parse(fs.readFileSync(path.join(BACKEND, 'curriculum/registry.json'), 'utf8'));

function servedFiles() {
  const out = [];
  for (const g of registry.grades) {
    for (const s of g.subjects) {
      if (s.bookFile) out.push(path.join(BACKEND, 'curriculum', g.dir, s.bookFile));
      if (s.lessonsFile) out.push(path.join(BACKEND, 'curriculum', g.dir, s.lessonsFile));
    }
  }
  for (const f of fs.readdirSync(path.join(BACKEND, 'content/stories'))) {
    out.push(path.join(BACKEND, 'content/stories', f));
  }
  return out.filter((f) => fs.existsSync(f));
}

/** every image reference in the served content, as { url, file } */
function imageReferences() {
  const IMG = /"(\/[^"]+\.(?:png|jpe?g|webp|gif|svg|avif))"/gi;
  const refs = [];
  for (const f of servedFiles()) {
    const raw = fs.readFileSync(f, 'utf8');
    IMG.lastIndex = 0;
    let m;
    while ((m = IMG.exec(raw))) refs.push({ url: m[1].split('?')[0], file: path.relative(REPO, f).replace(/\\/g, '/') });
  }
  return refs;
}

function resolveOnDisk(url) {
  const clean = decodeURIComponent(url).replace(/^\/+/, '');
  for (const root of ROOTS) {
    const c = path.join(root, clean);
    try { if (fs.existsSync(c) && fs.statSync(c).isFile()) return c; } catch { /* ignore */ }
  }
  return null;
}

/** The asset families that were never committed — reported, never invented. */
const KNOWN_ASSET_GAPS = ['/assets/books/anisi-lessons/', '/assets/books/anisi-workbook/'];

describe('صور المحتوى (ISS-022)', () => {
  it('كل مرجع صورة موجود على القرص، أو ينتمي لفجوة محتوى معروفة', () => {
    const unresolved = imageReferences().filter((r) => !resolveOnDisk(r.url));
    const undocumented = unresolved.filter(
      (r) => !KNOWN_ASSET_GAPS.some((g) => r.url.startsWith(g))
    );
    expect(
      undocumented.map((r) => `${r.url}  (in ${r.file})`),
      `a referenced image is neither on disk nor a documented gap:\n${undocumented.slice(0, 10).map((r) => r.url).join('\n')}`
    ).toEqual([]);
  });

  it('لا مرجع صورة يشير إلى امتداد بينما الملف موجود بامتداد آخر (خطأ ‎.png‎ مقابل ‎.jpg‎)', () => {
    // The exact defect that was fixed: the y5 reading stories pointed at `.png`
    // covers while the files on disk are `.jpg`. Any reference whose basename exists
    // only under a different extension is a broken reference and must fail.
    const wrongExtension = [];
    for (const r of imageReferences()) {
      if (resolveOnDisk(r.url)) continue;
      if (KNOWN_ASSET_GAPS.some((g) => r.url.startsWith(g))) continue;
      const clean = decodeURIComponent(r.url).replace(/^\/+/, '');
      const base = path.basename(clean);
      const stem = base.replace(EXT, '');
      const other = [];
      for (const root of ROOTS) {
        if (!fs.existsSync(root)) continue;
        const stack = [root];
        while (stack.length) {
          const dir = stack.pop();
          let entries = [];
          try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { continue; }
          for (const e of entries) {
            const p = path.join(dir, e.name);
            if (e.isDirectory()) { stack.push(p); continue; }
            if (e.name.replace(EXT, '').toLowerCase() === stem.toLowerCase()) other.push(p);
          }
        }
      }
      if (other.length) wrongExtension.push(`${r.url}  → exists as ${path.relative(REPO, other[0])}`);
    }
    expect(wrongExtension, wrongExtension.slice(0, 10).join('\n')).toEqual([]);
  });

  it('أغلفة قصص السنة الخامسة تشير إلى ملفات موجودة فعلًا (32 غلافًا)', () => {
    const file = path.join(BACKEND, 'content/stories/y5-reading-stories-data.json');
    const stories = JSON.parse(fs.readFileSync(file, 'utf8'));
    expect(stories.length).toBeGreaterThan(0);

    const urls = [];
    const walk = (node) => {
      if (!node || typeof node !== 'object') return;
      if (Array.isArray(node)) return node.forEach(walk);
      for (const v of Object.values(node)) {
        if (typeof v === 'string' && /\/story-covers\//.test(v)) urls.push(v);
        else walk(v);
      }
    };
    walk(stories);
    expect(urls.length).toBeGreaterThanOrEqual(32);

    const missing = urls.filter((u) => !resolveOnDisk(u));
    expect(missing, `covers that do not exist:\n${[...new Set(missing)].slice(0, 8).join('\n')}`).toEqual([]);
    // each cover is a real image, not a placeholder
    const sizes = [...new Set(urls)].map((u) => fs.statSync(resolveOnDisk(u)).size);
    expect(Math.min(...sizes)).toBeGreaterThan(1000);
  });
});
