// تقرير القسم (المرحلة D) — مصفوفة موحّدة: حضور + امتحان رسمي + واجب + اختبار،
// وإتقان الكفايات من جدول الإسناد، مع قاعدة الصدق: ما لم يُصحَّح يدويًّا
// يبقى «بانتظار التصحيح» ولا يُحسب صفرًا.
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { resetDatabase, seedTestData, login } from './helpers.js';
import request from 'supertest';
import bcrypt from 'bcryptjs';

let app;
let prisma;
let teacherToken;
let klass;
let teacherId;

const today = new Date().toISOString().slice(0, 10);

// محتوى امتحان كامل: جدول إسناد بمفاتيح المصدر الرسمي
// (criteria-grids.js / OfficialExams.jsx ⇒ none/below/min/max)
function examContent(totalPoints = 10) {
  return {
    totalPoints,
    criteria: [
      { id: 'مع1', label: 'يجمع عددين', mastery: { none: 0, below: 2, min: 4, max: 5 } },
      { id: 'مع2', label: 'طرح عددين', mastery: { none: 0, below: 1, min: 3, max: 5 } }
    ],
    questions: [
      { id: 'q1', type: 'FILL_BLANK', criterion: 'مع1', correctAnswer: '3', points: 5 },
      { id: 'q2', type: 'FILL_BLANK', criterion: 'مع2', correctAnswer: '2', points: 5 }
    ]
  };
}

beforeAll(async () => {
  ({ app } = await import('../src/index.js'));
  const dbModule = await import('../src/db.js');
  prisma = dbModule.default;
  await resetDatabase();
  const seeded = await seedTestData();
  klass = seeded.klass;
  teacherId = klass.teacherId;
  const t = await login('teacher@test.tn', 'teacher123');
  teacherToken = t.body.token;
  expect(teacherToken).toBeTruthy();
});

beforeEach(async () => {
  await prisma.attendanceRecord.deleteMany({ where: { classId: klass.id } });
  await prisma.officialSubmission.deleteMany({ where: { exam: { classId: klass.id } } });
  await prisma.officialExam.deleteMany({ where: { classId: klass.id } });
  await prisma.assignmentSubmission.deleteMany({ where: { assignment: { classId: klass.id } } });
  await prisma.assignment.deleteMany({ where: { classId: klass.id } });
});

const get = (classId = klass.id, token = teacherToken) =>
  request(app).get(`/api/teacher/classes/${classId}/report`).set('Authorization', `Bearer ${token}`);

describe('تقرير القسم (المرحلة D)', () => {
  it('يرفض بلا مصادقة (401)', async () => {
    const res = await request(app).get(`/api/teacher/classes/${klass.id}/report`);
    expect(res.status).toBe(401);
  });

  it('يرفض التلميذ (403)', async () => {
    const s = await login('student@test.tn', 'student123');
    const res = await get(klass.id, s.body.token);
    expect(res.status).toBe(403);
  });

  it('قسم غير موجود (404)', async () => {
    const res = await get(999999);
    expect(res.status).toBe(404);
  });

  it('قسم ليس لهذا الأستاذ (404) — لا يرى تقرير قسم غيره', async () => {
    const otherTeacher = await prisma.user.create({
      data: {
        firstName: 'أستاذ',
        lastName: 'آخر',
        email: 'other.teacher@test.tn',
        passwordHash: await bcrypt.hash('teacher123', 4),
        role: 'TEACHER'
      }
    });
    const other = await prisma.class.create({
      data: { name: 'قسم آخر', level: 'السنة الأولى ابتدائي', teacherId: otherTeacher.id }
    });
    const res = await get(other.id);
    expect(res.status).toBe(404);
  });

  it('تاريخ غير صحيح (400)', async () => {
    const res = await request(app)
      .get(`/api/teacher/classes/${klass.id}/report?from=2026/01/01`)
      .set('Authorization', `Bearer ${teacherToken}`);
    expect(res.status).toBe(400);
  });

  it('تقرير بلا أعمال: تلاميذ القسم موجودون لكن لا أعمال — لا يختلق بيانات', async () => {
    const res = await get();
    expect(res.status).toBe(200);
    expect(res.body.items).toEqual([]);
    expect(res.body.criteria).toEqual([]);
    expect(res.body.totals.students).toBe(1); // تلميذ البذرة
    expect(res.body.totals.pendingManual).toBe(0);
    expect(res.body.attendanceDays).toBe(0);
    expect(res.body.rows[0].attendance.rate).toBeNull(); // لا سجلّ حضور ⇒ لا نسبة مخترعة
  });

  it('مصفوفة: حضور + امتحان + واجب، وخلية «لم يُسلّم» صادقة', async () => {
    const exam = await prisma.officialExam.create({
      data: { teacherId, classId: klass.id, title: 'امتحانCollections', subject: 'MATH', content: examContent(10), published: true }
    });
    const assignment = await prisma.assignment.create({
      data: { teacherId, classId: klass.id, title: 'واجب الجمع', subject: 'MATH', questions: [], status: 'PUBLISHED' }
    });
    const student = await prisma.student.findFirst({ where: { classId: klass.id, accountUserId: { not: null } } });
    const accountId = student.accountUserId;

    await prisma.attendanceRecord.create({
      data: { classId: klass.id, studentId: accountId, date: new Date(`${today}T00:00:00.000Z`), present: true, recordedBy: teacherId }
    });
    await prisma.attendanceRecord.create({
      data: { classId: klass.id, studentId: accountId, date: new Date('2026-01-05T00:00:00.000Z'), present: false, recordedBy: teacherId }
    });
    await prisma.officialSubmission.create({
      data: { examId: exam.id, studentId: accountId, answers: { q1: '3', q2: '2' }, score: 10, status: 'CORRECTED' }
    });
    await prisma.assignmentSubmission.create({
      data: { assignmentId: assignment.id, studentId: accountId, answers: {}, score: 4, totalPoints: 5, status: 'GRADED' }
    });

    const res = await get();
    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(2);
    const kinds = res.body.items.map((i) => i.kind).sort();
    expect(kinds).toEqual(['assignment', 'exam']);

    const row = res.body.rows.find((r) => r.studentId === accountId);
    expect(row).toBeTruthy();
    // الحضور: حضور في يومين، غياب في واحد ⇒ 50%
    expect(row.attendance.present).toBe(1);
    expect(row.attendance.absent).toBe(1);
    expect(row.attendance.rate).toBe(50);
    expect(res.body.attendanceDays).toBe(2);

    const examCell = row.cells[`exam-${exam.id}`];
    expect(examCell.state).toBe('graded');
    expect(examCell.percent).toBe(100);
    const assignCell = row.cells[`assignment-${assignment.id}`];
    expect(assignCell.state).toBe('graded');
    expect(assignCell.percent).toBe(80);
  });

  it('الصدق: امتحان بلا تصحيح يدوي = «بانتظار التصحيح» لا صفر ولا نسبة', async () => {
    const exam = await prisma.officialExam.create({
      data: { teacherId, classId: klass.id, title: 'امتحان مفتوح', subject: 'MATH', content: examContent(10), published: true }
    });
    const student = await prisma.student.findFirst({ where: { classId: klass.id, accountUserId: { not: null } } });
    await prisma.officialSubmission.create({
      data: { examId: exam.id, studentId: student.accountUserId, answers: { q1: '3', q2: '1' }, score: 5, status: 'IN_REVIEW' }
    });

    const res = await get();
    const row = res.body.rows.find((r) => r.studentId === student.accountUserId);
    const cell = row.cells[`exam-${exam.id}`];
    expect(cell.state).toBe('pending');
    expect(cell.percent).toBeNull(); // ليس 0 — لا نزيّف
    expect(res.body.totals.pendingManual).toBeGreaterThan(0);
  });

  it('إتقان الكفايات يأتي من جدول الإسناد (لا من إعادة اشتقاق)', async () => {
    const exam = await prisma.officialExam.create({
      data: { teacherId, classId: klass.id, title: 'امتحان الكفايات', subject: 'MATH', content: examContent(10), published: true }
    });
    const student = await prisma.student.findFirst({ where: { classId: klass.id, accountUserId: { not: null } } });
    await prisma.officialSubmission.create({
      data: { examId: exam.id, studentId: student.accountUserId, answers: { q1: '3', q2: '2' }, score: 9, status: 'CORRECTED' }
    });

    const res = await get();
    const row = res.body.rows.find((r) => r.studentId === student.accountUserId);
    const m1 = row.mastery[`exam-${exam.id}|مع1`];
    const m2 = row.mastery[`exam-${exam.id}|مع2`];
    expect(m1.label).toBe('يجمع عددين');
    expect(m1.masteryKey).toBe('max'); // إجابتان صحيحتان ⇒ التملك الأقصى
    expect(m1.earned).toBe(5); // من جدول الإسناد لا صفر
    expect(m2).toBeTruthy();
    expect(res.body.criteria.length).toBe(2);
    const c1 = res.body.criteria.find((c) => c.criterion === 'مع1');
    expect(c1.label).toBe('يجمع عددين');
    expect(c1.studentsGraded).toBe(1);
    expect(c1.masteryIndex).toBe(4); // max = 4 في سُلّم 1..4
  });

  it('حارس: إجابة صحيحة على كل الأسئلة ⇒ نقاط مكتسبة لا صفر (سُلّم الإتقان متوافق)', async () => {
    // انحدار سابق: earned = criterion.mastery[masteryKey] كانت تُرجع 0 دائمًا لأن
    // masteryFromRatio يعيد none/below/min/max بينما الجدول بمفاتيح أخرى.
    const exam = await prisma.officialExam.create({
      data: { teacherId, classId: klass.id, title: 'امتحان كامل', subject: 'MATH', content: examContent(10), published: true }
    });
    const student = await prisma.student.findFirst({ where: { classId: klass.id, accountUserId: { not: null } } });
    await prisma.officialSubmission.create({
      data: { examId: exam.id, studentId: student.accountUserId, answers: { q1: '3', q2: '2' }, score: 10, status: 'CORRECTED' }
    });
    const res = await get();
    const row = res.body.rows.find((r) => r.studentId === student.accountUserId);
    const cell = row.cells[`exam-${exam.id}`];
    expect(cell.state).toBe('graded');
    expect(cell.total).toBe(10); // 5 + 5 لا صفر
    expect(cell.totalMax).toBe(10);
    expect(row.mastery[`exam-${exam.id}|مع1`].earned).toBe(5);
    expect(row.mastery[`exam-${exam.id}|مع2`].earned).toBe(5);
  });

  it('امتحان بلا جدول إسناد = كله انتظار يدوي (لا صفر ظالم)', async () => {
    const exam = await prisma.officialExam.create({
      data: {
        teacherId,
        classId: klass.id,
        title: 'بلا إسناد',
        subject: 'MATH',
        published: true,
        content: { totalPoints: 10, questions: [{ id: 'q1', type: 'FILL_BLANK', correctAnswer: '3', points: 10 }] }
      }
    });
    const student = await prisma.student.findFirst({ where: { classId: klass.id, accountUserId: { not: null } } });
    await prisma.officialSubmission.create({
      data: { examId: exam.id, studentId: student.accountUserId, answers: { q1: '3' }, score: 10, status: 'CORRECTED' }
    });
    const res = await get();
    const row = res.body.rows.find((r) => r.studentId === student.accountUserId);
    const cell = row.cells[`exam-${exam.id}`];
    expect(cell.state).toBe('pending');
    expect(cell.reason).toBe('NO_CRITERIA');
  });

  it('نافذة التاريخ تُصفّي الحضور', async () => {
    const student = await prisma.student.findFirst({ where: { classId: klass.id, accountUserId: { not: null } } });
    await prisma.attendanceRecord.create({
      data: { classId: klass.id, studentId: student.accountUserId, date: new Date('2026-01-05T00:00:00.000Z'), present: false, recordedBy: teacherId }
    });
    await prisma.attendanceRecord.create({
      data: { classId: klass.id, studentId: student.accountUserId, date: new Date(`${today}T00:00:00.000Z`), present: true, recordedBy: teacherId }
    });
    const all = await get();
    expect(all.body.attendanceDays).toBe(2);

    const ranged = await request(app)
      .get(`/api/teacher/classes/${klass.id}/report?from=${today}&to=${today}`)
      .set('Authorization', `Bearer ${teacherToken}`);
    expect(ranged.body.attendanceDays).toBe(1);
    const row = ranged.body.rows.find((r) => r.studentId === student.accountUserId);
    expect(row.attendance.rate).toBe(100);
  });
});
