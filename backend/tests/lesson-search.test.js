import { describe, it, expect, beforeAll } from 'vitest';
import { resetDatabase, seedTestData, login } from './helpers.js';
import request from 'supertest';
import prisma from '../src/db.js';
import { lightStem, questionRoots, searchLessonAnswer } from '../src/services/lessonSearch.js';

let app;
let studentToken;

const LEVEL = 'السنة الأولى أساسي';

beforeAll(async () => {
  ({ app } = await import('../src/index.js'));
  await resetDatabase();
  await seedTestData();

  // تلميذ بمستوى معلوم وبلا قسم — نطاق البحث محسوم بلا تخمين،
  // وبلا أي مفتاح ذكاء اصطناعي أصلًا: الدليل أن المسار المحلي يعمل وحده.
  const u = await prisma.user.findFirst({ where: { email: 'student@test.tn' } });
  await prisma.student.updateMany({
    where: { accountUserId: u.id },
    data: { level: LEVEL, classId: null }
  });
  await prisma.aiKey.deleteMany({});
  await prisma.systemSetting.deleteMany({ where: { key: 'ai_provider_key' } });
  delete process.env.GEMINI_API_KEY;

  const sres = await login('student@test.tn', 'student123');
  studentToken = sres.body.token;
});

describe('جذور الكلمات العربية — جمع = الجمع = الجموع = الجامع', () => {
  it('المخفّف يوحّد الصيغ الأربع إلى جذع واحد', () => {
    expect(lightStem('جمع')).toBe('جمع');
    expect(lightStem('الجمع')).toBe('جمع');
    expect(lightStem('الجموع')).toBe('جمع');
    expect(lightStem('الجامع')).toBe('جمع');
  });

  it('التحيات لا تولّد جذورًا (التحية لا تُقحم درسًا في المحادثة)', () => {
    expect(questionRoots('مرحبا رفيقي كيف حالك')).toHaveLength(0);
    expect(questionRoots('ما هو الجمع')).toEqual(['جمع']);
  });
});

describe('مسار المحادثة الأول: دروس المنصة بلا مفتاح', () => {
  it('يجد درس «الجمع» في مادة الرياضيات لمستوى التلميذ', () => {
    const hit = searchLessonAnswer({ message: 'ما هو الجمع', level: LEVEL });
    expect(hit).toBeTruthy();
    expect(hit.lessonTitle).toContain('جمع');
    expect(hit.subjectTitle).toBeTruthy();
    // عنوان الدرس دائمًا في ترويسة الردّ مهما ضاقت نافذة المقتطف.
    expect(hit.reply).toContain(hit.lessonTitle);
    expect(hit.reply).toContain('🦉');
  });

  it('بلا مستوى معلوم (حساب الاستكشاف) لا يخمّن درسًا', () => {
    expect(searchLessonAnswer({ message: 'ما هو الجمع', level: '' })).toBeNull();
  });

  it('الصيغ الأربع تصل للردّ عبر /ai/chat نفسها — بلا مفتاح وبلا 502', async () => {
    for (const message of ['الجمع', 'الجموع', 'الجامع']) {
      const res = await request(app)
        .post('/api/ai/chat')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ message });
      expect(res.status).toBe(200);
      expect(res.body.role).toBe('assistant');
      expect(res.body.content).toContain('جمع');
      expect(res.body.content).not.toContain('لم يتوفر له مفتاح');
    }
  });

  it('سؤال بلا مطابقة وبلا مفتاح يعود رسالة لطيفة (لا 502 ولا انهيار)', async () => {
    const res = await request(app)
      .post('/api/ai/chat')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ message: 'مرحبا' });
    expect(res.status).toBe(200);
    expect(res.body.role).toBe('assistant');
    expect(res.body.content).toContain('مفتاح');
  });
});
