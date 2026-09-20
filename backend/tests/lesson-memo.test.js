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

  it('يعرض كل بروفايلات المنهجية (13 بروفايلًا رسميًا يشمل رياضيات السنين 1-6)', async () => {
    const res = await request(app).get('/api/memos/methodologies').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(13);
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
    expect(memo.content.phases.length).toBe(6);
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

  it('لا يختلق محتوى: يرفض مادة بلا أي كتاب في registry.json', async () => {
    const res = await request(app)
      .post('/api/memos/generate')
      .set('Authorization', `Bearer ${token}`)
      .send({ subject: 'تربية إسلامية', level: 'السنة الثانية أساسي', lessonTitle: 'الصلاة' });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('لا يوجد محتوى منهج');
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

  it('المذكرة بلا صور (حسب المعيار) وتُصدَّر Word قابل للتعديل', async () => {
    const gen = await request(app)
      .post('/api/memos/generate')
      .set('Authorization', 'Bearer ' + token)
      .send({ subject: 'رياضيات', level: 'السنة الأولى أساسي', lessonTitle: 'آلة الجمع دون احتفاظ: الجمع العمودي' });
    expect(gen.status).toBe(200);
    const memo = gen.body.memo;
    // لا صور إطلاقًا في المذكرات
    expect((memo.content.images || []).length).toBe(0);
    expect((memo.content.spec && memo.content.spec.images) || []).toHaveLength(0);
    expect((memo.content.spec.rows || []).every((r) => !r.images || !r.images.length)).toBe(true);

    const pdf = await request(app)
      .get(`/api/memos/${memo.id}/pdf`)
      .set('Authorization', `Bearer ${token}`)
      .parse((res, cb) => { const chunks = []; res.on('data', (c) => chunks.push(c)); res.on('end', () => cb(null, Buffer.concat(chunks))); });
    expect(pdf.status).toBe(200);
    expect(pdf.body.subarray(0, 4).toString()).toBe('PK\x03\x04');
    expect(pdf.body.length).toBeGreaterThan(1000);

    const missing = await request(app)
      .get('/api/memos/999999/pdf')
      .set('Authorization', `Bearer ${token}`);
    expect(missing.status).toBe(404);
    expect(missing.body.error).toContain('غير موجودة');
  });

  it('مذكرة رياضيات س2 من الكتاب الرسمي الجديد تسحب درسها ومراحلها الخمس', async () => {
    const res = await request(app)
      .post('/api/memos/generate')
      .set('Authorization', `Bearer ${token}`)
      .send({ subject: 'رياضياتي 2', level: 'السنة الثانية أساسي', lessonTitle: 'الأعداد من 0 إلى 499: الطرح دون زيادة ولا تفكيك' });
    expect(res.status).toBe(200);
    const memo = res.body.memo;
    expect(memo.methodologyId).toBe('official-y2-math');
    expect(memo.lessonId).toBe('y2m49');
    expect(memo.content.phases.length).toBe(5);
    expect(memo.content.source).toBe('official');
    expect(memo.content.table.columns).toEqual(['المراحل', 'نشاط المعلّم', 'نشاط المتعلّم', 'الوسائل']);
    const allText = JSON.stringify(memo.content);
    expect(allText).toContain('الطرح');
  });

  it('مذكرة س2 للدرس ذي الصور تُصدَّر Word بلا صور (المعيار: لا صور في المذكرات)', async () => {
    const res = await request(app)
      .post('/api/memos/generate')
      .set('Authorization', `Bearer ${token}`)
      .send({ subject: 'رياضياتي 2', level: 'السنة الثانية أساسي', lessonTitle: 'القطع النقديّة المتداولة 5، 10، 20، 50، 100، 200: التصرّف فيها' });
    expect(res.status).toBe(200);
    const memo = res.body.memo;
    expect(memo.lessonId).toBe('y2m50');
    expect((memo.content.images || []).length).toBe(0);

    const pdf = await request(app)
      .get(`/api/memos/${memo.id}/pdf`)
      .set('Authorization', `Bearer ${token}`)
      .parse((res, cb) => { const chunks = []; res.on('data', (c) => chunks.push(c)); res.on('end', () => cb(null, Buffer.concat(chunks))); });
    expect(pdf.status).toBe(200);
    expect(pdf.body.subarray(0, 4).toString()).toBe('PK\x03\x04');
    expect(pdf.body.length).toBeGreaterThan(1000);
  });

  it('كتاب رياضياتي 2 الرسمي: 63 درسًا بمحتوى المصدر وصوره بلا إجابات مكشوفة', async () => {
    const res = await request(app).get('/api/public/curriculum/books/year2/math2/lessons');
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThanOrEqual(60);
    const blob = JSON.stringify(res.body);
    expect(blob).not.toContain('"answer"');
    const withImg = res.body.filter((p) => (p.blocks || []).some((b) => b.image && b.imageId));
    expect(withImg.length).toBeGreaterThanOrEqual(30);
    const first = res.body.find((p) => p.id === 'y2m01');
    expect(first.blocks.some((b) => b.blockId && b.blockId.startsWith('b'))).toBe(true);
    const imgBlock = first.blocks.find((b) => b.image);
    expect(imgBlock.imageId).toMatch(/^img-y2m01-\d+$/);
  });

  it('مادة واحدة بعدة كتب: «رياضيات» س2 تولّد من الكتابين وكل مذكرة بلا صور وبمرجع كتابها', async () => {
    const r1 = await request(app)
      .post('/api/memos/generate')
      .set('Authorization', `Bearer ${token}`)
      .send({ subject: 'رياضيات', level: 'السنة الثانية أساسي', lessonTitle: 'القطع النقديّة المتداولة 5، 10، 20، 50، 100، 200: التصرّف فيها' });
    expect(r1.status).toBe(200);
    expect(r1.body.memo.bookId).toBe('year2/math2');
    expect((r1.body.memo.content.images || []).length).toBe(0);
    expect(r1.body.memo.content.sourceBook).toBe('رياضياتي 2');

    const r2 = await request(app)
      .post('/api/memos/generate')
      .set('Authorization', `Bearer ${token}`)
      .send({ subject: 'رياضيات', level: 'السنة الثانية أساسي', lessonTitle: 'أصابع اليد' });
    expect(r2.status).toBe(200);
    expect(r2.body.memo.bookId).toBe('year2/math');
    expect(r2.body.memo.content.sourceBook).toBe('رياضيات');
    expect((r2.body.memo.content.images || []).length).toBe(0);
  });

  it('س6 الرياضيات بعد الترقيم: مذكرة حقيقية بمراحل المواصفات بلا صور', async () => {
    const res = await request(app)
      .post('/api/memos/generate')
      .set('Authorization', `Bearer ${token}`)
      .send({ subject: 'رياضيات', level: 'السنة السادسة أساسي', lessonTitle: 'أُوَظّفُ الجمعَ والطّرحَ في مجموعةِ الأعدادِ العشريّةِ' });
    expect(res.status).toBe(200);
    const memo = res.body.memo;
    expect(memo.bookId).toBe('year6/math');
    expect(memo.content.spec.rows.length).toBeGreaterThanOrEqual(4);
    const blob = JSON.stringify(memo.content.spec.rows);
    expect(blob).toContain('9,9');
    const pdf = await request(app)
      .get(`/api/memos/${memo.id}/pdf`)
      .set('Authorization', `Bearer ${token}`)
      .parse((res, cb) => { const chunks = []; res.on('data', (c) => chunks.push(c)); res.on('end', () => cb(null, Buffer.concat(chunks))); });
    expect(pdf.status).toBe(200);
    expect(pdf.body.subarray(0, 4).toString()).toBe('PK\x03\x04');
  });

  it('س5: مذكرة من كتاب «رفيقي في الرياضيات س5» بمراحل متمايزة بلا تكرار', async () => {
    const res = await request(app)
      .post('/api/memos/generate')
      .set('Authorization', `Bearer ${token}`)
      .send({ subject: 'رياضيات', level: 'السنة الخامسة أساسي', lessonTitle: 'الأعداد الطبيعية (حتى المليارات)' });
    expect(res.status).toBe(200);
    const memo = res.body.memo;
    expect(memo.bookId).toBe('year5/math2');
    expect(memo.content.spec.headerTitle).toContain('لحصة رياضيات');
    const rows = memo.content.spec.rows;
    expect(rows.length).toBeGreaterThanOrEqual(3);
    expect(new Set(rows.map((r) => r.teacherActivity)).size).toBe(rows.length);
    for (const r of rows) {
      expect(r.teacherActivity).not.toBe(r.learnerActivity);
      expect(r.tools.length).toBeGreaterThan(0);
    }
    const pdf = await request(app)
      .get(`/api/memos/${memo.id}/pdf`)
      .set('Authorization', `Bearer ${token}`)
      .parse((res, cb) => { const chunks = []; res.on('data', (c) => chunks.push(c)); res.on('end', () => cb(null, Buffer.concat(chunks))); });
    expect(pdf.status).toBe(200);
    expect(pdf.body.subarray(0, 4).toString()).toBe('PK\x03\x04');
  });

  it('قالب موحّد: profiles الرياضيات (س2 رسمية بخمس مراحل مثل كتاب المذكرات)', async () => {
    const { resolveMethodology } = await import('../src/services/methodologyResolver.js');
    const canonical = ['الحساب الذهني', 'الاستحضار الوظيفي', 'الاستكشاف', 'التعلّم المنهجي', 'الإدماج', 'التقييم'];
    const officialY2 = ['حساب ذهني', 'تعهد المكتسبات', 'الوضعية الاستكشافية + التعلم المنهجي الآلي', 'تعلم ادماجي', 'تقييم'];
    for (const y of ['الأولى', 'الثالثة', 'الرابعة', 'الخامسة', 'السادسة']) {
      const p = resolveMethodology({ subject: 'رياضيات', level: `السنة ${y} أساسي` });
      expect(p.phases.map((x) => x.name), `س${y}`).toEqual(canonical);
    }
    const p2 = resolveMethodology({ subject: 'رياضيات', level: 'السنة الثانية أساسي' });
    expect(p2.phases.map((x) => x.name)).toEqual(officialY2);
    const gen = await request(app)
      .post('/api/memos/generate')
      .set('Authorization', `Bearer ${token}`)
      .send({ subject: 'رياضيات', level: 'السنة الأولى أساسي', lessonTitle: 'آلة الجمع دون احتفاظ: الجمع العمودي' });
    expect(gen.status).toBe(200);
    const spec = gen.body.memo.content.spec;
    expect(spec.mathTemplate).toBe(true);
    const firstLines = spec.rows.map((r) => String(r.stage).split('\n')[0]);
    expect(firstLines.slice(0, 5)).toEqual(['حساب ذهني', 'تعهّد المكتسبات', 'الوضعية الاستكشافية', 'تعلّم إدماجي', 'تقييم']);
    expect(spec.rows.length).toBeGreaterThanOrEqual(5);
    expect(spec.rows.length).toBeLessThanOrEqual(6);
  });

  it('تغطية كاملة: 6 سنوات × 4 مواد أساسية بلا أي «لا توجد منهجية»', async () => {
    const { resolveMethodology } = await import('../src/services/methodologyResolver.js');
    const years = ['الأولى', 'الثانية', 'الثالثة', 'الرابعة', 'الخامسة', 'السادسة'];
    for (const y of years) {
      for (const s of ['رياضيات', 'قراءة', 'إيقاظ علمي', 'إنتاج كتابي']) {
        const p = resolveMethodology({ subject: s, level: `السنة ${y} أساسي` });
        expect(p, `${s} — السنة ${y}`).toBeTruthy();
        expect((p.phases || []).length).toBeGreaterThan(0);
      }
    }
    expect(() => resolveMethodology({ subject: 'فرنسية', level: 'السنة الأولى أساسي' })).toThrow();
  });

  it('محرك المواصفات: مذكرة س2 تلتزم الهيكل الرسمي (رأس/كفايات/أهداف/تمشي 5 مراحل/خاتمة قرار)', async () => {
    const res = await request(app)
      .post('/api/memos/generate')
      .set('Authorization', `Bearer ${token}`)
      .send({ subject: 'رياضيات', level: 'السنة الثانية أساسي', lessonTitle: 'الأعداد من 0 إلى 499: الطرح دون زيادة ولا تفكيك' });
    expect(res.status).toBe(200);
    const spec = res.body.memo.content.spec;
    expect(spec.specVersion).toBe(2);
    expect(spec.headerTitle).toContain('مذكرة بيداغوجية لحصة رياضيات');
    expect(spec.period).toBe('05');
    expect(spec.competencies.domain).toContain('وضعيات');
    expect(spec.competencies.distinctiveObjective).toMatch(/الطرح|الجمع/);
    expect(spec.lessonObjectives.length).toBeGreaterThanOrEqual(1);
    expect(spec.lessonObjectives[0]).toMatch(/ينجز|يحل|يتعرّف|يتعرف|يوظّف|يوظف|يطبّق|يطبق/);
    expect(spec.rows.length).toBeGreaterThanOrEqual(4);
    expect(spec.rows.length).toBeLessThanOrEqual(7);
    const stages = spec.rows.map((r) => r.stage);
    expect(stages.join(' ')).toMatch(/استكشاف/); /* قالب الرياضيات الموحد */
    expect(stages.join(' ')).toMatch(/تقو|تقييم/);
    for (const r of spec.rows) {
      expect(r.teacherActivity.length).toBeGreaterThan(10);
      expect(r.learnerActivity.length).toBeGreaterThan(5);
      expect(r.teacherActivity).not.toBe(r.learnerActivity);
      if (!spec.mathTemplate) expect(r.skill.length).toBeGreaterThan(3);
      expect(r.tools.length).toBeGreaterThan(0);
    }
    const teachers = new Set(spec.rows.map((r) => r.teacherActivity));
    expect(teachers.size).toBeGreaterThanOrEqual(4);
    expect(spec.successRateLine).toContain('نسبة نجاح الدرس');
    expect(spec.pedagogicalDecision).toContain('القرار البيداغوجي');

    const pdf = await request(app)
      .get(`/api/memos/${res.body.memo.id}/pdf`)
      .set('Authorization', `Bearer ${token}`)
      .parse((res, cb) => { const chunks = []; res.on('data', (c) => chunks.push(c)); res.on('end', () => cb(null, Buffer.concat(chunks))); });
    expect(pdf.status).toBe(200);
    expect(pdf.body.subarray(0, 4).toString()).toBe('PK\x03\x04');
  });
});
