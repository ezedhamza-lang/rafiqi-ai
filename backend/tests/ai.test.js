import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { resetDatabase, seedTestData, login } from './helpers.js';
import request from 'supertest';
import prisma from '../src/db.js';
import {
  saveAiKey,
  savePlatformAiKey,
  __setCallProvider,
  __resetCallProvider,
  resolveLessonContext
} from '../src/services/aiService.js';

let app;
let studentToken;
let teacherToken;

const fakeProvider = async (prompt) => {
  if (prompt.includes('المخطط الإلزامي') || prompt.includes('هيكل المذكرة الرسمية')) {
    return JSON.stringify({
      competency: 'مكوّن تجريبي',
      objective: 'هدف تجريبي',
      content: 'محتوى تجريبي',
      lessonGoal: 'هدف حصة تجريبي',
      stages: [
        { name: 'حساب ذهني', teacherActivity: 'نشاط معلم 1', learnerActivity: 'نشاط متعلم 1', tools: 'سبورة' },
        { name: 'تعهد المكتسبات', teacherActivity: 'نشاط معلم 2', learnerActivity: 'نشاط متعلم 2', tools: 'بطاقات' },
        { name: 'الوضعية الاستكشافية + التعلم المنهجي الآلي', teacherActivity: 'نشاط معلم 3', learnerActivity: 'نشاط متعلم 3', tools: 'كتاب' },
        { name: 'تعلم ادماجي', teacherActivity: 'نشاط معلم 4', learnerActivity: 'نشاط متعلم 4', tools: 'كراس' },
        { name: 'تقييم', teacherActivity: 'نشاط معلم 5', learnerActivity: 'نشاط متعلم 5', tools: 'ورقة' }
      ]
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

  it('تلميذ بلا قسم (وضع حساب الاستكشاف) يستعمل مفتاح المنصة بدل رسالة «لا مفتاح»', async () => {
    // explorer@test.tn مخلّق في seed بلا سجل Student — كان السطر
    // «if (!teacherId) throw NO_AI_KEY» يقطع مفتاح المنصة/البيئة نهائيًا.
    const user = await prisma.user.findFirst({ where: { email: 'student@test.tn' } });
    const student = await prisma.student.findFirst({ where: { accountUserId: user.id } });
    const savedClassId = student.classId;
    await prisma.student.update({ where: { id: student.id }, data: { classId: null } });
    await savePlatformAiKey(1, 'platform-key-for-chat');
    __setCallProvider(async () => 'رد-من-مفتاح-المنصة');
    try {
      const res = await request(app)
        .post('/api/ai/chat')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ message: 'مرحبا' });
      expect(res.status).toBe(200);
      expect(res.body.role).toBe('assistant');
      expect(res.body.content).toContain('رد-من-مفتاح-المنصة');
      expect(res.body.content).not.toContain('مفتاح الذكاء الاصطناعي');
    } finally {
      await prisma.student.update({ where: { id: student.id }, data: { classId: savedClassId } });
      await prisma.systemSetting.deleteMany({ where: { key: 'ai_provider_key' } });
      __setCallProvider(fakeProvider);
    }
  });
});

describe('المرحلة 7.2 — مساعد الأستاذ (خطة/ملخص/شرائح/أسئلة)', () => {
  it('توليد خطة درس كاملة يعيد هيكل المذكرة الرسمية (5 مراحل مسماة)', async () => {
    const res = await request(app)
      .post('/api/ai/generate-lesson-plan')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ subject: 'الرياضيات', level: 'السنة الأولى', lessonTitle: 'الجمع' });
    expect(res.status).toBe(200);
    expect(res.body.lessonPlan).toBeTruthy();
    expect(res.body.lessonPlan.competency).toBeTruthy();
    expect(res.body.lessonPlan.lessonGoal).toBeTruthy();
    expect(Array.isArray(res.body.lessonPlan.stages)).toBe(true);
    expect(res.body.lessonPlan.stages.length).toBe(5);
    for (const s of res.body.lessonPlan.stages) {
      expect(s.name).toBeTruthy();
      expect(s.teacherActivity).toBeTruthy();
      expect(s.learnerActivity).toBeTruthy();
      expect(s.tools).toBeTruthy();
    }
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

  it('عند تعذّر قراءة JSON مرتين: 502 برسالة صادقة لا «أضف مفتاحك» + إعادة محاولة واحدة', async () => {
    let calls = 0;
    __setCallProvider(async () => { calls += 1; return 'نص حر لا يحوي أي مصفوفة أسئلة.'; });
    const res = await request(app)
      .post('/api/ai/generate-quiz')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ subject: 'الرياضيات', level: 'السنة الأولى', lessonTitle: 'الجمع', count: 3 });
    expect(res.status).toBe(502);
    expect(res.body.error).toContain('صيغة الأسئلة');
    expect(res.body.error).not.toContain('أضف مفتاح');
    expect(calls).toBe(2);
    __setCallProvider(fakeProvider);
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

  it('مخرجات ذكاء مشوهة تُرفض بخطأ واضح بدل حفظ قمامة', async () => {
    __setCallProvider(async () => JSON.stringify({ wrong: 'schema', stages: [{ name: 'x' }] }));
    const res = await request(app)
      .post('/api/ai/generate-lesson-plan')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ subject: 'الرياضيات', level: 'السنة الأولى', lessonTitle: 'الجمع' });
    expect(res.status).toBe(422);
    expect(res.body.error).toContain('للقالب الرسمي');
    __setCallProvider(fakeProvider);
  });

  it('خطة الدرس تطلب ميزانية رموز كافية للمذكرة الكاملة', async () => {
    let seenOpts = null;
    __setCallProvider(async (prompt, key, provider, opts) => {
      seenOpts = opts;
      return fakeProvider(prompt);
    });
    const res = await request(app)
      .post('/api/ai/generate-lesson-plan')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ subject: 'الرياضيات', level: 'السنة الأولى', lessonTitle: 'الجمع' });
    expect(res.status).toBe(200);
    expect(Number(seenOpts && seenOpts.maxTokens)).toBeGreaterThanOrEqual(3000);
    __setCallProvider(fakeProvider);
  });

  it('خطأ المزوّد يُترجم لرسالة عربية محددة (مفتاح مرفوض/حصة)', async () => {
    const badKey = async () => {
      const err = new Error('AI service error: 401');
      err.providerStatus = 401;
      throw err;
    };
    __setCallProvider(badKey);
    const r1 = await request(app)
      .post('/api/ai/generate-lesson-plan')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ subject: 'الرياضيات', level: 'السنة الأولى', lessonTitle: 'الجمع' });
    expect(r1.status).toBe(401);
    expect(r1.body.error).toContain('مرفوض');
    const quota = async () => {
      const err = new Error('AI service error: 429');
      err.providerStatus = 429;
      throw err;
    };
    __setCallProvider(quota);
    const r2 = await request(app)
      .post('/api/ai/generate-lesson-plan')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ subject: 'الرياضيات', level: 'السنة الأولى', lessonTitle: 'الجمع' });
    expect(r2.status).toBe(429);
    expect(r2.body.error).toContain('حصة');
    __setCallProvider(fakeProvider);
  });

  it('كشف المزوّد من صيغة المفتاح (gemini/groq/nvidia/openai)', async () => {
    const teacher = await prisma.user.findFirst({ where: { email: 'teacher@test.tn' } });
    await saveAiKey(teacher.id, 'AIza-test-key');
    let row = await prisma.aiKey.findUnique({ where: { teacherId: teacher.id } });
    expect(row.provider).toBe('gemini');
    await saveAiKey(teacher.id, 'gsk_test-key');
    row = await prisma.aiKey.findUnique({ where: { teacherId: teacher.id } });
    expect(row.provider).toBe('groq');
    await saveAiKey(teacher.id, 'nvapi-test-key');
    row = await prisma.aiKey.findUnique({ where: { teacherId: teacher.id } });
    expect(row.provider).toBe('nvidia');
    await saveAiKey(teacher.id, 'sk-test-key');
    row = await prisma.aiKey.findUnique({ where: { teacherId: teacher.id } });
    expect(row.provider).toBe('openai');
    await saveAiKey(teacher.id, 'fake-gemini-key');
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
