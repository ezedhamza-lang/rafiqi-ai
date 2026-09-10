import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { resetDatabase, seedTestData } from './helpers.js';

let app;
let teacherToken;

describe('مكتبة الموارد المشتركة (R-langs)', () => {
  beforeAll(async () => {
    ({ app } = await import('../src/index.js'));
    await resetDatabase();
    await seedTestData();
    const r = await request(app).post('/api/auth/login').send({ email: 'teacher@test.tn', password: 'teacher123' });
    teacherToken = r.body.token;
  });

  async function createShared(subject) {
    const created = await request(app)
      .post('/api/teacher/resources')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ kind: 'WORKSHEET', subject, level: 'السنة الأولى أساسي', lessonTitle: 'درس اختبار', input: {} });
    expect(created.status).toBe(201);
    const shared = await request(app)
      .put(`/api/teacher/resources/${created.body.id}/share`)
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ shared: true });
    expect(shared.status).toBe(200);
    return created.body;
  }

  it('تصفية المادة لا تتحسس لحالة الأحرف (math يطابق MATH)', async () => {
    const res = await createShared('math');
    const list = await request(app).get('/api/teacher/library?subject=MATH').set('Authorization', `Bearer ${teacherToken}`);
    expect(list.status).toBe(200);
    expect(list.body.map((r) => r.id)).toContain(res.id);
    const lower = await request(app).get('/api/teacher/library?subject=math').set('Authorization', `Bearer ${teacherToken}`);
    expect(lower.body.map((r) => r.id)).toContain(res.id);
    const wrong = await request(app).get('/api/teacher/library?subject=STORIES').set('Authorization', `Bearer ${teacherToken}`);
    expect(wrong.body.map((r) => r.id)).not.toContain(res.id);
  });
});
