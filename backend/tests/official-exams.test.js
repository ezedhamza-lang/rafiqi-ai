import { describe, it, expect, beforeAll } from 'vitest';
import { resetDatabase, seedTestData, login } from './helpers.js';
import request from 'supertest';

let app;

beforeAll(async () => {
  ({ app } = await import('../src/index.js'));
  await resetDatabase();
  await seedTestData();
});

function authHeader(token) {
  return { Authorization: `Bearer ${token}` };
}

async function loginAs(role) {
  const emails = {
    teacher: 'teacher@test.tn',
    student: 'student@test.tn'
  };
  const passwords = {
    teacher: 'teacher123',
    student: 'student123'
  };
  const res = await login(emails[role], passwords[role]);
  return res.body.token;
}

describe('المرحلة 6.3 — بنك الاختبارات الرسمية ومحرك التصحيح', () => {
  it('البنك يحتوي اختبارات حقيقية لكل ثلاثي ومادة متوفرة (س1 وس2)', async () => {
    const res = await request(app).get('/api/public/official-exams-bank').send();
    expect(res.status).toBe(200);
    const bank = res.body;
    expect(Array.isArray(bank)).toBe(true);
    expect(bank.length).toBeGreaterThanOrEqual(15);

    const levels = new Set(bank.map((e) => e.level));
    expect(levels.has('year1')).toBe(true);
    expect(levels.has('year2')).toBe(true);

    const subjects = new Set(bank.map((e) => e.subject));
    for (const s of ['math', 'anisi', 'science']) {
      expect(subjects.has(s), `المادة ${s} يجب أن تكون في البنك`).toBe(true);
    }

    const trimesters = new Set(bank.map((e) => e.trimester));
    expect(trimesters.has(1)).toBe(true);
    expect(trimesters.has(2)).toBe(true);
    expect(trimesters.has(3)).toBe(true);
  });

  it('كل قالب في البنك يحمل جدول إسناد أعداد مجموعه 20 نقطة', async () => {
    const res = await request(app).get('/api/public/official-exams-bank').send();
    for (const e of res.body) {
      expect(Array.isArray(e.criteria), `${e.id} يجب أن يملك معايير`).toBe(true);
      expect(e.criteria.length).toBeGreaterThanOrEqual(3);
      const sum = e.criteria.reduce((s, c) => s + (c.mastery?.max ?? 0), 0);
      expect(sum, `${e.id}: مجموع معايير التملك الأقصى يجب أن يساوي 20`).toBe(20);
    }
  });

  it('المعاينة العمومية تفصّل سندات وأسئلة قالب واحد', async () => {
    const list = await request(app).get('/api/public/official-exams-bank').send();
    const one = list.body.find((e) => e.subject === 'math');
    const res = await request(app).get(`/api/public/official-exams-bank/${one.id}`).send();
    expect(res.status).toBe(200);
    expect(res.body.title).toBe(one.title);
    expect(Array.isArray(res.body.passages)).toBe(true);
    expect(res.body.passages.length).toBeGreaterThan(0);
    expect(Array.isArray(res.body.questions)).toBe(true);
    expect(res.body.questions.length).toBeGreaterThanOrEqual(5);
  });

  it('الأستاذ ينشئ اختبارا رسميا من البنك (instantiate)', async () => {
    const token = await loginAs('teacher');
    const list = await request(app).get('/api/public/official-exams-bank?level=year1&subject=math').send();
    const bankExam = list.body[0];
    expect(bankExam).toBeTruthy();

    const res = await request(app)
      .post('/api/teacher/exams/instantiate')
      .set(authHeader(token))
      .send({ bankId: bankExam.id });
    expect(res.status).toBe(201);
    expect(res.body.title).toBe(bankExam.title);
    expect(res.body.subject).toBe('math');
    expect(res.body.trimester).toBe(1);
    expect(res.body.content.criteria.length).toBe(bankExam.criteria.length);
    expect(res.body.content.questions.length).toBe(bankExam.questions.length);
    expect(res.body.summary.canAutoCorrect).toBe(true);
  });

  it('محرك التصحيح: إجابات صحيحة كلها تعطي 20، وخطأ كله يعطي 0', async () => {
    const list = await request(app).get('/api/public/official-exams-bank').send();
    const mathExam = list.body.find((e) => e.subject === 'math' && e.trimester === 1 && e.level === 'year1');

    const full = {};
    for (const q of mathExam.questions) {
      if (q.type === 'MCQ') full[q.id] = q.correct;
      else if (q.type === 'TRUE_FALSE') full[q.id] = q.correctAnswer;
      else if (q.type === 'FILL_BLANK') full[q.id] = q.correctAnswer;
    }

    const { gradeOfficialExam, buildExamContent } = await import('../src/services/officialExamService.js');
    const content = buildExamContent(mathExam);

    const good = gradeOfficialExam(content, full);
    expect(good.total).toBe(20);
    expect(good.totalMax).toBe(20);
    expect(good.needsManualGrading).toBe(false);

    const bad = gradeOfficialExam(content, {});
    expect(bad.total).toBe(0);
  });

  it('المعايير غير الآلية (مثل القراءة الجهرية/الإنتاج) تُعلَم للتقويم اليدوي', async () => {
    const list = await request(app).get('/api/public/official-exams-bank').send();
    const reading = list.body.find((e) => e.subject === 'anisi' && e.trimester === 3 && e.level === 'year1');
    const { gradeOfficialExam, buildExamContent } = await import('../src/services/officialExamService.js');
    const r = gradeOfficialExam(buildExamContent(reading), {});
    expect(r.needsManualGrading).toBe(true);
    expect(r.manualCriteria.length).toBeGreaterThan(0);
  });

  it('التلميذ يرى الاختبارات المنشورة لقسمه ويتقدم بإجاباته فيُصحّح آليا', async () => {
    const teacherToken = await loginAs('teacher');
    const studentToken = await loginAs('student');

    const list = await request(app).get('/api/public/official-exams-bank?level=year1&subject=science').send();
    const bankExam = list.body[0];

    const created = await request(app)
      .post('/api/teacher/exams/instantiate')
      .set(authHeader(teacherToken))
      .send({ bankId: bankExam.id, classId: 1 });
    expect(created.status).toBe(201);

    const published = await request(app)
      .put(`/api/teacher/exams/${created.body.id}`)
      .set(authHeader(teacherToken))
      .send({ published: true });
    expect(published.status).toBe(200);

    const myExams = await request(app).get('/api/teacher/student/official-exams').set(authHeader(studentToken));
    expect(myExams.status).toBe(200);
    expect(myExams.body.length).toBeGreaterThanOrEqual(1);
    const mine = myExams.body.find((x) => x.id === created.body.id);
    expect(mine).toBeTruthy();
    expect(mine.published).toBe(true);

    // إجابات صحيحة كلها (من القالب الأصلي لأن مفاتيح الإجابة لا تصل للتلميذ)
    const answers = {};
    for (const q of bankExam.questions) {
      if (q.type === 'MCQ') answers[q.id] = q.correct;
      else if (q.type === 'TRUE_FALSE') answers[q.id] = q.correctAnswer;
      else if (q.type === 'FILL_BLANK') answers[q.id] = q.correctAnswer;
    }

    const submit = await request(app)
      .post(`/api/teacher/student/official-exams/${created.body.id}/submit`)
      .set(authHeader(studentToken))
      .send({ answers });
    expect(submit.status).toBe(201);
    expect(submit.body.score).toBe(20);
    expect(submit.body.result.total).toBe(20);
    expect(submit.body.status).toBe('CORRECTED');

    // الإعادة ممنوعة
    const again = await request(app)
      .post(`/api/teacher/student/official-exams/${created.body.id}/submit`)
      .set(authHeader(studentToken))
      .send({ answers });
    expect(again.status).toBe(400);
  });

  it('لا تظهر مفاتيح الإجابة للتلميذ', async () => {
    const teacherToken = await loginAs('teacher');
    const studentToken = await loginAs('student');

    const list = await request(app).get('/api/public/official-exams-bank?level=year2&subject=math').send();
    const bankExam = list.body[0];

    const created = await request(app)
      .post('/api/teacher/exams/instantiate')
      .set(authHeader(teacherToken))
      .send({ bankId: bankExam.id, classId: 1 });
    await request(app)
      .put(`/api/teacher/exams/${created.body.id}`)
      .set(authHeader(teacherToken))
      .send({ published: true });

    const detail = await request(app)
      .get(`/api/teacher/student/official-exams/${created.body.id}`)
      .set(authHeader(studentToken));
    expect(detail.status).toBe(200);
    for (const q of detail.body.content.questions) {
      expect(q.correct, 'مفتاح الإجابة (correct) يجب ألا يصل للتلميذ').toBeUndefined();
      expect(q.correctAnswer, 'مفتاح الإجابة (correctAnswer) يجب ألا يصل للتلميذ').toBeUndefined();
    }
  });
});

describe('البنك المدمج — 240 أنموذجاً للسنة الأولى من الملف المدمج', () => {
  it('يضيف 20 أنموذجاً على الأقل لكل مادة وثلاثي في السنة الأولى', async () => {
    const res = await request(app).get('/api/public/official-exams-bank?level=year1').send();
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThanOrEqual(240);
    for (const subject of ['math', 'anisi', 'science', 'production']) {
      for (const tri of [1, 2, 3]) {
        const group = res.body.filter((e) => e.subject === subject && e.trimester === tri);
        expect(group.length, `س1 ${subject} ثلاثي ${tri}`).toBeGreaterThanOrEqual(20);
      }
    }
  });

  it('كل قالب مدمج يحترم الصيغة: أنواع صحيحة، معرّفات فريدة، مفاتيح صواب/خطأ، معايير 20/20', async () => {
    const res = await request(app).get('/api/public/official-exams-bank?level=year1').send();
    const merged = res.body.filter((e) => e.id.startsWith('off-'));
    expect(merged.length).toBe(240);
    const ids = new Set();
    for (const e of merged) {
      expect(ids.has(e.id), `معرّف مكرر ${e.id}`).toBe(false);
      ids.add(e.id);
      expect(e.totalPoints).toBe(20);
      const sum = e.criteria.reduce((s, c) => s + (c.mastery?.max ?? 0), 0);
      expect(sum, `${e.id}: مجموع المعايير`).toBe(20);
      for (const q of e.questions) {
        expect(['MCQ', 'TRUE_FALSE', 'ORDER', 'EXTRACT', 'FILL_BLANK']).toContain(q.type);
        expect(q.prompt, `${e.id}/${q.id} بلا نص`).toBeTruthy();
        if (q.type === 'TRUE_FALSE') expect(['صواب', 'خطأ'], `${e.id}/${q.id}`).toContain(q.correctAnswer);
        if (q.type === 'ORDER') expect(Array.isArray(q.orderItems) && q.orderItems.length >= 2).toBe(true);
        const opts = q.options || [];
        expect(new Set(opts).size, `${e.id}/${q.id} خيارات مكررة`).toBe(opts.length);
      }
    }
  });

  it('نموذج مدمج (off-math-t1-m1) يُبنى ويُصحَّح 20/20 بالإجابات الكاملة', async () => {
    const res = await request(app).get('/api/public/official-exams-bank/off-math-t1-m1').send();
    expect(res.status).toBe(200);
    expect(res.body.level).toBe('year1');
    expect(res.body.subject).toBe('math');
    const { buildExamContent, gradeOfficialExam } = await import('../src/services/officialExamService.js');
    const content = buildExamContent(res.body);
    const answers = {};
    for (const q of content.questions) {
      if (q.type === 'MCQ') answers[q.id] = q.correct;
      else if (q.type === 'TRUE_FALSE') answers[q.id] = q.correctAnswer;
      else if (q.type === 'FILL_BLANK' || q.type === 'EXTRACT') answers[q.id] = q.correctAnswer.split('|')[0];
      else if (q.type === 'ORDER') answers[q.id] = q.orderItems;
    }
    const g = gradeOfficialExam(content, answers);
    expect(g.total).toBe(20);
    expect(g.totalMax).toBe(20);
    expect(g.needsManualGrading).toBe(false);
  });
});
