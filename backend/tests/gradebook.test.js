import { describe, it, expect, beforeAll } from 'vitest';
import { resetDatabase, seedTestData, login } from './helpers.js';
import request from 'supertest';
import prisma from '../src/db.js';

// ISS-009: /api/teacher/gradebook matched Submission.studentId (a User.id foreign
// key) against Student.id, so no cell ever matched and the gradebook was empty for
// every class. The second guard pins column alignment: `grades` must stay the same
// length as `items` with nulls in the gaps, otherwise a missing grade shifts every
// later grade into the wrong column in the table and in the CSV export.
let app;
let teacherToken;
let otherTeacherToken;
let klass;
let studentAccountId;
let otherStudentAccountId;

beforeAll(async () => {
  ({ app } = await import('../src/index.js'));
  await resetDatabase();
  const seeded = await seedTestData();
  klass = seeded.klass;
  studentAccountId = seeded.users.student.id;
  teacherToken = (await login('teacher@test.tn', 'teacher123')).body.token;

  const bcrypt = (await import('bcryptjs')).default;
  const t2 = await prisma.user.create({
    data: {
      firstName: 'سامي',
      lastName: 'الأستاذ',
      email: 'teacher2@test.tn',
      passwordHash: await bcrypt.hash('teacher123', 4),
      role: 'TEACHER',
      accountStatus: 'ACTIVE'
    }
  });
  otherTeacherToken = (await login('teacher2@test.tn', 'teacher123')).body.token;

  const s2 = await prisma.user.create({
    data: {
      firstName: 'ليلى',
      lastName: 'الطالبة',
      email: 'student2@test.tn',
      passwordHash: await bcrypt.hash('student123', 4),
      role: 'STUDENT',
      accountStatus: 'ACTIVE',
      xp: 40,
      level: 1
    }
  });
  otherStudentAccountId = s2.id;
  await prisma.student.create({
    data: {
      userId: s2.id,
      accountUserId: s2.id,
      classId: klass.id,
      firstName: 'ليلى',
      lastName: 'الطالبة',
      birthDate: new Date('2019-02-02'),
      level: 'السنة الأولى أساسي',
      schoolYear: '2026-2027'
    }
  });
});

const auth = (req, token) => req.set('Authorization', `Bearer ${token}`);
const book = (token = teacherToken) => auth(request(app).get(`/api/teacher/gradebook?classId=${klass.id}`), token);

describe('دفتر الدرجات (ISS-009)', () => {
  let assignmentId;
  let quizId;

  it('يرفض القسم غير الموجود / بلا صلاحية', async () => {
    expect((await request(app).get('/api/teacher/gradebook')).status).toBe(401);
    expect((await auth(request(app).get('/api/teacher/gradebook'), teacherToken)).status).toBe(400);
    expect((await book()).status).toBe(200);
    // a teacher who does not own the class gets 403
    expect((await book(otherTeacherToken)).status).toBe(403);
  });

  it('يعرض صفًا لكل تلميذ في القسم', async () => {
    const res = await book();
    expect(res.body.studentsCount).toBe(2);
    expect(res.body.rows).toHaveLength(2);
    expect(res.body.rows.map((r) => r.name).sort()).toEqual(['أحمد التلميذ', 'ليلى الطالبة']);
  });

  it('يربط درجة الواجب بخانتها الصحيحة (الربط عبر accountUserId)', async () => {
    const assignment = await prisma.assignment.create({
      data: {
        teacherId: (await prisma.user.findUnique({ where: { email: 'teacher@test.tn' } })).id,
        classId: klass.id,
        subject: 'MATH',
        title: 'واجب: الأعداد',
        status: 'PUBLISHED',
        questions: [{ id: 'q1', type: 'MCQ', text: '2+2', options: ['3', '4'], answer: '4', points: 2 }]
      }
    });
    assignmentId = assignment.id;
    await prisma.assignmentSubmission.create({
      data: {
        assignmentId,
        studentId: studentAccountId,
        answers: { q1: '4' },
        score: 4,
        totalPoints: 4,
        status: 'GRADED'
      }
    });

    const res = await book();
    expect(res.body.items.map((i) => i.id)).toContain(`a${assignmentId}`);
    const row = res.body.rows.find((r) => r.name === 'أحمد التلميذ');
    const idx = res.body.items.findIndex((i) => i.id === `a${assignmentId}`);
    expect(row.grades[idx]).toBe(100);
  });

  it('يربط درجة الاختبار بخانتها الصحيحة', async () => {
    const teacher = await prisma.user.findUnique({ where: { email: 'teacher@test.tn' } });
    const quiz = await prisma.quiz.create({
      data: {
        teacherId: teacher.id,
        classId: klass.id,
        subject: 'MATH',
        title: 'اختبار: القسمة',
        questions: [{ id: 'q1', type: 'MCQ', text: '8/2', options: ['3', '4'], answer: '4', points: 10 }]
      }
    });
    quizId = quiz.id;
    await prisma.submission.create({
      data: { quizId, studentId: studentAccountId, answers: { q1: '4' }, score: 6, totalPoints: 10 }
    });

    const res = await book();
    const row = res.body.rows.find((r) => r.name === 'أحمد التلميذ');
    const idx = res.body.items.findIndex((i) => i.id === `q${quizId}`);
    expect(row.grades[idx]).toBe(60);
  });

  it('المعدل هو متوسط الدرجات المكتسبة فقط (100 و60 → 80)', async () => {
    const res = await book();
    const row = res.body.rows.find((r) => r.name === 'أحمد التلميذ');
    expect(row.average).toBe(80);
  });

  it('يترك خانة فارغة (null) للتلميذ بلا تسليم ولا يحسبها في المعدل', async () => {
    const res = await book();
    const row = res.body.rows.find((r) => r.name === 'ليلى الطالبة');
    // one slot per item, all null — the array must NOT be compacted
    expect(row.grades).toHaveLength(res.body.items.length);
    expect(row.grades.every((g) => g === null)).toBe(true);
    expect(row.average).toBeNull();
  });

  it('لا تزحزح الدرجات: تلميذ له الاختبار فقط يرى درجته تحت عمود الاختبار', async () => {
    const res = await book();
    const idx = res.body.items.findIndex((i) => i.id === `q${quizId}`);
    const aIdx = res.body.items.findIndex((i) => i.id === `a${assignmentId}`);
    const row = res.body.rows.find((r) => r.name === 'أحمد التلميذ');

    // both grades present: the later item keeps its own index
    expect(row.grades[aIdx]).toBe(100);
    expect(row.grades[idx]).toBe(60);

    // give the second student only the quiz → her 60 must stay in the quiz column
    await prisma.submission.create({
      data: { quizId, studentId: otherStudentAccountId, answers: { q1: '4' }, score: 6, totalPoints: 10 }
    });
    const after = await book();
    const row2 = after.body.rows.find((r) => r.name === 'ليلى الطالبة');
    expect(row2.grades[aIdx]).toBeNull();
    expect(row2.grades[idx]).toBe(60);
    expect(row2.average).toBe(60);
  });

  it('لا يسرّب درجات قسم آخر', async () => {
    const other = await prisma.class.create({ data: { name: 'قسم آخر', level: 'السنة الثانية' } });
    const u = await prisma.user.create({
      data: {
        firstName: 'دخيل',
        lastName: 'القسم',
        email: 'outsider@test.tn',
        passwordHash: 'x',
        role: 'STUDENT',
        accountStatus: 'ACTIVE'
      }
    });
    await prisma.student.create({
      data: {
        userId: u.id,
        accountUserId: u.id,
        classId: other.id,
        firstName: 'دخيل',
        lastName: 'القسم',
        birthDate: new Date('2019-03-03'),
        level: 'السنة الثانية',
        schoolYear: '2026-2027'
      }
    });
    const res = await book();
    expect(res.body.rows.map((r) => r.name)).not.toContain('دخيل القسم');
    expect(res.body.rows.map((r) => r.name)).not.toContain('دخيل');
  });
});
