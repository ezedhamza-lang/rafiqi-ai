import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { resetDatabase, seedTestData, login } from './helpers.js';
import request from 'supertest';
import prisma from '../src/db.js';
import bcrypt from 'bcryptjs';
import {
  saveAiKey,
  __setCallProvider,
  __resetCallProvider,
  hasAiKey
} from '../src/services/aiService.js';

let app;
let parentToken;
let studentToken;
let teacherToken;

const fakeProvider = async (prompt) => {
  if (prompt.includes('اقترح أنشطة عملية للولي')) {
    return JSON.stringify([
      { title: 'مراجعة الرياضيات', detail: 'خصص 15 دقيقة يومياً للتمارين' },
      { title: 'إنجاز التكليفات', detail: 'ساعد ابنك في إنجاز التكليفات المتبقية' }
    ]);
  }
  if (prompt.includes('اكتب ملخصاً')) {
    return 'ابنك يحتاج إلى دعم في الرياضيات ومتابعة انتظام الحضور، مع التركيز على إنجاز التكليفات المتبقية.';
  }
  return 'رد افتراضي.';
};

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

beforeAll(async () => {
  ({ app } = await import('../src/index.js'));
  await resetDatabase();
  await seedTestData();

  const pres = await login('parent@test.tn', 'parent123');
  parentToken = pres.body.token;
  const sres = await login('student@test.tn', 'student123');
  studentToken = sres.body.token;
  const tres = await login('teacher@test.tn', 'teacher123');
  teacherToken = tres.body.token;
});

afterAll(() => {
  __resetCallProvider();
});

describe('المرحلة 7.3 — رؤى الولي الذكية (توقع التعثر + ملخص + أنشطة)', () => {
  it('يتطلب دور ولي أو أستاذ (403 للتلميذ) — والأستاذ غير المربوط بأبنائه 404', async () => {
    const student = await prisma.student.findFirst();
    const res = await request(app)
      .get(`/api/parent/insights/children/${student.accountUserId}`)
      .set('Authorization', `Bearer ${studentToken}`);
    expect(res.status).toBe(403);

    // دعم الدورين: الأستاذ لم يُعدَّم على الدور (البوابة تقبل PARENT وTEACHER)،
    // لكن الملكية ما زالت تمنع الاطلاع: ابن غير مرتبط به ⇒ 404 لا بيانات.
    const res2 = await request(app)
      .get(`/api/parent/insights/children/${student.accountUserId}`)
      .set('Authorization', `Bearer ${teacherToken}`);
    expect(res2.status).toBe(404);
  });

  it('حساب دورين: أستاذ له ابن مرتبط يرى رؤى ابنه وتقدمه وبطاقة دخوله', async () => {
    const teacher = await prisma.user.findFirst({ where: { role: 'TEACHER' } });
    const student = await prisma.student.findFirst();
    const savedUserId = student.userId;
    await prisma.student.update({ where: { id: student.id }, data: { userId: teacher.id } });
    try {
      const insights = await request(app)
        .get(`/api/parent/insights/children/${student.accountUserId}`)
        .set('Authorization', `Bearer ${teacherToken}`);
      expect(insights.status).toBe(200);
      expect(insights.body.child.firstName).toBeTruthy();

      const progress = await request(app)
        .get('/api/parent/children/progress')
        .set('Authorization', `Bearer ${teacherToken}`);
      expect(progress.status).toBe(200);
      expect(Array.isArray(progress.body)).toBe(true);
      expect(progress.body.length).toBeGreaterThan(0);

      const credentials = await request(app)
        .get('/api/parent/children/credentials')
        .set('Authorization', `Bearer ${teacherToken}`);
      expect(credentials.status).toBe(200);
      expect(Array.isArray(credentials.body)).toBe(true);
    } finally {
      await prisma.student.update({ where: { id: student.id }, data: { userId: savedUserId } });
    }
  });

  it('يتطلب مصادقة (401 بدون توكن)', async () => {
    const student = await prisma.student.findFirst();
    const res = await request(app).get(`/api/parent/insights/children/${student.accountUserId}`);
    expect(res.status).toBe(401);
  });

  it('يمنع الاطلاع على ابنٍ ليس من أبنائه (404)', async () => {
    const hash = bcrypt.hashSync('other123', 4);
    const otherParent = await prisma.user.create({
      data: { firstName: 'آخر', lastName: 'ولي', email: 'parent2@test.tn', passwordHash: hash, role: 'PARENT', accountStatus: 'ACTIVE' }
    });
    const otherAccount = await prisma.user.create({
      data: { firstName: 'أخ', lastName: 'التلميذ', email: 'other.student@test.tn', passwordHash: hash, role: 'STUDENT', accountStatus: 'ACTIVE' }
    });
    await prisma.student.create({
      data: {
        userId: otherParent.id,
        accountUserId: otherAccount.id,
        firstName: 'أخ',
        lastName: 'التلميذ',
        birthDate: new Date('2019-01-01'),
        level: 'السنة الأولى أساسي'
      }
    });

    const res = await request(app)
      .get(`/api/parent/insights/children/${otherAccount.id}`)
      .set('Authorization', `Bearer ${parentToken}`);
    expect(res.status).toBe(404);
  });

  it('يعيد رؤية كاملة لابن الولي (توقع + ملخص + أنشطة + بيانات)', async () => {
    await createData({});

    const student = await prisma.student.findFirst();
    const res = await request(app)
      .get(`/api/parent/insights/children/${student.accountUserId}`)
      .set('Authorization', `Bearer ${parentToken}`);
    expect(res.status).toBe(200);
    expect(res.body.child.firstName).toBeTruthy();
    expect(res.body.prediction).toBeTruthy();
    expect(res.body.prediction.riskScore).toBeGreaterThanOrEqual(0);
    expect(res.body.prediction.riskScore).toBeLessThanOrEqual(100);
    expect(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).toContain(res.body.prediction.riskLevel);
    expect(typeof res.body.summary).toBe('string');
    expect(res.body.summary.length).toBeGreaterThan(10);
    expect(Array.isArray(res.body.activities)).toBe(true);
    expect(Array.isArray(res.body.data.subjects)).toBe(true);
    expect(res.body.aiConfigured).toBe(false);
  });

  it('يكتشف خطر تعثر مرتفع من أداء منخفض وغياب وإنجاز ضعيف', async () => {
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
      .get(`/api/parent/insights/children/${student.accountUserId}`)
      .set('Authorization', `Bearer ${parentToken}`);
    expect(res.status).toBe(200);
    expect(res.body.prediction.riskScore).toBeGreaterThanOrEqual(55);
    expect(res.body.prediction.riskLevel).toBe('HIGH');
    const keys = res.body.prediction.reasons.map((r) => r.key);
    expect(keys).toContain('LOW_PERFORMANCE');
    expect(keys).toContain('ABSENTEEISM');
    expect(res.body.data.attendance.absent).toBe(3);
    expect(res.body.activities.some((a) => a.key === 'TEACHER_CONTACT')).toBe(true);
  });

  it('تلميذ نشيط بأداء جيد يبقى في مستوى مستقر (LOW)', async () => {
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
      .get(`/api/parent/insights/children/${student.accountUserId}`)
      .set('Authorization', `Bearer ${parentToken}`);
    expect(res.status).toBe(200);
    expect(res.body.prediction.riskLevel).toBe('LOW');
    expect(res.body.prediction.riskScore).toBeLessThan(30);
    expect(res.body.prediction.reasons.length).toBe(0);
  });

  it('التوليد بالذكاء الاصطناعي بلا مفتاح يعود للملخص الحتمي (ai:false)', async () => {
    await createData({
      grades: [{ subject: 'MATH', submit: true, score: 5, totalPoints: 10 }]
    });
    await prisma.aiKey.deleteMany({});

    const student = await prisma.student.findFirst();
    const res = await request(app)
      .post(`/api/parent/insights/children/${student.accountUserId}/generate`)
      .set('Authorization', `Bearer ${parentToken}`);
    expect(res.status).toBe(200);
    expect(res.body.ai).toBe(false);
    expect(typeof res.body.summary).toBe('string');
    expect(Array.isArray(res.body.activities)).toBe(true);
    expect(res.body.activities.length).toBeGreaterThan(0);
  });

  it('التوليد بمفتاح مهيأ يعيد ملخصاً وأنشطة من مزود AI (ai:true)', async () => {
    await createData({
      grades: [{ subject: 'MATH', submit: true, score: 5, totalPoints: 10 }]
    });
    const teacher = await prisma.user.findFirst({ where: { role: 'TEACHER' } });
    await saveAiKey(teacher.id, 'fake-gemini-key');
    __setCallProvider(fakeProvider);

    const student = await prisma.student.findFirst();
    const res = await request(app)
      .post(`/api/parent/insights/children/${student.accountUserId}/generate`)
      .set('Authorization', `Bearer ${parentToken}`);
    expect(res.status).toBe(200);
    expect(res.body.ai).toBe(true);
    expect(res.body.summary).toContain('الرياضيات');
    expect(Array.isArray(res.body.activities)).toBe(true);
    expect(res.body.activities.length).toBeGreaterThanOrEqual(2);

    const keyRow = await hasAiKey(teacher.id);
    expect(keyRow).toBeTruthy();
  });
});
