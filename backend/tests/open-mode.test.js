// «الوضع المفتوح» المؤقت (2026-11) — اختبارات.
//
// الملف يفعّل OPEN_MODE قبل استيراد التطبيق (config يُقرأ عند الاستيراد).
// يغطّي:
//  • خارج الوضع المفتوح: اختيار «أستاذ» عند التسجيل لا يغيّر شيئًا (PARENT)
//    والحساب المعلّق (قيد المصادقة) يُرفض بـ403  → المسار القديم سليم.
//  • في الوضع المفتوح: تسجيل أستاذ ذاتي + دخوله فورًا، وإنشاء تلميذ لولي
//    بلا موافقة ولا دفع، وبطاقة دخول جاهزة.
process.env.OPEN_MODE = 'true';

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

describe('الوضع المفتوح — إعدادات عامة', () => {
  it('GET /api/auth/config يعلنOPENMode=true', async () => {
    const res = await request(app).get('/api/auth/config');
    expect(res.status).toBe(200);
    expect(res.body.openMode).toBe(true);
  });

  it('الفحص الصحي يعلن الوضع المفتوح', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.openMode).toBe(true);
  });
});

describe('الوضع المفتوح — تسجيل أستاذ ذاتي', () => {
  it('يقبل role=TEACHER وينشئ حساب أستاذ «قيد المصادقة»', async () => {
    const res = await request(app).post('/api/auth/register').send({
      firstName: 'سعاد',
      lastName: 'المعلمة',
      email: 'souad@test.tn',
      password: 'secret123',
      role: 'TEACHER'
    });
    expect(res.status).toBe(201);
    expect(res.body.user.role).toBe('TEACHER');
    expect(res.body.user.accountStatus).toBe('PENDING_APPROVAL');
    expect(res.body.token).toBeDefined();
  });

  it('الأستاذ الجديد يدخل مباشرة إلى فضاء الأستاذ (لا 403)', async () => {
    await request(app).post('/api/auth/register').send({
      firstName: 'سعاد',
      lastName: 'المعلمة',
      email: 'souad@test.tn',
      password: 'secret123',
      role: 'TEACHER'
    });
    const login = await request(app).post('/api/auth/login').send({
      email: 'souad@test.tn',
      password: 'secret123'
    });
    expect(login.status).toBe(200);
    expect(login.body.user.role).toBe('TEACHER');

    const me = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${login.body.token}`);
    expect(me.status).toBe(200);
    expect(me.body.accountStatus).toBe('PENDING_APPROVAL');

    const classes = await request(app).get('/api/teacher/classes').set('Authorization', `Bearer ${login.body.token}`);
    expect(classes.status).toBe(200);
  });

  it('لا يقبل أدوار إدارية عند التسجيل (.Admin تسريب)', async () => {
    const res = await request(app).post('/api/auth/register').send({
      firstName: 'م',
      lastName: 'خ',
      email: 'evil@test.tn',
      password: 'secret123',
      role: 'SUPER_ADMIN'
    });
    expect(res.status).toBe(400);
    expect(res.body.errors.some((e) => e.field === 'role')).toBe(true);
  });

  it('التسجيل بلا role يبقى وليًا (المسار القديم)', async () => {
    const res = await request(app).post('/api/auth/register').send({
      firstName: 'علي',
      lastName: 'بن سالم',
      email: 'ali@test.tn',
      password: 'secret123'
    });
    expect(res.status).toBe(201);
    expect(res.body.user.role).toBe('PARENT');
    expect(res.body.user.accountStatus).toBe('ACTIVE');
  });
});

describe('الوضع المفتوح — punishments تبقى سارية', () => {
  it('حساب معطّل (SUSPENDED) يبقى محجوبًا رغم الوضع المفتوح', async () => {
    const prisma = (await import('../src/db.js')).default;
    await prisma.user.update({ where: { email: 'teacher@test.tn' }, data: { accountStatus: 'SUSPENDED' } });
    const res = await request(app).post('/api/auth/login').send({
      email: 'teacher@test.tn',
      password: 'teacher123'
    });
    expect(res.status).toBe(403);
  });

  it('حساب منتهي (EXPIRED) يبقى محجوبًا', async () => {
    const prisma = (await import('../src/db.js')).default;
    await prisma.user.update({ where: { email: 'teacher@test.tn' }, data: { accountStatus: 'EXPIRED' } });
    const res = await request(app).post('/api/auth/login').send({
      email: 'teacher@test.tn',
      password: 'teacher123'
    });
    expect(res.status).toBe(403);
  });
});

describe('الوضع المفتوح — «أضف ابني» بلا موافقة ولا دفع', () => {
  async function loginParent() {
    const res = await request(app).post('/api/auth/login').send({ email: 'parent@test.tn', password: 'parent123' });
    return res.body.token;
  }

  it('طلب تسجيل ابن يُنفَّذ فورًا: حساب تلميذ مفعّل + بطاقة دخول', async () => {
    const token = await loginParent();
    const res = await request(app)
      .post('/api/subscription-requests')
      .set('Authorization', `Bearer ${token}`)
      .send({
        firstName: 'ليلى',
        lastName: 'بن عمر',
        birthDate: '2020-05-04',
        level: 'السنة الأولى أساسي',
        schoolYear: '2026-2027',
        gender: 'أنثى'
      });

    expect(res.status).toBe(201);
    expect(res.body._openMode).toBe(true);
    expect(res.body.status).toBe('ACTIVE');
    expect(res.body.studentId).toBeTruthy();

    const prisma = (await import('../src/db.js')).default;
    // التلميذ أُنشئ بحساب ACTIVE
    const student = await prisma.student.findFirst({ where: { firstName: 'ليلى' } });
    expect(student).toBeTruthy();
    expect(student.accountUserId).toBeTruthy();
    const childAccount = await prisma.user.findUnique({ where: { id: student.accountUserId } });
    expect(childAccount.role).toBe('STUDENT');
    expect(childAccount.accountStatus).toBe('ACTIVE');
    // بطاقة الدخول متاحة للولي
    expect(student.tempPassword).toBeTruthy();
    // ولا اشتراك (إيراد صفر في الوضع المفتوح)
    const subs = await prisma.subscription.count({ where: { userId: childAccount.id } });
    expect(subs).toBe(0);
  });

  it('الطلب المكرر لا ينشئ طفلًا ثانيًا', async () => {
    const token = await loginParent();
    const payload = {
      firstName: 'ليلى',
      lastName: 'بن عمر',
      birthDate: '2020-05-04',
      level: 'السنة الأولى أساسي',
      schoolYear: '2026-2027'
    };
    const first = await request(app).post('/api/subscription-requests').set('Authorization', `Bearer ${token}`).send(payload);
    const second = await request(app).post('/api/subscription-requests').set('Authorization', `Bearer ${token}`).send(payload);
    expect(first.status).toBe(201);
    expect(second.status).toBe(200);
    expect(second.body._deduped).toBe(true);

    const prisma = (await import('../src/db.js')).default;
    const count = await prisma.student.count({ where: { firstName: 'ليلى' } });
    expect(count).toBe(1);
  });

  it('التلميذ الجديد يدخل مباشرةً بكلمة السر المؤقتة', async () => {
    const token = await loginParent();
    await request(app)
      .post('/api/subscription-requests')
      .set('Authorization', `Bearer ${token}`)
      .send({
        firstName: 'ليلى',
        lastName: 'بن عمر',
        birthDate: '2020-05-04',
        level: 'السنة الأولى أساسي',
        schoolYear: '2026-2027'
      });
    const prisma = (await import('../src/db.js')).default;
    const student = await prisma.student.findFirst({ where: { firstName: 'ليلى' } });
    const childAccount = await prisma.user.findUnique({ where: { id: student.accountUserId } });

    const login = await request(app).post('/api/auth/login').send({
      email: childAccount.email,
      password: student.tempPassword
    });
    expect(login.status).toBe(200);
    expect(login.body.user.role).toBe('STUDENT');
    expect(login.body.user.mustChangePassword).toBe(true);
  });
});

describe('الوضع المفتوح — مصادقة الأستاذ ذاتيًا من لوحة المالك', () => {
  it('PUT /api/superadmin/users/:id/status يفعّل حساب الأستاذ', async () => {
    const prisma = (await import('../src/db.js')).default;
    const created = await prisma.user.create({
      data: {
        firstName: 'سعاد',
        lastName: 'المعلمة',
        email: 'souad2@test.tn',
        passwordHash: 'x',
        role: 'TEACHER',
        accountStatus: 'PENDING_APPROVAL'
      }
    });

    const login = await request(app).post('/api/auth/login').send({ email: 'super@education.tn', password: 'super123' });
    const res = await request(app)
      .put(`/api/superadmin/users/${created.id}/status`)
      .set('Authorization', `Bearer ${login.body.token}`)
      .send({ status: 'ACTIVE' });

    expect(res.status).toBe(200);
    expect(res.body.accountStatus).toBe('ACTIVE');
    const updated = await prisma.user.findUnique({ where: { id: created.id } });
    expect(updated.accountStatus).toBe('ACTIVE');
  });

  it('لا يُسمح إلا للمدير العام', async () => {
    const res = await request(app)
      .put('/api/superadmin/users/1/status')
      .set('Authorization', 'Bearer fake')
      .send({ status: 'ACTIVE' });
    expect(res.status).toBe(401);
  });});
