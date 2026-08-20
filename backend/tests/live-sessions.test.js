import { beforeAll, afterAll, beforeEach, describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';
import { resetDatabase, seedTestData } from './helpers.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REC_DIR = path.resolve(__dirname, '..', 'uploads', 'recordings');

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

async function createUser(prisma, { email, firstName, lastName, role }) {
  return prisma.user.create({
    data: {
      firstName,
      lastName,
      email,
      passwordHash: await bcrypt.hash('other123', 4),
      role,
      accountStatus: 'ACTIVE'
    }
  });
}

function iso(hoursFromNow, extraMinutes = 0) {
  return new Date(Date.now() + hoursFromNow * 3600 * 1000 + extraMinutes * 60000).toISOString();
}

function sessionBody(overrides = {}) {
  return {
    title: 'حصة رياضيات حية',
    subject: 'الرياضيات',
    classId: 1,
    startsAt: iso(1),
    endsAt: iso(1, 60),
    ...overrides
  };
}

describe('live sessions (الحصص المباشرة — 5.1)', () => {
  it('يعرض معلومات المزوّد الافتراضي LOCAL', async () => {
    const token = await getToken('teacher@test.tn', 'teacher123');
    const res = await request(app).get('/api/live/config').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.provider).toBe('LOCAL');
    expect(res.body.supportsRecording).toBe(true);
  });

  it('الأستاذ يجدول حصة مباشرة جديدة', async () => {
    const token = await getToken('teacher@test.tn', 'teacher123');
    const res = await request(app)
      .post('/api/teacher/live')
      .set('Authorization', `Bearer ${token}`)
      .send(sessionBody());
    expect(res.status).toBe(201);
    expect(res.body.title).toBe('حصة رياضيات حية');
    expect(res.body.status).toBe('SCHEDULED');
    expect(res.body.roomName).toBeTruthy();
    expect(res.body.maxParticipants).toBe(30);
    expect(res.body.provider).toBe('LOCAL');
  });

  it('يرفض حصة بوقت نهاية قبل البداية', async () => {
    const token = await getToken('teacher@test.tn', 'teacher123');
    const res = await request(app)
      .post('/api/teacher/live')
      .set('Authorization', `Bearer ${token}`)
      .send(sessionBody({ startsAt: iso(1), endsAt: iso(0) }));
    expect(res.status).toBe(400);
  });

  it('يرفض التلميذ جدولة حصة مباشرة', async () => {
    const token = await getToken('student@test.tn', 'student123');
    const res = await request(app)
      .post('/api/student/live')
      .set('Authorization', `Bearer ${token}`)
      .send(sessionBody());
    expect(res.status).toBe(403);
  });

  it('يرفض الأستاذ جدولة حصة لقسم ليس من أقسامه', async () => {
    const prisma = (await import('../src/db.js')).default;
    await createUser(prisma, { email: 'other@test.tn', firstName: 'آخر', lastName: 'معلمة', role: 'TEACHER' });
    const token = await getToken('other@test.tn', 'other123');
    const res = await request(app)
      .post('/api/teacher/live')
      .set('Authorization', `Bearer ${token}`)
      .send(sessionBody());
    expect(res.status).toBe(403);
  });

  it('التلميذ يشاهد حصص قسمه فقط', async () => {
    const prisma = (await import('../src/db.js')).default;
    const teacherToken = await getToken('teacher@test.tn', 'teacher123');
    await request(app)
      .post('/api/teacher/live')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send(sessionBody());

    const otherClass = await prisma.class.create({
      data: { name: 'قسم آخر', level: 'السنة الثانية أساسي', teacherId: 4 }
    });
    await request(app)
      .post('/api/teacher/live')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send(sessionBody({ title: 'حصة سرية', classId: otherClass.id }));

    const studentToken = await getToken('student@test.tn', 'student123');
    const res = await request(app).get('/api/student/live').set('Authorization', `Bearer ${studentToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    const titles = res.body.map((s) => s.title);
    expect(titles).toContain('حصة رياضيات حية');
    expect(titles).not.toContain('حصة سرية');
  });

  it('الأستاذ يبدأ الحصة فتصبح حية مع توكن البث', async () => {
    const token = await getToken('teacher@test.tn', 'teacher123');
    const created = await request(app)
      .post('/api/teacher/live')
      .set('Authorization', `Bearer ${token}`)
      .send(sessionBody());
    const start = await request(app)
      .post(`/api/teacher/live/${created.body.id}/start`)
      .set('Authorization', `Bearer ${token}`);
    expect(start.status).toBe(200);
    expect(start.body.session.status).toBe('LIVE');
    expect(start.body.join.token).toBeTruthy();
    expect(start.body.join.roomName).toBe(created.body.roomName);
    expect(start.body.join.canPublish).toBe(true);
  });

  it('التلميذ ينضم إلى حصة حية لقسمه', async () => {
    const token = await getToken('teacher@test.tn', 'teacher123');
    const created = await request(app)
      .post('/api/teacher/live')
      .set('Authorization', `Bearer ${token}`)
      .send(sessionBody());
    await request(app).post(`/api/teacher/live/${created.body.id}/start`).set('Authorization', `Bearer ${token}`);

    const studentToken = await getToken('student@test.tn', 'student123');
    const join = await request(app)
      .post(`/api/student/live/${created.body.id}/join`)
      .set('Authorization', `Bearer ${studentToken}`);
    expect(join.status).toBe(200);
    expect(join.body.join.roomName).toBe(created.body.roomName);
    expect(join.body.join.canPublish).toBe(false);
  });

  it('الولي ينضم إلى حصة حية لقسم ابنه', async () => {
    const token = await getToken('teacher@test.tn', 'teacher123');
    const created = await request(app)
      .post('/api/teacher/live')
      .set('Authorization', `Bearer ${token}`)
      .send(sessionBody());
    await request(app).post(`/api/teacher/live/${created.body.id}/start`).set('Authorization', `Bearer ${token}`);

    const parentToken = await getToken('parent@test.tn', 'parent123');
    const join = await request(app)
      .post(`/api/parent/live/${created.body.id}/join`)
      .set('Authorization', `Bearer ${parentToken}`);
    expect(join.status).toBe(200);
    expect(join.body.join.roomName).toBe(created.body.roomName);
  });

  it('يرفض انضمام التلميذ إلى حصة لم تبدأ بعد', async () => {
    const token = await getToken('teacher@test.tn', 'teacher123');
    const created = await request(app)
      .post('/api/teacher/live')
      .set('Authorization', `Bearer ${token}`)
      .send(sessionBody());
    const studentToken = await getToken('student@test.tn', 'student123');
    const join = await request(app)
      .post(`/api/student/live/${created.body.id}/join`)
      .set('Authorization', `Bearer ${studentToken}`);
    expect(join.status).toBe(403);
  });

  it('الأستاذ ينهي الحصة فيُنشأ التسجيل تلقائيا ويصبح متاحا', async () => {
    const token = await getToken('teacher@test.tn', 'teacher123');
    const created = await request(app)
      .post('/api/teacher/live')
      .set('Authorization', `Bearer ${token}`)
      .send(sessionBody());
    await request(app).post(`/api/teacher/live/${created.body.id}/start`).set('Authorization', `Bearer ${token}`);

    const end = await request(app)
      .post(`/api/teacher/live/${created.body.id}/end`)
      .set('Authorization', `Bearer ${token}`);
    expect(end.status).toBe(200);
    expect(end.body.session.status).toBe('ENDED');
    expect(end.body.recording).toBeTruthy();
    expect(end.body.recording.status).toBe('AVAILABLE');
    expect(end.body.recording.fileUrl).toMatch(/^\/uploads\/recordings\/.+\.wav$/);

    const filePath = path.join(REC_DIR, path.basename(end.body.recording.fileUrl));
    expect(fs.existsSync(filePath)).toBe(true);
  });

  it('التلميذ يرى تسجيلات حصص قسمه', async () => {
    const token = await getToken('teacher@test.tn', 'teacher123');
    const created = await request(app)
      .post('/api/teacher/live')
      .set('Authorization', `Bearer ${token}`)
      .send(sessionBody());
    await request(app).post(`/api/teacher/live/${created.body.id}/start`).set('Authorization', `Bearer ${token}`);
    await request(app).post(`/api/teacher/live/${created.body.id}/end`).set('Authorization', `Bearer ${token}`);

    const studentToken = await getToken('student@test.tn', 'student123');
    const res = await request(app).get('/api/student/live/recordings').set('Authorization', `Bearer ${studentToken}`);
    expect(res.status).toBe(200);
    expect(res.body.some((r) => r.sessionId === created.body.id && r.status === 'AVAILABLE')).toBe(true);
  });

  it('الأستاذ يعدّل حصة مجدولة', async () => {
    const token = await getToken('teacher@test.tn', 'teacher123');
    const created = await request(app)
      .post('/api/teacher/live')
      .set('Authorization', `Bearer ${token}`)
      .send(sessionBody());
    const upd = await request(app)
      .put(`/api/teacher/live/${created.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'حصة معدلة' });
    expect(upd.status).toBe(200);
    expect(upd.body.title).toBe('حصة معدلة');
  });

  it('الأستاذ يلغي حصة مجدولة', async () => {
    const token = await getToken('teacher@test.tn', 'teacher123');
    const created = await request(app)
      .post('/api/teacher/live')
      .set('Authorization', `Bearer ${token}`)
      .send(sessionBody());
    const cancel = await request(app)
      .post(`/api/teacher/live/${created.body.id}/cancel`)
      .set('Authorization', `Bearer ${token}`);
    expect(cancel.status).toBe(200);
    expect(cancel.body.status).toBe('CANCELLED');
  });

  it('يمنع وليا لا يملك ابنا في القسم من الدخول', async () => {
    const prisma = (await import('../src/db.js')).default;
    const token = await getToken('teacher@test.tn', 'teacher123');
    const created = await request(app)
      .post('/api/teacher/live')
      .set('Authorization', `Bearer ${token}`)
      .send(sessionBody());
    await request(app).post(`/api/teacher/live/${created.body.id}/start`).set('Authorization', `Bearer ${token}`);

    await createUser(prisma, { email: 'parent2@test.tn', firstName: 'ولي', lastName: 'غريب', role: 'PARENT' });
    const parentToken = await getToken('parent2@test.tn', 'other123');
    const join = await request(app)
      .post(`/api/parent/live/${created.body.id}/join`)
      .set('Authorization', `Bearer ${parentToken}`);
    expect(join.status).toBe(403);
  });

  it('يمنع أستاذا آخر من إنهاء حصة غيره', async () => {
    const prisma = (await import('../src/db.js')).default;
    const token = await getToken('teacher@test.tn', 'teacher123');
    const created = await request(app)
      .post('/api/teacher/live')
      .set('Authorization', `Bearer ${token}`)
      .send(sessionBody());
    await request(app).post(`/api/teacher/live/${created.body.id}/start`).set('Authorization', `Bearer ${token}`);

    await createUser(prisma, { email: 'other@test.tn', firstName: 'آخر', lastName: 'معلمة', role: 'TEACHER' });
    const otherToken = await getToken('other@test.tn', 'other123');
    const end = await request(app)
      .post(`/api/teacher/live/${created.body.id}/end`)
      .set('Authorization', `Bearer ${otherToken}`);
    expect(end.status).toBe(403);
  });

  it('لا يمكن الانضمام إلى حصة انتهت أو أُلغيت (حتى من الأستاذ)', async () => {
    const token = await getToken('teacher@test.tn', 'teacher123');
    const created = await request(app)
      .post('/api/teacher/live')
      .set('Authorization', `Bearer ${token}`)
      .send(sessionBody());
    await request(app).post(`/api/teacher/live/${created.body.id}/start`).set('Authorization', `Bearer ${token}`);
    await request(app).post(`/api/teacher/live/${created.body.id}/end`).set('Authorization', `Bearer ${token}`);

    const teacherJoin = await request(app)
      .post(`/api/teacher/live/${created.body.id}/join`)
      .set('Authorization', `Bearer ${token}`);
    expect(teacherJoin.status).toBe(400);

    const studentToken = await getToken('student@test.tn', 'student123');
    const studentJoin = await request(app)
      .post(`/api/student/live/${created.body.id}/join`)
      .set('Authorization', `Bearer ${studentToken}`);
    expect(studentJoin.status).toBe(400);
  });

  it('لا يمكن إلغاء حصة جارية (LIVE)', async () => {
    const token = await getToken('teacher@test.tn', 'teacher123');
    const created = await request(app)
      .post('/api/teacher/live')
      .set('Authorization', `Bearer ${token}`)
      .send(sessionBody());
    await request(app).post(`/api/teacher/live/${created.body.id}/start`).set('Authorization', `Bearer ${token}`);

    const cancel = await request(app)
      .post(`/api/teacher/live/${created.body.id}/cancel`)
      .set('Authorization', `Bearer ${token}`);
    expect(cancel.status).toBe(400);
  });

  it('ينضم التلميذ تلقائيا لحصة صار وقتها رغم بقائها مجدولة في القاعدة', async () => {
    const prisma = (await import('../src/db.js')).default;
    const token = await getToken('teacher@test.tn', 'teacher123');
    const created = await request(app)
      .post('/api/teacher/live')
      .set('Authorization', `Bearer ${token}`)
      .send(sessionBody());

    await prisma.liveSession.update({
      where: { id: created.body.id },
      data: { startsAt: new Date(Date.now() - 60 * 60000), endsAt: new Date(Date.now() + 60 * 60000) }
    });

    const studentToken = await getToken('student@test.tn', 'student123');
    const join = await request(app)
      .post(`/api/student/live/${created.body.id}/join`)
      .set('Authorization', `Bearer ${studentToken}`);
    expect(join.status).toBe(200);
    expect(join.body.session.status).toBe('LIVE');
    expect(join.body.join.canPublish).toBe(false);
  });

  it('تحميل تسجيل ملف مفقود يعيد 404 بدل 500', async () => {
    const prisma = (await import('../src/db.js')).default;
    const token = await getToken('teacher@test.tn', 'teacher123');
    const created = await request(app)
      .post('/api/teacher/live')
      .set('Authorization', `Bearer ${token}`)
      .send(sessionBody());
    await request(app).post(`/api/teacher/live/${created.body.id}/start`).set('Authorization', `Bearer ${token}`);
    await request(app).post(`/api/teacher/live/${created.body.id}/end`).set('Authorization', `Bearer ${token}`);

    await prisma.liveRecording.updateMany({
      where: { sessionId: created.body.id },
      data: { fileUrl: '/uploads/recordings/does-not-exist.wav' }
    });

    const res = await request(app)
      .get(`/api/teacher/live/${created.body.id}/recording`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
  });
});
