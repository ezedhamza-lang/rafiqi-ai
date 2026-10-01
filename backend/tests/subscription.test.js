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

describe('subscription-requests (طلبات الولي)', () => {
  it('يرفض طلبا بدون auth', async () => {
    const res = await request(app).post('/api/subscription-requests').send({
      firstName: 'ياسين',
      lastName: 'بن علي',
      birthDate: '2020-05-10',
      level: 'السنة الأولى أساسي'
    });
    expect(res.status).toBe(401);
  });

  it('يسمح للولي بتقديم طلب صحيح', async () => {
    const token = await getToken('parent@test.tn', 'parent123');
    const res = await request(app)
      .post('/api/subscription-requests')
      .set('Authorization', `Bearer ${token}`)
      .send({
        firstName: 'ياسين',
        lastName: 'بن علي',
        birthDate: '2020-05-10',
        level: 'السنة الأولى أساسي'
      });
    expect(res.status).toBe(201);
    expect(res.body.status).toBe('PENDING_APPROVAL');
    expect(res.body.firstName).toBe('ياسين');
  });

  it('يرفض طلبا بتاريخ غير صالح برسالة عربية', async () => {
    const token = await getToken('parent@test.tn', 'parent123');
    const res = await request(app)
      .post('/api/subscription-requests')
      .set('Authorization', `Bearer ${token}`)
      .send({ firstName: 'ياسين', lastName: 'بن علي', birthDate: '2020/05/10', level: 'السنة الأولى' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('يرجى التحقق من البيانات المدخلة');
    expect(res.body.errors.some((e) => e.field === 'birthDate')).toBe(true);
  });

  it('يرفض بيانات ناقصة (بلا مستوى)', async () => {
    const token = await getToken('parent@test.tn', 'parent123');
    const res = await request(app)
      .post('/api/subscription-requests')
      .set('Authorization', `Bearer ${token}`)
      .send({ firstName: 'ياسين', lastName: 'بن علي', birthDate: '2020-05-10' });
    expect(res.status).toBe(400);
  });

  it('يمنع التلميذ من تقديم طلب — ويدعم حساب دورين (الأستاذ الوليّ مقبول)', async () => {
    const studentToken = await getToken('student@test.tn', 'student123');
    const denied = await request(app)
      .post('/api/subscription-requests')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ firstName: 'ياسين', lastName: 'بن علي', birthDate: '2020-05-10', level: 'السنة الأولى' });
    expect(denied.status).toBe(403);

    // معلّم هو وليّ أمر في نفس الوقت: الطلب يُنسب إليه هو (parentId) — قبله كان 403
    const teacherToken = await getToken('teacher@test.tn', 'teacher123');
    const allowed = await request(app)
      .post('/api/subscription-requests')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ firstName: 'سلمى', lastName: 'بن علي', birthDate: '2020-05-10', level: 'السنة الأولى' });
    expect(allowed.status).toBe(201);
    expect(allowed.body.parentId).toBeTruthy();
  });

  it('يعرض قائمة طلبات الولي', async () => {
    const token = await getToken('parent@test.tn', 'parent123');
    const res = await request(app)
      .get('/api/subscription-requests/mine')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('يرجع مصفوفة فارغة لغير الولي (403 سابق، الآن 200)', async () => {
    const token = await getToken('teacher@test.tn', 'teacher123');
    const res = await request(app)
      .get('/api/subscription-requests/mine')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('يوجّه إشعار الطلب للإداري برابط شاشته ولمدير النظام برابط فضائه (لا رابط ميّت)', async () => {
    const prisma = (await import('../src/db.js')).default;
    const token = await getToken('parent@test.tn', 'parent123');
    const res = await request(app)
      .post('/api/subscription-requests')
      .set('Authorization', `Bearer ${token}`)
      .send({ firstName: 'ياسين', lastName: 'بن علي', birthDate: '2020-05-10', level: 'السنة الأولى أساسي' });
    expect(res.status).toBe(201);

    const admin = await prisma.user.findUnique({ where: { email: 'admin@education.tn' } });
    const superAdmin = await prisma.user.findUnique({ where: { email: 'super@education.tn' } });

    const adminNotif = await prisma.notification.findFirst({
      where: { userId: admin.id, type: 'SUBSCRIPTION_REQUEST' }
    });
    expect(adminNotif?.link).toBe('/director/requests');

    const superNotif = await prisma.notification.findFirst({
      where: { userId: superAdmin.id, type: 'SUBSCRIPTION_REQUEST' }
    });
    expect(superNotif?.link).toBe('/superadmin');
  });
});

describe('admin/subscriptions (اللوحة المالية)', () => {
  it('يمنع غير الإداري من الوصول', async () => {
    const token = await getToken('parent@test.tn', 'parent123');
    const res = await request(app).get('/api/admin/subscriptions').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  it('يعرض لوحة الاشتراكات للمدير العام', async () => {
    const token = await getToken('admin@education.tn', 'admin123');
    const res = await request(app).get('/api/admin/subscriptions').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.subscriptions).toBeDefined();
    expect(res.body.summary).toBeDefined();
    expect(res.body.summary.activeCount).toBe(1);
  });

  it('يرفض عملية دفع لمعرف غير رقمي', async () => {
    const token = await getToken('admin@education.tn', 'admin123');
    const res = await request(app)
      .post('/api/admin/subscriptions/abc/pay')
      .set('Authorization', `Bearer ${token}`)
      .send({ amount: 147 });
    expect(res.status).toBe(400);
    expect(res.body.errors.some((e) => e.field === 'id')).toBe(true);
  });

  it('يسجل دفعة على اشتراك معلق ويفعّله', async () => {
    const prisma = (await import('../src/db.js')).default;
    const token = await getToken('admin@education.tn', 'admin123');

    const sub = await prisma.subscription.create({
      data: {
        userId: (await prisma.user.findUnique({ where: { email: 'student@test.tn' } })).id,
        type: 'STUDENT',
        plan: 'اشتراك تلميذ',
        schoolYear: '2026-2027',
        startDate: new Date('2026-09-01'),
        endDate: new Date('2027-06-30'),
        status: 'PENDING_PAYMENT',
        amount: 147
      }
    });

    const res = await request(app)
      .post(`/api/admin/subscriptions/${sub.id}/pay`)
      .set('Authorization', `Bearer ${token}`)
      .send({ amount: 147, method: 'OFFLINE' });
    expect(res.status).toBe(201);
    expect(res.body.status).toBe('ACTIVE');

    const updated = await prisma.subscription.findUnique({ where: { id: sub.id } });
    expect(updated.status).toBe('ACTIVE');
  });

  it('يرجع 404 عند دفع اشتراك غير موجود', async () => {
    const token = await getToken('admin@education.tn', 'admin123');
    const res = await request(app)
      .post('/api/admin/subscriptions/99999/pay')
      .set('Authorization', `Bearer ${token}`)
      .send({ amount: 147 });
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('الاشتراك غير موجود');
  });
});
