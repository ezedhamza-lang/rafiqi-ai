import { describe, it, expect, beforeAll } from 'vitest';
import { resetDatabase, seedTestData, login } from './helpers.js';
import request from 'supertest';
import prisma from '../src/db.js';

let app;
let token;

beforeAll(async () => {
  ({ app } = await import('../src/index.js'));
  await resetDatabase();
  await seedTestData();
  const res = await login('student@test.tn', 'student123');
  token = res.body.token;
  expect(token).toBeTruthy();
});

describe('ربط المحتوى بالتقدم (المرحلة 6.6) — إتمام درس يمنح نقاطاً وشارات', () => {
  it('تسجيل الإتمام يتطلب مصادقة (401 بدون توكن)', async () => {
    const res = await request(app)
      .post('/api/student/progress/lessons')
      .send({ gradeId: 'year1', subjectId: 'math', lessonId: 'math1' });
    expect(res.status).toBe(401);
  });

  it('يرفض نقص الحقول المطلوبة', async () => {
    const res = await request(app)
      .post('/api/student/progress/lessons')
      .set('Authorization', `Bearer ${token}`)
      .send({ gradeId: 'year1', subjectId: 'math' });
    expect(res.status).toBe(400);
  });

  it('إتمام درس أول مرة يمنح نقاطاً ويسجّل التقدم', async () => {
    const before = await request(app)
      .get('/api/student/profile')
      .set('Authorization', `Bearer ${token}`);
    const xpBefore = before.body.user.xp;

    const res = await request(app)
      .post('/api/student/progress/lessons')
      .set('Authorization', `Bearer ${token}`)
      .send({ gradeId: 'year1', subjectId: 'math', lessonId: 'math1', lessonTitle: 'الأعداد من 0 إلى 5' });

    expect(res.status).toBe(200);
    expect(res.body.alreadyDone).toBe(false);
    expect(res.body.xpAwarded).toBe(5);
    expect(res.body.progress.lessonId).toBe('math1');
    expect(res.body.newBadges).toEqual([]);

    const after = await request(app)
      .get('/api/student/profile')
      .set('Authorization', `Bearer ${token}`);
    expect(after.body.user.xp).toBe(xpBefore + 5);
    expect(after.body.stats.lessonsCompleted).toBe(1);
  });

  it('إتمام نفس الدرس مرتين لا يمنح نقاطاً إضافية (Idempotent)', async () => {
    const res = await request(app)
      .post('/api/student/progress/lessons')
      .set('Authorization', `Bearer ${token}`)
      .send({ gradeId: 'year1', subjectId: 'math', lessonId: 'math1', lessonTitle: 'الأعداد من 0 إلى 5' });
    expect(res.status).toBe(200);
    expect(res.body.alreadyDone).toBe(true);
    expect(res.body.xpAwarded).toBe(0);
  });

  it('قراءة التقدم تعيد الدروس المكتملة وملخصاً حسب المادة', async () => {
    const res = await request(app)
      .get('/api/student/progress/lessons?gradeId=year1&subjectId=math')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(1);
    expect(res.body.lessons[0].lessonId).toBe('math1');
    expect(res.body.bySubject).toEqual(
      expect.arrayContaining([expect.objectContaining({ gradeId: 'year1', subjectId: 'math', count: 1 })])
    );
  });

  it('إتمام درس يستوفي شرط شارة (LESSONS_COMPLETED) يمنحها', async () => {
    await prisma.badge.upsert({
      where: { key: 'first_lesson' },
      update: {},
      create: {
        key: 'first_lesson',
        name: 'أول درس',
        icon: 'school',
        description: 'أتممت أول درس تفاعلي',
        condition: { type: 'LESSONS_COMPLETED', value: 1 }
      }
    });

    const res = await request(app)
      .post('/api/student/progress/lessons')
      .set('Authorization', `Bearer ${token}`)
      .send({ gradeId: 'year1', subjectId: 'anisi', lessonId: 'u1-l1', lessonTitle: 'حرف أ' });
    expect(res.status).toBe(200);
    expect(res.body.newBadges.length).toBeGreaterThan(0);
    const keys = res.body.newBadges.map((b) => b.key);
    expect(keys).toContain('first_lesson');

    const earned = await prisma.studentBadge.findFirst({
      where: { studentId: (await login('student@test.tn', 'student123')).body.user?.id ?? 0 }
    });
    expect(earned).toBeTruthy();
  });

  it('الملف الشخصي يعرض عدد الدروس المكتملة', async () => {
    const res = await request(app)
      .get('/api/student/profile')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.stats.lessonsCompleted).toBeGreaterThanOrEqual(2);
  });
});
