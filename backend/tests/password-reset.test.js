import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import prisma from '../src/db.js';
import { seedTestData, resetDatabase } from './helpers.js';

let request;
let app;

beforeAll(async () => {
  const { default: supertest } = await import('supertest');
  request = supertest;
  const mod = await import('../src/index.js');
  app = mod.app;
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('استعادة كلمة المرور وتأكيد البريد', () => {
  it('forgot-password يعيد 200 دائماً حتى لبريد غير موجود (لا تعداد حسابات)', async () => {
    await resetDatabase();
    await seedTestData();
    const res = await request(app).post('/api/auth/forgot-password').send({ email: 'nobody@test.tn' });
    expect(res.status).toBe(200);
    expect(res.body.message).toBeTruthy();
  });

  it('التدفق الكامل: نسيان -> رمز -> إعادة تعيين -> دخول بالجديدة', async () => {
    await resetDatabase();
    await seedTestData();

    // 1) طلب استعادة لحساب موجود
    await request(app).post('/api/auth/forgot-password').send({ email: 'student@test.tn' });

    // لا يمكن استخراج الرمز الخام من الهاش — ننشئ رمزاً معروفاً مباشرة
    const crypto = await import('crypto');
    const raw = crypto.randomBytes(32).toString('hex');
    const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');
    const user = await prisma.user.findUnique({ where: { email: 'student@test.tn' } });
    await prisma.passwordResetToken.create({
      data: { userId: user.id, tokenHash: sha256(raw), expiresAt: new Date(Date.now() + 3600_000) }
    });

    // 2) إعادة التعيين برمز صالح
    const reset = await request(app)
      .post('/api/auth/reset-password')
      .send({ token: raw, password: 'newpass123' });
    expect(reset.status).toBe(200);

    // 3) الدخول بالقديمة يفشل والجديدة ينجح
    const oldLogin = await request(app).post('/api/auth/login').send({ email: 'student@test.tn', password: 'student123' });
    expect(oldLogin.status).toBe(401);
    const newLogin = await request(app).post('/api/auth/login').send({ email: 'student@test.tn', password: 'newpass123' });
    expect(newLogin.status).toBe(200);

    // 4) الرمز أحادي الاستعمال
    const reuse = await request(app).post('/api/auth/reset-password').send({ token: raw, password: 'another123' });
    expect(reuse.status).toBe(400);
  });

  it('reset-password يرفض رمزاً غير صالح', async () => {
    await resetDatabase();
    await seedTestData();
    const res = await request(app).post('/api/auth/reset-password').send({ token: 'x'.repeat(40), password: 'whatever1' });
    expect(res.status).toBe(400);
  });

  it('verify-email يؤكد البريد برمز صالح', async () => {
    await resetDatabase();
    await seedTestData();
    const crypto = await import('crypto');
    const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');
    const raw = crypto.randomBytes(32).toString('hex');
    const user = await prisma.user.findUnique({ where: { email: 'parent@test.tn' } });
    await prisma.emailVerificationToken.create({
      data: { userId: user.id, tokenHash: sha256(raw), expiresAt: new Date(Date.now() + 3600_000) }
    });

    const res = await request(app).post('/api/auth/verify-email').send({ token: raw });
    expect(res.status).toBe(200);

    const after = await prisma.user.findUnique({ where: { email: 'parent@test.tn' } });
    expect(after.emailVerified).toBe(true);
  });
});