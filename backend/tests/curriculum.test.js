import { describe, it, expect, beforeAll } from 'vitest';
import { resetDatabase, seedTestData } from './helpers.js';
import request from 'supertest';

let app;

beforeAll(async () => {
  ({ app } = await import('../src/index.js'));
  await resetDatabase();
  await seedTestData();
});

describe('محرّك المناهج — وصول المحتوى للتلميذ', () => {
  it('يعرض قائمة الكتب لكل السنوات والمواد', async () => {
    const res = await request(app).get('/api/public/curriculum/books').send();
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(8);
    const year1Math = res.body.find((b) => b.gradeId === 'year1' && b.subjectId === 'math');
    expect(year1Math).toBeTruthy();
    expect(year1Math.totalPages).toBeGreaterThan(0);
    const year1Arabic = res.body.find((b) => b.gradeId === 'year1' && b.subjectId === 'anisi');
    expect(year1Arabic).toBeTruthy();
  });

  it('يدرج دروس الرياضيات س1 التفاعلية (تغذية التلميذ الفعلية)', async () => {
    const res = await request(app)
      .get('/api/public/curriculum/books/year1/math/lessons')
      .send();
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    const lessons = res.body;
    expect(lessons.length).toBeGreaterThan(10);
    const l = lessons[0];
    expect(l.title).toBeTruthy();
    expect(Array.isArray(l.blocks)).toBe(true);
    expect(l.blocks.length).toBeGreaterThan(0);
    const kinds = new Set(l.blocks.map((b) => b.kind));
    expect(kinds.has('objective')).toBe(true);
  });

  it('يدرج دروس القراءة (أنيسي) س1 التفاعلية', async () => {
    const res = await request(app)
      .get('/api/public/curriculum/books/year1/anisi/lessons')
      .send();
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThan(10);
  });

  it('لا يعرض دروسا غير جاهزة في تغذية التلميذ', async () => {
    const res = await request(app)
      .get('/api/public/curriculum/books/year1/math/lessons')
      .send();
    expect(res.status).toBe(200);
    for (const page of res.body) {
      expect(page.title).toBeTruthy();
      for (const block of page.blocks || []) {
        expect(block.kind).toBeTruthy();
        expect(block.title || block.text).toBeTruthy();
      }
    }
  });

  it('المكوّن العام يخدم كل أنواع الكتل المدعومة', async () => {
    const res = await request(app)
      .get('/api/public/curriculum/books/year1/anisi/lessons')
      .send();
    const all = res.body.flatMap((p) => p.blocks || []);
    const kinds = new Set(all.map((b) => b.kind));
    for (const k of ['objective', 'concept', 'definition', 'keyword', 'question']) {
      expect(kinds.has(k), `نوع الكتلة ${k} يجب أن يكون مدعوماً`).toBe(true);
    }
  });

  it('إيقاظ علمي س1: لا يضيع محتوى — تجارب وخلاصات ومكافآت تصل للتلميذ', async () => {
    const res = await request(app)
      .get('/api/public/curriculum/books/year1/science/lessons')
      .send();
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(200);

    const blocks = res.body.flatMap((p) => p.blocks || []);
    const kinds = new Set(blocks.map((b) => b.kind));
    for (const k of ['experiment', 'summary', 'reward', 'question', 'concept']) {
      expect(kinds.has(k), `نوع الكتلة ${k} يجب أن يصل للتلميذ من كتاب الإيقاظ`).toBe(true);
    }

    const experiment = blocks.find((b) => b.kind === 'experiment');
    expect(experiment.materials.length).toBeGreaterThan(0);
    expect(experiment.steps.length).toBeGreaterThan(0);

    const summary = blocks.find((b) => b.kind === 'summary');
    expect(summary.points.length).toBeGreaterThan(0);

    for (const page of res.body) {
      expect(page.blocks.length).toBeGreaterThan(0);
    }
  });

  it('إيقاظ علمي س1: أسئلة الاختيار تحمل خيارات وإجابة قابلة للتحقق', async () => {
    const res = await request(app)
      .get('/api/public/curriculum/books/year1/science/lessons')
      .send();
    const questions = res.body.flatMap((p) => p.blocks || []).filter((b) => b.kind === 'question');
    expect(questions.length).toBeGreaterThan(30);

    const mcq = questions.filter((q) => q.options && q.options.length > 0);
    expect(mcq.length).toBeGreaterThan(30);
    for (const q of mcq) {
      expect(q.answer).toBeDefined();
      expect(Number(q.answer)).toBeGreaterThanOrEqual(0);
      expect(Number(q.answer)).toBeLessThan(q.options.length);
    }
  });

  it('المرحلة 6.2: إثراء البنك موضوعي لا عشوائي — لا محتوى أجنبي داخل الدروس', async () => {
    // تقرير المستخدم: درس س2 «مكمّل عدد إلى آخر» كان يحمل أسئلة قياس الطول
    const y2 = await request(app)
      .get('/api/public/curriculum/books/year2/math/lessons')
      .send();
    const mokammil = y2.body.find((l) => l.title.includes('مكمّل عدد'));
    expect(mokammil).toBeTruthy();
    const y2Text = JSON.stringify(mokammil.blocks);
    expect(y2Text.includes('أَطْوَل') || y2Text.includes('الطَّاوِلَةِ')).toBe(false);

    // تقرير المستخدم: درس قراءة س5 «أعلامنا ورموزنا» كان يحمل نصّ «قطة نور» س1
    const y5 = await request(app)
      .get('/api/public/curriculum/books/year5/anisi/lessons')
      .send();
    const alamana = y5.body.find((l) => l.id === 'u1-l3');
    expect(alamana).toBeTruthy();
    const y5Text = JSON.stringify(alamana.blocks);
    expect(y5Text.includes('قِطَّة')).toBe(false);
    expect(y5Text.includes('نُورَ')).toBe(false);

    // السنوات 2-6: بنك القوالب كله من مستوى س1 فلا يُرفق بها أي سؤال من المستوى الأدنى.
    // استثناء موثّق: الدروس المؤلفة أصلياً (تحمل lessonTestId) قد تحوي أسئلة
    // تفاعلية من تأليف المنصة — يُتحقق من سلامتها بدل منعها.
    const y3 = await request(app)
      .get('/api/public/curriculum/books/year3/math/lessons')
      .send();
    const compose = y3.body.find((l) => l.title.includes('4 أرقام'));
    expect(compose).toBeTruthy();
    const y3Text = JSON.stringify(compose.blocks);
    expect(y3Text.includes('12 أَمْ 8')).toBe(false);
    expect(y3Text.includes('15 أَصْغَرُ مِنْ 10')).toBe(false);
    for (const page of y3.body) {
      const qs = (page.blocks || []).filter((b) => b.kind === 'question');
      if (qs.length) {
        expect(page.lessonTestId, `درس ${page.id} فيه أسئلة دون lessonTestId`).toBeTruthy();
        for (const q of qs) {
          expect(q.text || q.title, `سؤال بلا نص في ${page.id}`).toBeTruthy();
          expect(q.answer !== undefined, `سؤال بلا إجابة في ${page.id}`).toBe(true);
          if (q.options) {
            expect(Number(q.answer)).toBeGreaterThanOrEqual(0);
            expect(Number(q.answer)).toBeLessThan(q.options.length);
          }
        }
      }
    }
  });

  it('المرحلة 6.2: لا محتوى أجنبي عند الاستدعاء بالمستوى وحده (دون gradeId)', async () => {
    const { getLessonPages } = await import('../src/services/curriculumService.js');
    const pages = getLessonPages('math', 'السنة الثالثة', undefined);
    const compose = pages.find((l) => l.title.includes('4 أرقام'));
    expect(compose).toBeTruthy();
    const text = JSON.stringify(compose.blocks || []);
    expect(text.includes('12 أَمْ 8')).toBe(false);
    expect(text.includes('15 أَصْغَرُ مِنْ 10')).toBe(false);
    const authored = pages.filter((p) => p.lessonTestId);
    expect(authored.length).toBeGreaterThan(0);
    for (const page of pages.filter((p) => !p.lessonTestId)) {
      expect(page.blocks.some((b) => b.kind === 'question')).toBe(false);
    }
  });

  it('المرحلة 6.2: الإثراء المطابق يرفق سؤالاً من نفس موضوع الدرس (مثال: الموقع في الفضاء)', async () => {
    const res = await request(app)
      .get('/api/public/curriculum/books/year1/math/lessons')
      .send();
    const spatial = res.body.find((l) => l.title.includes('تعيين موقع شيء في الفضاء'));
    expect(spatial).toBeTruthy();
    const qs = (spatial.blocks || []).filter((b) => b.kind === 'question' && b.options && b.answer !== undefined);
    expect(qs.length).toBeGreaterThan(0);
    for (const q of qs) {
      expect(Number(q.answer)).toBeGreaterThanOrEqual(0);
      expect(Number(q.answer)).toBeLessThan(q.options.length);
    }
  });

  it('المرحلة 6.2: نقطة نهاية التمارين تخدم مواد السنتين الأوليين بمحتوى حقيقي', async () => {
    const cases = [
      ['year1', 'math', 150],
      ['year1', 'anisi', 150],
      ['year1', 'science', 148],
      ['year2', 'math', 150]
    ];
    for (const [gradeId, subjectId, min] of cases) {
      const res = await request(app)
        .get(`/api/public/curriculum/books/${gradeId}/${subjectId}/exercises`)
        .send();
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length, `${gradeId}/${subjectId} يجب أن يعرض تمارين حقيقية`).toBeGreaterThanOrEqual(min);
      for (const ex of res.body) {
        expect(ex.title).toBeTruthy();
        expect(Array.isArray(ex.questions)).toBe(true);
        for (const q of ex.questions) {
          expect(q.kind).toBe('question');
          expect(q.text).toBeTruthy();
          if (q.options && q.options.length > 0) {
            expect(Number(q.answer)).toBeGreaterThanOrEqual(0);
            expect(Number(q.answer)).toBeLessThan(q.options.length);
          } else {
            expect(q.answer).toBeTruthy();
          }
        }
      }
    }
  });

  it('المرحلة 6.2: لا مواد مزيّفة — لا فرنسية ولا تربية إسلامية/تشكيلية بلا مصادر', async () => {
    const res = await request(app).get('/api/public/curriculum/books').send();
    for (const book of res.body) {
      const title = `${book.subject}`;
      expect(title.includes('فرنسية'), 'لا نختلق محتوى فرنسية').toBe(false);
    }
    const subjects = await request(app).get('/api/public/curriculum/subjects?level=السنة الأولى').send();
    const ids = subjects.body.map((s) => s.id);
    expect(ids).toEqual(expect.arrayContaining(['math', 'anisi', 'science']));
    expect(ids).not.toContain('french');
  });
});
