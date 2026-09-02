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

const QUESTIONS = [
  { id: 'q1', type: 'MCQ', prompt: 'ما هو 2+2؟', points: 1, options: ['3', '4', '5'], correctOption: '1' },
  { id: 'q2', type: 'TRUE_FALSE', prompt: 'الشمس تشرق من الشرق.', points: 1, correctAnswer: 'TRUE' }
];

async function createAssignment(teacherToken, klass, title, subject, dueDate) {
  const res = await request(app)
    .post('/api/teacher/assignments')
    .set('Authorization', `Bearer ${teacherToken}`)
    .send({ title, subject, classId: klass.id, dueDate, questions: QUESTIONS });
  return res.body;
}

async function submitAssignment(studentToken, assignmentId, answers) {
  return request(app)
    .post(`/api/teacher/student/assignments/${assignmentId}/submit`)
    .set('Authorization', `Bearer ${studentToken}`)
    .send({ answers });
}

describe('analytics (المرحلة 3.2 — التقارير التحليلية والتصدير)', () => {
  it('يحظر الوصول لتقارير التحليلات بدون auth', async () => {
    const prisma = (await import('../src/db.js')).default;
    const klass = await prisma.class.findFirst();
    const res = await request(app).get(`/api/teacher/analytics/class/${klass.id}`);
    expect(res.status).toBe(401);
  });

  it('يمنع الولي من الاطلاع على تحليلات الأستاذ', async () => {
    const prisma = (await import('../src/db.js')).default;
    const klass = await prisma.class.findFirst();
    const token = await getToken('parent@test.tn', 'parent123');
    const res = await request(app)
      .get(`/api/teacher/analytics/class/${klass.id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  it('يرى الأستاذ تقرير القسم ويتعرف على التلميذ', async () => {
    const prisma = (await import('../src/db.js')).default;
    const klass = await prisma.class.findFirst();
    const teacherToken = await getToken('teacher@test.tn', 'teacher123');

    const res = await request(app)
      .get(`/api/teacher/analytics/class/${klass.id}`)
      .set('Authorization', `Bearer ${teacherToken}`);
    expect(res.status).toBe(200);
    expect(res.body.class.id).toBe(klass.id);
    expect(res.body.summary.studentsCount).toBe(1);
    expect(res.body.students).toHaveLength(1);
    expect(res.body.atRiskStudents).toHaveLength(0);
    expect(res.body.perAssignment).toHaveLength(0);
  });

  it('يبني تقرير تلميذ واحد ويعرض القوة والضعف والمنحنى', async () => {
    const prisma = (await import('../src/db.js')).default;
    const klass = await prisma.class.findFirst();
    const teacherToken = await getToken('teacher@test.tn', 'teacher123');
    const studentToken = await getToken('student@test.tn', 'student123');

    const good = await createAssignment(teacherToken, klass, 'واجب ممتاز رياضيات', 'MATH', '2026-09-10');
    await createAssignment(teacherToken, klass, 'واجب صعب قراءة', 'READING', '2026-09-11');

    await submitAssignment(studentToken, good.id, { q1: '1', q2: 'TRUE' });

    const report = await request(app)
      .get('/api/teacher/analytics/students/2')
      .set('Authorization', `Bearer ${teacherToken}`);
    expect(report.status).toBe(200);
    expect(report.body.summary.assignmentsTotal).toBe(2);
    expect(report.body.summary.submitted).toBe(1);
    expect(report.body.summary.completionRate).toBe(50);

    const math = report.body.subjects.find((s) => s.subject === 'MATH');
    expect(math.avgPercent).toBe(100);
    expect(math.strength).toBe(true);

    const reading = report.body.subjects.find((s) => s.subject === 'READING');
    expect(reading.submitted).toBe(0);

    expect(report.body.strengths.some((s) => s.subject === 'MATH')).toBe(true);
    expect(report.body.trend).toHaveLength(1);
    expect(report.body.trend[0].percent).toBe(100);
  });

  it('يطلق تنبيه تعثر عندما تكون نسبة الإنجاز منخفضة', async () => {
    const prisma = (await import('../src/db.js')).default;
    const klass = await prisma.class.findFirst();
    const teacherToken = await getToken('teacher@test.tn', 'teacher123');

    await createAssignment(teacherToken, klass, 'واجب 1', 'MATH', '2026-09-01');
    await createAssignment(teacherToken, klass, 'واجب 2', 'MATH', '2026-09-05');
    await createAssignment(teacherToken, klass, 'واجب 3', 'MATH', '2026-09-10');
    await createAssignment(teacherToken, klass, 'واجب 4', 'SCIENCE', '2026-09-15');

    const report = await request(app)
      .get('/api/teacher/analytics/students/2')
      .set('Authorization', `Bearer ${teacherToken}`);
    expect(report.status).toBe(200);
    expect(report.body.summary.completionRate).toBe(0);
    expect(report.body.alerts.some((a) => a.type === 'LOW_COMPLETION')).toBe(true);
  });

  it('يرى الولي تقرير ابنه التحليلي', async () => {
    const prisma = (await import('../src/db.js')).default;
    const klass = await prisma.class.findFirst();
    const teacherToken = await getToken('teacher@test.tn', 'teacher123');
    const studentToken = await getToken('student@test.tn', 'student123');
    const parentToken = await getToken('parent@test.tn', 'parent123');

    const assignment = await createAssignment(teacherToken, klass, 'واجب رياضيات', 'MATH', '2026-09-10');
    await submitAssignment(studentToken, assignment.id, { q1: '1', q2: 'TRUE' });

    const report = await request(app)
      .get('/api/parent/analytics/children/2')
      .set('Authorization', `Bearer ${parentToken}`);
    expect(report.status).toBe(200);
    expect(report.body.summary.submitted).toBe(1);
    expect(report.body.summary.avgPercent).toBe(100);
    expect(report.body.strengths.some((s) => s.subject === 'MATH')).toBe(true);
  });

  it('يمنع الولي من رؤية تقرير ابن ليس له', async () => {
    const token = await getToken('parent@test.tn', 'parent123');
    const res = await request(app)
      .get('/api/parent/analytics/children/999')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
  });

  it('يرى التلميذ تقريره التحليلي الخاص', async () => {
    const prisma = (await import('../src/db.js')).default;
    const klass = await prisma.class.findFirst();
    const teacherToken = await getToken('teacher@test.tn', 'teacher123');
    const studentToken = await getToken('student@test.tn', 'student123');

    const assignment = await createAssignment(teacherToken, klass, 'واجب قراءة', 'READING', '2026-09-10');
    await submitAssignment(studentToken, assignment.id, { q1: '0', q2: 'FALSE' });

    const report = await request(app)
      .get('/api/student/analytics/self')
      .set('Authorization', `Bearer ${studentToken}`);
    expect(report.status).toBe(200);
    expect(report.body.summary.gradedCount).toBe(1);
    expect(report.body.summary.avgPercent).toBe(0);
    expect(report.body.weaknesses.some((s) => s.subject === 'READING')).toBe(true);
  });

  it('يصدر الأستاذ درجات القسم CSV', async () => {
    const prisma = (await import('../src/db.js')).default;
    const klass = await prisma.class.findFirst();
    const teacherToken = await getToken('teacher@test.tn', 'teacher123');

    const res = await request(app)
      .get(`/api/teacher/analytics/export?classId=${klass.id}&format=csv`)
      .set('Authorization', `Bearer ${teacherToken}`);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/csv');
    expect(res.text).toContain(klass.name);
    expect(res.text).toContain('التلميذ');
  });

  it('يصدر الأستاذ درجات القسم PDF', async () => {
    const prisma = (await import('../src/db.js')).default;
    const klass = await prisma.class.findFirst();
    const teacherToken = await getToken('teacher@test.tn', 'teacher123');

    const res = await request(app)
      .get(`/api/teacher/analytics/export?classId=${klass.id}&format=pdf`)
      .set('Authorization', `Bearer ${teacherToken}`);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('application/pdf');
    expect(res.body).toBeDefined();
  });
});
