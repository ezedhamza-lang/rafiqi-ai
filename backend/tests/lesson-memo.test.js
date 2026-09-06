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
  const res = await login('teacher@test.tn', 'teacher123');
  token = res.body.token;
  expect(token).toBeTruthy();
});

describe('نظام المذكرات حسب بروفايل المنهجية (LessonMemoService) — بلا أي ذكاء اصطناعي', () => {
  it('التوليد يتطلب مصادقة (401 بدون توكن)', async () => {
    const res = await request(app)
      .post('/api/memos/generate')
      .send({ subject: 'رياضيات', level: 'السنة الأولى أساسي', lessonTitle: 'تعيين موقع شيء في الفضاء: أمام - وراء' });
    expect(res.status).toBe(401);
  });

  it('يرفض نقص الحقول المطلوبة', async () => {
    const res = await request(app)
      .post('/api/memos/generate')
      .set('Authorization', `Bearer ${token}`)
      .send({ level: 'السنة الأولى أساسي' });
    expect(res.status).toBe(400);
  });

  it('يعرض كل بروفايلات المنهجية (9 بروفايلات رسمية)', async () => {
    const res = await request(app).get('/api/memos/methodologies').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(9);
    const reading = res.body.find((m) => m.appliesTo?.subject === 'قراءة');
    expect(reading).toBeTruthy();
    expect(reading.phases.length).toBeGreaterThan(0);
  });

  it('يولّد مذكرة رياضيات س1 وفق المنهجية ويضم محتوى الدرس الحقيقي', async () => {
    const res = await request(app)
      .post('/api/memos/generate')
      .set('Authorization', `Bearer ${token}`)
      .send({ subject: 'رياضيات', level: 'السنة الأولى أساسي', lessonTitle: 'تعيين موقع شيء في الفضاء: أمام - وراء' });
    expect(res.status).toBe(200);
    expect(res.body.cached).toBe(false);
    const memo = res.body.memo;
    expect(memo.methodologyId).toBe('year1-math-standard');
    expect(memo.bookId).toBe('year1/math');
    expect(memo.content.header.columns.length).toBeGreaterThan(0);
    expect(memo.content.phases.length).toBe(5);
    expect(memo.content.table.columns).toEqual(['المراحل', 'نشاط المعلّم', 'نشاط المتعلّم', 'الملاحظات']);
    const allText = JSON.stringify(memo.content);
    expect(allText).toContain('تعيين موقع شيء في الفضاء');
    expect(allText).toContain('التموضع');
  });

  it('نفس الدرس يولّد نفس المذكرة (ذاكرة مؤقتة عبر bookId+lessonId)', async () => {
    const res = await request(app)
      .post('/api/memos/generate')
      .set('Authorization', `Bearer ${token}`)
      .send({ subject: 'رياضيات', level: 'السنة الأولى أساسي', lessonTitle: 'تعيين موقع شيء في الفضاء: أمام - وراء' });
    expect(res.status).toBe(200);
    expect(res.body.cached).toBe(true);
    expect(res.body.memo.id).toBeTruthy();
    const count = await prisma.lessonMemo.count({
      where: { bookId: 'year1/math', lessonId: 'y1m01' }
    });
    expect(count).toBe(1);
  });

  it('يولّد مذكرة قراءة س1 (الطريقة المختلطة) مع بنك التهيئة ومراحل الشاملة/التحليلية/التركيبية', async () => {
    const res = await request(app)
      .post('/api/memos/generate')
      .set('Authorization', `Bearer ${token}`)
      .send({ subject: 'قراءة', level: 'السنة الأولى أساسي', lessonTitle: 'حرف الميم' });
    expect(res.status).toBe(200);
    const memo = res.body.memo;
    expect(memo.methodologyId).toBe('year1-reading-mixed-method');
    expect(memo.content.warmup.length).toBeGreaterThan(0);
    const phaseNames = memo.content.phases.map((p) => p.name);
    expect(phaseNames).toEqual(expect.arrayContaining(['المرحلة الشاملة', 'المرحلة التحليلية', 'المرحلة التركيبية']));
    const allText = JSON.stringify(memo.content);
    expect(allText).toContain('الميم');
  });

  it('يولّد مذكرة إيقاظ علمي س1 ويملأ مكوّن الكفاية والهدف المميّز من الإطار الرسمي', async () => {
    const res = await request(app)
      .post('/api/memos/generate')
      .set('Authorization', `Bearer ${token}`)
      .send({ subject: 'إيقاظ علمي', level: 'السنة الأولى أساسي', lessonTitle: 'الحواس الخمس ووظائفها' });
    expect(res.status).toBe(200);
    const memo = res.body.memo;
    expect(memo.methodologyId).toBe('year1-science-awakening');
    const values = memo.content.header.values;
    expect(values['مكوّن الكفاية']).toContain('حلّ وضعيات مشكل');
    expect(values['الهدف المميّز']).toContain('أعضاء جسمه');
  });

  it('لا يختلق محتوى: يرفض مادة بلا منهجية مُعرَّفة (NO_METHODOLOGY)', async () => {
    const res = await request(app)
      .post('/api/memos/generate')
      .set('Authorization', `Bearer ${token}`)
      .send({ subject: 'رياضيات', level: 'السنة الثانية أساسي', lessonTitle: 'المجموعات ومكوّناتها' });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('لا توجد منهجية');
  });

  it('لا يختلق محتوى: يرفض مادة بلا كتاب (NO_BOOK)', async () => {
    const res = await request(app)
      .post('/api/memos/generate')
      .set('Authorization', `Bearer ${token}`)
      .send({ subject: 'فرنسية', level: 'السنة الأولى أساسي', lessonTitle: 'Le corps' });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('لا يوجد محتوى منهج');
  });

  it('يرجع 404 عندما لا يوجد درس بالعنوان المطلوب', async () => {
    const res = await request(app)
      .post('/api/memos/generate')
      .set('Authorization', `Bearer ${token}`)
      .send({ subject: 'رياضيات', level: 'السنة الأولى أساسي', lessonTitle: 'درس غير موجود تماما' });
    expect(res.status).toBe(404);
  });

  it('إعادة البناء تحذف النسخة المحفوظة وتعيد البناء من جديد', async () => {
    const first = await request(app)
      .post('/api/memos/generate')
      .set('Authorization', `Bearer ${token}`)
      .send({ subject: 'رياضيات', level: 'السنة الأولى أساسي', lessonTitle: 'تعيين موقع شيء في الفضاء: فوق - تحت' });
    expect(first.body.cached).toBe(false);
    const id = first.body.memo.id;

    const again = await request(app)
      .post('/api/memos/generate')
      .set('Authorization', `Bearer ${token}`)
      .send({ subject: 'رياضيات', level: 'السنة الأولى أساسي', lessonTitle: 'تعيين موقع شيء في الفضاء: فوق - تحت' });
    expect(again.body.cached).toBe(true);

    const rebuilt = await request(app)
      .post('/api/memos/rebuild')
      .set('Authorization', `Bearer ${token}`)
      .send({ subject: 'رياضيات', level: 'السنة الأولى أساسي', lessonTitle: 'تعيين موقع شيء في الفضاء: فوق - تحت' });
    expect(rebuilt.status).toBe(200);
    expect(rebuilt.body.cached).toBe(false);
    expect(rebuilt.body.memo.id).not.toBe(id);
  });

  it('قائمة المذكرات تعرض ما تولّده الأستاذ مع إمكانية الحذف', async () => {
    const list = await request(app).get('/api/memos?limit=20').set('Authorization', `Bearer ${token}`);
    expect(list.status).toBe(200);
    expect(list.body.length).toBeGreaterThanOrEqual(3);

    const first = list.body[0];
    const del = await request(app).del(`/api/memos/${first.id}`).set('Authorization', `Bearer ${token}`);
    expect(del.status).toBe(200);

    const after = await request(app).get('/api/memos?limit=20').set('Authorization', `Bearer ${token}`);
    expect(after.body.some((m) => m.id === first.id)).toBe(false);
  });

  it('يحترم التوحيد اللغوي للمواد (الإيقاظ العلمي = إيقاظ علمي)', async () => {
    const res = await request(app)
      .post('/api/memos/generate')
      .set('Authorization', `Bearer ${token}`)
      .send({ subject: 'الإيقاظ العلمي', level: 'السنة الأولى أساسي', lessonTitle: 'الحواس الخمس ووظائفها' });
    expect(res.status).toBe(200);
    expect(res.body.memo.methodologyId).toBe('year1-science-awakening');
  });
});
