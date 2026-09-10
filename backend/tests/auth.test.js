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

describe('تغيير كلمة السر + إلزام التلميذ بتغيير كلمة السر المؤقتة', () => {
  async function login(email, password) {
    return request(app).post('/api/auth/login').send({ email, password });
  }

  it('التلميذ ذو كلمة السر المؤقتة يُعلَّم بـmustChangePassword=true في login وme', async () => {
    const prisma = (await import('../src/db.js')).default;
    const acct = await prisma.user.findUnique({ where: { email: 'student@test.tn' } });
    await prisma.student.updateMany({ where: { accountUserId: acct.id }, data: { tempPassword: '123456' } });

    const res = await login('student@test.tn', 'student123');
    expect(res.status).toBe(200);
    expect(res.body.user.mustChangePassword).toBe(true);

    const me = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${res.body.token}`);
    expect(me.body.mustChangePassword).toBe(true);
  });

  it('غير التلميذ (وليّ) لا يُجبر على التغيير', async () => {
    const res = await login('parent@test.tn', 'parent123');
    expect(res.status).toBe(200);
    expect(res.body.user.mustChangePassword).toBeFalsy();
  });

  it('رفض كلمة سر الحالية الخاطئة', async () => {
    const res = await login('parent@test.tn', 'parent123');
    const bad = await request(app)
      .put('/api/auth/change-password')
      .set('Authorization', `Bearer ${res.body.token}`)
      .send({ currentPassword: 'wrong', newPassword: 'newpass1' });
    expect(bad.status).toBe(401);
  });

  it('رفض كلمة سر جديدة قصيرة', async () => {
    const res = await login('parent@test.tn', 'parent123');
    const short = await request(app)
      .put('/api/auth/change-password')
      .set('Authorization', `Bearer ${res.body.token}`)
      .send({ currentPassword: 'parent123', newPassword: '123' });
    expect(short.status).toBe(400);
  });

  it('نجاح التغيير: كلمة سر جديدة تعمل، tempPassword يُمسح، والجلسات القديمة تُلغى', async () => {
    const prisma = (await import('../src/db.js')).default;
    const acct = await prisma.user.findUnique({ where: { email: 'student@test.tn' } });
    await prisma.student.updateMany({ where: { accountUserId: acct.id }, data: { tempPassword: '654321' } });

    const s1 = await login('student@test.tn', 'student123');
    expect(s1.body.user.mustChangePassword).toBe(true);

    const change = await request(app)
      .put('/api/auth/change-password')
      .set('Authorization', `Bearer ${s1.body.token}`)
      .send({ currentPassword: 'student123', newPassword: 'brandnew1' });
    expect(change.status).toBe(200);
    expect(change.body.token).toBeTruthy();
    expect(change.body.refreshToken).toBeTruthy();

    // tempPassword مُمسح ⇒ mustChangePassword صارت false في جلسة جديدة
    const s2 = await login('student@test.tn', 'brandnew1');
    expect(s2.status).toBe(200);
    expect(s2.body.user.mustChangePassword).toBe(false);
    const stud = await prisma.student.findFirst({ where: { accountUserId: acct.id } });
    expect(stud.tempPassword).toBeNull();

    // كلمة السر القديمة لم تعد تعمل
    const old = await login('student@test.tn', 'student123');
    expect(old.status).toBe(401);

    // الجلسة القديمة (قبل التغيير) رُميت رموزها ⇒ refresh يفشل
    const oldRefresh = await request(app).post('/api/auth/refresh').send({ refreshToken: s1.body.refreshToken });
    expect([401, 403]).toContain(oldRefresh.status);

    // الجلسة الحالية (من استجابة التغيير) لا تزال صالحة
    const me = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${change.body.token}`);
    expect(me.status).toBe(200);
  });

  it('لا تغيير بلا مصادقة', async () => {
    const res = await request(app).put('/api/auth/change-password').send({ currentPassword: 'a', newPassword: 'abcdef' });
    expect(res.status).toBe(401);
  });
});
