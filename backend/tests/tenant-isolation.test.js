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

beforeAll(async () => {
  ({ app } = await import('../src/index.js'));
  await resetDatabase();

  const schoolA = await prisma.school.create({ data: { code: 'SCH-A', name: 'مدرسة أ' } });
  const schoolB = await prisma.school.create({ data: { code: 'SCH-B', name: 'مدرسة ب' } });

  await mkUser('dira@test.tn', 'SCHOOL_DIRECTOR', schoolA.id);
  await mkUser('dirb@test.tn', 'SCHOOL_DIRECTOR', schoolB.id);
  const tA = await mkUser('ta@test.tn', 'TEACHER', schoolA.id);
  const tB = await mkUser('tb@test.tn', 'TEACHER', schoolB.id);
  await mkUser('supertest@test.tn', 'SUPER_ADMIN', null);

  await prisma.class.create({ data: { name: 'قسم أ-1', level: 'السنة الأولى أساسي', teacherId: tA.id, schoolId: schoolA.id } });
  await prisma.class.create({ data: { name: 'قسم ب-1', level: 'السنة الأولى أساسي', teacherId: tB.id, schoolId: schoolB.id } });
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
    const schoolA = await prisma.school.findUnique({ where: { code: 'SCH-A' } });
    expect(r.body.schoolId).toBe(schoolA.id);
  });

  it('مدير لا يستطيع تعديل قسم مدرسة أخرى (404)', async () => {
    const tA = await tok('dira@test.tn');
    const schoolB = await prisma.school.findUnique({ where: { code: 'SCH-B' } });
    const clsB = await prisma.class.findFirst({ where: { schoolId: schoolB.id } });
    const r = await request(app).put(`/api/director/classes/${clsB.id}`).set('Authorization', `Bearer ${tA}`).send({ name: 'اختراق' });
    expect(r.status).toBe(404);
  });

  it('المشرف العام (بلا مدرسة) يرى كل الأقسام', async () => {
    const ts = await tok('supertest@test.tn');
    const r = await request(app).get('/api/director/classes').set('Authorization', `Bearer ${ts}`);
    expect(r.body.length).toBeGreaterThanOrEqual(3);
  });
});
