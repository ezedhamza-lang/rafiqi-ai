import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { resetDatabase, seedTestData, login } from './helpers.js';
import request from 'supertest';
import prisma from '../src/db.js';
import {
  saveAiKey,
  __setCallProvider,
  __resetCallProvider,
  resolveLessonContext
} from '../src/services/aiService.js';

let app;
let studentToken;
let teacherToken;

const fakeProvider = async (prompt) => {
  if (prompt.includes('خطة درس بصيغة JSON') || prompt.includes('أنشئ خطة درس')) {
    return JSON.stringify({
      title: 'خطة درس الرياضيات',
      objectives: ['التعرف على المفهوم', 'تطبيق المفهوم في تمارين'],
      materials: ['كتاب التلميذ', 'سبورة'],
      stages: [
        { time: '5 د', name: 'تمهيد', goal: 'تهيئة التلميذ', activity: 'سؤال تمهيدي' },
        { time: '25 د', name: 'شرح', goal: 'تقديم المحتوى', activity: 'شرح المفهوم' },
        { time: '15 د', name: 'تقويم', goal: 'قياس التعلم', activity: 'تمارين قصيرة' }
      ],
      evaluation: 'ملاحظة إنجاز التمارين',
      homework: 'حل تمرين من الكتاب'
    });
  }
  if (prompt.includes('شرائح عرض تقديمي') || prompt.includes('أنشئ شرائح')) {
    return JSON.stringify([
      { title: 'درس الرياضيات', body: 'الدرس الكامل' },
      { title: 'الأهداف', body: 'أن يتعرف المتعلم على المفهوم' },
      { title: 'المحتوى', body: 'شرح المفهوم' },
      { title: 'التقويم', body: 'أسئلة قصيرة' }
    ]);
  }
  if (prompt.includes('ملخصا موجزا') || prompt.includes('اكتب ملخصا')) {
    return 'هذا ملخص درس الرياضيات: يتعرف المتعلم على المفهوم الأساسي ثم يطبقه في تمارين تطبيقية.';
  }
  if (prompt.includes('أنشئ أسئلة اختبار')) {
    return JSON.stringify([
      { type: 'MCQ', prompt: 'ما نتيجة 2+2؟', options: ['3', '4', '5'], correctOption: '4', points: 1 }
    ]);
  }
  if (prompt.includes('قصة قصيرة')) {
    return 'كان يا مكان في قديم الزمان قصة جميلة عن الصداقة.';
  }
  return 'رد افتراضي من رفيقي بسيط ومشجع.';
};

beforeAll(async () => {
  ({ app } = await import('../src/index.js'));
  await resetDatabase();
  await seedTestData();

  const sres = await login('student@test.tn', 'student123');
  studentToken = sres.body.token;
  const tres = await login('teacher@test.tn', 'teacher123');
  teacherToken = tres.body.token;

  const teacher = await prisma.user.findFirst({ where: { email: 'teacher@test.tn' } });
  await saveAiKey(teacher.id, 'fake-gemini-key');
  __setCallProvider(fakeProvider);
});

afterAll(() => {
  __resetCallProvider();
});

describe('المرحلة 7.1 — رفيقي مربوط بمحتوى المنهج', () => {
  it('سياق رفيقي يعيد مستوى التلميذ ومواده ودروسه', async () => {
    const res = await request(app)
      .get('/api/ai/student/tutor-context')
      .set('Authorization', `Bearer ${studentToken}`);
    expect(res.status).toBe(200);
    expect(res.body.level).toBeTruthy();
    expect(Array.isArray(res.body.subjects)).toBe(true);
    expect(res.body.subjects.length).toBeGreaterThan(0);
    const math = res.body.subjects.find((s) => s.id === 'math');
    expect(math).toBeTruthy();
    expect(math.lessons.length).toBeGreaterThan(0);
    expect(math.lessons[0].id).toBeTruthy();
    expect(math.lessons[0].title).toBeTruthy();
  });

  it('يتطلب مصادقة (401 بدون توكن)', async () => {
    const res = await request(app).get('/api/ai/student/tutor-context').send();
    expect(res.status).toBe(401);
  });

  it('resolveLessonContext يستخرج محتوى درس حقيقي من المنهج', () => {
    const ctx = resolveLessonContext({ gradeId: 'year1', subjectId: 'math', level: 'السنة الأولى أساسي' });
    expect(ctx.length).toBeGreaterThan(50);
    expect(ctx).toContain('الدرس:');
  });

  it('محادثة التلميذ مع درس محدد تستعمل السياق وتحفظ الرسائل', async () => {
    const res = await request(app)
      .post('/api/ai/chat')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ message: 'اشرح لي درس الرياضيات', gradeId: 'year1', subjectId: 'math', lessonId: 'year1' });
    expect(res.status).toBe(200);
    expect(res.body.role).toBe('assistant');
    expect(res.body.content.length).toBeGreaterThan(0);

    const hist = await request(app)
      .get('/api/ai/chat/history')
      .set('Authorization', `Bearer ${studentToken}`);
    expect(hist.status).toBe(200);
    expect(hist.body.some((m) => m.role === 'assistant')).toBe(true);
  });

  it('محادثة بلا مفتاح (أستاذ بلا AIKey) تعيد رسالة لطيفة بدل خطأ', async () => {
    await prisma.aiKey.deleteMany({});
    try {
      const res = await request(app)
        .post('/api/ai/chat')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ message: 'مرحبا' });
      expect(res.status).toBe(200);
      expect(res.body.role).toBe('assistant');
      expect(res.body.content).toContain('مفتاح');
    } finally {
      const teacher = await prisma.user.findFirst({ where: { email: 'teacher@test.tn' } });
      await saveAiKey(teacher.id, 'fake-gemini-key');
    }
  });
});

describe('المرحلة 7.2 — مساعد الأستاذ (خطة/ملخص/شرائح/أسئلة)', () => {
  it('توليد خطة درس كاملة يعيد بنية JSON صحيحة', async () => {
    const res = await request(app)
      .post('/api/ai/generate-lesson-plan')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ subject: 'الرياضيات', level: 'السنة الأولى', lessonTitle: 'الجمع' });
    expect(res.status).toBe(200);
    expect(res.body.lessonPlan).toBeTruthy();
    expect(res.body.lessonPlan.objectives.length).toBeGreaterThan(0);
    expect(Array.isArray(res.body.lessonPlan.stages)).toBe(true);
    expect(res.body.lessonPlan.stages.length).toBeGreaterThan(0);
    expect(res.body.lessonPlan.stages[0].time).toBeTruthy();
  });

  it('توليد ملخص درس يعيد نصا', async () => {
    const res = await request(app)
      .post('/api/ai/generate-summary')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ subject: 'الرياضيات', level: 'السنة الأولى', lessonTitle: 'الجمع' });
    expect(res.status).toBe(200);
    expect(res.body.summary.length).toBeGreaterThan(10);
  });

  it('توليد شرائح عرض يعيد مصفوفة شرائح', async () => {
    const res = await request(app)
      .post('/api/ai/generate-presentation')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ subject: 'الرياضيات', level: 'السنة الأولى', lessonTitle: 'الجمع', slideCount: 5 });
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.slides)).toBe(true);
    expect(res.body.slides.length).toBeGreaterThan(0);
    expect(res.body.slides[0].title).toBeTruthy();
  });

  it('توليد أسئلة الاختبار لا يزال يعمل', async () => {
    const res = await request(app)
      .post('/api/ai/generate-quiz')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ subject: 'الرياضيات', level: 'السنة الأولى', lessonTitle: 'الجمع', count: 3 });
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.questions)).toBe(true);
  });

  it('مولدات الأستاذ تتطلب مصادقة أستاذ (رفض للتلميذ)', async () => {
    const res = await request(app)
      .post('/api/ai/generate-lesson-plan')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ subject: 'الرياضيات', level: 'السنة الأولى', lessonTitle: 'الجمع' });
    expect(res.status).toBe(403);
  });

  it('توليد خطة درس بدون عنوان يرفض (400)', async () => {
    const res = await request(app)
      .post('/api/ai/generate-lesson-plan')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ subject: 'الرياضيات' });
    expect(res.status).toBe(400);
  });

  it('توليد بلا مفتاح يعيد 400 برسالة واضحة', async () => {
    await prisma.aiKey.deleteMany({});
    const res = await request(app)
      .post('/api/ai/generate-lesson-plan')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ subject: 'الرياضيات', level: 'السنة الأولى', lessonTitle: 'الجمع' });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('مفتاح');
  });
});
