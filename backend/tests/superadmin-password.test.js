import { describe, it, expect, beforeAll } from 'vitest';
import { resetDatabase, seedTestData, login } from './helpers.js';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import prisma from '../src/db.js';

let app;
let superToken;
let targetId;

beforeAll(async () => {
  ({ app } = await import('../src/index.js'));
  await resetDatabase();
  await seedTestData();
  const res = await login('super@education.tn', 'super123');
  superToken = res.body.token;
  expect(superToken).toBeTruthy();
  const stu = await prisma.user.findUnique({ where: { email: 'student@test.tn' } });
  targetId = stu.id;
  expect(targetId).toBeTruthy();
});

describe('إعادة تعيين كلمات السر من المشرف العام', () => {
  it('يرفض بدون مصادقة (401)', async () => {
    const res = await request(app).put('/api/superadmin/users/1/password').send({});
    expect(res.status).toBe(401);
  });

  it('يرفض مستخدما غير موجود (404)', async () => {
    const res = await request(app)
      .put('/api/superadmin/users/999999/password')
      .set('Authorization', `Bearer ${superToken}`)
      .send({});
    expect(res.status).toBe(404);
  });

  it('يرفض كلمة سر قصيرة (400)', async () => {
    const res = await request(app)
      .put(`/api/superadmin/users/${targetId}/password`)
      .set('Authorization', `Bearer ${superToken}`)
      .send({ password: '123' });
    expect(res.status).toBe(400);
  });

  it('يولّد كلمة سر تلقائيا وتعمل فعلا', async () => {
    const res = await request(app)
      .put(`/api/superadmin/users/${targetId}/password`)
      .set('Authorization', `Bearer ${superToken}`)
      .send({});
    expect(res.status).toBe(200);
    expect(res.body.password).toBeTruthy();
    expect(res.body.password.length).toBeGreaterThanOrEqual(6);
    const user = await prisma.user.findUnique({ where: { id: targetId } });
    expect(await bcrypt.compare(res.body.password, user.passwordHash)).toBe(true);
  });

  it('يقبل كلمة سر مخصصة', async () => {
    const res = await request(app)
      .put(`/api/superadmin/users/${targetId}/password`)
      .set('Authorization', `Bearer ${superToken}`)
      .send({ password: 'NewPass-987654' });
    expect(res.status).toBe(200);
    expect(res.body.password).toBe('NewPass-987654');
    const loginRes = await login('student@test.tn', 'NewPass-987654');
    expect(loginRes.body.token).toBeTruthy();
  });
});
