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
  return request(app)
    .post('/api/payments/admin/discounts')
    .set('Authorization', `Bearer ${adminToken}`)
    .send(data);
}

async function createSubscription(prisma, userId, { status = 'PENDING_PAYMENT', amount = 147, schoolYear = '2026-2027', endDate } = {}) {
  return prisma.subscription.create({
    data: {
      userId,
      type: 'STUDENT',
      plan: 'اشتراك تلميذ',
      schoolYear,
      startDate: new Date('2026-09-01'),
      endDate: endDate || new Date('2027-06-30'),
      status,
      amount
    }
  });
}

async function makePaidInvoice(prisma, parentToken, { amount = 147, discountCode } = {}) {
  const student = await prisma.user.findUnique({ where: { email: 'student@test.tn' } });
  const sub = await createSubscription(prisma, student.id, { amount });
  const body = discountCode ? { discountCode } : {};
  const res = await checkout(parentToken, sub.id, body);
  expect(res.status).toBe(201);
  const complete = await completeDemo(res.body.id, 'success', parentToken);
  expect(complete.body.status).toBe('SUCCEEDED');
  const invoice = await prisma.invoice.findFirst({ where: { subscriptionId: sub.id } });
  expect(invoice).toBeTruthy();
  return { sub, invoice, intent: res.body };
}

describe('لوحة المدير المالية — المرحلة 4.3 (حماية الوصول)', () => {
  it('يحظر الوصول لغير الإداري/النظامي', async () => {
    const parentToken = await getToken('parent@test.tn', 'parent123');
    const teacherToken = await getToken('teacher@test.tn', 'teacher123');

    const r1 = await request(app).get('/api/admin/finance/overview').set('Authorization', `Bearer ${parentToken}`);
    expect(r1.status).toBe(403);

    const r2 = await request(app).get('/api/admin/finance/reports').set('Authorization', `Bearer ${teacherToken}`);
    expect(r2.status).toBe(403);

    const r3 = await request(app).get('/api/admin/finance/reconciliation').set('Authorization', `Bearer ${teacherToken}`);
    expect(r3.status).toBe(403);

    const r4 = await request(app).get('/api/admin/finance/anomalies').set('Authorization', `Bearer ${parentToken}`);
    expect(r4.status).toBe(403);
  });
});

describe('لوحة المدير المالية — النظرة العامة والتقارير', () => {
  it('يعيد النظرة العامة المالية بعد عملية دفع ناجحة', async () => {
    const prisma = (await import('../src/db.js')).default;
    const adminToken = await getToken('admin@education.tn', 'admin123');
    const parentToken = await getToken('parent@test.tn', 'parent123');

    await makePaidInvoice(prisma, parentToken);

    const res = await request(app).get('/api/admin/finance/overview').set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.summary.totalRevenue).toBeGreaterThan(0);
    expect(res.body.summary.periodRevenue).toBeGreaterThan(0);
    expect(res.body.summary.pending).toBeGreaterThanOrEqual(0);
    expect(Array.isArray(res.body.revenueByMonth)).toBe(true);
    expect(res.body.revenueByMonth.length).toBeGreaterThan(0);
    expect(res.body.recentPayments.length).toBeGreaterThan(0);
    expect(res.body.summary.invoiceCount).toBe(1);
  });

  it('يولّد التقرير المالي ويصدّره PDF وCSV', async () => {
    const prisma = (await import('../src/db.js')).default;
    const adminToken = await getToken('admin@education.tn', 'admin123');
    const parentToken = await getToken('parent@test.tn', 'parent123');

    await makePaidInvoice(prisma, parentToken);

    const rep = await request(app).get('/api/admin/finance/reports').set('Authorization', `Bearer ${adminToken}`);
    expect(rep.status).toBe(200);
    expect(rep.body.summary).toBeTruthy();
    expect(rep.body.summary.paymentCount).toBe(1);
    expect(rep.body.summary.invoiceCount).toBe(1);
    expect(rep.body.payments.length).toBe(1);
    expect(rep.body.invoices[0].invoiceNumber).toMatch(/^INV-/);

    const pdf = await request(app).get('/api/admin/finance/reports/pdf').set('Authorization', `Bearer ${adminToken}`);
    expect(pdf.status).toBe(200);
    expect(pdf.headers['content-type']).toContain('application/pdf');
    expect(pdf.body.length).toBeGreaterThan(1000);

    const csv = await request(app).get('/api/admin/finance/reports/csv').set('Authorization', `Bearer ${adminToken}`);
    expect(csv.status).toBe(200);
    expect(csv.headers['content-type']).toContain('text/csv');
    expect(csv.text).toContain('التقرير المالي');
    expect(csv.text).toContain('عمليات الدفع');
  });

  it('يصفّي النظرة العامة والتقرير حسب السنة الدراسية', async () => {
    const prisma = (await import('../src/db.js')).default;
    const adminToken = await getToken('admin@education.tn', 'admin123');
    const student = await prisma.user.findUnique({ where: { email: 'student@test.tn' } });

    const sub = await createSubscription(prisma, student.id);
    await prisma.payment.create({
      data: {
        subscriptionId: sub.id,
        amount: 147,
        method: 'OFFLINE',
        paidByUserId: student.id,
        paidAt: new Date('2026-10-15')
      }
    });
    await prisma.payment.create({
      data: {
        subscriptionId: sub.id,
        amount: 99,
        method: 'OFFLINE',
        paidByUserId: student.id,
        paidAt: new Date('2025-10-15')
      }
    });

    const res = await request(app)
      .get('/api/admin/finance/overview?schoolYear=2026-2027')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.summary.periodRevenue).toBe(147);

    const rep = await request(app)
      .get('/api/admin/finance/reports?schoolYear=2026-2027')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(rep.body.summary.totalRevenue).toBe(147);

    const all = await request(app).get('/api/admin/finance/reports').set('Authorization', `Bearer ${adminToken}`);
    expect(all.body.summary.totalRevenue).toBe(246);
  });
});

describe('لوحة المدير المالية — التسوية (Reconciliation)', () => {
  it('يكشف عمليات بلا فواتير وفروق الجمل', async () => {
    const prisma = (await import('../src/db.js')).default;
    const adminToken = await getToken('admin@education.tn', 'admin123');
    const student = await prisma.user.findUnique({ where: { email: 'student@test.tn' } });

    const sub = await createSubscription(prisma, student.id);
    await prisma.payment.create({
      data: {
        subscriptionId: sub.id,
        amount: 147,
        method: 'OFFLINE',
        paidByUserId: student.id
      }
    });

    const res = await request(app).get('/api/admin/finance/reconciliation').set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.counts.paymentsWithoutInvoice).toBe(1);
    expect(res.body.differences.paidVsInvoiced).toBe(147);
    expect(res.body.counts.activeWithoutPayment).toBeGreaterThanOrEqual(0);
    expect(res.body.totals.payments).toBe(147);
  });

  it('بعد عملية ناجحة تصبح التسوية مطابقة (كل عملية لها فاتورة)', async () => {
    const prisma = (await import('../src/db.js')).default;
    const adminToken = await getToken('admin@education.tn', 'admin123');
    const parentToken = await getToken('parent@test.tn', 'parent123');

    await makePaidInvoice(prisma, parentToken);

    const res = await request(app).get('/api/admin/finance/reconciliation').set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.counts.paymentsWithoutInvoice).toBe(0);
    expect(res.body.differences.paidVsInvoiced).toBe(0);
    expect(res.body.totals.invoices).toBe(147);
  });
});

describe('لوحة المدير المالية — الإرجاعات (Refunds)', () => {
  it('يسجّل إرجاعا للفاتورة، يميّز الحالة، ويمنع الإرجاع المزدوج', async () => {
    const prisma = (await import('../src/db.js')).default;
    const adminToken = await getToken('admin@education.tn', 'admin123');
    const parentToken = await getToken('parent@test.tn', 'parent123');

    const { invoice } = await makePaidInvoice(prisma, parentToken);

    const res = await request(app)
      .post(`/api/admin/finance/invoices/${invoice.id}/refund`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reason: 'خطأ في معالجة الدفع' });
    expect(res.status).toBe(200);
    expect(res.body.invoice.status).toBe('REFUNDED');

    const refund = await prisma.refund.findFirst({ where: { invoiceId: invoice.id } });
    expect(refund).toBeTruthy();
    expect(refund.amount).toBe(invoice.total);
    expect(refund.reason).toBe('خطأ في معالجة الدفع');

    const log = await prisma.auditLog.findFirst({ where: { action: 'INVOICE_REFUNDED' } });
    expect(log).toBeTruthy();
    expect(log.metadata.amount).toBe(invoice.total);

    const again = await request(app)
      .post(`/api/admin/finance/invoices/${invoice.id}/refund`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reason: 'مكرر' });
    expect(again.status).toBe(400);

    const list = await request(app).get('/api/admin/finance/refunds').set('Authorization', `Bearer ${adminToken}`);
    expect(list.status).toBe(200);
    expect(list.body.length).toBe(1);
  });

  it('يمنع غير الإداري من إرجاع الفاتورة', async () => {
    const prisma = (await import('../src/db.js')).default;
    const teacherToken = await getToken('teacher@test.tn', 'teacher123');
    const parentToken = await getToken('parent@test.tn', 'parent123');

    const { invoice } = await makePaidInvoice(prisma, parentToken);

    const res = await request(app)
      .post(`/api/admin/finance/invoices/${invoice.id}/refund`)
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ reason: 'لأجلها' });
    expect(res.status).toBe(403);
  });
});

describe('لوحة المدير المالية — كشف الشذوذ', () => {
  it('يكتشف محاولات الدفع الفاشلة المتكررة ويعالجها دون تكرار', async () => {
    const prisma = (await import('../src/db.js')).default;
    const adminToken = await getToken('admin@education.tn', 'admin123');
    const student = await prisma.user.findUnique({ where: { email: 'student@test.tn' } });
    const sub = await prisma.subscription.findFirst({ where: { userId: student.id, status: 'ACTIVE' } });

    for (let i = 0; i < 3; i += 1) {
      await prisma.paymentIntent.create({
        data: {
          subscriptionId: sub.id,
          userId: student.id,
          provider: 'DEMO',
          status: 'FAILED',
          amount: 147,
          currency: 'TND'
        }
      });
    }

    const detect = await request(app)
      .post('/api/admin/finance/anomalies/detect')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(detect.status).toBe(200);
    expect(detect.body.created).toBeGreaterThan(0);

    const list = await request(app).get('/api/admin/finance/anomalies?status=OPEN').set('Authorization', `Bearer ${adminToken}`);
    expect(list.status).toBe(200);
    const anomaly = list.body.anomalies.find((a) => a.type === 'REPEATED_FAILED_PAYMENT');
    expect(anomaly).toBeTruthy();
    expect(anomaly.severity).toBe('MEDIUM');
    expect(anomaly.subjectId).toBe(sub.id);

    const resolved = await request(app)
      .post(`/api/admin/finance/anomalies/${anomaly.id}/resolve`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'RESOLVED', resolution: 'تمت المراجعة' });
    expect(resolved.status).toBe(200);
    expect(resolved.body.status).toBe('RESOLVED');

    await request(app).post('/api/admin/finance/anomalies/detect').set('Authorization', `Bearer ${adminToken}`);
    const after = await request(app).get('/api/admin/finance/anomalies?status=OPEN').set('Authorization', `Bearer ${adminToken}`);
    expect(after.body.anomalies.some((a) => a.type === 'REPEATED_FAILED_PAYMENT')).toBe(false);
  });

  it('يكتشف فاتورة بقيمة صفرية (منحة كاملة) ويسجّل سجل تدقيق للكشف', async () => {
    const prisma = (await import('../src/db.js')).default;
    const adminToken = await getToken('admin@education.tn', 'admin123');
    const parentToken = await getToken('parent@test.tn', 'parent123');

    await createDiscount(adminToken, { code: 'FULL', type: 'PERCENTAGE', value: 100 });
    const { invoice } = await makePaidInvoice(prisma, parentToken, { discountCode: 'FULL' });
    expect(invoice.total).toBe(0);

    const detect = await request(app)
      .post('/api/admin/finance/anomalies/detect')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(detect.body.created).toBeGreaterThan(0);

    const log = await prisma.auditLog.findFirst({ where: { action: 'ANOMALY_DETECT_RUN' } });
    expect(log).toBeTruthy();

    const list = await request(app).get('/api/admin/finance/anomalies?status=OPEN').set('Authorization', `Bearer ${adminToken}`);
    expect(list.body.anomalies.some((a) => a.type === 'FREE_INVOICE')).toBe(true);
  });

  it('يكتشف إرجاعات متكررة على نفس الاشتراك بعد إرجاعين', async () => {
    const prisma = (await import('../src/db.js')).default;
    const adminToken = await getToken('admin@education.tn', 'admin123');
    const student = await prisma.user.findUnique({ where: { email: 'student@test.tn' } });
    const sub = await prisma.subscription.findFirst({ where: { userId: student.id, status: 'ACTIVE' } });
    const admin = await prisma.user.findUnique({ where: { email: 'admin@education.tn' } });

    for (let i = 1; i <= 2; i += 1) {
      const payment = await prisma.payment.create({
        data: {
          subscriptionId: sub.id,
          amount: 147,
          method: 'OFFLINE',
          paidByUserId: admin.id
        }
      });
      const invoice = await prisma.invoice.create({
        data: {
          subscriptionId: sub.id,
          paymentId: payment.id,
          amount: 147,
          total: 147,
          invoiceNumber: `INV-TEST-${i}-${payment.id}`
        }
      });
      const res = await request(app)
        .post(`/api/admin/finance/invoices/${invoice.id}/refund`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ reason: `إرجاع اختبار ${i}` });
      expect(res.status).toBe(200);
    }

    const detect = await request(app)
      .post('/api/admin/finance/anomalies/detect')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(detect.status).toBe(200);

    const list = await request(app).get('/api/admin/finance/anomalies?status=OPEN').set('Authorization', `Bearer ${adminToken}`);
    const repeated = list.body.anomalies.find((a) => a.type === 'REPEATED_REFUND');
    expect(repeated).toBeTruthy();
    expect(repeated.severity).toBe('HIGH');
    expect(repeated.subjectId).toBe(sub.id);
    expect(repeated.metadata.count).toBe(2);
  });
});
