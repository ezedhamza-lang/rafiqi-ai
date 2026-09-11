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
    expect(kinds.has('concept')).toBe(true);
  });

  it('كتب التلميذ بلا كتل مذكرة (لا أهداف/أساس/محور/مرجع) — رياضيات كل السنوات', async () => {
    const forbidden = ['الأهداف', 'الأساس البيداغوجي', 'المحور', 'مرجع'];
    for (const gradeId of ['year1', 'year2', 'year3', 'year4', 'year5', 'year6']) {
      const res = await request(app)
        .get(`/api/public/curriculum/books/${gradeId}/math/lessons`)
        .send();
      expect(res.status).toBe(200);
      for (const page of res.body) {
        for (const block of page.blocks || []) {
          expect(forbidden.includes(block.title), `${gradeId}/${page.id}: كتلة مذكرة ممنوعة «${block.title}»`).toBe(false);
        }
      }
    }
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
    // العقد الجديد لأنيسي س1: ورقة رسمية مثل الرياضيات — أقسام (concept) + أسئلة، وكل درس ورقة تقويم
    for (const k of ['concept', 'question']) {
      expect(kinds.has(k), `نوع الكتلة ${k} يجب أن يكون مدعوماً`).toBe(true);
    }
    for (const p of res.body) expect(p.isAssessment).toBe(true);
    // الإجابات لم تعد تصل للواجهة العامة — قابلية الإجابة تُتحقق من المرجع الخادمي
    expect(JSON.stringify(res.body)).not.toContain('"answer"');
    const { getLessonPages } = await import('../src/services/curriculumService.js');
    for (const q of getLessonPages('anisi', null, 'year1').flatMap((p) => p.blocks || []).filter((b) => b.kind === 'question')) {
      const hasMCQ = Array.isArray(q.options) && q.options.length > 0 && typeof q.answer === 'number';
      const hasFill = !q.options && q.answer !== undefined && q.answer !== null;
      expect(hasMCQ || hasFill, `السؤال "${(q.text || '').slice(0, 40)}" يجب أن يكون قابلًا للإجابة`).toBe(true);
    }
  });

  it('إيقاظ علمي س1: دروس تفاعلية + تقييمات فترات /20 — كل سؤال قابل للإجابة', async () => {
    const res = await request(app)
      .get('/api/public/curriculum/books/year1/science/lessons')
      .send();
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    // 21 درسًا + 6 تقييمات فترات
    expect(res.body.length).toBeGreaterThanOrEqual(25);

    const blocks = res.body.flatMap((p) => p.blocks || []);
    const kinds = new Set(blocks.map((b) => b.kind));
    for (const k of ['objective', 'concept', 'question', 'summary']) {
      expect(kinds.has(k), `نوع الكتلة ${k} يجب أن يصل للتلميذ من كتاب الإيقاظ`).toBe(true);
    }

    for (const page of res.body) {
      expect(page.blocks.length).toBeGreaterThan(0);
    }

    // كل سؤال قابل للإجابة — يُتحقق من مرجع الخادم (الإجابات محجوبة عن الحمولة العامة)
    expect(JSON.stringify(res.body)).not.toContain('"answer"');
    const { getLessonPages } = await import('../src/services/curriculumService.js');
    for (const q of getLessonPages('science', null, 'year1').flatMap((p) => p.blocks || []).filter((b) => b.kind === 'question')) {
      const hasMCQ = Array.isArray(q.options) && q.options.length > 0 && typeof q.answer === 'number';
      const hasFill = !q.options && q.answer !== undefined && q.answer !== null;
      expect(hasMCQ || hasFill, `سؤال بلا إجابة في ${q.title || ''}`).toBe(true);
    }

    // تقييمات الفترات الست بمجموع 20 نقطة
    const assess = res.body.filter((p) => p.isAssessment);
    expect(assess.length).toBe(6);
    for (const a of assess) {
      const pts = (a.blocks || []).filter((b) => b.points).reduce((s, b) => s + b.points, 0);
      expect(pts, `تقييم ${a.id} مجموعه ${pts} بدل 20`).toBe(20);
    }

    const summary = blocks.find((b) => b.kind === 'summary');
    expect(summary.points.length).toBeGreaterThan(0);
  });

  it('إيقاظ علمي س1: أسئلة الاختيار تحمل خيارات وإجابة قابلة للتحقق', async () => {
    const { getLessonPages } = await import('../src/services/curriculumService.js');
    const questions = getLessonPages('science', null, 'year1').flatMap((p) => p.blocks || []).filter((b) => b.kind === 'question');
    expect(questions.length).toBeGreaterThan(30);

    const mcq = questions.filter((q) => q.options && q.options.length > 0);
    expect(mcq.length).toBeGreaterThan(30);
    for (const q of mcq) {
      expect(q.answer).toBeDefined();
      expect(Number(q.answer)).toBeGreaterThanOrEqual(0);
      expect(Number(q.answer)).toBeLessThan(q.options.length);
    }
    // والواجهة العامة تعرض الخيارات بلا الإجابة
    const res = await request(app).get('/api/public/curriculum/books/year1/science/lessons').send();
    const pubMcq = res.body.flatMap((p) => p.blocks || []).filter((b) => b.kind === 'question' && b.options && b.options.length);
    expect(pubMcq.length).toBeGreaterThan(30);
    for (const q of pubMcq) expect(q.answer).toBeUndefined();
  });

  it('المرحلة 6.2: إثراء البنك موضوعي لا عشوائي — لا محتوى أجنبي داخل الدروس', async () => {
    // درس الأعداد في س2 («منازل الأعداد») يجب ألا يحمل محتوى قياس الطول (س1).
    const y2 = await request(app)
      .get('/api/public/curriculum/books/year2/math/lessons')
      .send();
    const numbersLesson = y2.body.find((l) => l.id === 'y2m-08');
    expect(numbersLesson).toBeTruthy();
    const y2Text = JSON.stringify(numbersLesson.blocks);
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
    for (const page of (await import('../src/services/curriculumService.js')).getLessonPages('math', null, 'year3')) {
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
    // الحمولة العامة: سؤال بإجابات بلا إجابة صحيحة
    const pubQs = (spatial.blocks || []).filter((b) => b.kind === 'question' && b.options && b.options.length);
    expect(pubQs.length).toBeGreaterThan(0);
    for (const q of pubQs) expect(q.answer).toBeUndefined();
    // المرجع الخادمي: قابل للتحقق وفي نفس الموضوع
    const { getLessonPages } = await import('../src/services/curriculumService.js');
    const srv = getLessonPages('math', null, 'year1').find((l) => l.title.includes('تعيين موقع شيء في الفضاء'));
    const qs = (srv.blocks || []).filter((b) => b.kind === 'question' && b.options && b.answer !== undefined);
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

  it('كتاب س6 «رفيقي في الرياضيات»: نسخة مصوّرة كاملة 26 صفحة — بلا مساس بأي كتاب قائم', async () => {
    const res = await request(app).get('/api/public/curriculum/books');
    expect(res.status).toBe(200);
    const y6 = res.body.filter((b) => b.gradeId === 'year6');
    expect(y6.map((b) => b.subjectId)).toEqual(expect.arrayContaining(['math', 'math-rafiqi', 'anisi', 'science', 'production']));
    const raf = y6.find((b) => b.subjectId === 'math-rafiqi');
    expect(raf.title).toBe('رفيقي في الرياضيات');
    expect(raf.subjectKey).toBe('رياضيات');
    expect(raf.scanReady).toBe(true);
    expect(raf.hasImages).toBe(true);
    expect(raf.totalPages).toBe(26);
    expect(raf.imageBase).toBe('/assets/books/rafiqi-m6/');
    const fs = await import('fs');
    const path = await import('path');
    const dir = path.join(process.cwd(), 'curriculum/assets-books/rafiqi-m6');
    expect(fs.existsSync(path.join(dir, 'page-001.webp'))).toBe(true);
    expect(fs.existsSync(path.join(dir, 'page-026.webp'))).toBe(true);
    // الكتاب الرسمي القديم لس6 لم يُمسّ
    const old = y6.find((b) => b.subjectId === 'math');
    expect(old.title).toBeTruthy();
  });

  it('أمان: بنك الاختبارات العام لا يسرّب مفاتيح الإجابات (التفاصيل والقائمة)', async () => {
    const detail = await request(app).get('/api/public/official-exams-bank/year1-t1-math-noor');
    expect(detail.status).toBe(200);
    const blob = JSON.stringify(detail.body);
    expect(blob).not.toMatch(/"correct"|"correctAnswer"|"orderItems"/);
    expect((detail.body.questions || []).length).toBeGreaterThan(0);

    const list = await request(app).get('/api/public/official-exams-bank');
    expect(list.status).toBe(200);
    expect(list.body.length).toBeGreaterThan(0);
    expect(JSON.stringify(list.body)).not.toMatch(/"correct"|"correctAnswer"|"orderItems"/);
  });
});
