import { describe, it, expect, beforeAll } from 'vitest';
import { resetDatabase, seedTestData, login } from './helpers.js';
import request from 'supertest';
import { getLessonPages } from '../src/services/curriculumService.js';

let app;
let studentToken;
let teacherToken;

beforeAll(async () => {
  ({ app } = await import('../src/index.js'));
  await resetDatabase();
  await seedTestData();
  studentToken = (await login('student@test.tn', 'student123')).body.token;
  teacherToken = (await login('teacher@test.tn', 'teacher123')).body.token;
});

describe('كتاب التلميذ: الإجابات server-side وكشفها مشروط بمحاولة', () => {
  it('حمولة الطالب العامة لم تعد تحتوي أي answer', async () => {
    const res = await request(app).get('/api/public/curriculum/books/year1/math/lessons');
    expect(res.status).toBe(200);
    const body = JSON.stringify(res.body);
    expect(body).not.toContain('"answer"');
    expect(body).not.toContain('"correctAnswer"');
    expect(body).not.toContain('"explanation"');
    const y1m01 = res.body.find((p) => p.id === 'y1m01');
    expect(y1m01).toBeTruthy();
    expect(y1m01.blocks[0].blockId).toBe('b0');
    const q = y1m01.blocks.find((b) => Array.isArray(b.options) && b.options.length);
    expect(q).toBeTruthy();
    expect(q.options.length).toBeGreaterThan(1);
    expect(q.checkable).toBe(true);
    const nonQ = y1m01.blocks.find((b) => b.kind === 'concept');
    expect(nonQ.checkable).toBe(false);
  });

  it('reveal بلا محاولة سابقة ⇒ 403', async () => {
    const res = await request(app)
      .post('/api/student/lesson/reveal')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ gradeId: 'year1', subjectId: 'math', lessonId: 'y1m01', blockId: 'b3' });
    expect(res.status).toBe(403);
    expect(res.body.error).toContain('محاول');
  });

  it('check يحفظ المحاولة ويصحّح بلا كشف', async () => {
    const wrong = await request(app)
      .post('/api/student/lesson/check')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ gradeId: 'year1', subjectId: 'math', lessonId: 'y1m01', blockId: 'b3', answer: 999 });
    expect(wrong.status).toBe(200);
    expect(wrong.body.attempts).toBe(1);
    expect(wrong.body.correct).toBe(false);
    expect(Object.keys(wrong.body).sort()).toEqual(['attempts', 'correct']);

    const right = await request(app)
      .post('/api/student/lesson/check')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ gradeId: 'year1', subjectId: 'math', lessonId: 'y1m01', blockId: 'b3', answer: 0 });
    expect(right.status).toBe(200);
    expect(right.body.attempts).toBe(2);
    expect(right.body.correct).toBe(true);
  });

  it('reveal بعد المحاولة يعيد الإجابة والحالة محفوظة للاستئناف', async () => {
    const r = await request(app)
      .post('/api/student/lesson/reveal')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ gradeId: 'year1', subjectId: 'math', lessonId: 'y1m01', blockId: 'b3' });
    expect(r.status).toBe(200);
    expect(r.body.answer).toBe(0);

    const list = await request(app)
      .get('/api/student/lesson/attempts/year1/math/y1m01')
      .set('Authorization', `Bearer ${studentToken}`);
    expect(list.status).toBe(200);
    const b3 = list.body.find((x) => x.blockId === 'b3');
    expect(b3).toMatchObject({ attempts: 2, correct: true, revealed: true });
    expect(b3.lastAnswer).not.toBeNull();
  });

  it('درس/عنصر غير موجود ⇒ 404، وحقول غير صالحة ⇒ 400', async () => {
    const missing = await request(app)
      .post('/api/student/lesson/check')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ gradeId: 'year1', subjectId: 'math', lessonId: 'zzz99', blockId: 'b0', answer: 1 });
    expect(missing.status).toBe(404);
    const badBlock = await request(app)
      .post('/api/student/lesson/check')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ gradeId: 'year1', subjectId: 'math', lessonId: 'y1m01', blockId: 'xx', answer: 1 });
    expect(badBlock.status).toBe(400);
  });

  it('وليّ أمر لا يستطيع استخدام مسارات كتاب التلميذ (403) — والمعلّم مسموح بتصميم المنصة', async () => {
    const parentToken = (await login('parent@test.tn', 'parent123')).body.token;
    const denied = await request(app)
      .post('/api/student/lesson/reveal')
      .set('Authorization', `Bearer ${parentToken}`)
      .send({ gradeId: 'year1', subjectId: 'math', lessonId: 'y1m01', blockId: 'b3' });
    expect(denied.status).toBe(403);
    const teacherAllowed = await request(app)
      .post('/api/student/lesson/check')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ gradeId: 'year1', subjectId: 'math', lessonId: 'y1m01', blockId: 'b3', answer: 0 });
    expect(teacherAllowed.status).toBe(200);
    expect(teacherAllowed.body.correct).toBe(true);
  });

  it('تسامح التصحيح: أرقام عربية/تشكيل/مسافاتExtra تُقبل server-side', async () => {
    let target = null;
    for (const g of ['year1']) {
      for (const p of getLessonPages('math', null, g)) {
        for (let i = 0; i < (p.blocks || []).length; i++) {
          const b = p.blocks[i];
          const hasOpts = Array.isArray(b.options) && b.options.length;
          if (!hasOpts && typeof b.answer === 'string' && /^\d+/.test(b.answer.replace(/[٠-٩]/g, '0'))) {
            target = { lessonId: p.id, blockId: 'b' + i, answer: b.answer };
            break;
          }
        }
        if (target) break;
      }
    }
    if (!target) return;
    const eastern = target.answer.replace(/[0-9]/g, (d) => '٠١٢٣٤٥٦٧٨٩'[Number(d)]);
    const res = await request(app)
      .post('/api/student/lesson/check')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ gradeId: 'year1', subjectId: 'math', lessonId: target.lessonId, blockId: target.blockId, answer: eastern + '  ' });
    expect(res.status).toBe(200);
    expect(res.body.correct).toBe(true);
  });
});
