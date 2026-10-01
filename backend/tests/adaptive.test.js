import { describe, it, expect, beforeAll } from 'vitest';
import { resetDatabase, seedTestData, login } from './helpers.js';
import request from 'supertest';
import prisma from '../src/db.js';
import {
  sm2Next,
  qualityFromCorrect,
  difficultyFromState,
  itemKeyOf,
  parseItemKey
} from '../src/services/adaptiveService.js';

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

describe('محرّك التكرار المتباعد (SM-2) — دوال خالصة', () => {
  it('إجابة صحيحة على بطاقة جديدة: تكرار 1، فاصل يوم، وسهولة أعلى', () => {
    const next = sm2Next({ repetitions: 0, easeFactor: 2.5, intervalDays: 0 }, 5);
    expect(next.repetitions).toBe(1);
    expect(next.intervalDays).toBe(1);
    expect(next.easeFactor).toBeGreaterThan(2.5);
  });

  it('إجابة صحيحة ثانية: فاصل 6 أيام', () => {
    const next = sm2Next({ repetitions: 1, easeFactor: 2.6, intervalDays: 1 }, 5);
    expect(next.repetitions).toBe(2);
    expect(next.intervalDays).toBe(6);
  });

  it('إجابات صحيحة لاحقة: الفاصل يتضاعف بعامل السهولة', () => {
    const next = sm2Next({ repetitions: 2, easeFactor: 2.6, intervalDays: 6 }, 5);
    expect(next.repetitions).toBe(3);
    expect(next.intervalDays).toBe(Math.round(6 * 2.6));
  });

  it('إجابة خاطئة: تُصفّر التكرارات ويعود الفاصل يومًا مع انخفاض السهولة', () => {
    const next = sm2Next({ repetitions: 3, easeFactor: 2.6, intervalDays: 15 }, 0);
    expect(next.repetitions).toBe(0);
    expect(next.intervalDays).toBe(1);
    expect(next.easeFactor).toBeLessThan(2.6);
  });

  it('معامل السهولة لا يهبط دون الحد الأدنى 1.3', () => {
    let ef = 1.3;
    for (let i = 0; i < 5; i += 1) ef = sm2Next({ easeFactor: ef }, 0).easeFactor;
    expect(ef).toBeGreaterThanOrEqual(1.3);
  });

  it('التقييم يُقصّ على 0..5 والقيم غير الرقمية تُعامل كـ 0', () => {
    expect(sm2Next({}, 99).easeFactor).toBe(2.6);
    expect(sm2Next({}, 'x').repetitions).toBe(0);
    expect(sm2Next({}, -2).repetitions).toBe(0);
  });

  it('qualityFromCorrect: صحيح→5، خاطئ→1', () => {
    expect(qualityFromCorrect(true)).toBe(5);
    expect(qualityFromCorrect(false)).toBe(1);
  });
});

describe('مستوى السؤال التكيفي — يتغير حسب إجابات التلميذ', () => {
  it('بطاقة جديدة تبدأ بالمستوى 1', () => {
    expect(difficultyFromState({ repetitions: 0, streak: 0 })).toBe(1);
  });

  it('سلسلة إجابات صحيحة تصعّب السؤال تدريجياً حتى 5', () => {
    let state = { repetitions: 0, streak: 0 };
    expect(difficultyFromState(state)).toBe(1);
    state = { repetitions: 1, streak: 1 };
    expect(difficultyFromState(state)).toBe(2);
    state = { repetitions: 2, streak: 2 };
    expect(difficultyFromState(state)).toBe(3);
    state = { repetitions: 3, streak: 3 };
    expect(difficultyFromState(state)).toBe(4);
    state = { repetitions: 4, streak: 4 };
    expect(difficultyFromState(state)).toBe(5);
    state = { repetitions: 10, streak: 9 };
    expect(difficultyFromState(state)).toBe(5);
  });

  it('خطأ بعد سلسلة ناجحة يُسهّل السؤال (يعود للمستوى الأدنى)', () => {
    const hard = difficultyFromState({ repetitions: 4, streak: 4 });
    expect(hard).toBe(5);
    const reset = difficultyFromState({ repetitions: 0, streak: 0 });
    expect(reset).toBe(1);
  });

  it('المستوى يعتمد على الأداء الأخير لا على عدد المراجعات بحد ذاته', () => {
    expect(difficultyFromState({ repetitions: 2, streak: 0 })).toBe(1);
  });

  it('مفاتيح البطاقات مستقرة وقابلة للتحليل', () => {
    const key = itemKeyOf('tpl-xyz', 3);
    expect(key).toBe('tpl-xyz:3');
    expect(parseItemKey(key)).toEqual({ exerciseId: 'tpl-xyz', questionIndex: 3 });
    expect(parseItemKey('bad')).toBeNull();
  });
});

describe('واجهات التكيف (المرحلة 6.5) — مصادقة وجلسات وتحديث', () => {
  it('جلسة المراجعة تتطلب مصادقة (401 بدون توكن)', async () => {
    const res = await request(app).get('/api/student/adaptive/session?gradeId=year1&subjectId=math').send();
    expect(res.status).toBe(401);
  });

  it('يتطلب السنة والمادة', async () => {
    const res = await request(app)
      .get('/api/student/adaptive/session?gradeId=year1')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(400);
  });

  it('يبني جلسة من البنك الحقيقي بأسئلة وحالة تكيفية', async () => {
    const res = await request(app)
      .get('/api/student/adaptive/session?gradeId=year1&subjectId=math&limit=3')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.items.length).toBe(3);
    expect(res.body.meta.limit).toBe(3);
    for (const item of res.body.items) {
      expect(item.itemKey).toBeTruthy();
      expect(item.question.text).toBeTruthy();
      expect(Array.isArray(item.question.options)).toBe(true);
      expect(item.question.answer).toBeDefined();
      expect(item.state.difficulty).toBe(1);
      expect(item.state.repetitions).toBe(0);
    }
  });

  it('الحد الأقصى للجلسة لا يتجاوز 30', async () => {
    const res = await request(app)
      .get('/api/student/adaptive/session?gradeId=year1&subjectId=math&limit=999')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.items.length).toBeLessThanOrEqual(30);
  });

  it('إجابة صحيحة تصعّب المستوى وتحدّد موعداً لاحقاً', async () => {
    const session = await request(app)
      .get('/api/student/adaptive/session?gradeId=year1&subjectId=math&limit=1')
      .set('Authorization', `Bearer ${token}`);
    const item = session.body.items[0];

    const res = await request(app)
      .post('/api/student/adaptive/review')
      .set('Authorization', `Bearer ${token}`)
      .send({ itemKey: item.itemKey, gradeId: 'year1', subjectId: 'math', correct: true });
    expect(res.status).toBe(200);
    expect(res.body.correct).toBe(true);
    expect(res.body.state.repetitions).toBe(1);
    expect(res.body.state.intervalDays).toBe(1);
    expect(res.body.state.difficulty).toBe(2);
    expect(res.body.state.streak).toBe(1);

    const again = await request(app)
      .get('/api/student/adaptive/session?gradeId=year1&subjectId=math&limit=30')
      .set('Authorization', `Bearer ${token}`);
    const keys = again.body.items.map((i) => i.itemKey);
    expect(keys).not.toContain(item.itemKey);
  });

  it('إجابة خاطئة تُصفّر التكرارات وتُسهّل المستوى', async () => {
    const session = await request(app)
      .get('/api/student/adaptive/session?gradeId=year1&subjectId=anisi&limit=1')
      .set('Authorization', `Bearer ${token}`);
    const item = session.body.items[0];

    await request(app)
      .post('/api/student/adaptive/review')
      .set('Authorization', `Bearer ${token}`)
      .send({ itemKey: item.itemKey, gradeId: 'year1', subjectId: 'anisi', correct: true });

    const res = await request(app)
      .post('/api/student/adaptive/review')
      .set('Authorization', `Bearer ${token}`)
      .send({ itemKey: item.itemKey, gradeId: 'year1', subjectId: 'anisi', quality: 0 });
    expect(res.status).toBe(200);
    expect(res.body.correct).toBe(false);
    expect(res.body.state.repetitions).toBe(0);
    expect(res.body.state.intervalDays).toBe(1);
    expect(res.body.state.difficulty).toBe(1);
    expect(res.body.state.streak).toBe(0);
  });

  it('طلب التحديث يرفض نقص التقييم أو معرّفاً غير صالح', async () => {
    const missing = await request(app)
      .post('/api/student/adaptive/review')
      .set('Authorization', `Bearer ${token}`)
      .send({ itemKey: 'x:0', gradeId: 'year1', subjectId: 'math' });
    expect(missing.status).toBe(400);

    const badKey = await request(app)
      .post('/api/student/adaptive/review')
      .set('Authorization', `Bearer ${token}`)
      .send({ itemKey: 'invalid', gradeId: 'year1', subjectId: 'math', correct: true });
    expect(badKey.status).toBe(400);
  });

  it('الملخص يعكس البطاقات والجلسات المسجلة', async () => {
    const res = await request(app)
      .get('/api/student/adaptive/summary?gradeId=year1&subjectId=math')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.total).toBeGreaterThan(0);
    expect(res.body.reviewCount).toBeGreaterThan(0);
    expect(res.body.accuracy).toBeGreaterThanOrEqual(0);
    const levels = res.body.byDifficulty.map((d) => d.level);
    expect(levels).toEqual([1, 2, 3, 4, 5]);
  });

  it('الملخص الكلي (بدون فلاتر) يشمل كل كتب التلميذ', async () => {
    const res = await request(app)
      .get('/api/student/adaptive/summary')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.total).toBeGreaterThanOrEqual(2);
    expect(res.body.hasActiveFilters).toBe(false);
  });
});

describe('عمل المراجعة الذكية مع كل الأقسام (تصحيح تسمية المستوى)', () => {
  it('تسمية مستوى بدل المعرّف تُوحَّد ولا تُعيد 403 ولا صفحة فارغة', async () => {
    const res = await request(app)
      .get(`/api/student/adaptive/session?gradeId=${encodeURIComponent('السنة الأولى أساسي')}&subjectId=math&limit=3`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.items.length).toBe(3);
  });

  it('بلا قسم وبلا مستوى: ردّ 400 واضح بدل طلب معلّق بلا استجابة', async () => {
    const user = await prisma.user.findFirst({ where: { email: 'student@test.tn' } });
    // level حقل نصّي غير nullable في المخطّط — سلسلة فارغة تعني «بلا مستوى»
    // (getStudentLevel يرجّع null للفارغ) وclassId nullable يقبل الإفراغ.
    await prisma.student.updateMany({
      where: { accountUserId: user.id },
      data: { classId: null, level: '' }
    });
    const res = await request(app)
      .get('/api/student/adaptive/session?subjectId=math')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(400);
    expect(String(res.body.error || '')).toContain('غير محدّد');
  });
});
