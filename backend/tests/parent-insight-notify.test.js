import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { resetDatabase, seedTestData, login } from './helpers.js';
import request from 'supertest';
import prisma from '../src/db.js';

let app;
let adminToken;
let teacherToken;

async function createData({ grades = [], attendances = [], lessons = 0 }) {
  const klass = await prisma.class.findFirst();
  const teacher = await prisma.user.findFirst({ where: { role: 'TEACHER' } });
  const student = await prisma.student.findFirst();
  const accountId = student.accountUserId;

  await prisma.attendanceRecord.deleteMany({ where: { studentId: accountId } });
  await prisma.assignmentSubmission.deleteMany({ where: { studentId: accountId } });
  await prisma.assignment.deleteMany({ where: { classId: klass.id } });
  await prisma.lessonProgress.deleteMany({ where: { userId: accountId } });

  const assignments = [];
  for (let i = 0; i < grades.length; i += 1) {
    const a = await prisma.assignment.create({
      data: {
        teacherId: teacher.id,
        classId: klass.id,
        subject: grades[i].subject,
        title: `واجب ${i + 1}`,
        questions: [],
        status: 'PUBLISHED'
      }
    });
    assignments.push(a);
    if (grades[i].submit) {
      await prisma.assignmentSubmission.create({
        data: {
          assignmentId: a.id,
          studentId: accountId,
          answers: {},
          score: grades[i].score,
          totalPoints: grades[i].totalPoints,
          status: 'GRADED'
        }
      });
    }
  }

  for (const att of attendances) {
    await prisma.attendanceRecord.create({
      data: {
        classId: klass.id,
        studentId: accountId,
        date: att.date,
        present: att.present,
        recordedBy: teacher.id
      }
    });
  }

  for (let i = 0; i < lessons; i += 1) {
    await prisma.lessonProgress.create({
      data: {
        userId: accountId,
        gradeId: 'year1',
        subjectId: 'math',
        lessonId: `math${i + 1}`,
        lessonTitle: `درس ${i + 1}`
      }
    });
  }

  return { klass, teacher, student, accountId, assignments };
}

async function countAlerts(studentId) {
  return prisma.notification.count({
    where: { type: 'PARENT_RISK_ALERT', metadata: { path: ['studentId'], equals: String(studentId) } }
  });
}

beforeAll(async () => {
  ({ app } = await import('../src/index.js'));
  await resetDatabase();
  await seedTestData();

  const ares = await login('admin@education.tn', 'admin123');
  adminToken = ares.body.token;
  const tres = await login('teacher@test.tn', 'teacher123');
  teacherToken = tres.body.token;
});

afterAll(async () => {
  await prisma.notification.deleteMany({});
});

describe('المرحلة 7.3 — إشعارات استباقية للولي عند ارتفاع خطر التعثر', () => {
  it('مسح يدوي يتطلب دور المسؤول (403 للأستاذ)', async () => {
    const res = await request(app)
      .post('/api/admin/insights/sweep')
      .set('Authorization', `Bearer ${teacherToken}`);
    expect(res.status).toBe(403);
  });

  it('يتطلب مصادقة (401 بدون توكن)', async () => {
    const res = await request(app).post('/api/admin/insights/sweep');
    expect(res.status).toBe(401);
  });

  it('لا يرسل إشعاراً عندما يكون الخطر منخفضاً', async () => {
    await createData({
      grades: [
        { subject: 'MATH', submit: true, score: 9, totalPoints: 10 },
        { subject: 'READING', submit: true, score: 8, totalPoints: 10 }
      ],
      attendances: [{ date: new Date(), present: true }],
      lessons: 3
    });
    const student = await prisma.student.findFirst();

    const res = await request(app)
      .post('/api/admin/insights/sweep')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.checked).toBeGreaterThanOrEqual(1);
    expect(res.body.alerted).toHaveLength(0);
    expect(await countAlerts(student.id)).toBe(0);
  });

  it('يرسل إشعاراً للولي عند خطر مرتفع (HIGH) مع رابط لصفحة الرؤى', async () => {
    const today = new Date();
    const days = Array.from({ length: 10 }, (_, i) => new Date(today.getTime() - i * 86400000));
    await createData({
      grades: [
        { subject: 'MATH', submit: true, score: 4, totalPoints: 10 },
        { subject: 'READING', submit: false }
      ],
      attendances: [
        { date: days[0], present: false },
        { date: days[1], present: false },
        { date: days[2], present: false },
        ...days.slice(3).map((d) => ({ date: d, present: true }))
      ],
      lessons: 0
    });

    const student = await prisma.student.findFirst();
    const res = await request(app)
      .post('/api/admin/insights/sweep')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    const alerted = res.body.alerted.find((a) => String(a.studentId) === String(student.id));
    expect(alerted).toBeTruthy();
    expect(alerted.riskLevel).toBe('HIGH');

    const notif = await prisma.notification.findFirst({
      where: { type: 'PARENT_RISK_ALERT', metadata: { path: ['studentId'], equals: String(student.id) } },
      orderBy: { createdAt: 'desc' }
    });
    expect(notif).toBeTruthy();
    expect(notif.userId).toBe(student.userId);
    expect(notif.title).toContain(student.firstName);
    expect(notif.link).toBe('/parent/insights');
    expect(notif.metadata.riskLevel).toBe('HIGH');
  });

  it('لا يكرر الإشعار لنفس مستوى الخطر ضمن المهلة (cooldown)', async () => {
    const student = await prisma.student.findFirst();
    const before = await countAlerts(student.id);

    const res = await request(app)
      .post('/api/admin/insights/sweep')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(await countAlerts(student.id)).toBe(before);
  });

  it('يرسل إشعاراً جديداً عند تصعيد الخطر إلى CRITICAL رغم cooldown', async () => {
    const today = new Date();
    const days = Array.from({ length: 6 }, (_, i) => new Date(today.getTime() - i * 86400000));
    await createData({
      grades: [{ subject: 'MATH', submit: true, score: 1, totalPoints: 10 }],
      attendances: days.map((d) => ({ date: d, present: false })),
      lessons: 0
    });

    const student = await prisma.student.findFirst();
    const before = await countAlerts(student.id);

    const res = await request(app)
      .post('/api/admin/insights/sweep')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    const alerted = res.body.alerted.find((a) => String(a.studentId) === String(student.id));
    expect(alerted).toBeTruthy();
    expect(alerted.riskLevel).toBe('CRITICAL');
    expect(await countAlerts(student.id)).toBe(before + 1);
  });
});
