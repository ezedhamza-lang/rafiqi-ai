import { beforeAll, afterAll, beforeEach, describe, it, expect } from 'vitest';
import { resetDatabase, seedTestData } from './helpers.js';

let request;
let app;
let prisma;

// «نتائج التلاميذ» و«المعدلات» كانتا تقرآن الاختبارات السريعة فقط ⇒ كل ما صحّحه
// المعلّم من امتحانات رسمية وواجبات كان مخفيًا (يظهر «لا توجد نتائج»).
describe('نتائج ومعدلات المعلّم تشمل الامتحانات الرسمية والواجبات', () => {
  let teacherToken;
  let klass;
  let studentAccount;
  let teacher;

  const login = async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'teacher@test.tn', password: 'teacher123' });
    expect(res.status).toBe(200);
    return res.body.token;
  };

  beforeAll(async () => {
    const { default: supertest } = await import('supertest');
    request = supertest;
    const mod = await import('../src/index.js');
    app = mod.app;
    prisma = (await import('../src/db.js')).default;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await resetDatabase();
    await seedTestData();
    teacherToken = await login();
    klass = await prisma.class.findFirst();
    studentAccount = await prisma.user.findUnique({ where: { email: 'student@test.tn' } });
    teacher = await prisma.user.findUnique({ where: { email: 'teacher@test.tn' } });
  });

  async function seedData() {
    const exam = await prisma.officialExam.create({
      data: {
        teacherId: teacher.id,
        classId: klass.id,
        title: 'امتحان النتائج',
        subject: 'math',
        published: true,
        content: { totalPoints: 20, criteria: [], questions: [] }
      }
    });
    await prisma.officialSubmission.create({
      data: { examId: exam.id, studentId: studentAccount.id, answers: { q1: '7' }, score: 15, status: 'CORRECTED' }
    });
    const assignment = await prisma.assignment.create({
      data: {
        teacherId: teacher.id,
        classId: klass.id,
        title: 'واجب النتائج',
        subject: 'MATH',
        status: 'PUBLISHED',
        questions: []
      }
    });
    await prisma.assignmentSubmission.create({
      data: {
        assignmentId: assignment.id,
        studentId: studentAccount.id,
        answers: { q1: ['1'] },
        score: 1,
        totalPoints: 1,
        status: 'GRADED'
      }
    });
    return { exam, assignment };
  }

  it('يعرض نتائج التلميذ من الامتحان الرسمي والواجب مع تفصيل المصادر', async () => {
    await seedData();
    const res = await request(app)
      .get('/api/teacher/results')
      .set('Authorization', `Bearer ${teacherToken}`);
    expect(res.status).toBe(200);
    const row = res.body.find((r) => r.student.firstName === 'أحمد');
    expect(row).toBeTruthy();
    const kinds = row.attempts.map((a) => a.kind).sort();
    expect(kinds).toEqual(['assignment', 'exam']);
    const examAttempt = row.attempts.find((a) => a.kind === 'exam');
    expect(examAttempt.title).toBe('امتحان النتائج');
    expect(examAttempt.max).toBe(20);
    expect(examAttempt.percent).toBe(75);
    expect(examAttempt.pendingManualGrading).toBe(false);
    const hwAttempt = row.attempts.find((a) => a.kind === 'assignment');
    expect(hwAttempt.percent).toBe(100);
    expect(row.breakdown.exams).toBe(1);
    expect(row.breakdown.assignments).toBe(1);
    expect(row.avgPercent).toBe(88);
  });

  it('يحسب معدل الامتحان الرسمي والواجب في صفحة المعدلات', async () => {
    await seedData();
    const res = await request(app)
      .get('/api/teacher/averages')
      .set('Authorization', `Bearer ${teacherToken}`);
    expect(res.status).toBe(200);
    const examRow = res.body.find((r) => r.kind === 'exam' && r.title === 'امتحان النتائج');
    expect(examRow).toBeTruthy();
    expect(examRow.attempts).toBe(1);
    expect(examRow.avgPercent).toBe(75);
    const hwRow = res.body.find((r) => r.kind === 'assignment' && r.title === 'واجب النتائج');
    expect(hwRow).toBeTruthy();
    expect(hwRow.avgPercent).toBe(100);
  });

  it('يعلّم التسليم الذي ما زال بانتظار تصحيح يدوي', async () => {
    await seedData();
    await prisma.officialSubmission.updateMany({ where: { status: 'CORRECTED' }, data: { status: 'IN_REVIEW' } });
    const res = await request(app)
      .get('/api/teacher/results')
      .set('Authorization', `Bearer ${teacherToken}`);
    const row = res.body.find((r) => r.student.firstName === 'أحمد');
    const examAttempt = row.attempts.find((a) => a.kind === 'exam');
    expect(examAttempt.pendingManualGrading).toBe(true);
    expect(row.pendingManual).toBe(1);
  });
});