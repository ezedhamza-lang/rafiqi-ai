import { beforeAll, afterAll, beforeEach, describe, it, expect } from 'vitest';
import { resetDatabase, seedTestData } from './helpers.js';

let request;
let app;

beforeAll(async () => {
  const { default: supertest } = await import('supertest');
  request = supertest;
  const mod = await import('../src/index.js');
  app = mod.app;
});

afterAll(async () => {
  const prisma = (await import('../src/db.js')).default;
  await prisma.$disconnect();
});

beforeEach(async () => {
  await resetDatabase();
  await seedTestData();
});

async function getToken(email, password) {
  const res = await request(app).post('/api/auth/login').send({ email, password });
  return res.body.token;
}

describe('attendance (الحضور والغياب)', () => {
  it('يعرض قائمة حضور قسم للأستاذ', async () => {
    const token = await getToken('teacher@test.tn', 'teacher123');
    const res = await request(app)
      .get('/api/teacher/attendance/classes/1')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.className).toBe('قسم السنة الأولى أ');
    expect(Array.isArray(res.body.students)).toBe(true);
  });

  it('يمنع الولي من عرض حضور قسم', async () => {
    const token = await getToken('parent@test.tn', 'parent123');
    const res = await request(app)
      .get('/api/teacher/attendance/classes/1')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  it('يحفظ سجل حضور صحيح', async () => {
    const token = await getToken('teacher@test.tn', 'teacher123');
    const res = await request(app)
      .post('/api/teacher/attendance/save')
      .set('Authorization', `Bearer ${token}`)
      .send({ classId: 1, date: '2026-08-14', records: [{ studentId: 2, present: false, note: 'غائب' }] });
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.absent).toBe(1);
  });

  it('يرفض تاريخا غير صحيح عند الحفظ', async () => {
    const token = await getToken('teacher@test.tn', 'teacher123');
    const res = await request(app)
      .post('/api/teacher/attendance/save')
      .set('Authorization', `Bearer ${token}`)
      .send({ classId: 1, date: '14-08-2026', records: [{ studentId: 2, present: false }] });
    expect(res.status).toBe(400);
    expect(res.body.errors.some((e) => e.field === 'date')).toBe(true);
  });

  it('يرفض قسم غير موجود', async () => {
    const token = await getToken('teacher@test.tn', 'teacher123');
    const res = await request(app)
      .post('/api/teacher/attendance/save')
      .set('Authorization', `Bearer ${token}`)
      .send({ classId: 999, date: '2026-08-14', records: [{ studentId: 2 }] });
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('القسم غير موجود');
  });

  it('يرفض سجلا بدون records', async () => {
    const token = await getToken('teacher@test.tn', 'teacher123');
    const res = await request(app)
      .post('/api/teacher/attendance/save')
      .set('Authorization', `Bearer ${token}`)
      .send({ classId: 1, date: '2026-08-14' });
    expect(res.status).toBe(400);
  });

  it('يعرض غيابات أبناء الولي', async () => {
    const token = await getToken('parent@test.tn', 'parent123');
    const res = await request(app)
      .get('/api/parent/attendance/children?days=30')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('يمنع المعلمة من استعمال مسار الولي', async () => {
    const token = await getToken('teacher@test.tn', 'teacher123');
    const res = await request(app)
      .get('/api/parent/attendance/children')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });
});
