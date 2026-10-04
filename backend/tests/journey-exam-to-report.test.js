// المرحلة F — رحلة إنتاج كاملة عبر الـAPI الحقيقي (لا استدعاء خدمة مباشرة):
//
//   معلّم ينشئ امتحانًا رسميًا (بجدول إسناد ومفاتيح إجابة) ← ينشره
//   ← 3 تلاميذ يستلمون (كامل/جزئي/بلا تسليم)
//   ← تصحيح آلي + تصحيح يدوي ل Nolan "بانتظار"
//   ← النتائج والمعدلات وتقرير القسم يreflect كل ذلك
//
// هذا هو الاختبار الذي كان ناقصًا: الاختبارات السابقة تفحص كل وحدة على حدة
// (خدمات أو مسار أوCalculations)، وهذا يفحص **تسلسلًا كاملًا** يمنع أن يكون
// كل جزء صحيحًا بينما الرحلة معطّلة (نوع المسار، حالة التقديم، الصلاحيات).
import { describe, it, expect, beforeAll } from 'vitest';
import { resetDatabase, seedTestData, login } from './helpers.js';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import { gradeOfficialExam } from '../src/services/officialExamService.js';

let app;
let prisma;
let teacherToken;
let klass;
let students = []; // [{ token, accountId, firstName }]

const auth = (token) => ({ Authorization: `Bearer ${token}` });

// محتوى ورقة: جدول إسناد بمفاتيح المصدر الرسمي (none/below/min/max)
function examPaper({ withKeys = true, totalPoints = 20 } = {}) {
  const q = (id, criterion, points, correct, correctAnswer) => ({
    id,
    type: 'FILL_BLANK',
    prompt: `${id}: أكمل`,
    points,
    criterion,
    ...(withKeys ? { correct, correctAnswer } : {})
  });
  return {
    totalPoints,
    stimulus: 'الأعداد من 0 إلى 20',
    criteria: [
      { id: 'مع1', label: 'يجمع في حدود 20', mastery: { none: 0, below: 4, min: 8, max: 10 } },
      { id: 'مع2', label: 'طرح في حدود 20', mastery: { none: 0, below: 3, min: 6, max: 10 } }
    ],
    questions: [
      q('q1', 'مع1', 10, undefined, '31'),
      q('q2', 'مع1', 10, undefined, '24'),
      q('q3', 'مع2', 10, undefined, '12'),
      q('q4', 'مع2', 10, undefined, '7')
    ]
  };
}

beforeAll(async () => {
  ({ app } = await import('../src/index.js'));
  prisma = (await import('../src/db.js')).default;
  await resetDatabase();
  const seeded = await seedTestData();
  klass = seeded.klass;

  const t = await login('teacher@test.tn', 'teacher123');
  teacherToken = t.body.token;
  expect(teacherToken).toBeTruthy();

  // 3 حسابات تلاميذ في القسم نفسه (قاعدة الاختبار ترى حسابًا واحدًا فقط)
  const parent = await prisma.user.findUnique({ where: { email: 'parent@test.tn' } });
  const names = [
    ['لينا', 'journey1@test.tn', { q1: '31', q2: '24', q3: '12', q4: '7' }], // كامل
    ['نسرين', 'journey2@test.tn', { q1: '31', q2: '24', q3: '15', q4: '9' }], // جزئي
    ['محمد', 'journey3@test.tn', null] // بلا تسليم
  ];
  for (const [firstName, email, answers] of names) {
    const acc = await prisma.user.create({
      data: {
        firstName,
        lastName: 'رحلة',
        email,
        passwordHash: await bcrypt.hash('journey123', 4),
        role: 'STUDENT',
        accountStatus: 'ACTIVE'
      }
    });
    await prisma.student.create({
      data: {
        userId: parent.id,
        accountUserId: acc.id,
        classId: klass.id,
        firstName,
        lastName: 'رحلة',
        birthDate: new Date('2015-04-01'),
        level: klass.level
      }
    });
    const login_ = await login(email, 'journey123');
    students.push({ token: login_.body.token, accountId: acc.id, firstName, email, answers });
  }
  expect(students.length).toBe(3);
});

describe('الرحلة الكاملة: إنشاء ← نشر ← تسليم ← تصحيح ← نتائج', () => {
  let examId;

  it('١) المعلّم ينشئ امتحانًا رسميًا وبياناته تُحفظ كاملة', async () => {
    const res = await request(app)
      .post('/api/teacher/exams')
      .set(auth(teacherToken))
      .send({ title: 'اختبار الوحدة الأولى', subject: 'MATH', classId: klass.id, content: examPaper() });
    expect(res.status).toBe(201);
    examId = res.body.id;
    expect(examId).toBeTruthy();
    expect(res.body.content.criteria).toHaveLength(2);
    expect(res.body.content.questions).toHaveLength(4);
  });

  it('١ب) ورقة بلا سند تُقبل كمسوّدة، وتُبقي التصحيح «بانتظار» — لا صفر مُختلق', async () => {
    // سلوك موثّق: الخادم يقبل بناء المسوّدة يدويًا بلا جدول إسناد (المحرّك يفرضه
    // في الواجهة). الأهم أخلاقيًا: عند التصحيح لا يدّعي تصحيحًا ولا يكتب صفرًا.
    const draft = await request(app)
      .post('/api/teacher/exams')
      .set(auth(teacherToken))
      .send({ title: 'مسوّدة بلا سند', subject: 'MATH', classId: klass.id, content: { totalPoints: 20, questions: examPaper().questions } });
    expect(draft.status).toBe(201);

    const pub = await request(app).put(`/api/teacher/exams/${draft.body.id}`).set(auth(teacherToken)).send({ published: true });
    expect(pub.status).toBe(200);

    await request(app)
      .post(`/api/teacher/student/official-exams/${draft.body.id}/submit`)
      .set(auth(students[2].token))
      .send({ answers: students[0].answers });
    const sub = await prisma.officialSubmission.findFirst({ where: { examId: draft.body.id } });
    const graded = gradeOfficialExam(draft.body.content, sub.answers);
    expect(graded.needsManualGrading).toBe(true);
    expect(graded.reason).toBe('NO_CRITERIA');

    // تنظيف: ورقة المسوّدة ليست جزءًا من الرحلة
    await prisma.officialSubmission.deleteMany({ where: { examId: draft.body.id } });
    await prisma.officialExam.delete({ where: { id: draft.body.id } });
  });

  it('٢) قبل النشر: لا يظهر لأي تلميذ', async () => {
    for (const s of students) {
      const res = await request(app).get('/api/teacher/student/official-exams').set(auth(s.token));
      expect(res.status).toBe(200);
      expect(res.body.some((e) => e.id === examId)).toBe(false);
    }
  });

  it('٣) المعلّم ينشر الورقة فتظهر لدى التلاميذ', async () => {
    const pub = await request(app)
      .put(`/api/teacher/exams/${examId}`)
      .set(auth(teacherToken))
      .send({ published: true });
    expect(pub.status).toBe(200);

    const seen = await request(app).get('/api/teacher/student/official-exams').set(auth(students[0].token));
    expect(seen.body.some((e) => e.id === examId)).toBe(true);
  });

  it('٤) تلميذ من قسم آخر لا يرى الورقة (حاجز التقييد)', async () => {
    const outsider = await prisma.user.create({
      data: {
        firstName: 'دخيل',
        lastName: 'قسم',
        email: 'journey.outsider@test.tn',
        passwordHash: await bcrypt.hash('journey123', 4),
        role: 'STUDENT',
        accountStatus: 'ACTIVE'
      }
    });
    const otherClass = await prisma.class.create({ data: { name: 'قسم آخر', level: klass.level, teacherId: klass.teacherId } });
    await prisma.student.create({
      data: { userId: outsider.id, accountUserId: outsider.id, classId: otherClass.id, firstName: 'دخيل', lastName: 'قسم', birthDate: new Date('2015-01-01'), level: klass.level }
    });
    const token = (await login('journey.outsider@test.tn', 'journey123')).body.token;
    const res = await request(app).get(`/api/teacher/student/official-exams/${examId}`).set(auth(token));
    expect(res.status).toBe(404);
  });

  it('٥) تلميذان يسلّمان (كامل + جزئي) والثالث لا يسلّم', async () => {
    for (const s of students.filter((x) => x.answers)) {
      const res = await request(app)
        .post(`/api/teacher/student/official-exams/${examId}/submit`)
        .set(auth(s.token))
        .send({ answers: s.answers });
      expect(res.status).toBe(201);
    }
    const subs = await prisma.officialSubmission.count({ where: { examId } });
    expect(subs).toBe(2);
  });

  it('٦) التصحيح الآلي: كامل = 20/20، جزئي = نقاط صادقة بلا صفر ظالم', async () => {
    const full = await prisma.officialSubmission.findFirst({ where: { examId, studentId: students[0].accountId } });
    const partial = await prisma.officialSubmission.findFirst({ where: { examId, studentId: students[1].accountId } });

    // كامل: مع1 إجابتان صحيحتان ⇒ max(10) + مع2 إجابتان صحيحتان ⇒ max(10)
    expect(full.score).toBe(20);
    expect(full.status).toBe('CORRECTED');
    // جزئي: مع1 صحيحتان (10) + مع2 خاطئتان (0) ⇒ 10 لا 0
    expect(partial.score).toBe(10);
    expect(partial.status).toBe('CORRECTED');
  });

  it('٧) إعادة التسليم مرفوضة (لا تلاعب بالنتيجة)', async () => {
    const before = await prisma.officialSubmission.findFirst({
      where: { examId, studentId: students[0].accountId }
    });
    const res = await request(app)
      .post(`/api/teacher/student/official-exams/${examId}/submit`)
      .set(auth(students[0].token))
      .send({ answers: { q1: '0', q2: '0', q3: '0', q4: '0' } });
    expect(res.status).toBe(400);
    const after = await prisma.officialSubmission.findFirst({
      where: { examId, studentId: students[0].accountId }
    });
    expect(after.score).toBe(before.score); // لم تتغيّر الدرجة
  });

  it('٨) التصحيح اليدوي: الحقل موجود ويرفع الدرجة فعلًا', async () => {
    const subs = await request(app).get(`/api/teacher/exams/${examId}/submissions`).set(auth(teacherToken));
    expect(subs.status).toBe(200);
    expect(subs.body.length).toBe(2);

    const target = subs.body.find((s) => s.studentId === students[1].accountId);
    const up = await request(app)
      .put(`/api/teacher/exams/${examId}/submissions/${target.id}`)
      .set(auth(teacherToken))
      .send({ score: 14, status: 'IN_REVIEW' });
    expect(up.status).toBe(200);

    const after = await prisma.officialSubmission.findUnique({ where: { id: target.id } });
    expect(after.score).toBe(14);
    expect(after.status).toBe('IN_REVIEW');
  });

  it('٩) تقرير القسم ي.reflect الرحلة: خانتان مصحّحتان + واحد لم يسلّم + إتقان', async () => {
    const rep = await request(app).get(`/api/teacher/classes/${klass.id}/report`).set(auth(teacherToken));
    expect(rep.status).toBe(200);
    const ourExam = rep.body.items.find((i) => i.id === `exam-${examId}`);
    expect(ourExam, 'ورقة الرحلة ضمن أعمال القسم').toBeTruthy();
    expect(ourExam.kind).toBe('exam');

    const rowLina = rep.body.rows.find((r) => r.studentId === students[0].accountId);
    const rowN = rep.body.rows.find((r) => r.studentId === students[1].accountId);
    const rowM = rep.body.rows.find((r) => r.studentId === students[2].accountId);
    const cell = `exam-${examId}`;

    expect(rowLina.cells[cell].state).toBe('graded');
    expect(rowLina.cells[cell].percent).toBe(100);
    // نسرين: تصحيح يدوي قيد المراجعة ⇒ «بانتظار التصحيح» لا نسبة
    expect(rowN.cells[cell].state).toBe('pending');
    expect(rowN.cells[cell].percent).toBeNull();
    expect(rowM.cells[cell].state).toBe('missing');

    // الكفايات: مع1 عند لينا圆满، ونسرين جزئي ⇒ متوسط بين
    const c1 = rep.body.criteria.find((c) => c.criterion === 'مع1');
    expect(c1.studentsGraded).toBe(2);
    expect(c1.masteryIndex).toBeGreaterThan(0);
    expect(c1.max).toBe(10);
  });

  it('١٠) نتائج الأستاذ: مجموعة لكل تلميذ، والتحصيل 20/20 صحيح', async () => {
    const res = await request(app).get('/api/teacher/results').set(auth(teacherToken));
    expect(res.status).toBe(200);
    const lina = res.body.find((r) => r.student.firstName === 'لينا');
    expect(lina, 'لينا في النتائج').toBeTruthy();
    expect(lina.breakdown.exams).toBe(1);
    const attempt = lina.attempts.find((a) => a.kind === 'exam');
    expect(attempt.score).toBe(20);
    expect(attempt.max).toBe(20);
    expect(attempt.percent).toBe(100);

    // نسرين: قُيّمت يدويًّا إلى 14 و وضعها قيد المراجعة ⇒ pendingManual صادق
    const n = res.body.find((r) => r.student.firstName === 'نسرين');
    expect(n.pendingManual).toBe(1);
    const nAttempt = n.attempts.find((a) => a.kind === 'exam');
    expect(nAttempt.pendingManualGrading).toBe(true);
    expect(nAttempt.percent).toBeNull(); // لا نسبة قبل التصحيح النهائي
  });

  it('١١) التلميذ يرى حالته عبر صفحة الامتحانات الرسمية (المسار الذي تستعمله الواجهة)', async () => {
    const lina = await request(app).get('/api/teacher/student/official-exams').set(auth(students[0].token));
    expect(lina.status).toBe(200);
    const mine = lina.body.find((e) => e.id === examId);
    expect(mine).toBeTruthy();
    expect(mine.done).toBe(true);
    // بعد التصحيح: الدرجة موجودة (لا «بانتظار» ولا صفر كاذب)
    expect(mine.mySubmission.score).toBe(20);
    expect(mine.mySubmission.status).toBe('CORRECTED');
    // ولا مفاتيح الإجابة تصل التلميذ أبدًا
    expect(JSON.stringify(lina.body)).not.toMatch(/correctAnswer/);

    const n = await request(app).get('/api/teacher/student/official-exams').set(auth(students[1].token));
    const mineN = n.body.find((e) => e.id === examId);
    expect(mineN.mySubmission.status).toBe('IN_REVIEW'); // قيد المراجعة بعد التصحيح اليدوي
    expect(mineN.mySubmission.score).toBe(14);

    // محمد لم يسلّم: يظهر له بلا تسليم
    const m = await request(app).get('/api/teacher/student/official-exams').set(auth(students[2].token));
    expect(m.body.find((e) => e.id === examId).done).toBe(false);
  });

  it('١٢) ولا تلميذ ولا ولي يرى ورقة قسم آخر في نتائجهم', async () => {
    const res = await request(app).get('/api/teacher/results').set(auth(students[0].token));
    expect([401, 403]).toContain(res.status);
  });
});
