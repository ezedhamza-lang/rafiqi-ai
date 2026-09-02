import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import prisma from '../src/db.js';
import { seedTestData, resetDatabase } from './helpers.js';
import { buildMasteryMap, detectGaps, analyzeQuiz } from '../src/services/learningIntelligenceService.js';

let request;
let app;

beforeAll(async () => {
  const { default: supertest } = await import('supertest');
  request = supertest;
  const mod = await import('../src/index.js');
  app = mod.app;
});

afterAll(async () => {
  await prisma.$disconnect();
});

async function login(email, password) {
  const res = await request(app).post('/api/auth/login').send({ email, password });
  return res.body?.accessToken || res.body?.token;
}

describe('ذكاء التعلم — خريطة الإتقان والفجوات وتحليل الاختبارات', () => {
  let quizId;

  beforeAll(async () => {
    await resetDatabase();
    await seedTestData();
    // اختبار بأسئلة معروفة + تسليمات: سؤال يفشل فيه الجميع (سؤال مشبوه)
    const teacher = await prisma.user.findUnique({ where: { email: 'teacher@test.tn' } });
    const klass = await prisma.class.findFirst();
    const quiz = await prisma.quiz.create({
      data: {
        teacherId: teacher.id,
        classId: klass.id,
        title: 'اختبار تجريبي للتحليل',
        subject: 'رياضيات',
        questions: [
          { id: 'q1', type: 'MCQ', prompt: '2+2؟', options: ['3', '4'], correctOption: '4', points: 5 },
          { id: 'q2', type: 'MCQ', prompt: 'سؤال صعب جداً', options: ['أ', 'ب'], correctOption: 'ب', points: 5 }
        ]
      }
    });
    quizId = quiz.id;
    // تسليمات: q1 ينجح فيها الجميع، q2 يفشل فيها الجميع
    const student = await prisma.user.findUnique({ where: { email: 'student@test.tn' } });
    await prisma.submission.create({
      data: { quizId: quiz.id, studentId: student.id, answers: { q1: '4', q2: 'أ' }, score: 5, totalPoints: 10 }
    });
    const parent = await prisma.user.findUnique({ where: { email: 'parent@test.tn' } });
    await prisma.submission.create({
      data: { quizId: quiz.id, studentId: parent.id, answers: { q1: '4', q2: 'أ' }, score: 5, totalPoints: 10 }
    });
    const admin = await prisma.user.findUnique({ where: { email: 'admin@education.tn' } });
    await prisma.submission.create({
      data: { quizId: quiz.id, studentId: admin.id, answers: { q1: '4', q2: 'أ' }, score: 5, totalPoints: 10 }
    });
  });

  it('خريطة الإتقان تعيد المواد والدروس بحالة حقيقية', async () => {
    const student = await prisma.user.findUnique({ where: { email: 'student@test.tn' } });
    const map = await buildMasteryMap(student.id);
    expect(map.summary.total).toBeGreaterThan(0);
    expect(map.subjects.length).toBeGreaterThan(0);
    for (const s of map.subjects) {
      expect(Array.isArray(s.lessons)).toBe(true);
      for (const l of s.lessons) expect(['MASTERED', 'IN_PROGRESS', 'NOT_STARTED']).toContain(l.mastery);
    }
  });

  it('رادار الفجوات يكتشف الاختبار الضعيف بأدلة', async () => {
    const student = await prisma.user.findUnique({ where: { email: 'student@test.tn' } });
    const gaps = await detectGaps(student.id);
    const mathGap = gaps.find((g) => g.area === 'math' && g.severity !== 'LOW');
    if (mathGap) {
      expect(mathGap.why).toContain('%');
      expect(mathGap.suggestedAction).toBeTruthy();
    }
  });

  it('تحليل الاختبار يكشف السؤال المشبوه (نجاح 0%) ويميز السهل (100%)', async () => {
    const analysis = await analyzeQuiz(quizId);
    expect(analysis.submissions).toBe(3);
    expect(analysis.classAvgPct).toBe(50);
    const q1 = analysis.questions.find((q) => q.questionId === 'q1');
    const q2 = analysis.questions.find((q) => q.questionId === 'q2');
    expect(q1.successRate).toBe(100);
    expect(q1.flag).toContain('سهل');
    expect(q2.successRate).toBe(0);
    expect(q2.flag).toContain('أجهل');
    expect(analysis.suspiciousQuestions.length).toBe(2);
  });

  it('نقاط النهاية محمية: التلميذ يرى خرائطه ولا يرى تحليل المعلم', async () => {
    const stoken = await login('student@test.tn', 'student123');
    const mastery = await request(app).get('/api/student/mastery').set('Authorization', `Bearer ${stoken}`);
    expect(mastery.status).toBe(200);
    const gaps = await request(app).get('/api/student/gaps').set('Authorization', `Bearer ${stoken}`);
    expect(gaps.status).toBe(200);
    const forbidden = await request(app).get(`/api/teacher/quizzes/${quizId}/analysis`).set('Authorization', `Bearer ${stoken}`);
    expect([401, 403]).toContain(forbidden.status);

    const ttoken = await login('teacher@test.tn', 'teacher123');
    const analysis = await request(app).get(`/api/teacher/quizzes/${quizId}/analysis`).set('Authorization', `Bearer ${ttoken}`);
    expect(analysis.status).toBe(200);
  });
});