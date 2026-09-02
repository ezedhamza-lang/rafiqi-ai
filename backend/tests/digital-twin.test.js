import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import prisma from '../src/db.js';
import { seedTestData, resetDatabase } from './helpers.js';
import { buildSchoolTwin, simulatePolicy } from '../src/services/digitalTwinService.js';

let request;
let app;

beforeAll(async () => {
  const { default: supertest } = await import('supertest');
  request = supertest;
  const mod = await import('../src/index.js');
  app = mod.app;
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('التوأم الرقمي ومحاكي القرارات', () => {
  let schoolId;

  beforeAll(async () => {
    await resetDatabase();
    await seedTestData();
    const school = await prisma.school.findUnique({ where: { code: 'SCH-001' } });
    schoolId = school.id;
  });

  it('التوأم الرقمي يعيد لقطة كاملة بمؤشرات صحة', async () => {
    const twin = await buildSchoolTwin(schoolId);
    expect(twin.school.code).toBe('SCH-001');
    expect(twin.totals.classes).toBeGreaterThan(0);
    expect(twin.totals.users).toBeGreaterThan(0);
    expect(twin.today).toBeTruthy();
    expect(['GOOD', 'WATCH', 'ALERT', 'LOW', 'NO_DATA']).toContain(twin.health.attendance);
    expect(twin.snapshotAt).toBeTruthy();
  });

  it('محاكاة فتح قسم جديد تعيد الإسقاط والأثر والافتراضات', async () => {
    const r = await simulatePolicy(schoolId, { type: 'add_class', level: 'السنة الأولى أساسي' });
    expect(r.scenario).toBe('add_class');
    expect(r.projected.totalClasses).toBeGreaterThan(0);
    expect(r.assumptions.length).toBeGreaterThan(0);
    expect(r.impact.length).toBeGreaterThan(0);
  });

  it('محاكاة تقسيم قسم ممتلئ تقترح قسمين ومعلماً إضافياً', async () => {
    const klass = await prisma.class.findFirst({ where: { schoolId } });
    const r = await simulatePolicy(schoolId, { type: 'split_class', classId: klass.id });
    expect(r.projected.newClasses.length).toBe(2);
    expect(r.projected.teachersNeeded).toBe(1);
  });

  it('نقاط النهاية محمية بالأدوار: المدير يرى توأم مدرسته والتلميذ ممنوع', async () => {
    await resetDatabase();
    await seedTestData();
    const dtok = (await request(app).post('/api/auth/login').send({ email: 'director@test.tn', password: 'director123' })).body.token;
    const twin = await request(app).get('/api/school-twin').set('Authorization', `Bearer ${dtok}`);
    expect(twin.status).toBe(200);
    expect(twin.body.school.code).toBe('SCH-001');

    const sim = await request(app).post('/api/school-simulate').set('Authorization', `Bearer ${dtok}`).send({ type: 'add_class' });
    expect(sim.status).toBe(200);

    const stok = (await request(app).post('/api/auth/login').send({ email: 'student@test.tn', password: 'student123' })).body.token;
    const forbidden = await request(app).get('/api/school-twin').set('Authorization', `Bearer ${stok}`);
    expect([401, 403]).toContain(forbidden.status);
  });
});