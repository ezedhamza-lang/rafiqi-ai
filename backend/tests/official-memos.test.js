import { describe, it, expect, beforeAll } from 'vitest';
import { resetDatabase, seedTestData, login } from './helpers.js';
import request from 'supertest';
import { loadOfficialMemos, loadOfficialLinks, matchOfficialMemo, getOfficialMemoById, listOfficialMemos, normalizeMemoText } from '../src/services/officialMemos.js';

let app;
let token;

beforeAll(async () => {
  ({ app } = await import('../src/index.js'));
  await resetDatabase();
  await seedTestData();
  const res = await login('teacher@test.tn', 'teacher123');
  token = res.body.token;
  expect(token).toBeTruthy();
});

describe('بنك المذكرات الرسمية (س2 رياضيات + إيقاظ)', () => {
  it('البنك سليم: 149 مذكرة بحقول كاملة و5 مراحل لكل واحدة', () => {
    const bank = loadOfficialMemos();
    expect(bank.length).toBe(149);
    for (const m of bank) {
      expect(m.topic, m.id).toBeTruthy();
      expect(m.competency, m.id).toBeTruthy();
      expect(m.stages.length, m.id).toBe(5);
      for (const s of m.stages) {
        expect(s.name, m.id).toBeTruthy();
        expect(s.teacher, m.id).toBeTruthy();
        expect(Array.isArray(s.tools), m.id).toBe(true);
      }
    }
    expect(bank.some((m) => m.subject === 'math')).toBe(true);
    expect(bank.some((m) => m.subject === 'science')).toBe(true);
  });

  it('الربط صريح ومدقق (بلا تخمين وقت التشغيل)', () => {
    const links = loadOfficialLinks();
    expect(Object.keys(links).length).toBeGreaterThanOrEqual(15);
    for (const [title, id] of Object.entries(links)) {
      expect(typeof title).toBe('string');
      expect(getOfficialMemoById(id), title).toBeTruthy();
    }
  });

  it('التطبيع يوحّد التشكيل والألف', () => {
    expect(normalizeMemoText('مذكّرة')).toBe(normalizeMemoText('مذكرة'));
    expect(normalizeMemoText('الإيقاظ')).toBe(normalizeMemoText('الايقاظ'));
    expect(normalizeMemoText('مكوّناتها')).toBe('مكوناتها');
  });

  it('المطابقة الصريحة: درس مربوط يجد مذكرته، وغير المربوط يرجع null', () => {
    const hit = matchOfficialMemo({
      subject: 'رياضيات',
      level: 'السنة الثانية أساسي',
      lessonTitle: 'الأعداد من 0 إلى 499: الطرح دون زيادة ولا تفكيك'
    });
    expect(hit).toBeTruthy();
    expect(hit.subject).toBe('math');
    const miss = matchOfficialMemo({
      subject: 'رياضيات',
      level: 'السنة الثانية أساسي',
      lessonTitle: 'درس غير موجود تماما عن الفضاء والكواكب'
    });
    expect(miss).toBeNull();
    const wrongLevel = matchOfficialMemo({
      subject: 'رياضيات',
      level: 'السنة الأولى أساسي',
      lessonTitle: 'الأعداد من 0 إلى 499: الطرح دون زيادة ولا تفكيك'
    });
    expect(wrongLevel).toBeNull();
  });

  it('طلب درس مربوط يعيد المذكرة الرسمية حرفياً (موسومة official)', async () => {
    const res = await request(app)
      .post('/api/memos/generate')
      .set('Authorization', `Bearer ${token}`)
      .send({ subject: 'رياضياتي 2', level: 'السنة الثانية أساسي', lessonTitle: 'الأعداد من 0 إلى 499: الطرح دون زيادة ولا تفكيك' });
    expect(res.status).toBe(200);
    const memo = res.body.memo;
    expect(memo.methodologyId).toBe('official-y2-math');
    expect(memo.content.source).toBe('official');
    expect(memo.content.officialRef).toBeTruthy();
    expect(memo.content.spec.specVersion).toBe(2);
    expect(memo.content.table.columns).toEqual(['المراحل', 'نشاط المعلّم', 'نشاط المتعلّم', 'الوسائل']);
    expect(memo.content.header.values['التوقيت']).toContain('60');
  });

  it('الجلب المباشر بالمعرف يعيد المذكرة نفسها بلا مطابقة', async () => {
    const res = await request(app)
      .post('/api/memos/generate')
      .set('Authorization', `Bearer ${token}`)
      .send({ subject: 'رياضيات', level: 'السنة الثانية أساسي', lessonTitle: 'الأعداد من 0 إلى 499: الطرح دون زيادة ولا تفكيك', officialRef: 'y2-math-01' });
    expect(res.status).toBe(200);
    expect(res.body.memo.content.officialRef).toBe('y2-math-01');
    expect(res.body.memo.content.officialTopic).toContain('المجموعات');
  });

  it('اختيار مباشر بلا عنوان درس يعيد الرسمية (يتجاوز حل الدرس)', async () => {
    const res = await request(app)
      .post('/api/memos/generate')
      .set('Authorization', `Bearer ${token}`)
      .send({ subject: 'رياضيات', level: 'السنة الثانية أساسي', lessonTitle: '', officialRef: 'y2-math-04' });
    expect(res.status).toBe(200);
    expect(res.body.memo.content.officialRef).toBe('y2-math-04');
    expect(res.body.memo.content.source).toBe('official');
  });

  it('معرف رسمي خاطئ يعيد 404', async () => {
    const res = await request(app)
      .post('/api/memos/generate')
      .set('Authorization', `Bearer ${token}`)
      .send({ subject: 'رياضيات', level: 'السنة الثانية أساسي', lessonTitle: 'الأعداد من 0 إلى 499: الطرح دون زيادة ولا تفكيك', officialRef: 'y9-fake-99' });
    expect(res.status).toBe(404);
  });

  it('قائمة الرسميات تعرض 74 موضوعاً (149 متغيراً) بلا مصادقة إضافية', async () => {
    const res = await request(app)
      .get('/api/memos/official?subject=رياضيات')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(108);
    expect(res.body[0]).toHaveProperty('id');
    expect(res.body[0]).toHaveProperty('topic');
    const all = await request(app)
      .get('/api/memos/official')
      .set('Authorization', `Bearer ${token}`);
    expect(all.body.length).toBe(149);
  });

  it('المعلّم يستطيع طلب توليد بديل بتجاوز البنك (useOfficial: false)', async () => {
    const res = await request(app)
      .post('/api/memos/generate')
      .set('Authorization', `Bearer ${token}`)
      .send({ subject: 'رياضياتي 2', level: 'السنة الثانية أساسي', lessonTitle: 'الأعداد من 0 إلى 499: الطرح دون زيادة ولا تفكيك', useOfficial: false });
    expect(res.status).toBe(200);
    expect(res.body.memo.methodologyId).toBe('year2-math-standard');
    expect(res.body.memo.content.source).not.toBe('official');
  });

  it('درس خارج البنك يسقط على المولّد المصحّح (لا اختلاق رسمية)', async () => {
    const res = await request(app)
      .post('/api/memos/generate')
      .set('Authorization', `Bearer ${token}`)
      .send({ subject: 'رياضيات', level: 'السنة الخامسة أساسي', lessonTitle: 'الأعداد الطبيعية (حتى المليارات)' });
    expect(res.status).toBe(200);
    expect(res.body.memo.methodologyId).not.toMatch(/^official-/);
    expect(res.body.memo.content.source).not.toBe('official');
  });
});
