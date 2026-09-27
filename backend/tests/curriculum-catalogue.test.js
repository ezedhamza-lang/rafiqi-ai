import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { resetDatabase, seedTestData, login } from './helpers.js';
import request from 'supertest';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CURRICULUM = path.join(__dirname, '../curriculum');

let app;
const registry = JSON.parse(fs.readFileSync(path.join(CURRICULUM, 'registry.json'), 'utf8'));

/** Every (gradeId, subjectId) the registry declares, with its lessonsFile (or null). */
function registryEntries() {
  const out = [];
  for (const g of registry.grades) {
    for (const s of g.subjects) {
      if (!s.bookFile) continue;
      out.push({ gradeId: g.id, subjectId: s.id, bookFile: s.bookFile, lessonsFile: s.lessonsFile || null });
    }
  }
  return out;
}

const entries = registryEntries();

describe('فهرس الكتب — تطابق «عدد الدروس» مع الواقع (ISS-015)', () => {
  beforeAll(async () => {
    ({ app } = await import('../src/index.js'));
    await resetDatabase();
    await seedTestData();
  });

  it('السجل يغطي 6 سنوات وكل كتبها (حارس ضد تغيير صامت)', () => {
    expect(entries.length).toBeGreaterThanOrEqual(30);
    expect(new Set(entries.map((e) => e.gradeId)).size).toBe(6);
  });

  it('عدد الدروس المعلَن = عدد الدروس الفعلي لكل كتاب من السجل', async () => {
    const catalogue = (await request(app).get('/api/public/curriculum/books')).body;
    expect(Array.isArray(catalogue)).toBe(true);
    expect(catalogue).toHaveLength(entries.length);

    const mismatches = [];
    for (const book of catalogue) {
      const res = await request(app).get(`/api/public/curriculum/books/${book.gradeId}/${book.subjectId}/lessons`);
      expect(res.status, `${book.gradeId}/${book.subjectId} lessons`).toBe(200);
      const real = Array.isArray(res.body) ? res.body.length : 0;
      if (real !== book.lessonsCount) {
        mismatches.push(`${book.gradeId}/${book.subjectId}: advertised=${book.lessonsCount} real=${real}`);
      }
    }
    expect(mismatches, `lessonsCount must equal the real page count:\n${mismatches.join('\n')}`).toEqual([]);
  });

  it('لا كتاب فيه دروس يُعلن صفرًا (الصفر يعني فعلًا "لا دروس")', async () => {
    const catalogue = (await request(app).get('/api/public/curriculum/books')).body;
    const lying = [];
    for (const book of catalogue) {
      if (book.lessonsCount !== 0) continue;
      const res = await request(app).get(`/api/public/curriculum/books/${book.gradeId}/${book.subjectId}/lessons`);
      const real = Array.isArray(res.body) ? res.body.length : 0;
      if (real > 0) lying.push(`${book.gradeId}/${book.subjectId} says 0 but serves ${real}`);
    }
    expect(lying, lying.join('\n')).toEqual([]);
  });

  // The bug was shape-specific: a counter that only reads top-level `title` keys
  // reports 0 for every nested shape. Pin the shapes that used to break.
  it('الصيغ المتداخلة تُحسب صحيحًا (السبب الجذري لا الاستثناء)', async () => {
    const catalogue = (await request(app).get('/api/public/curriculum/books')).body;
    const by = (g, s) => catalogue.find((b) => b.gradeId === g && b.subjectId === s);

    // { _meta, title, units:[…] } — reading-units.json
    expect(by('year2', 'anisi').lessonsCount).toBeGreaterThan(0);
    expect(by('year5', 'anisi').lessonsCount).toBeGreaterThan(0);
    // { _meta, title, units:[…] } — production-units.json
    expect(by('year3', 'production').lessonsCount).toBeGreaterThan(0);
    expect(by('year6', 'production').lessonsCount).toBeGreaterThan(0);
    // { book_title, workbook_title, source_note, units:[…] } — anisi-lessons-full.json
    expect(by('year1', 'anisi').lessonsCount).toBeGreaterThan(0);
    // no lessonsFile at all in the registry (science s2/s3) — the adapter falls back
    // to the book chapters, and the count must follow
    expect(by('year2', 'science').lessonsCount).toBeGreaterThan(0);
    expect(by('year3', 'science').lessonsCount).toBeGreaterThan(0);
  });

  it('لا يبقى أي كتاب بلا وسيلة فتح، عدا فجوة محتوى واحدة معروفة', async () => {
    const catalogue = (await request(app).get('/api/public/curriculum/books')).body;
    const stuck = catalogue
      .filter((b) => b.lessonsCount === 0 && !b.hasImages && !b.hasPDF && !b.pdfUrl)
      .map((b) => `${b.gradeId}/${b.subjectId}`);

    // The UI renders exactly these three affordances (StudentBooks.jsx:150/156/165):
    //   lessons button  ⇐ lessonsCount > 0
    //   browse button   ⇐ hasImages
    //   PDF button      ⇐ hasPDF
    // So "stuck" means no way in at all. Before ISS-015 that was 14 books; after the
    // fix only the genuine content gap remains: year4 reading has a book file with
    // 8 units and 160 pages but no lessons file, no scan and no PDF (CONTENT_GAP).
    expect(stuck).toEqual(['year4/anisi']);
  });

  it('الكتاب الفرنسي يفتح عبر زر PDF (لا يحتاج دروسًا)', async () => {
    const catalogue = (await request(app).get('/api/public/curriculum/books')).body;
    const french = catalogue.find((b) => b.gradeId === 'year2' && b.subjectId === 'french');
    expect(french.hasPDF).toBe(true);
    expect(french.pdfUrl).toBeTruthy();
  });

  it('الفهرس لا يتجاوز ميزانية زمنية (لا تكرار في القراءة)', async () => {
    const started = Date.now();
    await request(app).get('/api/public/curriculum/books');
    const first = Date.now() - started;
    const warmStart = Date.now();
    await request(app).get('/api/public/curriculum/books');
    const warm = Date.now() - warmStart;
    expect(warm, `warm catalogue took ${warm}ms`).toBeLessThan(400);
    expect(first).toBeLessThan(4000);
  });
});
