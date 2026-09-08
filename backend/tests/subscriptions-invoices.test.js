import { beforeAll, afterAll, beforeEach, describe, it, expect } from 'vitest';
import { resetDatabase, seedTestData } from './helpers.js';

let request;
let app;

beforeAll(async () => {
  const { default: supertest } = await import('supertest');
  request = supertest;
  const mod = await import('../src/index.js');
  app = mod.app;
});

afterAll(async () => {
  const prisma = (await import('../src/db.js')).default;
  await prisma.$disconnect();
});

beforeEach(async () => {
  await resetDatabase();
  await seedTestData();
});

async function getToken(email, password) {
  const res = await request(app).post('/api/auth/login').send({ email, password });
  return res.body.token;
}

async function getCaptcha() {
  const res = await request(app).get('/api/payments/captcha');
  return res.body;
}

async function checkout(token, subscriptionId, body = {}) {
  const cap = await getCaptcha();
  const res = await request(app)
    .post('/api/payments/checkout')
    .set('Authorization', `Bearer ${token}`)
    .send({ subscriptionId, provider: 'DEMO', captchaToken: cap.token, captchaAnswer: cap.answer, ...body });
  return res;
}

async function completeDemo(intentId, result = 'success', token) {
  const req = request(app).post(`/api/payments/demo-checkout/${intentId}/result`);
  if (token) req.set('Authorization', `Bearer ${token}`);
  return req.send({ result });
}

async function createDiscount(adminToken, data) {
  const res = await request(app)
    .post('/api/payments/admin/discounts')
    .set('Authorization', `Bearer ${adminToken}`)
    .send(data);
  return res;
}

describe('أكواد التخفيض والمنح الدراسية (إداري)', () => {
  it('يمنع غير الإداري من إنشاء كود تخفيض', async () => {
    const parentToken = await getToken('parent@test.tn', 'parent123');
    const res = await createDiscount(parentToken, { code: 'X10', type: 'PERCENTAGE', value: 10 });
    expect(res.status).toBe(403);
  });

  it('ينشئ كودا بنسبة وتخفيضا بمبلغ ثابت ويرفض المكرر', async () => {
    const adminToken = await getToken('admin@education.tn', 'admin123');
    const pct = await createDiscount(adminToken, { code: 'rafiq10', type: 'PERCENTAGE', value: 10, description: 'تخفيض 10%' });
    expect(pct.status).toBe(201);
    expect(pct.body.code).toBe('RAFIQ10');

    const amt = await createDiscount(adminToken, { code: 'grant20', type: 'AMOUNT', value: 20, usageLimit: 3 });
    expect(amt.status).toBe(201);
    expect(amt.body.type).toBe('AMOUNT');

    const dup = await createDiscount(adminToken, { code: 'rafiq10', type: 'PERCENTAGE', value: 5 });
    expect(dup.status).toBe(400);

    const list = await request(app).get('/api/payments/admin/discounts').set('Authorization', `Bearer ${adminToken}`);
    expect(list.status).toBe(200);
    expect(list.body.length).toBe(2);
  });
});

describe('تطبيق كود التخفيض في الدفع', () => {
  it('يطبق نسبة تخفيض على مبلغ الاشتراك', async () => {
    const prisma = (await import('../src/db.js')).default;
    const parentToken = await getToken('parent@test.tn', 'parent123');
    const adminToken = await getToken('admin@education.tn', 'admin123');
    await createDiscount(adminToken, { code: 'RAFIQ10', type: 'PERCENTAGE', value: 10 });

    const student = await prisma.user.findUnique({ where: { email: 'student@test.tn' } });
    const sub = await prisma.subscription.create({
      data: {
        userId: student.id,
        type: 'STUDENT',
        plan: 'اشتراك تلميذ',
        schoolYear: '2026-2027',
        startDate: new Date('2026-09-01'),
        endDate: new Date('2027-06-30'),
        status: 'PENDING_PAYMENT',
        amount: 147
      }
    });

    const res = await checkout(parentToken, sub.id, { discountCode: 'rafiq10' });
    expect(res.status).toBe(201);
    expect(res.body.amount).toBe(132.3);
    expect(res.body.metadata.discountCode).toBe('RAFIQ10');
    expect(res.body.metadata.discountAmount).toBe(14.7);
    expect(res.body.metadata.originalAmount).toBe(147);
  });

  it('يطبق تخفيضا بمبلغ ثابت لا يتجاوز قيمة الاشتراك', async () => {
    const prisma = (await import('../src/db.js')).default;
    const parentToken = await getToken('parent@test.tn', 'parent123');
    const adminToken = await getToken('admin@education.tn', 'admin123');
    await createDiscount(adminToken, { code: 'GRANT200', type: 'AMOUNT', value: 200 });

    const student = await prisma.user.findUnique({ where: { email: 'student@test.tn' } });
    const sub = await prisma.subscription.create({
      data: {
        userId: student.id,
        type: 'STUDENT',
        plan: 'اشتراك تلميذ',
        schoolYear: '2026-2027',
        startDate: new Date('2026-09-01'),
        endDate: new Date('2027-06-30'),
        status: 'PENDING_PAYMENT',
        amount: 147
      }
    });

    const res = await checkout(parentToken, sub.id, { discountCode: 'GRANT200' });
    expect(res.status).toBe(201);
    expect(res.body.amount).toBe(0);
  });

  it('يرفض كودا غير صالح أو منتهي أو مستنفد', async () => {
    const prisma = (await import('../src/db.js')).default;
    const parentToken = await getToken('parent@test.tn', 'parent123');
    const adminToken = await getToken('admin@education.tn', 'admin123');
    await createDiscount(adminToken, {
      code: 'ONCE',
      type: 'PERCENTAGE',
      value: 50,
      usageLimit: 1,
      expiresAt: '2020-01-01'
    });

    const student = await prisma.user.findUnique({ where: { email: 'student@test.tn' } });
    const sub = await prisma.subscription.create({
      data: {
        userId: student.id,
        type: 'STUDENT',
        plan: 'اشتراك تلميذ',
        schoolYear: '2026-2027',
        startDate: new Date('2026-09-01'),
        endDate: new Date('2027-06-30'),
        status: 'PENDING_PAYMENT',
        amount: 147
      }
    });

    const bad = await checkout(parentToken, sub.id, { discountCode: 'NOPE' });
    expect(bad.status).toBe(400);

    const expired = await checkout(parentToken, sub.id, { discountCode: 'ONCE' });
    expect(expired.status).toBe(400);
  });
});

describe('الفاتورة الرقمية PDF', () => {
  it('ينشئ فاتورة عند نجاح الدفع مع التخفيض ويزيد عدّاد الاستعمال', async () => {
    const prisma = (await import('../src/db.js')).default;
    const parentToken = await getToken('parent@test.tn', 'parent123');
    const adminToken = await getToken('admin@education.tn', 'admin123');
    await createDiscount(adminToken, { code: 'DISCOUNT10', type: 'PERCENTAGE', value: 10 });

    const student = await prisma.user.findUnique({ where: { email: 'student@test.tn' } });
    const sub = await prisma.subscription.create({
      data: {
        userId: student.id,
        type: 'STUDENT',
        plan: 'اشتراك تلميذ',
        schoolYear: '2026-2027',
        startDate: new Date('2026-09-01'),
        endDate: new Date('2027-06-30'),
        status: 'PENDING_PAYMENT',
        amount: 147
      }
    });

    const res = await checkout(parentToken, sub.id, { discountCode: 'DISCOUNT10' });
    const intentId = res.body.id;
    const complete = await completeDemo(intentId, 'success', parentToken);
    expect(complete.status).toBe(200);
    expect(complete.body.status).toBe('SUCCEEDED');

    const invoice = await prisma.invoice.findFirst({ where: { subscriptionId: sub.id } });
    expect(invoice).toBeTruthy();
    expect(invoice.invoiceNumber).toMatch(/^INV-\d{4}-\d{6}$/);
    expect(Number(invoice.amount)).toBe(147);
    expect(Number(invoice.discountAmount)).toBe(14.7);
    expect(Number(invoice.total)).toBe(132.3);
    expect(invoice.discountCode).toBe('DISCOUNT10');

    const dc = await prisma.discountCode.findUnique({ where: { code: 'DISCOUNT10' } });
    expect(dc.usedCount).toBe(1);
  });

  it('يعرض فواتير المستخدم ويحمّل PDF ويمنع غير المالك', async () => {
    const prisma = (await import('../src/db.js')).default;
    const parentToken = await getToken('parent@test.tn', 'parent123');
    const teacherToken = await getToken('teacher@test.tn', 'teacher123');

    const student = await prisma.user.findUnique({ where: { email: 'student@test.tn' } });
    const sub = await prisma.subscription.create({
      data: {
        userId: student.id,
        type: 'STUDENT',
        plan: 'اشتراك تلميذ',
        schoolYear: '2026-2027',
        startDate: new Date('2026-09-01'),
        endDate: new Date('2027-06-30'),
        status: 'PENDING_PAYMENT',
        amount: 147
      }
    });
    const res = await checkout(parentToken, sub.id);
    await completeDemo(res.body.id, 'success', parentToken);

    const mine = await request(app).get('/api/payments/invoices/mine').set('Authorization', `Bearer ${parentToken}`);
    expect(mine.status).toBe(200);
    expect(mine.body.length).toBe(1);
    expect(mine.body[0].invoiceNumber).toBeTruthy();

    const invoiceId = mine.body[0].id;
    const pdf = await request(app).get(`/api/payments/invoices/${invoiceId}/pdf`).set('Authorization', `Bearer ${parentToken}`);
    expect(pdf.status).toBe(200);
    expect(pdf.headers['content-type']).toContain('application/pdf');
    expect(pdf.body.length).toBeGreaterThan(1000);

    const denied = await request(app).get(`/api/payments/invoices/${invoiceId}`).set('Authorization', `Bearer ${teacherToken}`);
    expect(denied.status).toBe(403);

    const adminToken = await getToken('admin@education.tn', 'admin123');
    const all = await request(app).get('/api/payments/admin/invoices').set('Authorization', `Bearer ${adminToken}`);
    expect(all.status).toBe(200);
    expect(all.body.length).toBe(1);
  });
});

describe('ربط الاشتراكات بعمليات الدفع + التجديد التلقائي والإلغاء', () => {
  async function activeSubscription(prisma) {
    const student = await prisma.user.findUnique({ where: { email: 'student@test.tn' } });
    const sub = await prisma.subscription.findFirst({ where: { userId: student.id, status: 'ACTIVE' } });
    return sub;
  }

  it('ينشئ عملية تجديد (RENEWAL) على اشتراك مفعّل ويرفض على غير مفعّل', async () => {
    const prisma = (await import('../src/db.js')).default;
    const parentToken = await getToken('parent@test.tn', 'parent123');
    const sub = await activeSubscription(prisma);

    const res = await checkout(parentToken, sub.id, { kind: 'RENEWAL' });
    expect(res.status).toBe(201);
    expect(res.body.metadata.kind).toBe('RENEWAL');
    expect(res.body.amount).toBe(147);

    const pending = await prisma.subscription.findUnique({ where: { id: sub.id } });
    const badSub = await prisma.subscription.create({
      data: {
        userId: pending.userId,
        type: 'STUDENT',
        plan: 'اشتراك تلميذ',
        schoolYear: '2026-2027',
        startDate: new Date('2026-09-01'),
        endDate: new Date('2027-06-30'),
        status: 'PENDING_PAYMENT',
        amount: 147
      }
    });
    const rejected = await checkout(parentToken, badSub.id, { kind: 'RENEWAL' });
    expect(rejected.status).toBe(400);
  });

  it('دفع التجديد يمدّد الاشتراك للسنة الموالية وينشئ دفعة وفتورة', async () => {
    const prisma = (await import('../src/db.js')).default;
    const parentToken = await getToken('parent@test.tn', 'parent123');
    const sub = await activeSubscription(prisma);
    const before = await prisma.subscription.findUnique({ where: { id: sub.id } });
    expect(before.schoolYear).toBe('2026-2027');

    const res = await checkout(parentToken, sub.id, { kind: 'RENEWAL' });
    const complete = await completeDemo(res.body.id, 'success', parentToken);
    expect(complete.status).toBe(200);
    expect(complete.body.status).toBe('SUCCEEDED');

    const after = await prisma.subscription.findUnique({ where: { id: sub.id } });
    expect(after.schoolYear).toBe('2027-2028');
    expect(after.status).toBe('ACTIVE');
    expect(after.startDate.getFullYear()).toBe(2027);
    expect(after.endDate.getFullYear()).toBe(2028);

    const payments = await prisma.payment.findMany({ where: { subscriptionId: sub.id } });
    const renewalPayment = payments.find((p) => p.method === 'DEMO');
    expect(renewalPayment).toBeTruthy();
    expect(Number(renewalPayment.amount)).toBe(147);

    const invoice = await prisma.invoice.findFirst({ where: { paymentId: renewalPayment.id } });
    expect(invoice).toBeTruthy();
    expect(Number(invoice.total)).toBe(147);
  });

  it('إلغاء التجديد التلقائي يمنع تجديدا جديدا، وإعادة التفعيل تسمح به', async () => {
    const prisma = (await import('../src/db.js')).default;
    const parentToken = await getToken('parent@test.tn', 'parent123');
    const sub = await activeSubscription(prisma);

    const cancel = await request(app)
      .post(`/api/payments/subscriptions/${sub.id}/cancel-renewal`)
      .set('Authorization', `Bearer ${parentToken}`);
    expect(cancel.status).toBe(200);
    expect(cancel.body.renewalEnabled).toBe(false);
    expect(cancel.body.cancelledAt).toBeTruthy();

    const rejected = await checkout(parentToken, sub.id, { kind: 'RENEWAL' });
    expect(rejected.status).toBe(400);

    const enable = await request(app)
      .post(`/api/payments/subscriptions/${sub.id}/enable-renewal`)
      .set('Authorization', `Bearer ${parentToken}`);
    expect(enable.status).toBe(200);
    expect(enable.body.renewalEnabled).toBe(true);
    expect(enable.body.cancelledAt).toBeNull();

    const allowed = await checkout(parentToken, sub.id, { kind: 'RENEWAL' });
    expect(allowed.status).toBe(201);
  });

  it('يمنع غير المالك من إلغاء التجديد', async () => {
    const prisma = (await import('../src/db.js')).default;
    const teacherToken = await getToken('teacher@test.tn', 'teacher123');
    const sub = await activeSubscription(prisma);
    const res = await request(app)
      .post(`/api/payments/subscriptions/${sub.id}/cancel-renewal`)
      .set('Authorization', `Bearer ${teacherToken}`);
    expect(res.status).toBe(403);
  });

  it('فحص التجديد التلقائي (Sweep) ينشئ نية تجديد ولا يكررها', async () => {
    const prisma = (await import('../src/db.js')).default;
    const adminToken = await getToken('admin@education.tn', 'admin123');
    const student = await prisma.user.findUnique({ where: { email: 'student@test.tn' } });

    const now = new Date();
    const sub = await prisma.subscription.create({
      data: {
        userId: student.id,
        type: 'STUDENT',
        plan: 'اشتراك تلميذ',
        schoolYear: '2026-2027',
        startDate: new Date('2026-09-01'),
        endDate: new Date(now.getTime() + 3 * 86400000),
        status: 'ACTIVE',
        amount: 147
      }
    });

    const run1 = await request(app)
      .post('/api/payments/admin/jobs/run-renewal')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(run1.status).toBe(200);
    expect(run1.body.created).toBe(1);

    const intents = await prisma.paymentIntent.findMany({
      where: { subscriptionId: sub.id, metadata: { path: ['kind'], equals: 'RENEWAL' } }
    });
    expect(intents.length).toBe(1);
    expect(intents[0].status).toBe('PENDING');

    const run2 = await request(app)
      .post('/api/payments/admin/jobs/run-renewal')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(run2.body.created).toBe(0);
  });

  it('الدفع اليدوي من الإداري ينشئ فاتورة', async () => {
    const prisma = (await import('../src/db.js')).default;
    const adminToken = await getToken('admin@education.tn', 'admin123');
    const student = await prisma.user.findUnique({ where: { email: 'student@test.tn' } });
    const sub = await prisma.subscription.create({
      data: {
        userId: student.id,
        type: 'STUDENT',
        plan: 'اشتراك تلميذ',
        schoolYear: '2026-2027',
        startDate: new Date('2026-09-01'),
        endDate: new Date('2027-06-30'),
        status: 'PENDING_PAYMENT',
        amount: 147
      }
    });

    const res = await request(app)
      .post(`/api/admin/subscriptions/${sub.id}/pay`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ amount: 147, method: 'OFFLINE' });
    expect(res.status).toBe(201);
    expect(res.body.invoice).toBeTruthy();
    expect(res.body.invoice.invoiceNumber).toMatch(/^INV-/);

    const invoice = await prisma.invoice.findFirst({ where: { subscriptionId: sub.id } });
    expect(Number(invoice.total)).toBe(147);
  });
});
