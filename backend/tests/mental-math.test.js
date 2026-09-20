import { describe, it, expect, beforeAll } from 'vitest';
import { resetDatabase, seedTestData, login } from './helpers.js';
import request from 'supertest';

let app;
let token;

beforeAll(async () => {
  ({ app } = await import('../src/index.js'));
  await resetDatabase();
  await seedTestData();
  token = (await login('student@test.tn', 'student123')).body.token;
});

describe('وحدة الحساب الذهني — أنشطة واستراتيجيات وتحليل أداء', () => {
  it('جلسة mental: أنشطة متنوعة بلا إجابات مكشوفة في الحمولة', async () => {
    const res = await request(app)
      .post('/api/student/mental-math/session')
      .set('Authorization', `Bearer ${token}`)
      .send({ gradeId: 'year3', seed: 123456, count: 6 });
    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(6);
    const blob = JSON.stringify(res.body.items);
    expect(blob).not.toContain('"answer"');
    expect(blob).not.toContain('"explain"');
    expect(res.body.items.every((x) => x.skill && x.prompt)).toBe(true);
    expect(new Set(res.body.items.map((x) => x.kind)).size).toBeGreaterThanOrEqual(1);
  });

  it('جلسة prereq (تعهّد المكتسبات): روابط وتفهك ومقارنة — جاهزية للدرس الحالي', async () => {
    const res = await request(app)
      .post('/api/student/mental-math/session')
      .set('Authorization', `Bearer ${token}`)
      .send({ gradeId: 'year2', seed: 777, count: 6, mode: 'prereq' });
    expect(res.status).toBe(200);
    const prompts = res.body.items.map((x) => x.prompt).join(' ');
    expect(prompts).toMatch(/أكمل لتصل|فكّك|الفارق|العشرات|اكتب بالأرقام|ضعف/);
    expect(JSON.stringify(res.body.items)).not.toContain('"answer"');
  });

  it('حتمية البذرة: نفس الجلسة تعطي نفس الأنشطة (فحص server-side بلا تخزين للحل)', async () => {
    const a = await request(app).post('/api/student/mental-math/session').set('Authorization', `Bearer ${token}`).send({ gradeId: 'year3', seed: 4242, count: 5 });
    const b = await request(app).post('/api/student/mental-math/session').set('Authorization', `Bearer ${token}`).send({ gradeId: 'year3', seed: 4242, count: 5 });
    expect(a.body.items.map((x) => x.prompt)).toEqual(b.body.items.map((x) => x.prompt));
  });

  it('محاولة خاطئة ⇒ لا «خطأ» جاف: تلميح استراتيجي + تمرين مشابه + كشف الحل لاحقًا فقط', async () => {
    const sess = await request(app).post('/api/student/mental-math/session').set('Authorization', `Bearer ${token}`).send({ gradeId: 'year3', seed: 999, count: 4 });
    const item = sess.body.items[0];
    const wrong = await request(app)
      .post('/api/student/mental-math/answer')
      .set('Authorization', `Bearer ${token}`)
      .send({ gradeId: 'year3', seed: 999, idx: 0, answer: 999999, ms: 4000 });
    expect(wrong.status).toBe(200);
    expect(wrong.body.correct).toBe(false);
    expect(wrong.body.hint || wrong.body.explainOnAsk).toBeTruthy();
    expect(JSON.stringify(wrong.body)).not.toContain('"answer"');
    const rev = await request(app)
      .post('/api/student/mental-math/reveal')
      .set('Authorization', `Bearer ${token}`)
      .send({ gradeId: 'year3', seed: 999, idx: 0, answer: 0 });
    expect(rev.body.answer).toBeDefined();
    expect(typeof rev.body.explain).toBe('string');
    const right = await request(app)
      .post('/api/student/mental-math/answer')
      .set('Authorization', `Bearer ${token}`)
      .send({ gradeId: 'year3', seed: 999, idx: 0, answer: rev.body.answer, ms: 3000 });
    expect(right.body.correct).toBe(true);
    expect(right.body.explain).toContain('الاستراتيجية') || expect(right.body.explain.length).toBeGreaterThan(4);
    void item;
  });

  it('التقرير يبني حالة المهارات: دقة وأخطاء وأنماط (يكِلّ العدّ / خلل منزلي) وليس سرعة فقط', async () => {
    for (let i = 0; i < 8; i++) {
      const sess = await request(app).post('/api/student/mental-math/session').set('Authorization', `Bearer ${token}`).send({ gradeId: 'year4', seed: 2000 + i, count: 3 });
      const it = sess.body.items[0];
      const rev = await request(app).post('/api/student/mental-math/reveal').set('Authorization', `Bearer ${token}`).send({ gradeId: 'year4', seed: 2000 + i, idx: 0, answer: 0 });
      const good = typeof rev.body.answer === 'number';
      await request(app).post('/api/student/mental-math/answer').set('Authorization', `Bearer ${token}`)
        .send({ gradeId: 'year4', seed: 2000 + i, idx: 0, answer: i % 3 === 0 ? (good ? rev.body.answer + 1 : 'x') : (good ? rev.body.answer : 'خطأ'), ms: 5000 + i * 400, hintUsed: i % 4 === 0 });
      void it;
    }
    const rep = await request(app).get('/api/student/mental-math/report').set('Authorization', `Bearer ${token}`);
    expect(rep.status).toBe(200);
    expect(rep.body.total).toBeGreaterThanOrEqual(8);
    expect(typeof rep.body.accuracy).toBe('number');
    expect(Array.isArray(rep.body.skills)).toBe(true);
    expect(rep.body.skills.length).toBeGreaterThan(0);
    const s0 = rep.body.skills[0];
    expect(s0).toHaveProperty('fluency');
    expect(s0).toHaveProperty('level');
    expect(rep.body).toHaveProperty('mastered');
    expect(rep.body).toHaveProperty('needSupport');
    expect(rep.body).toHaveProperty('next');
    const flu = rep.body.skills.reduce((a, x) => a + x.fluency, 0) / rep.body.skills.length;
    expect(flu).toBeLessThanOrEqual(1);
  });

  it('مذكرة الرياضيات: حساب ذهني بأنشطة مذكّرًا بالاستراتيجية، وتعهد المكتسبات بمقارنة وتفكيك', async () => {
    const t = (await login('teacher@test.tn', 'teacher123')).body.token;
    const gen = await request(app)
      .post('/api/memos/generate')
      .set('Authorization', `Bearer ${t}`)
      .send({ subject: 'رياضيات', level: 'السنة الثانية أساسي', lessonTitle: 'الأعداد من 0 إلى 499: الطرح دون زيادة ولا تفكيك', useOfficial: false });
    expect(gen.status).toBe(200);
    const rows = gen.body.memo.content.spec.rows;
    const mental = rows.find((r) => r.stage.startsWith('حساب ذهني'));
    const prereq = rows.find((r) => r.stage.startsWith('تعهّد'));
    expect(mental.teacherActivity).toContain('الطريقة المتوقعة');
    expect(prereq.teacherActivity).toMatch(/الفارق|فكّك|أكمل لتصل|العشرات|ضعف/);
  });
});
