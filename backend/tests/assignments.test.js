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

const SAMPLE_QUESTIONS = [
  {
    id: 'q1',
    type: 'MCQ',
    prompt: 'ما هي عاصمة تونس؟',
    points: 2,
    options: ['سوسة', 'تونس العاصمة', 'صفاقس'],
    correctOption: '1'
  },
  {
    id: 'q2',
    type: 'TRUE_FALSE',
    prompt: 'الماء يغلي على درجة 100.',
    points: 1,
    correctAnswer: 'TRUE'
  },
  {
    id: 'q3',
    type: 'FILL_BLANK',
    prompt: 'أكمل: 2 + 3 = ...',
    points: 1,
    correctAnswer: '5'
  }
];

describe('assignments (المرحلة 3.1 — التكليفات)', () => {
  it('يرفض إنشاء تكليف بدون auth', async () => {
    const res = await request(app).post('/api/teacher/assignments').send({
      title: 'تكليف رقم 1',
      subject: 'MATH',
      questions: SAMPLE_QUESTIONS
    });
    expect(res.status).toBe(401);
  });

  it('يمنع الولي من إنشاء تكليف', async () => {
    const token = await getToken('parent@test.tn', 'parent123');
    const res = await request(app)
      .post('/api/teacher/assignments')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'تكليف', subject: 'MATH', questions: SAMPLE_QUESTIONS });
    expect(res.status).toBe(403);
  });

  it('يرفض تكليفا بدون عنوان', async () => {
    const token = await getToken('teacher@test.tn', 'teacher123');
    const res = await request(app)
      .post('/api/teacher/assignments')
      .set('Authorization', `Bearer ${token}`)
      .send({ subject: 'MATH', questions: SAMPLE_QUESTIONS });
    expect(res.status).toBe(400);
  });

  it('ينشئ الأستاذ تكليفا ويظهر للتلميذ', async () => {
    const prisma = (await import('../src/db.js')).default;
    const klass = await prisma.class.findFirst();
    const teacherToken = await getToken('teacher@test.tn', 'teacher123');
    const studentToken = await getToken('student@test.tn', 'student123');

    const create = await request(app)
      .post('/api/teacher/assignments')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({
        title: 'واجب الرياضيات',
        subject: 'MATH',
        classId: klass.id,
        description: 'أنجز التمارين المطلوبة',
        dueDate: '2026-10-01',
        questions: SAMPLE_QUESTIONS
      });
    expect(create.status).toBe(201);
    expect(create.body.questions).toHaveLength(3);

    const list = await request(app)
      .get('/api/teacher/assignments')
      .set('Authorization', `Bearer ${teacherToken}`);
    expect(list.status).toBe(200);
    expect(list.body).toHaveLength(1);

    const studentList = await request(app)
      .get('/api/teacher/student/assignments')
      .set('Authorization', `Bearer ${studentToken}`);
    expect(studentList.status).toBe(200);
    expect(studentList.body).toHaveLength(1);
    expect(studentList.body[0].title).toBe('واجب الرياضيات');
    expect(studentList.body[0].done).toBe(false);
  });

  it('يقبل مهلة بصيغة ISO كاملة (ما ترسله الواجهة فعلًا) ويرفض صيغة فاسدة', async () => {
    const prisma = (await import('../src/db.js')).default;
    const klass = await prisma.class.findFirst();
    const teacherToken = await getToken('teacher@test.tn', 'teacher123');

    // الواجهة ترسل new Date(datetime-local).toISOString() ⇒‎2026-10-05T19:00:00.000Z
    const iso = await request(app)
      .post('/api/teacher/assignments')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({
        title: 'واجب بمهلة كاملة',
        subject: 'MATH',
        classId: klass.id,
        dueDate: '2026-10-05T19:00:00.000Z',
        questions: SAMPLE_QUESTIONS
      });
    expect(iso.status).toBe(201);
    expect(new Date(iso.body.dueDate).toISOString()).toBe('2026-10-05T19:00:00.000Z');

    // صيغة قصيرة (كما ترسلها الواجهة عند التحرير) ما زالت مقبولة
    const short = await request(app)
      .post('/api/teacher/assignments')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({
        title: 'واجب بمهلة قصيرة',
        subject: 'MATH',
        classId: klass.id,
        dueDate: '2026-10-06T20:00',
        questions: SAMPLE_QUESTIONS
      });
    expect(short.status).toBe(201);

    const bad = await request(app)
      .post('/api/teacher/assignments')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({
        title: 'واجب بمهلة فاسدة',
        subject: 'MATH',
        classId: klass.id,
        dueDate: 'غدًا',
        questions: SAMPLE_QUESTIONS
      });
    expect(bad.status).toBe(400);
    expect(JSON.stringify(bad.body)).toContain('تاريخ التسليم غير صحيح');
  });

  it('أمان: التلميذ لا يتلقى مفاتيح الإجابات لا في القائمة ولا التفاصيل', async () => {
    const prisma = (await import('../src/db.js')).default;
    const klass = await prisma.class.findFirst();
    const teacherToken = await getToken('teacher@test.tn', 'teacher123');
    const studentToken = await getToken('student@test.tn', 'student123');

    const create = await request(app)
      .post('/api/teacher/assignments')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ title: 'واجب سري', subject: 'MATH', classId: klass.id, questions: SAMPLE_QUESTIONS });
    const assignmentId = create.body.id;

    const strip = (qs) => {
      const blob = JSON.stringify(qs);
      expect(blob).not.toMatch(/correctOption|correctAnswer|orderItems/);
    };

    const list = await request(app)
      .get('/api/teacher/student/assignments')
      .set('Authorization', `Bearer ${studentToken}`);
    expect(list.status).toBe(200);
    strip(list.body[0].questions);

    const detail = await request(app)
      .get(`/api/teacher/student/assignments/${assignmentId}`)
      .set('Authorization', `Bearer ${studentToken}`);
    expect(detail.status).toBe(200);
    strip(detail.body.questions);

    // التسليم والتصحّح لا يزالان يعملان (التصحّح من قاعدة البيانات لا من المفاتيح الظاهرة)
    const submit = await request(app)
      .post(`/api/teacher/student/assignments/${assignmentId}/submit`)
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ answers: { q1: '1', q2: 'TRUE', q3: '5' } });
    expect(submit.status).toBe(201);
    expect(submit.body.score).toBe(4);
  });

  it('يصحح التلميذ التكليف آليا وتحصل على النتيجة', async () => {
    const prisma = (await import('../src/db.js')).default;
    const klass = await prisma.class.findFirst();
    const teacherToken = await getToken('teacher@test.tn', 'teacher123');
    const studentToken = await getToken('student@test.tn', 'student123');

    const create = await request(app)
      .post('/api/teacher/assignments')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ title: 'واجب الرياضيات', subject: 'MATH', classId: klass.id, questions: SAMPLE_QUESTIONS });
    const assignmentId = create.body.id;

    const submit = await request(app)
      .post(`/api/teacher/student/assignments/${assignmentId}/submit`)
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ answers: { q1: '1', q2: 'TRUE', q3: '5' } });
    expect(submit.status).toBe(201);
    expect(submit.body.status).toBe('GRADED');
    expect(submit.body.score).toBe(4);
    expect(submit.body.totalPoints).toBe(4);
    expect(submit.body.percent).toBe(100);

    const detail = await request(app)
      .get(`/api/teacher/student/assignments/${assignmentId}`)
      .set('Authorization', `Bearer ${studentToken}`);
    expect(detail.status).toBe(200);
    expect(detail.body.submission.percent).toBe(100);

    const twice = await request(app)
      .post(`/api/teacher/student/assignments/${assignmentId}/submit`)
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ answers: { q1: '0', q2: 'FALSE', q3: '3' } });
    expect(twice.status).toBe(400);
    expect(twice.body.error).toBe('لقد أرسلت إجابات هذا التكليف مسبقا');
  });

  it('يصحح آليا بإجابات خاطئة فتحصل على نقاط جزئية', async () => {
    const prisma = (await import('../src/db.js')).default;
    const klass = await prisma.class.findFirst();
    const teacherToken = await getToken('teacher@test.tn', 'teacher123');
    const studentToken = await getToken('student@test.tn', 'student123');

    const create = await request(app)
      .post('/api/teacher/assignments')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ title: 'واجب', subject: 'SCIENCE', classId: klass.id, questions: SAMPLE_QUESTIONS });
    const assignmentId = create.body.id;

    const submit = await request(app)
      .post(`/api/teacher/student/assignments/${assignmentId}/submit`)
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ answers: { q1: '0', q2: 'FALSE', q3: '3' } });
    expect(submit.status).toBe(201);
    expect(submit.body.score).toBe(0);
    expect(submit.body.percent).toBe(0);
  });

  it('يرى الأستاذ تسليمات التكليف ويمكنه التصحيح اليدوي', async () => {
    const prisma = (await import('../src/db.js')).default;
    const klass = await prisma.class.findFirst();
    const teacherToken = await getToken('teacher@test.tn', 'teacher123');
    const studentToken = await getToken('student@test.tn', 'student123');

    const create = await request(app)
      .post('/api/teacher/assignments')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ title: 'واجب', subject: 'READING', classId: klass.id, questions: SAMPLE_QUESTIONS });
    const assignmentId = create.body.id;

    await request(app)
      .post(`/api/teacher/student/assignments/${assignmentId}/submit`)
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ answers: { q1: '1', q2: 'TRUE', q3: '5' } });

    const subs = await request(app)
      .get(`/api/teacher/assignments/${assignmentId}/submissions`)
      .set('Authorization', `Bearer ${teacherToken}`);
    expect(subs.status).toBe(200);
    expect(subs.body.submissions).toHaveLength(1);
    expect(subs.body.classStudents).toHaveLength(1);
    expect(subs.body.classStudents[0].submission).not.toBeNull();

    const submissionId = subs.body.submissions[0].id;
    const grade = await request(app)
      .put(`/api/teacher/assignments/${assignmentId}/submissions/${submissionId}`)
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ score: 2, feedback: 'ممتاز لكن أعد النظر في السؤال الثالث' });
    expect(grade.status).toBe(200);
    expect(grade.body.status).toBe('GRADED');
    expect(grade.body.score).toBe(2);
    expect(grade.body.feedback).toContain('ممتاز');
  });

  it('يرى الولي تكليفات ابنه ونتيجته', async () => {
    const prisma = (await import('../src/db.js')).default;
    const klass = await prisma.class.findFirst();
    const teacherToken = await getToken('teacher@test.tn', 'teacher123');
    const studentToken = await getToken('student@test.tn', 'student123');
    const parentToken = await getToken('parent@test.tn', 'parent123');

    const create = await request(app)
      .post('/api/teacher/assignments')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ title: 'واجب الرياضيات', subject: 'MATH', classId: klass.id, questions: SAMPLE_QUESTIONS });
    const assignmentId = create.body.id;

    const before = await request(app)
      .get('/api/parent/assignments')
      .set('Authorization', `Bearer ${parentToken}`);
    expect(before.status).toBe(200);
    expect(before.body).toHaveLength(1);
    expect(before.body[0].assignments[0].done).toBe(false);
    expect(before.body[0].assignments[0].questionsCount).toBe(3);

    await request(app)
      .post(`/api/teacher/student/assignments/${assignmentId}/submit`)
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ answers: { q1: '1', q2: 'TRUE', q3: '5' } });

    const after = await request(app)
      .get('/api/parent/assignments')
      .set('Authorization', `Bearer ${parentToken}`);
    expect(after.body[0].assignments[0].done).toBe(true);
    expect(after.body[0].assignments[0].submission.percent).toBe(100);

    const detail = await request(app)
      .get(`/api/parent/assignments/${assignmentId}`)
      .set('Authorization', `Bearer ${parentToken}`);
    expect(detail.status).toBe(200);
    expect(detail.body.children).toHaveLength(1);
    expect(detail.body.children[0].submission.percent).toBe(100);
  });
});
