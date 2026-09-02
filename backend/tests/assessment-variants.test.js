import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import prisma from '../src/db.js';
import { seedTestData, resetDatabase } from './helpers.js';
import { generateExamVariants } from '../src/services/assessmentVariantService.js';
import { generateOfflineQuiz } from '../src/services/offlineQuizGeneratorService.js';

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

const QUESTIONS = [
  { id: 'q1', type: 'MCQ', prompt: '2+2؟', options: ['3', '4', '5'], correctOption: 1, points: 1 },
  { id: 'q2', type: 'MCQ', prompt: 'أكبر من 7؟', options: ['6', '8'], correctOption: 1, points: 1 },
  { id: 'q3', type: 'TRUE_FALSE', prompt: '5 أكبر من 3.', correctAnswer: 'TRUE', points: 1 }
];

describe('محرك الاختبارات بلا تكرار (نسخ Blueprint)', () => {
  it('كل النسخ تحمل نفس الأسئلة والنقاط (Blueprint محفوظ)', () => {
    const variants = generateExamVariants(QUESTIONS, 4, 'quiz-1');
    expect(variants.length).toBe(4);
    for (const v of variants) {
      expect(v.questions.length).toBe(3);
      const ids = v.questions.map((q) => q.id).sort();
      expect(ids).toEqual(['q1', 'q2', 'q3']);
      const totalPoints = v.questions.reduce((s, q) => s + q.points, 0);
      expect(totalPoints).toBe(3);
    }
  });

  it('الخيارات مخلوطة مع بقاء الجواب الصحيح صحيحاً', () => {
    const variants = generateExamVariants(QUESTIONS, 6, 'quiz-2');
    for (const v of variants) {
      for (const q of v.questions.filter((x) => x.type === 'MCQ')) {
        const original = QUESTIONS.find((o) => o.id === q.id);
        const correctText = original.options[original.correctOption];
        expect(q.options[q.correctOption]).toBe(correctText);
        // الخيارات نفسها موجودة كلها
        expect([...q.options].sort()).toEqual([...original.options].sort());
      }
    }
  });

  it('التوليد حتمي: نفس المفتاح يعيد نفس النسخ', () => {
    const a = generateExamVariants(QUESTIONS, 3, 'quiz-X');
    const b = generateExamVariants(QUESTIONS, 3, 'quiz-X');
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('توجد فعلاً نسخ مختلفة في الترتيب (لا تكرار أعمى)', () => {
    const variants = generateExamVariants(QUESTIONS, 6, 'quiz-Y');
    const orders = new Set(variants.map((v) => v.questions.map((q) => q.id).join(',')));
    expect(orders.size).toBeGreaterThan(1);
  });
});

describe('مولّد الأسئلة من البنك المحلي (بلا إنترنت)', () => {
  beforeAll(async () => {
    await resetDatabase();
    await seedTestData();
  });

  it('يولّد اختبار رياضيات بعدد الأسئلة المطلوب وبصيغة موحدة', () => {
    const paper = generateOfflineQuiz({ gradeId: 'year1', subject: 'math', count: 10 });
    expect(paper.count).toBeGreaterThan(0);
    expect(paper.questions.length).toBe(paper.count);
    for (const q of paper.questions) {
      expect(['MCQ', 'TRUE_FALSE']).toContain(q.type);
      expect(q.prompt).toBeTruthy();
      if (q.type === 'MCQ') {
        expect(q.options.length).toBeGreaterThan(1);
        expect(q.options[q.correctOption]).toBeTruthy();
      }
    }
  });

  it('الحتمية: نفس الـseed يعيد نفس الورقة', () => {
    const a = generateOfflineQuiz({ subject: 'math', count: 8, seed: 'abc' });
    const b = generateOfflineQuiz({ subject: 'math', count: 8, seed: 'abc' });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('نقطة النهاية تعمل وتحفظ اختباراً عند الطلب', async () => {
    await resetDatabase();
    await seedTestData();
    const loginBody = (await request(app).post('/api/auth/login').send({ email: 'teacher@test.tn', password: 'teacher123' })).body;
    const token = loginBody.accessToken || loginBody.token;
    const klass = await prisma.class.findFirst();

    const gen = await request(app)
      .post('/api/teacher/quizzes/generate-offline')
      .set('Authorization', `Bearer ${token}`)
      .send({ gradeId: 'year1', subject: 'math', count: 6 });
    expect(gen.status).toBe(200);
    expect(gen.body.count).toBe(6);

    const saved = await request(app)
      .post('/api/teacher/quizzes/generate-offline')
      .set('Authorization', `Bearer ${token}`)
      .send({ gradeId: 'year1', subject: 'math', count: 6, save: true, classId: klass.id, title: 'اختبار مولّد آلياً' });
    expect(saved.status).toBe(201);
    expect(saved.body.savedQuizId).toBeTruthy();
    const inDb = await prisma.quiz.findUnique({ where: { id: saved.body.savedQuizId } });
    expect(inDb.questions.length).toBe(6);
  });
});