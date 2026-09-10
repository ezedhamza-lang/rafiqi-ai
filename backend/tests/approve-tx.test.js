import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import { resetDatabase } from './helpers.js';
import prisma from '../src/db.js';

const PW = 'dir12345';
let app;
let dirToken;
let parentId;
let classId;

async function tok(email) {
  const r = await request(app).post('/api/auth/login').send({ email, password: PW });
  return r.body.token;
}

async function mkRequest() {
  return prisma.subscriptionRequest.create({
    data: {
      parentId,
      firstName: 'زائر',
      lastName: 'اختبار',
      birthDate: new Date('2019-01-01'),
      gender: 'ذكر',
      level: 'السنة الأولى أساسي',
      schoolYear: '2026-2027',
      status: 'PENDING_APPROVAL'
    }
  });
}

describe('ذرّية الموافقة على طلب التسجيل', () => {
  beforeAll(async () => {
    ({ app } = await import('../src/index.js'));
    await resetDatabase();
    const school = await prisma.school.create({ data: { code: 'S1', name: 'مدرسة 1' } });
    const dir = await prisma.user.create({
      data: { firstName: 'مدير', lastName: 'اختبار', email: 'dir@t.tn', passwordHash: await bcrypt.hash(PW, 4), role: 'SCHOOL_DIRECTOR', accountStatus: 'ACTIVE', schoolId: school.id }
    });
    parentId = (await prisma.user.create({
      data: { firstName: 'ولي', lastName: 'اختبار', email: 'par@t.tn', passwordHash: await bcrypt.hash(PW, 4), role: 'PARENT', accountStatus: 'ACTIVE', schoolId: school.id }
    })).id;
    classId = (await prisma.class.create({ data: { name: 'أ', level: 'السنة الأولى أساسي', schoolId: school.id } })).id;
    dirToken = await tok('dir@t.tn');
  });

  it('موافقتان متزامنتان على نفس الطلب ⇒ حساب طالب واحد فقط', async () => {
    const req = await mkRequest();
    const url = `/api/director/requests/${req.id}/approve`;
    const results = await Promise.all([
      request(app).put(url).set('Authorization', `Bearer ${dirToken}`).send({ classId }),
      request(app).put(url).set('Authorization', `Bearer ${dirToken}`).send({ classId })
    ]);
    const statuses = results.map((r) => r.status).sort();
    expect(statuses).toEqual([200, 400]); // واحد نجح والآخر رُفض (تمت معالجته مسبقا)

    const final = await prisma.subscriptionRequest.findUnique({ where: { id: req.id } });
    const createdSubs = await prisma.subscription.count({ where: { studentId: final.studentId } });
    const accountEmails = await prisma.user.count({ where: { role: 'STUDENT', email: { endsWith: '@refeeqi.tn' } } });
    const students = await prisma.student.count({ where: { userId: parentId, firstName: 'زائر' } });
    expect(students).toBe(1);
    expect(accountEmails).toBe(1);
    expect(createdSubs).toBe(1);
    expect(final.status).toBe('PENDING_PAYMENT');
    expect(final.studentId).not.toBeNull();
  });

  it('موافقة على طلب غير موجود ⇒ 404', async () => {
    const r = await request(app).put('/api/director/requests/999999/approve').set('Authorization', `Bearer ${dirToken}`).send({ classId });
    expect(r.status).toBe(404);
  });

  it('موافقة على طلب تمت معالجته ⇒ 400 (غير مصادَق عليه أصلاً)', async () => {
    const req = await mkRequest();
    await prisma.subscriptionRequest.update({ where: { id: req.id }, data: { status: 'ACTIVE' } });
    const r = await request(app).put(`/api/director/requests/${req.id}/approve`).set('Authorization', `Bearer ${dirToken}`).send({ classId });
    expect(r.status).toBe(400);
  });
});
