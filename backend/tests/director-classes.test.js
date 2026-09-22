import { describe, it, expect, beforeAll } from 'vitest';
import { resetDatabase, seedTestData, login } from './helpers.js';
import request from 'supertest';

let app;
let directorToken;
let teacherId;

beforeAll(async () => {
  ({ app } = await import('../src/index.js'));
  await resetDatabase();
  await seedTestData();
  const res = await login('director@test.tn', 'director123');
  directorToken = res.body.token;
  expect(directorToken).toBeTruthy();
  const t = await login('teacher@test.tn', 'teacher123');
  expect(t.body.token).toBeTruthy();
  // teacher user id from teachers list
  const list = await request(app).get('/api/director/teachers').set('Authorization', `Bearer ${directorToken}`);
  teacherId = list.body.find((u) => u.email === 'teacher@test.tn')?.id;
  expect(teacherId).toBeTruthy();
});

describe('إدارة الأقسام من المدير (إنشاء + إسناد لأستاذ)', () => {
  it('يرفض بدون مصادقة (401)', async () => {
    const res = await request(app).post('/api/director/classes').send({ name: 'x', level: 'y' });
    expect(res.status).toBe(401);
  });

  it('يرفض الحقول الناقصة (400)', async () => {
    const res = await request(app)
      .post('/api/director/classes')
      .set('Authorization', `Bearer ${directorToken}`)
      .send({ name: 'ق' });
    expect(res.status).toBe(400);
  });

  it('يرفض أستاذا غير موجود (404)', async () => {
    const res = await request(app)
      .post('/api/director/classes')
      .set('Authorization', `Bearer ${directorToken}`)
      .send({ name: 'قسم السنة السادسة', level: 'السنة السادسة أساسي', teacherId: 999999 });
    expect(res.status).toBe(404);
  });

  it('ينشئ قسما مع أستاذ (201) ويظهر في قائمة الأقسام', async () => {
    const res = await request(app)
      .post('/api/director/classes')
      .set('Authorization', `Bearer ${directorToken}`)
      .send({ name: 'قسم السنة السادسة', level: 'السنة السادسة أساسي', teacherId });
    expect(res.status).toBe(201);
    expect(res.body.id).toBeTruthy();
    expect(res.body.teacher.id).toBe(teacherId);

    const list = await request(app).get('/api/director/classes').set('Authorization', `Bearer ${directorToken}`);
    expect(list.body.some((c) => c.name === 'قسم السنة السادسة')).toBe(true);
  });

  it('ينشئ قسما بدون أستاذ ثم يسنده (PUT)', async () => {
    const created = await request(app)
      .post('/api/director/classes')
      .set('Authorization', `Bearer ${directorToken}`)
      .send({ name: 'قسم السنة الخامسة', level: 'السنة الخامسة أساسي' });
    expect(created.status).toBe(201);
    expect(created.body.teacher).toBeFalsy();

    const updated = await request(app)
      .put(`/api/director/classes/${created.body.id}`)
      .set('Authorization', `Bearer ${directorToken}`)
      .send({ teacherId });
    expect(updated.status).toBe(200);
    expect(updated.body.teacher.id).toBe(teacherId);
  });

  it('تعديل قسم غير موجود (404)', async () => {
    const res = await request(app)
      .put('/api/director/classes/999999')
      .set('Authorization', `Bearer ${directorToken}`)
      .send({ name: 'قسم وهمي للاختبار' });
    expect(res.status).toBe(404);
  });

  it('قائمة الأساتذة تعمل', async () => {
    const res = await request(app).get('/api/director/teachers').set('Authorization', `Bearer ${directorToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
  });

  it('يسمح للمدير العام (ADMIN) بقائمة الأساتذة', async () => {
    const admin = await login('admin@education.tn', 'admin123');
    expect(admin.body.token).toBeTruthy();
    const res = await request(app)
      .get('/api/director/teachers')
      .set('Authorization', `Bearer ${admin.body.token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});
