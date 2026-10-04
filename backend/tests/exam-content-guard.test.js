// حارس الورقة الرسمية (إغلاق «الباب الخلفي») — القاعدة الواحدة التي تحكم
// الإنشاء والتعديل والنشر، مطابقةً لسلوك الواجهة (لا أشدّ ولا أضعف).
//
// ما كان خللًا (04-10-2026): الواجهة تمنع حفظ ورقة فيها أسئلة مقفلة بلا جدول
// إسناد، لكن الـAPI كان يقبلها ⇒ ورقة «بلا سند» تُنشر برمجيًا، فيبقى كل
// تسليم «بانتظار التصحيح» بلا تصحيح آلي.
import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import request from 'supertest';
import { resetDatabase, seedTestData, login } from './helpers.js';
import { inspectExamContent } from '../src/exams/examContentGuard.js';
import { listBankExams } from '../src/services/officialExamService.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const backend = path.resolve(here, '..');

let app;
let teacherToken;
let klass;

const validCriteria = [
  { id: 'مع1', label: 'يجمع', mastery: { none: 0, below: 2, min: 4, max: 5 } },
  { id: 'مع2', label: 'يطرح', mastery: { none: 0, below: 1, min: 3, max: 5 } }
];

const paperWith = ({ criteria = validCriteria, questions } = {}) => ({
  totalPoints: 20,
  criteria,
  questions: questions ?? [
    { id: 'q1', type: 'FILL_BLANK', criterion: 'مع1', correctAnswer: '3', points: 10 },
    { id: 'q2', type: 'FILL_BLANK', criterion: 'مع2', correctAnswer: '2', points: 10 }
  ]
});

beforeAll(async () => {
  ({ app } = await import('../src/index.js'));
  await resetDatabase();
  klass = (await seedTestData()).klass;
  teacherToken = (await login('teacher@test.tn', 'teacher123')).body.token;
  expect(teacherToken).toBeTruthy();
});

const auth = () => ({ Authorization: `Bearer ${teacherToken}` });

describe('حارس الورقة الرسمية — القواعد (وحدة)', () => {
  it('ورقة سليمة تمرّ', () => {
    const r = inspectExamContent(paperWith());
    expect(r.blocking).toBe(false);
    expect(r.code).toBeNull();
    expect(r.detail.criteria).toBe(2);
  });

  it('أسئلة مقفلة بلا جدول إسناد ⇒ تمنع (NO_CRITERIA)', () => {
    const r = inspectExamContent(paperWith({ criteria: [] }));
    expect(r.blocking).toBe(true);
    expect(r.code).toBe('NO_CRITERIA');
    expect(r.messageAr).toMatch(/بلا جدول إسناد/);
  });

  it('كل الأسئلة مفتوحة بلا جدول إسناد ⇒ مسموحة (تصحيح يدوي معرَّف)', () => {
    const r = inspectExamContent({
      totalPoints: 20,
      questions: [{ id: 'q1', type: 'OPEN', prompt: 'اشرح', points: 20 }]
    });
    expect(r.blocking).toBe(false);
  });

  it('سؤال يشير إلى كفاية غير موجودة ⇒ يمنع (ORPHAN_CRITERION)', () => {
    const r = inspectExamContent(
      paperWith({
        questions: [
          { id: 'q1', type: 'FILL_BLANK', criterion: 'مع1', correctAnswer: '3', points: 10 },
          { id: 'q2', type: 'FILL_BLANK', criterion: 'مع9', correctAnswer: '2', points: 10 }
        ]
      })
    );
    expect(r.blocking).toBe(true);
    expect(r.code).toBe('ORPHAN_CRITERION');
  });

  it('سؤال بلاCriterion إطلاقًا ⇒ يمنع (كفاية إلزامية)', () => {
    const r = inspectExamContent(
      paperWith({
        questions: [
          { id: 'q1', type: 'FILL_BLANK', criterion: 'مع1', correctAnswer: '3', points: 10 },
          { id: 'q2', type: 'FILL_BLANK', correctAnswer: '2', points: 10 }
        ]
      })
    );
    expect(r.blocking).toBe(true);
    expect(r.code).toBe('ORPHAN_CRITERION');
  });

  it('Σ جدول الإسناد ≠ Σ نقاط الأسئلة ⇒ تحذير لا منع (وإلا لكُسر بنك الاختبارات)', () => {
    const r = inspectExamContent(
      paperWith({
        criteria: [{ id: 'مع1', label: 'يجمع', mastery: { none: 0, below: 1, min: 2, max: 3 } }],
        questions: [{ id: 'q1', type: 'FILL_BLANK', criterion: 'مع1', correctAnswer: '3', points: 20 }]
      })
    );
    expect(r.blocking).toBe(false);
    expect(r.warnings.some((w) => w.startsWith('SIGMA_MISMATCH'))).toBe(true);
  });

  it('مفتاح إجابة ناقص ⇒ تحذير لا منع (التصحيح اليدوي الصادق ليس خطأ)', () => {
    const r = inspectExamContent(
      paperWith({
        questions: [
          { id: 'q1', type: 'FILL_BLANK', criterion: 'مع1', correctAnswer: '3', points: 10 },
          { id: 'q2', type: 'FILL_BLANK', criterion: 'مع2', points: 10 }
        ]
      })
    );
    expect(r.blocking).toBe(false);
    expect(r.warnings.some((w) => w.startsWith('MISSING_ANSWER_KEYS'))).toBe(true);
  });
});

describe('حارس الورقة الرسمية — لا يكسر بنك الاختبارات (342 ورقة)', () => {
  it('كل ورقة بنك تمرّ من الحارس', () => {
    const bank = listBankExams();
    expect(bank.length).toBeGreaterThan(300);
    const blocked = [];
    for (const e of bank) {
      const criteria = e.criteria || [];
      const criteriaMax = criteria.reduce((s, c) => s + Number(c?.mastery?.max || 0), 0);
      const r = inspectExamContent({
        totalPoints: criteriaMax || 20,
        questions: e.questions || [],
        criteria
      });
      if (r.blocking) blocked.push({ id: e.id, code: r.code });
    }
    expect(blocked, `أوراق بنك ممنوعة: ${JSON.stringify(blocked.slice(0, 5))}`).toEqual([]);
  });
});

describe('حارس الورقة الرسمية — المسار الحقيقي ( supertest )', () => {
  it('الإنشاء بلا جدول إسناد مرفوض (400)', async () => {
    const res = await request(app)
      .post('/api/teacher/exams')
      .set(auth())
      .send({ title: 'بلا سند', subject: 'MATH', classId: klass.id, content: paperWith({ criteria: [] }) });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/بلا جدول إسناد/);
    expect(res.body.details?.code).toBe('NO_CRITERIA');
  });

  it('الإنشاء بسند صحيح ينجح (201)而后 يُنشر (200)', async () => {
    const created = await request(app)
      .post('/api/teacher/exams')
      .set(auth())
      .send({ title: 'ورقة سليمة', subject: 'MATH', classId: klass.id, content: paperWith() });
    expect(created.status).toBe(201);

    const published = await request(app)
      .put(`/api/teacher/exams/${created.body.id}`)
      .set(auth())
      .send({ published: true });
    expect(published.status).toBe(200);
  });

  it('النشر دون إرسال المحتوى يُفحص أيضًا (لا باب خلفي ثاني)', async () => {
    // ورقة أُنشئت ق��بل وجود الحارس (نُدخلها مباشرة كما لو كانت قديمة)
    const { default: prisma } = await import('../src/db.js');
    const teacher = await prisma.user.findUnique({ where: { email: 'teacher@test.tn' } });
    const legacy = await prisma.officialExam.create({
      data: {
        teacherId: teacher.id,
        classId: klass.id,
        title: 'ورقة قديمة بلا سند',
        subject: 'MATH',
        published: false,
        content: { totalPoints: 20, questions: [{ id: 'q1', type: 'FILL_BLANK', correctAnswer: '3', points: 20 }] }
      }
    });

    const res = await request(app).put(`/api/teacher/exams/${legacy.id}`).set(auth()).send({ published: true });
    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/بلا جدول إسناد/);
    const after = await prisma.officialExam.findUnique({ where: { id: legacy.id } });
    expect(after.published).toBe(false); // لم تُنشر رغمًا
  });

  it('رسالة الخطأ عربية وواضحة (لا 500 ولا رمز غامض)', async () => {
    const res = await request(app)
      .post('/api/teacher/exams')
      .set(auth())
      .send({ title: 'سند يتيم', subject: 'MATH', classId: klass.id, content: paperWith({ criteria: [{ id: 'مع1', label: 'يجمع', mastery: { none: 0, below: 1, min: 2, max: 3 } }], questions: [{ id: 'q1', type: 'FILL_BLANK', criterion: 'مع9', correctAnswer: '3', points: 3 }] }) });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/كفاية/);
  });
});

describe('القاعدة الواحدة: الواجهة والخادم متّفقان', () => {
  it('شروط المنع في الواجهة ما زالت موجودة (لا تفرّقان بصمت)', () => {
    const ui = fs.readFileSync(
      path.join(backend, '..', 'frontend', 'src', 'pages', 'teacher', 'OfficialExams.jsx'),
      'utf8'
    );
    // نفس شرط المنع: أسئلة مقفلة بلا جدول إسناد
    expect(ui).toMatch(/closed\.length > 0 && criteria\.length === 0/);
    // والواجهة تعرض تحذير Σ ولا تمنع به (مطابق لقرارنا)
    expect(ui).toMatch(/gradingWarnSigma/);
  });
});
