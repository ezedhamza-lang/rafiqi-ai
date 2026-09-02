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

async function login(email, password) {
  const res = await request(app).post('/api/auth/login').send({ email, password });
  return res.body?.accessToken || res.body?.token;
}

describe('تعدد المدارس — الشبكة والعزل', () => {
  beforeAll(async () => {
    await resetDatabase();
    await seedTestData();
  });

  it('البذرة تربط حسابات العرض بالمدرسة الافتراضية (عدا السوبر أدمن)', async () => {
    const school = await prisma.school.findUnique({ where: { code: 'SCH-001' } });
    expect(school).toBeTruthy();
    const teacher = await prisma.user.findUnique({ where: { email: 'teacher@test.tn' } });
    expect(teacher.schoolId).toBe(school.id);
    const superUser = await prisma.user.findUnique({ where: { email: 'super@education.tn' } });
    expect(superUser.schoolId).toBeNull();
  });

  it('السوبر أدمن ينشئ مدرسة ويراها في الشبكة مع إحصاءاتها', async () => {
    const token = await login('super@education.tn', 'super123');
    const created = await request(app)
      .post('/api/superadmin/schools')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'مدرسة المستقبل', code: 'SCH-002' });
    expect(created.status).toBe(201);

    const list = await request(app).get('/api/superadmin/schools').set('Authorization', `Bearer ${token}`);
    expect(list.status).toBe(200);
    const names = list.body.map((s) => s.code);
    expect(names).toContain('SCH-001');
    expect(names).toContain('SCH-002');
    const entry = list.body.find((s) => s.code === 'SCH-001');
    expect(entry.users).toBeGreaterThan(0);
  });

  it('رمز مدرسة مكرر يُرفض 409، والإنشاء بلا اسم يُرفض 400', async () => {
    const token = await login('super@education.tn', 'super123');
    const dup = await request(app)
      .post('/api/superadmin/schools')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'أخرى', code: 'SCH-001' });
    expect(dup.status).toBe(409);
    const noName = await request(app)
      .post('/api/superadmin/schools')
      .set('Authorization', `Bearer ${token}`)
      .send({ code: 'SCH-003' });
    expect(noName.status).toBe(400);
  });

  it('تعليق المدرسة يمنع مستخدميها من الدخول', async () => {
    const superToken = await login('super@education.tn', 'super123');
    const school = await prisma.school.findUnique({ where: { code: 'SCH-001' } });
    await request(app)
      .put(`/api/superadmin/schools/${school.id}/status`)
      .set('Authorization', `Bearer ${superToken}`)
      .send({ status: 'SUSPENDED' });

    const blocked = await request(app).post('/api/auth/login').send({ email: 'teacher@test.tn', password: 'teacher123' });
    expect(blocked.status).toBe(403);

    // السوبر أدمن يدخل رغم تعليق المدرسة
    const superLogin = await request(app).post('/api/auth/login').send({ email: 'super@education.tn', password: 'super123' });
    expect(superLogin.status).toBe(200);

    // إعادة التفعيل يعيد الدخول
    await request(app)
      .put(`/api/superadmin/schools/${school.id}/status`)
      .set('Authorization', `Bearer ${superToken}`)
      .send({ status: 'ACTIVE' });
    const restored = await request(app).post('/api/auth/login').send({ email: 'teacher@test.tn', password: 'teacher123' });
    expect(restored.status).toBe(200);
  });

  it('مدير المدرسة يرى أقسام مدرسته فقط (العزل)', async () => {
    // أنشئ مدرسة ثانية وقسماً فيها
    const s2 = await prisma.school.create({ data: { name: 'مدرسة أخرى', code: 'SCH-TEST-X' } });
    const otherClass = await prisma.class.create({
      data: { name: 'قسم خارجي', level: 'السنة الأولى أساسي', schoolId: s2.id }
    });

    const token = await login('director@test.tn', 'director123');
    const classes = await request(app).get('/api/director/classes').set('Authorization', `Bearer ${token}`);
    expect(classes.status).toBe(200);
    const ids = classes.body.map((c) => c.id);
    expect(ids).not.toContain(otherClass.id);
  });
});