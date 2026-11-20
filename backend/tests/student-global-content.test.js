import { beforeAll, afterAll, beforeEach, describe, it, expect } from 'vitest';
import { resetDatabase, seedTestData } from './helpers.js';

let request;
let app;
let prisma;

beforeAll(async () => {
  const { default: supertest } = await import('supertest');
  request = supertest;
  app = (await import('../src/index.js')).app;
  prisma = (await import('../src/db.js')).default;
});

afterAll(async () => {
  await prisma.$disconnect();
});

beforeEach(async () => {
  await resetDatabase();
  await seedTestData();
});

async function login(email, password) {
  const res = await request(app).post('/api/auth/login').send({ email, password });
  expect(res.status).toBe(200);
  return res.body.token;
}

async function makeNoClassStudent() {
  const user = await prisma.user.create({
    data: {
      firstName: 'بلا',
      lastName: 'قسم',
      email: 'noclass@test.tn',
      passwordHash: (await import('bcryptjs')).default.hashSync('noclass123', 4),
      role: 'STUDENT',
      accountStatus: 'ACTIVE'
    }
  });
  await prisma.student.create({
    data: {
      userId: user.id,
      accountUserId: user.id,
      firstName: 'بلا',
      lastName: 'قسم',
      birthDate: new Date('2019-01-01'),
      level: 'السنة الأولى أساسي',
      schoolYear: '2026-2027'
    }
  });
  return login('noclass@test.tn', 'noclass123');
}

const auth = (token) => ({ Authorization: `Bearer ${token}` });

describe('وصول التلميذ إلى محتوى «الكل» (classId = null)', () => {
  it('اختبار «الكل» يظهر لتلميذ مسند إلى قسم ويمكن فتحه', async () => {
    const teacher = await prisma.user.findUnique({ where: { email: 'teacher@test.tn' } });
    const quiz = await prisma.quiz.create({
      data: { teacherId: teacher.id, title: 'اختبار عام', subject: 'MATH', questions: [] }
    });
    const token = await login('student@test.tn', 'student123');

    const list = await request(app).get('/api/teacher/student/quizzes').set(auth(token));
    expect(list.status).toBe(200);
    expect(list.body.some((q) => q.id === quiz.id)).toBe(true);

    const detail = await request(app).get(`/api/teacher/student/quizzes/${quiz.id}`).set(auth(token));
    expect(detail.status).toBe(200);
    expect(detail.body.id).toBe(quiz.id);
  });

  it('اختبار «الكل» يظهر لتلميذ بلا قسم، بينما اختبار قسم محدد لا يظهر له', async () => {
    const teacher = await prisma.user.findUnique({ where: { email: 'teacher@test.tn' } });
    const klass = await prisma.class.findFirst();
    const globalQuiz = await prisma.quiz.create({
      data: { teacherId: teacher.id, title: 'عام', subject: 'MATH', questions: [] }
    });
    const classQuiz = await prisma.quiz.create({
      data: { teacherId: teacher.id, classId: klass.id, title: 'خاص بالقسم', subject: 'MATH', questions: [] }
    });
    const token = await makeNoClassStudent();

    const list = await request(app).get('/api/teacher/student/quizzes').set(auth(token));
    expect(list.status).toBe(200);
    expect(list.body.some((q) => q.id === globalQuiz.id)).toBe(true);
    expect(list.body.some((q) => q.id === classQuiz.id)).toBe(false);
  });

  it('امتحان رسمي منشور بـ «الكل» يظهر، وغير المنشور يبقى مخفيًا', async () => {
    const teacher = await prisma.user.findUnique({ where: { email: 'teacher@test.tn' } });
    const published = await prisma.officialExam.create({
      data: { teacherId: teacher.id, title: 'امتحان عام', subject: 'MATH', content: { totalPoints: 20, questions: [] }, published: true }
    });
    const hidden = await prisma.officialExam.create({
      data: { teacherId: teacher.id, title: 'مسودة عامة', subject: 'MATH', content: { totalPoints: 20, questions: [] }, published: false }
    });
    const token = await login('student@test.tn', 'student123');

    const list = await request(app).get('/api/teacher/student/official-exams').set(auth(token));
    expect(list.status).toBe(200);
    expect(list.body.some((e) => e.id === published.id)).toBe(true);
    expect(list.body.some((e) => e.id === hidden.id)).toBe(false);
  });

  it('امتحان قسم آخر لا يظهر لتلميذ حتى بعد إصلاح «الكل» (لا تسريب)', async () => {
    const teacher = await prisma.user.findUnique({ where: { email: 'teacher@test.tn' } });
    const otherSchool = await prisma.school.create({ data: { name: 'مدرسة أخرى', code: 'OTHER-SCHOOL' } });
    const otherClass = await prisma.class.create({
      data: { name: 'قسم آخر', level: 'السنة الأولى أساسي', schoolId: otherSchool.id, teacherId: teacher.id }
    });
    const otherExam = await prisma.officialExam.create({
      data: { teacherId: teacher.id, classId: otherClass.id, title: 'امتحان آخر', subject: 'MATH',
              content: { totalPoints: 20, questions: [] }, published: true }
    });
    const token = await login('student@test.tn', 'student123');
    const list = await request(app).get('/api/teacher/student/official-exams').set(auth(token));
    expect(list.body.some((e) => e.id === otherExam.id)).toBe(false);
  });

  it('تكليف «الكل» يظهر ويفتح لتلميذ مسند، وتكليف قسم آخر مرفوض', async () => {
    const teacher = await prisma.user.findUnique({ where: { email: 'teacher@test.tn' } });
    const general = await prisma.assignment.create({
      data: { teacherId: teacher.id, title: 'واجب عام', subject: 'MATH', questions: [], status: 'PUBLISHED' }
    });
    const otherSchool = await prisma.school.create({ data: { name: 'مدرسة ثانية', code: 'SECOND-SCHOOL' } });
    const otherClass = await prisma.class.create({
      data: { name: 'قسم ثانٍ', level: 'السنة الأولى أساسي', schoolId: otherSchool.id, teacherId: teacher.id }
    });
    const foreign = await prisma.assignment.create({
      data: { teacherId: teacher.id, classId: otherClass.id, title: 'واجب غريب', subject: 'MATH', questions: [], status: 'PUBLISHED' }
    });
    const token = await login('student@test.tn', 'student123');

    const list = await request(app).get('/api/teacher/student/assignments').set(auth(token));
    expect(list.body.some((a) => a.id === general.id)).toBe(true);
    expect(list.body.some((a) => a.id === foreign.id)).toBe(false);

    const openGeneral = await request(app).get(`/api/teacher/student/assignments/${general.id}`).set(auth(token));
    expect(openGeneral.status).toBe(200);
    const openForeign = await request(app).get(`/api/teacher/student/assignments/${foreign.id}`).set(auth(token));
    expect(openForeign.status).toBe(400);
  });

  it('تكليف «الكل» يظهر لتلميذ بلا قسم أيضاً', async () => {
    const teacher = await prisma.user.findUnique({ where: { email: 'teacher@test.tn' } });
    const klass = await prisma.class.findFirst();
    const general = await prisma.assignment.create({
      data: { teacherId: teacher.id, title: 'واجب عام 2', subject: 'MATH', questions: [], status: 'PUBLISHED' }
    });
    const specific = await prisma.assignment.create({
      data: { teacherId: teacher.id, classId: klass.id, title: 'واجب قسم', subject: 'MATH', questions: [], status: 'PUBLISHED' }
    });
    const token = await makeNoClassStudent();
    const list = await request(app).get('/api/teacher/student/assignments').set(auth(token));
    expect(list.body.some((a) => a.id === general.id)).toBe(true);
    expect(list.body.some((a) => a.id === specific.id)).toBe(false);
  });
});
