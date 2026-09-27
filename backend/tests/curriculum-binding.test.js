import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { resetDatabase, seedTestData } from './helpers.js';
import request from 'supertest';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CURRICULUM = path.join(__dirname, '../curriculum');
const registry = JSON.parse(fs.readFileSync(path.join(CURRICULUM, 'registry.json'), 'utf8'));

/** The bug: `subject.lessonsFile || '<default>'` made a book with no lessons file
 *  read ANOTHER book's file. year2/math-rasmi served math2's 63 lessons. */
describe('ربط الدروس بالكتاب الصحيح (ISS-016)', () => {
  let app;
  let catalogue;

  beforeAll(async () => {
    ({ app } = await import('../src/index.js'));
    await resetDatabase();
    await seedTestData();
    catalogue = (await request(app).get('/api/public/curriculum/books')).body;
  });

  it('لا كتابان يقدّمان نفس مجموعة الدروس (خلط محتوى)', async () => {
    const sets = new Map();
    for (const b of catalogue) {
      if (b.lessonsCount === 0) continue;
      const res = await request(app).get(`/api/public/curriculum/books/${b.gradeId}/${b.subjectId}/lessons`);
      const ids = (Array.isArray(res.body) ? res.body : []).map((p) => p.id).join(',');
      if (!ids) continue;
      const key = `${b.gradeId}|${ids}`;
      if (sets.has(key)) {
        throw new Error(
          `content mixing: ${b.gradeId}/${b.subjectId} serves the same lesson ids as ${sets.get(key)}`
        );
      }
      sets.set(key, `${b.gradeId}/${b.subjectId}`);
    }
    expect(sets.size).toBeGreaterThan(0);
  });

  it('كتاب بلا lessonsFile في السجل = صفر دروس (لا اسم ملف مُخمَّن)', async () => {
    const offenders = [];
    for (const g of registry.grades) {
      for (const s of g.subjects) {
        if (s.lessonsFile) continue;
        if (!/math|anisi|reading|production|writing/.test(`${s.id} ${s.adapter || ''}`)) continue;
        const b = catalogue.find((x) => x.gradeId === g.id && x.subjectId === s.id);
        if (!b) continue;
        if (b.lessonsCount !== 0) offenders.push(`${g.id}/${s.id} has no lessonsFile but serves ${b.lessonsCount}`);
      }
    }
    expect(offenders, offenders.join('\n')).toEqual([]);
  });

  it('mat-rasmi لم يعد يعرض دروس math2، ويبقى قابلًا للفتح (صور)', async () => {
    const rasmi = catalogue.find((b) => b.gradeId === 'year2' && b.subjectId === 'math-rasmi');
    const math2 = catalogue.find((b) => b.gradeId === 'year2' && b.subjectId === 'math2');
    expect(rasmi).toBeTruthy();
    expect(math2.lessonsCount).toBeGreaterThan(0);
    expect(rasmi.lessonsCount).toBe(0);
    // a scan book must still be openable in the UI
    expect(rasmi.hasImages || rasmi.hasPDF || !!rasmi.pdfUrl).toBe(true);
  });

  it('كل كتاب رياضيات آخر لم يتأثر', async () => {
    for (const b of catalogue.filter((x) => x.gradeId === 'year2' && /math/.test(x.subjectId))) {
      const res = await request(app).get(`/api/public/curriculum/books/${b.gradeId}/${b.subjectId}/lessons`);
      expect(res.status).toBe(200);
      const n = Array.isArray(res.body) ? res.body.length : 0;
      expect(n, `${b.gradeId}/${b.subjectId}`).toBe(b.lessonsCount);
    }
    // the two real math lesson sets stay distinct
    const situ = catalogue.find((b) => b.gradeId === 'year2' && b.subjectId === 'math');
    expect(situ.lessonsCount).toBe(40);
    const m2 = catalogue.find((b) => b.gradeId === 'year2' && b.subjectId === 'math2');
    expect(m2.lessonsCount).toBe(63);
  });

  it('الإيقاظ العلمي يبقي استخدم فصول كتابه (fallback مقصود وآمن)', async () => {
    for (const g of ['year2', 'year3']) {
      const b = catalogue.find((x) => x.gradeId === g && x.subjectId === 'science');
      expect(b, g).toBeTruthy();
      expect(b.lessonsCount, `${g}/science keeps its chapter-derived lessons`).toBeGreaterThan(0);
    }
  });
});
