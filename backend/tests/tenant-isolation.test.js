import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import { resetDatabase, login } from './helpers.js';
import prisma from '../src/db.js';

let app;
const PW = 'tenant123';

async function mkUser(email, role, schoolId) {
  return prisma.user.create({
    data: { firstName: 'مستخدم', lastName: role, email: email.toLowerCase(), passwordHash: await bcrypt.hash(PW, 4), role, accountStatus: 'ACTIVE', schoolId }
  });
}

let classBId, teacherAId, schoolAId, schoolBId;

beforeAll(async () => {
  ({ app } = await import('../src/index.js'));
  await resetDatabase();

  const schoolA = await prisma.school.create({ data: { code: 'SCH-A', name: 'مدرسة أ' } });
  const schoolB = await prisma.school.create({ data: { code: 'SCH-B', name: 'مدرسة ب' } });
  schoolAId = schoolA.id; schoolBId = schoolB.id;

  await mkUser('dira@test.tn', 'SCHOOL_DIRECTOR', schoolA.id);
  await mkUser('dirb@test.tn', 'SCHOOL_DIRECTOR', schoolB.id);
  const tA = await mkUser('ta@test.tn', 'TEACHER', schoolA.id);
  const tB = await mkUser('tb@test.tn', 'TEACHER', schoolB.id);
  await mkUser('supertest@test.tn', 'SUPER_ADMIN', null);
  teacherAId = tA.id;

  const classA = await prisma.class.create({ data: { name: 'قسم أ-1', level: 'السنة الأولى أساسي', teacherId: tA.id, schoolId: schoolA.id } });
  const classB = await prisma.class.create({ data: { name: 'قسم ب-1', level: 'السنة الأولى أساسي', teacherId: tB.id, schoolId: schoolB.id } });
  classBId = classB.id;

  // طالب واحد في كل مدرسة (مع حساب ولي وحساب تلميذ)
  for (const [cls, sid, tag] of [[classA.id, schoolA.id, 'a'], [classB.id, schoolB.id, 'b']]) {
    const parent = await mkUser(`parent${tag}@test.tn`, 'PARENT', sid);
    const acct = await mkUser(`stud${tag}@test.tn`, 'STUDENT', sid);
    await prisma.student.create({
      data: { userId: parent.id, accountUserId: acct.id, classId: cls, firstName: `تلميذ ${tag}`, lastName: 'اختبار', birthDate: new Date('2019-01-01'), gender: 'ذكر', level: 'السنة الأولى أساسي', schoolYear: '2026-2027' }
    });
  }
});

async function tok(email) {
  const r = await login(email, PW);
  return r.body.token;
}

describe('عزل المدارس (Multi-tenancy)', () => {
  it('كل مدير يرى أقسام مدرسته فقط', async () => {
    const [tA, tB] = await Promise.all([tok('dira@test.tn'), tok('dirb@test.tn')]);
    const rA = await request(app).get('/api/director/classes').set('Authorization', `Bearer ${tA}`);
    const rB = await request(app).get('/api/director/classes').set('Authorization', `Bearer ${tB}`);
    expect(rA.body.map((c) => c.name)).toEqual(['قسم أ-1']);
    expect(rB.body.map((c) => c.name)).toEqual(['قسم ب-1']);
  });

  it('قائمة الأساتذة معزولة بالمدرسة', async () => {
    const tA = await tok('dira@test.tn');
    const r = await request(app).get('/api/director/teachers').set('Authorization', `Bearer ${tA}`);
    expect(r.body.map((u) => u.email)).toEqual(['ta@test.tn']);
  });

  it('إنشاء قسم يُسند تلقائياً لمدرسة المدير', async () => {
    const tA = await tok('dira@test.tn');
    const r = await request(app).post('/api/director/classes').set('Authorization', `Bearer ${tA}`).send({ name: 'قسم أ-2', level: 'السنة الثانية أساسي' });
    expect(r.status).toBe(201);
    expect(r.body.schoolId).toBe(schoolAId);
  });

  it('مدير لا يستطيع تعديل قسم مدرسة أخرى (404)', async () => {
    const tA = await tok('dira@test.tn');
    const r = await request(app).put(`/api/director/classes/${classBId}`).set('Authorization', `Bearer ${tA}`).send({ name: 'اختراق' });
    expect(r.status).toBe(404);
  });

  it('إحصاءات اللوحة معزولة (تلميذ واحد لكل مدرسة)', async () => {
    const [tA, tB] = await Promise.all([tok('dira@test.tn'), tok('dirb@test.tn')]);
    const sA = await request(app).get('/api/director/dashboard').set('Authorization', `Bearer ${tA}`);
    const sB = await request(app).get('/api/director/dashboard').set('Authorization', `Bearer ${tB}`);
    expect(sA.body.totals.students).toBe(1);
    expect(sB.body.totals.students).toBe(1);
    expect(sA.body.totals.teachers).toBe(1);
  });

  it('قائمة التلاميذ (/students) معزولة بالمدرسة للمدير', async () => {
    const tA = await tok('dira@test.tn');
    const r = await request(app).get('/api/students').set('Authorization', `Bearer ${tA}`);
    const names = r.body.map((s) => s.firstName);
    expect(names).toContain('تلميذ a');
    expect(names).not.toContain('تلميذ b');
  });

  it('الحضور: مدير لا يصل لقسم مدرسة أخرى (404)', async () => {
    const tA = await tok('dira@test.tn');
    const r = await request(app).get(`/api/attendance/classes/${classBId}?date=2026-09-15`).set('Authorization', `Bearer ${tA}`);
    expect(r.status).toBe(404);
  });

  it('مواد الأقسام: أستاذ مدرسة أ لا يضيف مادة لقسم مدرسة ب (403)', async () => {
    const tAt = await tok('ta@test.tn');
    const r = await request(app).post('/api/teacher/class-subjects').set('Authorization', `Bearer ${tAt}`).send({ classId: classBId, subject: 'MATH' });
    expect(r.status).toBe(403);
  });

  it('نقل مستخدم بين المدرستين يعمل للمشرف العام فقط', async () => {
    const ts = await tok('supertest@test.tn');
    const ta = await prisma.user.findUnique({ where: { id: teacherAId } });
    const r = await request(app).put(`/api/superadmin/users/${ta.id}/school`).set('Authorization', `Bearer ${ts}`).send({ schoolId: schoolBId });
    expect(r.status).toBe(200);
    expect(r.body.schoolId).toBe(schoolBId);
    const tA = await tok('dira@test.tn');
    const forbidden = await request(app).put(`/api/superadmin/users/${ta.id}/school`).set('Authorization', `Bearer ${tA}`).send({ schoolId: schoolBId });
    expect(forbidden.status).toBe(403);
  });

  it('المشرف العام (بلا مدرسة) يرى كل الأقسام', async () => {
    const ts = await tok('supertest@test.tn');
    const r = await request(app).get('/api/director/classes').set('Authorization', `Bearer ${ts}`);
    expect(r.body.length).toBeGreaterThanOrEqual(3);
  });

  it('الطلبات: المدير يرى طلبات مدرسته والقادة غير المسندين، لا طلبات مدرسة أخرى', async () => {
    const tA = await tok('dira@test.tn');
    const mkReq = async (email, schoolId) => {
      const p = await mkUser(email, 'PARENT', schoolId);
      return prisma.subscriptionRequest.create({ data: { parentId: p.id, firstName: 'تلميذ', lastName: email.split('@')[0], birthDate: new Date('2019-01-01'), level: 'السنة الأولى أساسي', schoolYear: '2026-2027' } });
    };
    const rA = await mkReq('para@test.tn', schoolAId);
    const rNull = await mkReq('parnull@test.tn', null);
    const rB = await mkReq('parb@test.tn', schoolBId);
    const res = await request(app).get('/api/director/requests').set('Authorization', `Bearer ${tA}`);
    const ids = res.body.map((x) => x.id);
    expect(ids).toContain(rA.id);
    expect(ids).toContain(rNull.id);
    expect(ids).not.toContain(rB.id);
  });
});
