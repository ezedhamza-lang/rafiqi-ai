import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { resetDatabase, seedTestData, login } from './helpers.js';
import request from 'supertest';
import prisma from '../src/db.js';
import {
  saveAiKey,
  __setCallProvider,
  __resetCallProvider,
  generateText,
  getPlatformAiKey,
  savePlatformAiKey,
  deletePlatformAiKey
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
});
