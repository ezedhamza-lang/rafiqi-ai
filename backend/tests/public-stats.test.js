import { describe, it, expect, beforeAll } from 'vitest';
import { resetDatabase, seedTestData } from './helpers.js';
import request from 'supertest';
import prisma from '../src/db.js';

let app;

beforeAll(async () => {
  ({ app } = await import('../src/index.js'));
  await resetDatabase();
  await seedTestData();
});

describe('إحصائيات المنصة العامة (أرقام حقيقية بلا اختلاق)', () => {
  it('تعيد 200 بلا مصادقة مع الحقول الثلاثة', async () => {
    const res = await request(app).get('/api/public/stats').send();
    expect(res.status).toBe(200);
    expect(typeof res.body.teachers).toBe('number');
    expect(typeof res.body.students).toBe('number');
    expect(typeof res.body.schools).toBe('number');
  });

  it('تعكس البيانات المزروعة فعلاً (معلم وتلميذ على الأقل)', async () => {
    const res = await request(app).get('/api/public/stats').send();
    expect(res.body.teachers).toBeGreaterThanOrEqual(1);
    expect(res.body.students).toBeGreaterThanOrEqual(1);
    expect(res.body.schools).toBeGreaterThanOrEqual(0);
  });

  it('تخزن مؤقتاً: مدرسة جديدة لا تظهر قبل انتهاء المهلة', async () => {
    const before = await request(app).get('/api/public/stats').send();
    await prisma.school.create({ data: { code: 'STAT-TEST', name: 'مدرسة الإحصاء', status: 'ACTIVE' } });
    const after = await request(app).get('/api/public/stats').send();
    expect(after.body.schools).toBe(before.body.schools);
  });
});
