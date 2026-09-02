import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import prisma from '../src/db.js';
import { seedTestData, resetDatabase } from './helpers.js';
import { buildDailyBriefing } from '../src/services/teacherCopilotService.js';

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

describe('مساعد المعلّم الذكي (Teacher Copilot)', () => {
  beforeAll(async () => {
    await resetDatabase();
    await seedTestData();
  });

  it('يتطلب مصادقة (401 بلا توكن)', async () => {
    const res = await request(app).get('/api/teacher/copilot');
    expect(res.status).toBe(401);
  });

  it('البريف اليومي يعيد بنية قابلة للتفسير لقسم المعلم', async () => {
    const teacher = await prisma.user.findUnique({ where: { email: 'teacher@test.tn' } });
    const briefing = await buildDailyBriefing(teacher.id);
    expect(briefing.generatedAt).toBeTruthy();
    expect(briefing.explainability).toContain('القرار النهائي للمعلّم');
    expect(Array.isArray(briefing.classes)).toBe(true);
    expect(Array.isArray(briefing.suggestions)).toBe(true);
    // كل اقتراح يحمل التفسير والأدلة ودرجة الثقة
    for (const s of briefing.suggestions) {
      expect(s.action).toBeTruthy();
      expect(s.why).toBeTruthy();
      expect(Array.isArray(s.evidence)).toBe(true);
      expect(['HIGH', 'MEDIUM', 'LOW']).toContain(s.confidence);
    }
  });

  it('الدرس التالي المقترح يأتي من فهرس الكتاب مع نسبة إنجاز حقيقية', async () => {
    const klass = await prisma.class.findFirst({ where: { name: 'قسم السنة الأولى أ' } });
    const teacher = await prisma.user.findUnique({ where: { email: 'teacher@test.tn' } });
    const briefing = await buildDailyBriefing(teacher.id, { classId: klass.id, subject: 'رياضيات' });
    const entry = briefing.classes.find((c) => c.classId === klass.id);
    expect(entry).toBeTruthy();
    if (entry.nextLesson) {
      expect(entry.nextLesson.lessonId).toBeTruthy();
      expect(entry.nextLesson.totalLessons).toBeGreaterThan(0);
      expect(entry.nextLesson.classCompletionPct).toBeGreaterThanOrEqual(0);
      expect(entry.nextLesson.why).toContain('60%');
    }
  });

  it('نقطة النهاية تعمل عبر HTTP بتوكن المعلم', async () => {
    const login = await request(app).post('/api/auth/login').send({ email: 'teacher@test.tn', password: 'teacher123' });
    const token = login.body?.accessToken || login.body?.token;
    expect(token).toBeTruthy();
    const res = await request(app).get('/api/teacher/copilot').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.classes).toBeTruthy();
    expect(res.body.corrections).toBeTruthy();
  });

  it('التلميذ ممنوع من نقطة المعلم (403)', async () => {
    const login = await request(app).post('/api/auth/login').send({ email: 'student@test.tn', password: 'student123' });
    const token = login.body?.accessToken || login.body?.token;
    const res = await request(app).get('/api/teacher/copilot').set('Authorization', `Bearer ${token}`);
    expect([401, 403]).toContain(res.status);
  });
});