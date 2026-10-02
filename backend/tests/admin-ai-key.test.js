import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { resetDatabase, seedTestData, login } from './helpers.js';
import request from 'supertest';
import prisma from '../src/db.js';
import {
  saveAiKey,
  __setCallProvider,
  __resetCallProvider,
  generateText,
  generateQuizQuestions,
  getPlatformAiKey,
  savePlatformAiKey,
  deletePlatformAiKey,
  resolveApiKey
} from '../src/services/aiService.js';

let app;
let adminToken;
let teacherToken;

const fakeProvider = async () => 'رد افتراضي من مزود وهمي.';

beforeAll(async () => {
  ({ app } = await import('../src/index.js'));
  await resetDatabase();
  await seedTestData();

  const ares = await login('admin@education.tn', 'admin123');
  adminToken = ares.body.token;
  const tres = await login('teacher@test.tn', 'teacher123');
  teacherToken = tres.body.token;
});

afterAll(() => {
  __resetCallProvider();
});

describe('المرحلة 7.3 — إدارة مفتاح الذكاء الاصطناعي على مستوى المنصة', () => {
  it('يحظر وصول غير المسؤولين إلى إدارة مفتاح المنصة (403)', async () => {
    const res = await request(app)
      .get('/api/admin/ai/key')
      .set('Authorization', `Bearer ${teacherToken}`);
    expect(res.status).toBe(403);

    const res2 = await request(app)
      .post('/api/admin/ai/key')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ apiKey: 'x' });
    expect(res2.status).toBe(403);

    // مديرو المدارس ليسوا إدارة منصة — لا يعبثون بمفتاح AI المشترك
    const dres = await login('director@test.tn', 'director123');
    const dget = await request(app).get('/api/admin/ai/key').set('Authorization', `Bearer ${dres.body.token}`);
    expect(dget.status).toBe(403);
    const ddel = await request(app).delete('/api/admin/ai/key').set('Authorization', `Bearer ${dres.body.token}`);
    expect(ddel.status).toBe(403);
  });

  it('يتطلب مصادقة (401 بدون توكن)', async () => {
    const res = await request(app).get('/api/admin/ai/key');
    expect(res.status).toBe(401);
  });

  it('يعيد الحالة غير المهيأة مبدئياً (configured:false)', async () => {
    await prisma.systemSetting.deleteMany({});
    const res = await request(app)
      .get('/api/admin/ai/key')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.configured).toBe(false);
    expect(res.body.hasValue).toBe(false);
  });

  it('يرفض مفتاحاً فارغاً (400)', async () => {
    const res = await request(app)
      .post('/api/admin/ai/key')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ apiKey: '   ' });
    expect(res.status).toBe(400);
  });

  it('يحفظ مفتاح المنصة ثم يعيد الحالة مهيأة من قاعدة البيانات', async () => {
    const res = await request(app)
      .post('/api/admin/ai/key')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ apiKey: 'platform-secret-key' });
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);

    const get = await request(app)
      .get('/api/admin/ai/key')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(get.status).toBe(200);
    expect(get.body.configured).toBe(true);
    expect(get.body.source).toBe('db');
    expect(get.body.hasValue).toBe(false);

    const row = await prisma.systemSetting.findUnique({ where: { key: 'ai_provider_key' } });
    expect(row).toBeTruthy();
    expect(row.value).not.toContain('platform-secret-key');
    expect(row.updatedBy).toBeTruthy();
  });

  it('يحذف مفتاح المنصة', async () => {
    const res = await request(app)
      .delete('/api/admin/ai/key')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);

    const get = await request(app)
      .get('/api/admin/ai/key')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(get.body.configured).toBe(false);
  });

  it('يستخدم مفتاح المنصة عند غياب مفتاح المعلّم (ترتيب الاحتياط)', async () => {
    await prisma.aiKey.deleteMany({});
    await savePlatformAiKey(adminToken ? 1 : 1, 'platform-key-for-call');
    __setCallProvider(fakeProvider);

    const out = await generateText(null, 'system', 'user');
    expect(out).toBe('رد افتراضي من مزود وهمي.');

    await deletePlatformAiKey();
  });

  it('مفتاح المعلّم له الأولوية على مفتاح المنصة', async () => {
    __setCallProvider(async (prompt) => `teacher-path:${prompt.includes('platform-key') ? 'no' : 'yes'}`);
    const teacher = await prisma.user.findFirst({ where: { role: 'TEACHER' } });
    await saveAiKey(teacher.id, 'teacher-specific-key');
    await savePlatformAiKey(1, 'platform-key-for-call');

    const out = await generateText(teacher.id, 'system', 'user');
    expect(out).toContain('teacher-path');

    await deletePlatformAiKey();
    await prisma.aiKey.deleteMany({});
    __resetCallProvider();
  });

  it('مفتاح مفتاح المنصة المشفر لا يكشف القيمة الخام في الجدول', async () => {
    await savePlatformAiKey(1, 'ultra-secret-platform-value');
    const row = await prisma.systemSetting.findUnique({ where: { key: 'ai_provider_key' } });
    expect(row.value).not.toContain('ultra-secret-platform-value');
    const decrypted = await getPlatformAiKey();
    expect(decrypted).toBe('ultra-secret-platform-value');
    await deletePlatformAiKey();
  });

  it('مفتاح المنصة يكتشف مزوّده من صيغة المفتاح (لا يُجبر gemini)', async () => {
    await savePlatformAiKey(1, 'gsk_platform-key');
    const groqResolved = await resolveApiKey(null);
    expect(groqResolved.provider).toBe('groq');

    await savePlatformAiKey(1, 'AIza_platform-key');
    const gemResolved = await resolveApiKey(null);
    expect(gemResolved.provider).toBe('gemini');

    // مفاتيح AI Studio الجديدة (auth keys، الصيغة AQ.… منذ ماي 2026) = Google أيضًا:
    // سابقًا كانت تسقط في فرع openai فتُرفض 401 في الإنتاج.
    await savePlatformAiKey(1, 'AQ.Ab8RN-platform-key-49wA');
    const authResolved = await resolveApiKey(null);
    expect(authResolved.provider).toBe('gemini');

    await deletePlatformAiKey();
  });

  it('عند 503 (ذروة طلب على موديل جديد) يُسقط تلقائيًّا إلى الموديل الاحتياطي', async () => {
    await savePlatformAiKey(1, 'AQ.test-auth-key');
    const urls = [];
    vi.stubGlobal('fetch', async (url) => {
      urls.push(String(url));
      if (urls.length === 1) {
        // رفض مؤقت من Google على الموديل الأساسي (كما حدث في الإنتاج يوم الإعلان)
        return new Response(
          JSON.stringify({ error: { code: 503, status: 'UNAVAILABLE', message: 'high demand' } }),
          { status: 503, headers: { 'Content-Type': 'application/json' } }
        );
      }
      return new Response(
        JSON.stringify({ candidates: [{ content: { parts: [{ text: 'رد رفيقي الاحتياطي' }] } }] }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    });
    try {
      const out = await generateText(null, 'system', 'user');
      expect(out).toBe('رد رفيقي الاحتياطي');
      expect(urls[0]).toContain('gemini-3.8-flash');
      expect(urls[1]).toContain('gemini-3.5-flash-lite');
    } finally {
      vi.unstubAllGlobals();
      await deletePlatformAiKey();
    }
  });

  it('توليد الاختبار يطلب JSON رسميًّا (responseMimeType) بحدّ رموز 3000', async () => {
    await savePlatformAiKey(1, 'AQ.quiz-json-key');
    const bodies = [];
    vi.stubGlobal('fetch', async (url, init) => {
      bodies.push(JSON.parse(init.body));
      const text = JSON.stringify([{ type: 'MCQ', prompt: 'ما 2+2؟', options: ['3', '4'], correctOption: '4', points: 1 }]);
      return new Response(
        JSON.stringify({ candidates: [{ content: { parts: [{ text }] } }] }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    });
    try {
      const qs = await generateQuizQuestions(null, { subject: 'الرياضيات', level: 'الأول', lessonTitle: 'الجمع', count: 1 });
      expect(Array.isArray(qs)).toBe(true);
      expect(qs).toHaveLength(1);
      expect(bodies[0].generationConfig.responseMimeType).toBe('application/json');
      expect(bodies[0].generationConfig.maxOutputTokens).toBe(3000);
    } finally {
      vi.unstubAllGlobals();
      await deletePlatformAiKey();
    }
  });

  it('إن رُفض وضع JSON بـ400 يُعيد النداء بدونه (تدهور آمن بلا كسر)', async () => {
    await savePlatformAiKey(1, 'AQ.degrade-key');
    const bodies = [];
    vi.stubGlobal('fetch', async (url, init) => {
      const b = JSON.parse(init.body);
      bodies.push(b);
      if (b.generationConfig.responseMimeType) {
        return new Response(
          JSON.stringify({ error: { code: 400, message: 'response_mime_type is not supported' } }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }
      const text = '[{"type":"MCQ","prompt":"س؟","options":["أ"],"correctOption":"أ","points":1}]';
      return new Response(
        JSON.stringify({ candidates: [{ content: { parts: [{ text }] } }] }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    });
    try {
      const qs = await generateQuizQuestions(null, { subject: 'رياضيات', level: '', lessonTitle: '', count: 1 });
      expect(qs).toHaveLength(1);
      expect(bodies).toHaveLength(2);
      expect(bodies[0].generationConfig.responseMimeType).toBe('application/json');
      expect(bodies[1].generationConfig.responseMimeType).toBeUndefined();
    } finally {
      vi.unstubAllGlobals();
      await deletePlatformAiKey();
    }
  });

  it('قراءة فاشلة بعد محاولتين ترمي AI_BAD_JSON (بلا صمت ولا رسالة مفتاح كاذبة)', async () => {
    await savePlatformAiKey(1, 'AQ.badjson-key');
    let calls = 0;
    vi.stubGlobal('fetch', async () => {
      calls += 1;
      return new Response(
        JSON.stringify({ candidates: [{ content: { parts: [{ text: 'الموديل أعاد كلامًا حرًّا بلا JSON' }] } }] }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    });
    try {
      await expect(
        generateQuizQuestions(null, { subject: 'رياضيات', level: '', lessonTitle: '', count: 2 })
      ).rejects.toThrow('AI_BAD_JSON');
      expect(calls).toBe(2);
    } finally {
      vi.unstubAllGlobals();
      await deletePlatformAiKey();
    }
  });
});
