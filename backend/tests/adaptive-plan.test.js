import { describe, it, expect, beforeAll } from 'vitest';
import { resetDatabase, seedTestData, login } from './helpers.js';
import request from 'supertest';
import prisma from '../src/db.js';
import { buildLearningPlan } from '../src/services/adaptivePlanService.js';
import { buildSession, applyReview } from '../src/services/adaptiveService.js';

let app;
let token;
let studentId;

beforeAll(async () => {
  ({ app } = await import('../src/index.js'));
  await resetDatabase();
  await seedTestData();
  const res = await login('student@test.tn', 'student123');
  token = res.body.token;
  expect(token).toBeTruthy();
  const student = await prisma.user.findUnique({ where: { email: 'student@test.tn' } });
  studentId = student.id;
});

async function seedMathPerformance(high = true) {
  const teacher = await prisma.user.findUnique({ where: { email: 'teacher@test.tn' } });
  const quiz = await prisma.quiz.create({
    data: { teacherId: teacher.id, title: 'اختبار الرياضيات', subject: 'MATH', questions: [] }
  });
  await prisma.submission.create({
    data: { quizId: quiz.id, studentId, answers: {}, score: high ? 18 : 6, totalPoints: 20 }
  });
}

async function seedScienceWeak() {
  const teacher = await prisma.user.findUnique({ where: { email: 'teacher@test.tn' } });
  const assignment = await prisma.assignment.create({
    data: { teacherId: teacher.id, subject: 'SCIENCE', title: 'واجب الإيقاظ', questions: [], status: 'PUBLISHED' }
  });
  await prisma.assignmentSubmission.create({
    data: { assignmentId: assignment.id, studentId, answers: {}, score: 4, totalPoints: 20, status: 'GRADED' }
  });
}

async function seedAdaptiveReviews({ correct }) {
  const session = await buildSession(studentId, 'year1', 'math', 4);
  for (const item of session.items) {
    await applyReview({ userId: studentId, itemKey: item.itemKey, gradeId: 'year1', subjectId: 'math', correct });
  }
}

describe('خطة التعلّم الشخصية (التعلم التكيفي المتقدم — 7.3)', () => {
  it('تتطلب مصادقة (401 بدون توكن)', async () => {
    const res = await request(app).get('/api/student/adaptive/plan').send();
    expect(res.status).toBe(401);
  });

  it('تتطلب دور تلميذ (403 للأستاذ)', async () => {
    const teacherLogin = await login('teacher@test.tn', 'teacher123');
    const res = await request(app)
      .get('/api/student/adaptive/plan')
      .set('Authorization', `Bearer ${teacherLogin.body.token}`);
    expect(res.status).toBe(403);
  });

  it('تستجيب بدون بيانات: NO_DATA + توصية افتراضية + مصفوفات كاملة', async () => {
    const res = await request(app)
      .get('/api/student/adaptive/plan')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.student.firstName).toBe('أحمد');
    expect(res.body.overall.status).toBe('NO_DATA');
    expect(res.body.overall.hasData).toBe(false);
    expect(Array.isArray(res.body.subjects)).toBe(true);
    expect(res.body.subjects.length).toBeGreaterThan(0);
    expect(res.body.dailyPlan.length).toBeGreaterThan(0);
    expect(Array.isArray(res.body.reasons)).toBe(true);
    expect(Array.isArray(res.body.adjustments)).toBe(true);
    expect(res.body.subjects[0].status).toBe('NO_DATA');
    expect(res.body.subjects[0].targetDifficulty).toBe(1);
  });

  it('يكتشف مادة ضعيفة من درجات الواجب ويعتبرها محور تركيز', async () => {
    await seedScienceWeak();
    const res = await request(app)
      .get('/api/student/adaptive/plan')
      .set('Authorization', `Bearer ${token}`);
    const science = res.body.subjects.find((s) => s.subjectId === 'science');
    expect(science.status).toBe('WEAK');
    expect(science.proficiency).toBeLessThan(60);
    expect(res.body.overall.focusAreas.some((f) => f.subjectId === 'science')).toBe(true);
    expect(science.remainingLessons).toBeGreaterThan(0);
    expect(science.nextLesson).toBeTruthy();
  });

  it('يبني خطة يومية من الأرقام الحقيقية (مراجعة/درس/تمرين)', async () => {
    const plan = await buildLearningPlan(studentId);
    const types = new Set(plan.dailyPlan.map((d) => d.type));
    expect(plan.dailyPlan.length).toBeGreaterThan(0);
    for (const item of plan.dailyPlan.slice(0, 6)) {
      expect(item.title).toBeTruthy();
      expect(item.detail).toBeTruthy();
    }
    expect(types.has('LESSON')).toBe(true);
  });

  it('يرفع المستوى المستهدف للمادة المتقنة ديناميكياً مع سبب واضح', async () => {
    await seedAdaptiveReviews({ correct: true });
    const res = await request(app)
      .get('/api/student/adaptive/plan')
      .set('Authorization', `Bearer ${token}`);
    const math = res.body.subjects.find((s) => s.subjectId === 'math');
    expect(math.adaptive.accuracy).toBe(100);
    expect(math.adjusted).toBe(true);
    expect(math.targetDifficulty).toBeGreaterThan(math.baseDifficulty);
    const adj = res.body.adjustments.find((a) => a.subjectId === 'math');
    expect(adj).toBeTruthy();
    expect(adj.reason).toContain('تجاوز 80%');
  });

  it('يبقي المستوى المستهدف منخفضاً عند الدقة الضعيفة (تسهيل)', async () => {
    const res = await request(app)
      .get('/api/student/adaptive/plan')
      .set('Authorization', `Bearer ${token}`);
    const science = res.body.subjects.find((s) => s.subjectId === 'science');
    expect(science.targetDifficulty).toBeLessThanOrEqual(2);
  });

  it('جلسة الممارسة الموصى بها تقدّم الأضعف أولاً', async () => {
    const res = await request(app)
      .post('/api/student/adaptive/plan/session')
      .set('Authorization', `Bearer ${token}`)
      .send({ limit: 6 });
    expect(res.status).toBe(200);
    expect(res.body.items.length).toBeGreaterThan(0);
    expect(res.body.meta.order.length).toBeGreaterThan(0);
    expect(res.body.meta.order[0].subjectId).toBe('science');
    expect(res.body.meta.basedOn).toBe('weakest-first');
    for (const item of res.body.items) {
      expect(item.itemKey).toBeTruthy();
      expect(item.question.text).toBeTruthy();
      expect(item.state).toBeTruthy();
    }
  });

  it('جلسة الممارسة تقبل تحديد مادة وتتحقق من إرسالها منفردة', async () => {
    const ok = await request(app)
      .post('/api/student/adaptive/plan/session')
      .set('Authorization', `Bearer ${token}`)
      .send({ gradeId: 'year1', subjectId: 'math', limit: 3 });
    expect(ok.status).toBe(200);
    expect(ok.body.items.length).toBeLessThanOrEqual(3);

    const bad = await request(app)
      .post('/api/student/adaptive/plan/session')
      .set('Authorization', `Bearer ${token}`)
      .send({ gradeId: 'year1' });
    expect(bad.status).toBe(400);
  });

  it('يعيد إنشاء الخطة ديناميكياً بعد تحسّن الأداء', async () => {
    await seedMathPerformance(true);
    const before = await buildLearningPlan(studentId);
    const mathBefore = before.subjects.find((s) => s.subjectId === 'math');
    const res = await request(app)
      .get('/api/student/adaptive/plan')
      .set('Authorization', `Bearer ${token}`);
    const mathAfter = res.body.subjects.find((s) => s.subjectId === 'math');
    expect(mathAfter.assessment.avgPercent).toBeGreaterThan(80);
    expect(mathAfter.proficiency).toBeGreaterThanOrEqual(mathBefore.proficiency || 0);
    expect(res.body.overall.hasData).toBe(true);
  });
});
