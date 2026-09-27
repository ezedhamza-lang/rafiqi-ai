import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BACKEND = path.join(__dirname, '..');
const ASSETS = path.join(BACKEND, 'curriculum/assets-books');
const registry = JSON.parse(fs.readFileSync(path.join(BACKEND, 'curriculum/registry.json'), 'utf8'));

function books() {
  const out = [];
  for (const g of registry.grades) {
    for (const s of g.subjects) {
      if (!s.bookFile) continue;
      const f = path.join(BACKEND, 'curriculum', g.dir, s.bookFile);
      if (!fs.existsSync(f)) continue;
      out.push({ key: `${g.id}/${s.id}`, book: JSON.parse(fs.readFileSync(f, 'utf8')), file: s.bookFile });
    }
  }
  return out;
}

function scanPages(imageBase) {
  if (!imageBase) return null;
  const dir = path.join(ASSETS, imageBase.replace('/assets/books/', '').replace(/^\/+|\/+$/g, ''));
  if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) return null;
  const n = fs.readdirSync(dir).filter((f) => /^page-\d+\./i.test(f));
  if (!n.length) return null;
  const nums = n.map((f) => Number(f.match(/page-(\d+)/i)[1]));
  return { count: nums.length, max: Math.max(...nums) };
}

const all = books();

// ISS-018 / ISS-019. The root cause turned out to be stored metadata, not the
// calculation, the unit order, totalPages, the rendering or the pagination:
//   • the frontend never reads unit.startPage / unit.endPage;
//   • the viewer is bounded by book.totalPages.
// So the enforceable rule is: totalPages must equal the real scan, and a unit range
// may never point past the last existing page. The two books with nominally shared
// ranges are `paperOnly` and carry no scan at all.
describe('ترقيم صفحات الكتب (ISS-018 / ISS-019)', () => {
  it('عدد الصفحات المعلن = عدد ملفات المسح الموجودة (لا صفحة يمكن طلبها وهي مفقودة)', () => {
    const wrong = [];
    for (const { key, book } of all) {
      const scan = scanPages(book.imageBase);
      if (!scan) continue;
      if (Number(book.totalPages) !== scan.count) {
        wrong.push(`${key}: totalPages=${book.totalPages} but ${scan.count} page files exist (max page ${scan.max})`);
      }
    }
    expect(wrong, wrong.join('\n')).toEqual([]);
  });

  it('لا ملفات مسح فارغة أو مفقودة داخل المدى المعلن', () => {
    const bad = [];
    for (const { key, book } of all) {
      const scan = scanPages(book.imageBase);
      if (!scan) continue;
      const dir = path.join(ASSETS, book.imageBase.replace('/assets/books/', '').replace(/^\/+|\/+$/g, ''));
      const files = fs.readdirSync(dir).filter((f) => /^page-\d+\./i.test(f));
      const zero = files.filter((f) => fs.statSync(path.join(dir, f)).size === 0);
      if (zero.length) bad.push(`${key}: ${zero.length} zero-byte page file(s)`);
      const missing = [];
      for (let n = 1; n <= scan.max; n += 1) {
        if (!files.some((f) => Number(f.match(/page-(\d+)/i)[1]) === n)) missing.push(n);
      }
      if (missing.length) bad.push(`${key}: gaps at pages ${missing.slice(0, 8).join(', ')}`);
    }
    expect(bad, bad.join('\n')).toEqual([]);
  });

  it('لا وحدة تشير إلى صفحة أحدث من آخر صفحة في المسح', () => {
    // Known and documented: year6/math's unit ranges were copied from a 174-page
    // edition while its scan has 101 pages. Repairing it needs the real printed
    // pagination, so the exact count is pinned here instead of being "fixed".
    const known = { 'year6/math': 3 };
    const offenders = {};
    for (const { key, book } of all) {
      const scan = scanPages(book.imageBase);
      if (!scan) continue;
      const over = (book.units || []).filter((u) => Number(u.endPage) > scan.max);
      if (over.length) offenders[key] = over.length;
    }
    expect(offenders).toEqual(known);
  });

  it('الوحدات التي تتشارك المدى كاملًا هي كتب ورقية بلا مسح (ISS-018)', () => {
    const shared = [];
    for (const { key, book } of all) {
      const units = book.units || [];
      if (units.length < 2) continue;
      const ranges = units.map((u) => `${u.startPage}-${u.endPage}`);
      const allSame = ranges.every((r) => r === ranges[0]);
      if (!allSame) continue;
      shared.push(key);
      // a shared whole-book range is only acceptable when there is no scan to
      // mis-navigate: the field is never read by the UI
      expect(scanPages(book.imageBase), `${key} shares one range and has a scan`).toBeNull();
      expect(!!book.paperOnly, `${key} shares one range and is not marked paperOnly`).toBe(true);
    }
    expect(shared.sort()).toEqual(['year4/math', 'year5/math']);
  });

  it('كل كتاب له مسح يعلن عدد صفحات (المشاهد لا يمكن أن يتجاوز реаль الملفات)', () => {
    const missing = all
      .filter(({ book }) => scanPages(book.imageBase))
      .filter(({ book }) => !Number.isFinite(Number(book.totalPages)) || Number(book.totalPages) < 1)
      .map(({ key }) => key);
    expect(missing).toEqual([]);
  });
});
