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

describe('POST /api/auth/login — يصدّر زوج رموز (وصول + تجديد)', () => {
  it('يعيد refreshToken مع token عند الدخول', async () => {
    const res = await request(app).post('/api/auth/login').send({
      email: 'parent@test.tn',
      password: 'parent123'
    });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
    expect(res.body.refreshToken).toBeDefined();
    expect(res.body.refreshToken.length).toBeGreaterThan(20);
  });
});

describe('POST /api/auth/refresh — تدوير آمن', () => {
  it('يُدوّر الرمز: رمز جديد صالح والقديم يُبطَل', async () => {
    const login = await request(app).post('/api/auth/login').send({
      email: 'parent@test.tn',
      password: 'parent123'
    });
    const oldRefresh = login.body.refreshToken;

    const res = await request(app).post('/api/auth/refresh').send({ refreshToken: oldRefresh });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
    const newRefresh = res.body.refreshToken;
    expect(newRefresh).not.toBe(oldRefresh);

    // إعادة استعمال القديم — يجب أن تفشل (القديم مُبطَل)
    const reuse = await request(app).post('/api/auth/refresh').send({ refreshToken: oldRefresh });
    expect(reuse.status).toBe(401);

    // الجديد ما زال صالحاً
    const again = await request(app).post('/api/auth/refresh').send({ refreshToken: newRefresh });
    expect(again.status).toBe(200);
  });

  it('يرفض رمزاً غير موجود', async () => {
    const res = await request(app).post('/api/auth/refresh').send({ refreshToken: 'x'.repeat(96) });
    expect(res.status).toBe(401);
  });

  it('يرفض رمزاً مرفوعاً بعد logout', async () => {
    const login = await request(app).post('/api/auth/login').send({
      email: 'parent@test.tn',
      password: 'parent123'
    });
    await request(app).post('/api/auth/logout').send({ refreshToken: login.body.refreshToken });

    const res = await request(app).post('/api/auth/refresh').send({ refreshToken: login.body.refreshToken });
    expect(res.status).toBe(401);
  });

  it('يرفض payload بدون refreshToken', async () => {
    const res = await request(app).post('/api/auth/refresh').send({});
    expect(res.status).toBe(400);
  });
});

describe('POST /api/auth/logout', () => {
  it('ينهي الجلسة بنجاح', async () => {
    const login = await request(app).post('/api/auth/login').send({
      email: 'parent@test.tn',
      password: 'parent123'
    });
    const res = await request(app).post('/api/auth/logout').send({ refreshToken: login.body.refreshToken });
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });
});

describe('رمز الوصول قصير العمر (15 دقيقة)', () => {
  it('يُصدَر access token بمدة صلاحية 15 دقيقة', async () => {
    const { default: jwt } = await import('jsonwebtoken');
    const login = await request(app).post('/api/auth/login').send({
      email: 'parent@test.tn',
      password: 'parent123'
    });
    const payload = jwt.decode(login.body.token);
    const ttlSeconds = payload.exp - payload.iat;
    expect(ttlSeconds).toBe(15 * 60);
  });
});