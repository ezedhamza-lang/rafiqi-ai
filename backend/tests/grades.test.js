import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { resetDatabase, seedTestData, login } from './helpers.js';
import prisma from '../src/db.js';

let app;
let teacherTok;
let studentTok;
let classId;
let studentUserId;

describe('الجدول الصحيح + المعدلات والشهادات الرسمية', () => {
  beforeAll(async () => {
    ({ app } = await import('../src/index.js'));
    await resetDatabase();
    const { users, klass, student } = await seedTestData();
    classId = klass.id;
    studentUserId = student.accountUserId;
    teacherTok = (await login('teacher@test.tn', 'teacher123')).body.token;
    studentTok = (await login('student@test.tn', 'student123')).body.token;
    const auth = (r) => r.set('Authorization', `Bearer ${teacherTok}`);
    // برمجة مادة الرياضيات بمعامل افتراضي
    const cs = await auth(request(app).post('/api/teacher/class-subjects')).send({ classId, subject: 'MATH' });
    expect(cs.status).toBe(201);
    expect(cs.body.coefficient).toBe(4);
    // اختبار سريع + تسليم من التلميذ (إجابات صحيحة كلها)
    const qz = await auth(request(app).post('/api/teacher/quizzes')).send({
      title: 'اختبار تجميع',
      subject: 'MATH',
      classId,
      questions: [
        { id: 'q1', type: 'MCQ', prompt: '2+2؟', options: ['3', '4'], correctOption: '1', points: 2 },
        { id: 'q2', type: 'FILL_BLANK', prompt: '5+5؟', correctAnswer: '10', points: 2 }
      ]
    });
    expect(qz.status).toBe(201);
    const sub = await request(app)
      .post(`/api/teacher/student/quizzes/${qz.body.id}/submit`)
      .set('Authorization', `Bearer ${studentTok}`)
      .send({ answers: { q1: '1', q2: '10' } });
    expect([200, 201]).toContain(sub.status);
  });

  // ---------- المعدلات ----------
  it('معدل الثلاثي = Σ(عدد×معامل)÷Σ معامل + الرتبة', async () => {
    const res = await request(app).get(`/api/teacher/grades/classes/${classId}?period=1`).set('Authorization', `Bearer ${teacherTok}`);
    expect(res.status).toBe(200);
    const row = res.body.rows.find((r) => r.studentUserId === studentUserId);
    expect(row).toBeTruthy();
    expect(row.marks.MATH).toBe(20);
    expect(row.mean).toBe(20);
    expect(row.rank).toBe(1);
    expect(row.mention).toBe('تجدير مفض');
  });

  it('المعدل السنوي عند غياب ثلاثيات = متوسط المتوفر (لا يقسّر المعدل)', async () => {
    const res = await request(app).get(`/api/teacher/grades/classes/${classId}?period=annual`).set('Authorization', `Bearer ${teacherTok}`);
    const row = res.body.rows.find((r) => r.studentUserId === studentUserId);
    expect(row.annual).toBe(20);
  });

  it('معدل ثلاثٍ لا توجد به علامات ⇒ null بلا انهدام', async () => {
    const res = await request(app).get(`/api/teacher/grades/classes/${classId}?period=2`).set('Authorization', `Bearer ${teacherTok}`);
    const row = res.body.rows.find((r) => r.studentUserId === studentUserId);
    expect(row.mean).toBeNull();
    expect(row.rank).toBeNull();
  });

  it('رفض period غير صالح', async () => {
    const res = await request(app).get(`/api/teacher/grades/classes/${classId}?period=9`).set('Authorization', `Bearer ${teacherTok}`);
    expect(res.status).toBe(400);
  });

  it('تعديل المعامل live يغيّر المعدل', async () => {
    const cs = await request(app).get('/api/teacher/class-subjects').set('Authorization', `Bearer ${teacherTok}`);
    const row = cs.body.subjects.find((s) => s.class.id === classId && s.subject === 'MATH');
    const upd = await request(app).put(`/api/teacher/class-subjects/${row.id}`).set('Authorization', `Bearer ${teacherTok}`).send({ coefficient: 2 });
    expect(upd.status).toBe(200);
    expect(upd.body.coefficient).toBe(2);
    const g = await request(app).get(`/api/teacher/grades/classes/${classId}?period=1`).set('Authorization', `Bearer ${teacherTok}`);
    expect(g.body.rows.find((r) => r.studentUserId === studentUserId).mean).toBe(20);
    await request(app).put(`/api/teacher/class-subjects/${row.id}`).set('Authorization', `Bearer ${teacherTok}`).send({ coefficient: 4 });
  });

  // ---------- PDF ----------
  it('دفتر الأعداد PDF صالح', async () => {
    const res = await request(app).get(`/api/teacher/grades/classes/${classId}/pdf?period=1`).set('Authorization', `Bearer ${teacherTok}`);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/pdf/);
    expect(res.body.slice(0, 5).toString()).toBe('%PDF-');
  });

  it('شهادة التلميذ JSON ثم PDF', async () => {
    const j = await request(app).get(`/api/teacher/grades/students/${studentUserId}/classes/${classId}/certificate?period=1`).set('Authorization', `Bearer ${teacherTok}`);
    expect(j.status).toBe(200);
    expect(j.body.mean).toBe(20);
    expect(j.body.subjects[0].label).toBe('الرياضيات');
    expect(j.body.sumProducts).toBe(80);
    const p = await request(app).get(`/api/teacher/grades/students/${studentUserId}/classes/${classId}/certificate/pdf?period=1`).set('Authorization', `Bearer ${teacherTok}`);
    expect(p.status).toBe(200);
    expect(p.body.slice(0, 5).toString()).toBe('%PDF-');
  });

  it('لا شهادة لتلميذ غير موجود ⇒ 404', async () => {
    const res = await request(app).get(`/api/teacher/grades/students/999999/classes/${classId}/certificate?period=1`).set('Authorization', `Bearer ${teacherTok}`);
    expect(res.status).toBe(404);
  });

  // ---------- جدول الأسبوع ----------
  it('قائمة الجداول تتضمن 6 فترات والاقسام', async () => {
    const res = await request(app).get('/api/teacher/schedules').set('Authorization', `Bearer ${teacherTok}`);
    expect(res.status).toBe(200);
    expect(res.body.slots).toHaveLength(6);
    expect(res.body.classes[0].class.id).toBe(classId);
  });

  it('حفظ شبكة صحيحة، ورفض مادة غير مبرمجة، ورفض تعارض وقت الأستاذ', async () => {
    const ok = await request(app).put(`/api/teacher/schedules/${classId}`).set('Authorization', `Bearer ${teacherTok}`)
      .send({ grid: [{ day: 1, period: 1, subject: 'MATH' }] });
    expect(ok.status).toBe(200);
    expect(ok.body.count).toBe(1);

    const bad = await request(app).put(`/api/teacher/schedules/${classId}`).set('Authorization', `Bearer ${teacherTok}`)
      .send({ grid: [{ day: 2, period: 2, subject: 'SCIENCE' }] });
    expect(bad.status).toBe(400);

    // قسم ثانٍ لنفس الأستاذ في نفس التوقيت ⇒ تعارض
    const cls2 = await prisma.class.create({ data: { name: 'قسم ب', level: 'السنة الأولى أساسي', teacherId: (await prisma.user.findUnique({ where: { email: 'teacher@test.tn' } })).id } });
    await request(app).post('/api/teacher/class-subjects').set('Authorization', `Bearer ${teacherTok}`).send({ classId: cls2.id, subject: 'MATH' });
    const clash = await request(app).put(`/api/teacher/schedules/${cls2.id}`).set('Authorization', `Bearer ${teacherTok}`)
      .send({ grid: [{ day: 1, period: 1, subject: 'MATH' }] });
    expect(clash.status).toBe(409);

    // جدول التلميذ يعكس الشبكة المحفوظة
    const mine = await request(app).get('/api/teacher/schedules/student/my').set('Authorization', `Bearer ${studentTok}`);
    expect(mine.status).toBe(200);
    expect(mine.body.grid).toHaveLength(1);
    expect(mine.body.grid[0].subjectLabel).toBe('الرياضيات');
    expect(mine.body.class.name).toBeTruthy();
  });

  it('المعلم لا يمس قسمًا ليس له', async () => {
    const other = await prisma.class.create({ data: { name: 'قسم ج', level: 'السنة الأولى أساسي', teacherId: null } });
    const res = await request(app).put(`/api/teacher/schedules/${other.id}`).set('Authorization', `Bearer ${teacherTok}`).send({ grid: [] });
    expect(res.status).toBe(404);
  });
});
