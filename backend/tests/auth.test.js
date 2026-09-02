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

describe('POST /api/auth/register', () => {
  it('ينشئ حسابا جديدا ويعيد token', async () => {
    const res = await request(app).post('/api/auth/register').send({
      firstName: 'علي',
      lastName: 'بن سالم',
      email: 'ali@test.tn',
      password: 'secret123'
    });
    expect(res.status).toBe(201);
    expect(res.body.token).toBeDefined();
    expect(res.body.user.email).toBe('ali@test.tn');
    expect(res.body.user.role).toBe('PARENT');
  });

  it('يرفض البيانات الناقصة برسالة تحقق عربية', async () => {
    const res = await request(app).post('/api/auth/register').send({ email: 'x' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('يرجى التحقق من البيانات المدخلة');
    expect(Array.isArray(res.body.errors)).toBe(true);
    expect(res.body.errors.length).toBeGreaterThan(0);
  });

  it('يرفض البريد المكرر', async () => {
    const res = await request(app).post('/api/auth/register').send({
      firstName: 'محمد',
      lastName: 'الولي',
      email: 'parent@test.tn',
      password: 'secret123'
    });
    expect(res.status).toBe(409);
    expect(res.body.error).toBe('البريد الإلكتروني مسجل بالفعل');
  });

  it('يرفض كلمة سر قصيرة', async () => {
    const res = await request(app).post('/api/auth/register').send({
      firstName: 'علي',
      lastName: 'بن سالم',
      email: 'ali2@test.tn',
      password: '123'
    });
    expect(res.status).toBe(400);
    expect(res.body.errors.some((e) => e.field === 'password')).toBe(true);
  });
});

describe('POST /api/auth/login', () => {
  it('يسجل الدخول بحساب صحيح', async () => {
    const res = await request(app).post('/api/auth/login').send({
      email: 'parent@test.tn',
      password: 'parent123'
    });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
    expect(res.body.user.role).toBe('PARENT');
  });

  it('يرفض كلمة سر خاطئة', async () => {
    const res = await request(app).post('/api/auth/login').send({
      email: 'parent@test.tn',
      password: 'wrong-pass'
    });
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('بيانات الدخول غير صحيحة');
  });

  it('يرفض بريدا غير موجود', async () => {
    const res = await request(app).post('/api/auth/login').send({
      email: 'ghost@test.tn',
      password: 'whatever'
    });
    expect(res.status).toBe(401);
  });
});

describe('GET /api/auth/me', () => {
  it('يعيد بيانات المستخدم الموثق', async () => {
    const loginRes = await request(app).post('/api/auth/login').send({
      email: 'parent@test.tn',
      password: 'parent123'
    });
    const token = loginRes.body.token;

    const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.email).toBe('parent@test.tn');
  });

  it('يرفض طلبا بلا token', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  it('يرفض token زائفا', async () => {
    const res = await request(app).get('/api/auth/me').set('Authorization', 'Bearer fake-token');
    expect(res.status).toBe(401);
  });
});
