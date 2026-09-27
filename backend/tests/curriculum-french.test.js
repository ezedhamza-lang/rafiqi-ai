import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { resetDatabase, seedTestData } from './helpers.js';
import request from 'supertest';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CURRICULUM = path.join(__dirname, '../curriculum');
const registry = JSON.parse(fs.readFileSync(path.join(CURRICULUM, 'registry.json'), 'utf8'));

// ISS-017: `year2/french` was declared `adapter: math`. The registry is the mapping
// layer, so the fix belongs there — plus an explicit branch in the service so French
// never falls into the maths reader again.
describe('محوّل الفرنسية (ISS-017)', () => {
  let app;
  let catalogue;

  beforeAll(async () => {
    ({ app } = await import('../src/index.js'));
    await resetDatabase();
    await seedTestData();
    catalogue = (await request(app).get('/api/public/curriculum/books')).body;
  });

  it('لا مادة في السجل تدّعي محوّل مادة أخرى', () => {
    const lying = [];
    for (const g of registry.grades) {
      for (const s of g.subjects) {
        const adapter = s.adapter || '';
        const code = String(s.id).toLowerCase();
        if (adapter === 'math' && !/^math/.test(code)) lying.push(`${g.id}/${s.id} adapter=math`);
        if (adapter === 'anisi' && !/anisi|reading|arabic/.test(code)) lying.push(`${g.id}/${s.id} adapter=anisi`);
        if (adapter === 'science' && !/science/.test(code)) lying.push(`${g.id}/${s.id} adapter=science`);
        if (adapter === 'production' && !/production|writing/.test(code)) lying.push(`${g.id}/${s.id} adapter=production`);
        if (adapter === 'french' && !/french|français/.test(code)) lying.push(`${g.id}/${s.id} adapter=french`);
      }
    }
    expect(lying, lying.join('\n')).toEqual([]);
  });

  it('الفرنسية لم تعد تستعمل محوّل الرياضيات', () => {
    const french = registry.grades.find((g) => g.id === 'year2').subjects.find((s) => s.id === 'french');
    expect(french.adapter).toBe('french');
  });

  it('الكتاب الفرنسي يُفهرس ويُفتح عبر زر PDF', async () => {
    const french = catalogue.find((b) => b.gradeId === 'year2' && b.subjectId === 'french');
    expect(french, 'french must stay in the catalogue').toBeTruthy();
    expect(french.title).toBeTruthy();
    expect(french.hasPDF).toBe(true);
    expect(french.pdfUrl).toBeTruthy();
    // empty units file → honestly zero interactive lessons (CONTENT_GAP, not a bug)
    expect(french.lessonsCount).toBe(0);
  });

  it('نقطة نهاية الدروس للفرنسية ترجع مصفوفة فارغة لا خطأ ولا محتوى رياضيات', async () => {
    const res = await request(app).get('/api/public/curriculum/books/year2/french/lessons');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toEqual([]);
  });

  it('المواد الأخرى لم تتأثر بالفرنسية', async () => {
    const stillThere = catalogue.filter((b) => b.gradeId === 'year2');
    expect(stillThere.length).toBe(7);
    for (const b of stillThere.filter((x) => x.subjectId !== 'french')) {
      const res = await request(app).get(`/api/public/curriculum/books/${b.gradeId}/${b.subjectId}/lessons`);
      expect(res.status).toBe(200);
      const n = Array.isArray(res.body) ? res.body.length : 0;
      expect(n, `${b.gradeId}/${b.subjectId}`).toBe(b.lessonsCount);
    }
  });
});
