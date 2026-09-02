import { beforeAll, afterAll, beforeEach, describe, it, expect } from 'vitest';
import bcrypt from 'bcryptjs';
import { resetDatabase, seedTestData } from './helpers.js';

let request;
let app;
let server;
let prisma;

async function getToken(email, password) {
  const res = await request(app).post('/api/auth/login').send({ email, password });
  return res.body.token;
}

beforeAll(async () => {
  const { default: supertest } = await import('supertest');
  request = supertest;
  const mod = await import('../src/index.js');
  app = mod.app;
  server = mod.server;
  prisma = (await import('../src/db.js')).default;
  if (!server.listening) {
    await new Promise((resolve) => server.listen(3999, resolve));
  }
});

afterAll(async () => {
  if (server.listening) {
    await new Promise((resolve) => server.close(resolve));
  }
  await prisma.$disconnect();
});

beforeEach(async () => {
  await resetDatabase();
  await seedTestData();
});

describe('notifications + message center (الإشعارات الموحدة + مركز الرسائل — 5.3)', () => {
  it('إعلان من الإدارة يصل التلاميذ والأولياء والأساتذة كإشعار داخل المنصة', async () => {
    const adminToken = await getToken('admin@education.tn', 'admin123');
    const res = await request(app)
      .post('/api/director/announcements')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: 'تعليق الدروس يوم الاثنين',
        body: 'نعلم كافة الأولياء أنه سيتم تعليق الدروس يوم الاثنين القادم بمناسبة عيد الشغل.',
        category: 'URGENT',
        priority: 'HIGH',
        audience: ['ALL']
      });
    expect(res.status).toBe(201);
    expect(res.body.recipients).toBeGreaterThanOrEqual(5);
    expect(res.body.announcement.title).toBe('تعليق الدروس يوم الاثنين');

    const studentToken = await getToken('student@test.tn', 'student123');
    const parentToken = await getToken('parent@test.tn', 'parent123');
    const teacherToken = await getToken('teacher@test.tn', 'teacher123');

    for (const token of [studentToken, parentToken, teacherToken]) {
      const list = await request(app)
        .get('/api/notifications')
        .set('Authorization', `Bearer ${token}`);
      expect(list.status).toBe(200);
      const announcement = list.body.items.find((n) => n.type === 'ANNOUNCEMENT');
      expect(announcement).toBeTruthy();
      expect(announcement.title).toContain('تعليق الدروس');
      expect(announcement.link).toBe('/message-center');
    }
  });

  it('إعلان موجه للأساتذة فقط لا يصل التلميذ ولا الولي', async () => {
    const adminToken = await getToken('admin@education.tn', 'admin123');
    await request(app)
      .post('/api/director/announcements')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: 'اجتماع الأساتذة',
        body: 'اجتماع تربوي لأساتذة القسم التحضيري.',
        audience: ['TEACHER']
      });

    const teacherList = await request(app)
      .get('/api/notifications')
      .set('Authorization', `Bearer ${await getToken('teacher@test.tn', 'teacher123')}`);
    expect(teacherList.body.items.some((n) => n.type === 'ANNOUNCEMENT')).toBe(true);

    const studentList = await request(app)
      .get('/api/notifications')
      .set('Authorization', `Bearer ${await getToken('student@test.tn', 'student123')}`);
    expect(studentList.body.items.some((n) => n.type === 'ANNOUNCEMENT')).toBe(false);

    const parentList = await request(app)
      .get('/api/notifications')
      .set('Authorization', `Bearer ${await getToken('parent@test.tn', 'parent123')}`);
    expect(parentList.body.items.some((n) => n.type === 'ANNOUNCEMENT')).toBe(false);
  });

  it('إعلان بمستوى دراسي معين يصل تلاميذ ذلك المستوى فقط', async () => {
    const other = await prisma.user.create({
      data: {
        firstName: 'سمير',
        lastName: 'التلميذ',
        email: 'other-student@test.tn',
        passwordHash: await bcrypt.hash('other123', 4),
        role: 'STUDENT',
        accountStatus: 'ACTIVE'
      }
    });
    await prisma.student.create({
      data: {
        userId: other.id,
        accountUserId: other.id,
        firstName: 'سمير',
        lastName: 'التلميذ',
        birthDate: new Date('2018-05-01'),
        cin: '12345678',
        gender: 'ذكر',
        level: 'السنة الثانية أساسي',
        schoolYear: '2026-2027'
      }
    });

    const adminToken = await getToken('admin@education.tn', 'admin123');
    await request(app)
      .post('/api/director/announcements')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: 'نشاط السنة الأولى',
        body: 'رحلة مدرسية لتلاميذ السنة الأولى.',
        audience: ['STUDENT'],
        level: 'السنة الأولى أساسي'
      });

    const firstList = await request(app)
      .get('/api/notifications')
      .set('Authorization', `Bearer ${await getToken('student@test.tn', 'student123')}`);
    expect(firstList.body.items.some((n) => n.type === 'ANNOUNCEMENT')).toBe(true);

    const secondToken = await getToken('other-student@test.tn', 'other123');
    const secondList = await request(app)
      .get('/api/notifications')
      .set('Authorization', `Bearer ${secondToken}`);
    expect(secondList.body.items.some((n) => n.type === 'ANNOUNCEMENT')).toBe(false);
  });

  it('عدّاد غير المقروء وقراءة كل الإشعارات', async () => {
    const adminToken = await getToken('admin@education.tn', 'admin123');
    await request(app)
      .post('/api/director/announcements')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title: 'إعلان للقراءة', body: 'يجب قراءته.', audience: ['ALL'] });

    const studentToken = await getToken('student@test.tn', 'student123');
    const count = await request(app)
      .get('/api/notifications/unread-count')
      .set('Authorization', `Bearer ${studentToken}`);
    expect(count.body.count).toBeGreaterThanOrEqual(1);

    const readRes = await request(app)
      .post('/api/notifications/read')
      .set('Authorization', `Bearer ${studentToken}`);
    expect(readRes.status).toBe(200);
    expect(readRes.body.unread).toBe(0);

    const countAfter = await request(app)
      .get('/api/notifications/unread-count')
      .set('Authorization', `Bearer ${studentToken}`);
    expect(countAfter.body.count).toBe(0);
  });

  it('قراءة إشعار واحد فقط لا يمس بقية الإشعارات', async () => {
    const adminToken = await getToken('admin@education.tn', 'admin123');
    for (let i = 1; i <= 2; i += 1) {
      await request(app)
        .post('/api/director/announcements')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ title: `إعلان ${i}`, body: `نص الإعلان ${i}`, audience: ['ALL'] });
    }

    const studentToken = await getToken('student@test.tn', 'student123');
    const list = await request(app)
      .get('/api/notifications')
      .set('Authorization', `Bearer ${studentToken}`);
    const firstId = list.body.items[0].id;

    const readOne = await request(app)
      .post(`/api/notifications/${firstId}/read`)
      .set('Authorization', `Bearer ${studentToken}`);
    expect(readOne.status).toBe(200);

    const after = await request(app)
      .get('/api/notifications')
      .set('Authorization', `Bearer ${studentToken}`);
    const marked = after.body.items.find((n) => n.id === firstId);
    expect(marked.read).toBe(true);
    expect(after.body.unread).toBe(1);
  });

  it('تفضيلات القنوات: تفعيل البريد يولّد رسالة بريد (Outbox) عند وصول إشعار', async () => {
    const teacherToken = await getToken('teacher@test.tn', 'teacher123');
    const prefs = await request(app)
      .put('/api/notifications/preferences')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ email: true, push: true, sms: false });
    expect(prefs.status).toBe(200);
    expect(prefs.body.notifyEmail).toBe(true);

    const adminToken = await getToken('admin@education.tn', 'admin123');
    await request(app)
      .post('/api/director/announcements')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: 'إعلان بالبريد',
        body: 'هذا الإعلان يصل أيضا عبر البريد.',
        audience: ['TEACHER'],
        channels: ['EMAIL']
      });

    const teacher = await prisma.user.findUnique({ where: { email: 'teacher@test.tn' } });
    const outbox = await prisma.notificationOutbox.findMany({
      where: { userId: teacher.id, channel: 'EMAIL' }
    });
    expect(outbox.length).toBeGreaterThanOrEqual(1);
    expect(outbox[0].to).toBe('teacher@test.tn');
    expect(outbox[0].status).toBe('SENT');

    const prefs2 = await request(app)
      .get('/api/notifications/preferences')
      .set('Authorization', `Bearer ${teacherToken}`);
    expect(prefs2.body.notifyEmail).toBe(true);
  });

  it('رسالة داخلية تُنشئ إشعارا للمستلم (توافق المسار الحالي)', async () => {
    const parentToken = await getToken('parent@test.tn', 'parent123');
    const teacher = await prisma.user.findUnique({ where: { email: 'teacher@test.tn' } });
    await request(app)
      .post('/api/messages/messages')
      .set('Authorization', `Bearer ${parentToken}`)
      .send({ recipientId: teacher.id, body: 'مرحبا أستاذتي' });

    const teacherToken = await getToken('teacher@test.tn', 'teacher123');
    const list = await request(app)
      .get('/api/notifications')
      .set('Authorization', `Bearer ${teacherToken}`);
    expect(list.body.items.some((n) => n.type === 'MESSAGE')).toBe(true);
  });

  it('الإعلانات تظهر في مركز الرسائل مع تفاصيلها', async () => {
    const adminToken = await getToken('admin@education.tn', 'admin123');
    await request(app)
      .post('/api/director/announcements')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title: 'إعلان مركز الرسائل', body: 'تفاصيل الإعلان.', audience: ['ALL'], link: '/parent' });

    const studentToken = await getToken('student@test.tn', 'student123');
    const res = await request(app)
      .get('/api/notifications/announcements')
      .set('Authorization', `Bearer ${studentToken}`);
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(1);
    expect(res.body[0].schoolAnnouncement.title).toBe('إعلان مركز الرسائل');
    expect(res.body[0].schoolAnnouncement.link).toBe('/parent');
  });

  it('غير المدير لا يمكنه إصدار إعلانات', async () => {
    const teacherToken = await getToken('teacher@test.tn', 'teacher123');
    const res = await request(app)
      .post('/api/director/announcements')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ title: 'محاولة', body: 'غير مسموح' });
    expect(res.status).toBe(403);
  });

  it('حساب عدد المستفيدين من الجمهور', async () => {
    const adminToken = await getToken('admin@education.tn', 'admin123');
    const res = await request(app)
      .get('/api/director/announcements/audience-count?audience=ALL')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.count).toBeGreaterThanOrEqual(6);
  });

  it('مدير المدرسة يرى قائمة الإعلانات الصادرة مع عدد الواصلين', async () => {
    const adminToken = await getToken('admin@education.tn', 'admin123');
    await request(app)
      .post('/api/director/announcements')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title: 'إعلان القائمة', body: 'نص.', audience: ['ALL'] });

    const directorToken = await getToken('director@test.tn', 'director123');
    const res = await request(app)
      .get('/api/director/announcements')
      .set('Authorization', `Bearer ${directorToken}`);
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(1);
    expect(res.body[0]._count.notifications).toBeGreaterThanOrEqual(6);
    expect(res.body[0].creator.firstName).toBeTruthy();
  });
});
