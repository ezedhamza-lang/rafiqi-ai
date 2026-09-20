import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import { resetDatabase } from './helpers.js';
import prisma from '../src/db.js';

const PW = 'scope123';
let app;
let parentA, schoolA, schoolB;

async function mkUser(email, role, schoolId) {
  return prisma.user.create({
    data: { firstName: 'تست', lastName: role, email: email.toLowerCase(), passwordHash: await bcrypt.hash(PW, 4), role, accountStatus: 'ACTIVE', schoolId }
  });
}

async function tok(email) {
  const r = await request(app).post('/api/auth/login').send({ email, password: PW });
  return r.body.token;
}

describe('عزل مدارس P1-A (وثائق/تقويم/إعلانات)', () => {
  beforeAll(async () => {
    ({ app } = await import('../src/index.js'));
    await resetDatabase();
    schoolA = await prisma.school.create({ data: { code: 'A', name: 'مدرسة أ' } });
    schoolB = await prisma.school.create({ data: { code: 'B', name: 'مدرسة ب' } });
    await mkUser('dira@p1.tn', 'SCHOOL_DIRECTOR', schoolA.id);
    await mkUser('dirb@p1.tn', 'SCHOOL_DIRECTOR', schoolB.id);
    parentA = await mkUser('parenta@p1.tn', 'PARENT', schoolA.id);
    await mkUser('parentb@p1.tn', 'PARENT', schoolB.id);
  }, 90000);

  it('صندوق الوثائق: مدير ب لا يرى وثيقة ولي أ ولا يراجعها', async () => {
    const doc = await prisma.parentDocument.create({
      data: { parentId: parentA.id, docType: 'شهادة طبية', fileName: 'x.pdf', fileUrl: '/uploads/documents/x.pdf' }
    });
    const tA = await tok('dira@p1.tn');
    const tB = await tok('dirb@p1.tn');

    const listBoxA = await request(app).get('/api/director/documents/all').set('Authorization', `Bearer ${tA}`);
    expect(listBoxA.body.map((d) => d.id)).toContain(doc.id);
    const listBoxB = await request(app).get('/api/director/documents/all').set('Authorization', `Bearer ${tB}`);
    expect(listBoxB.body.map((d) => d.id)).not.toContain(doc.id);

    const revB = await request(app).put(`/api/director/documents/${doc.id}/review`).set('Authorization', `Bearer ${tB}`).send({ status: 'APPROVED' });
    expect(revB.status).toBe(404);
    const revA = await request(app).put(`/api/director/documents/${doc.id}/review`).set('Authorization', `Bearer ${tA}`).send({ status: 'APPROVED' });
    expect(revA.status).toBe(200);
  });

  it('التقويم: حدث مدرسة أ لا يظهر/يُعَدَّل/يُحذف لدى مدير ب، والعالمي يبقى للمشرف', async () => {
    const tA = await tok('dira@p1.tn');
    const tB = await tok('dirb@p1.tn');
    const ev = await request(app).post('/api/calendar').set('Authorization', `Bearer ${tA}`).send({ title: 'امتحان أ', date: '2026-10-05' });
    expect(ev.status).toBe(201);
    expect(ev.body.schoolId).toBe(schoolA.id);

    const listB = await request(app).get('/api/calendar/events?month=2026-10').set('Authorization', `Bearer ${tB}`);
    expect(listB.body.map((e) => e.id)).not.toContain(ev.body.id);
    const updB = await request(app).put(`/api/calendar/${ev.body.id}`).set('Authorization', `Bearer ${tB}`).send({ title: 'اختطاف' });
    expect(updB.status).toBe(404);
    const delB = await request(app).delete(`/api/calendar/${ev.body.id}`).set('Authorization', `Bearer ${tB}`);
    expect(delB.status).toBe(404);
    const listA = await request(app).get('/api/calendar/events?month=2026-10').set('Authorization', `Bearer ${tA}`);
    expect(listA.body.map((e) => e.id)).toContain(ev.body.id);
  });

  it('إعلانات: مدير أ ينشر لولي أ فقط — لا ولي ب يتلقى شيئاً', async () => {
    const tA = await tok('dira@p1.tn');
    const tB = await tok('dirb@p1.tn');
    const pub = await request(app).post('/api/director/announcements').set('Authorization', `Bearer ${tA}`).send({ title: 'عطلة أ', body: 'نص', audience: ['PARENT'] });
    expect(pub.status).toBe(201);
    expect(pub.body.recipients).toBe(1);

    const parentANotifs = await prisma.notification.count({ where: { userId: parentA.id, type: 'ANNOUNCEMENT' } });
    expect(parentANotifs).toBe(1);
    const listB = await request(app).get('/api/director/announcements').set('Authorization', `Bearer ${tB}`);
    expect(listB.body.map((a) => a.id)).not.toContain(pub.body.announcement.id);
  });
});
