import { beforeAll, afterAll, beforeEach, describe, it, expect } from 'vitest';
import crypto from 'crypto';
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

async function createPendingSubscription(prisma) {
  const student = await prisma.user.findUnique({ where: { email: 'student@test.tn' } });
  return prisma.subscription.create({
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
}

async function getCaptcha() {
  const res = await request(app).get('/api/payments/captcha');
  expect(res.status).toBe(200);
  return res.body;
}

async function startCheckout(token, subscriptionId) {
  const cap = await getCaptcha();
  const res = await request(app)
    .post('/api/payments/checkout')
    .set('Authorization', `Bearer ${token}`)
    .send({
      subscriptionId,
      provider: 'DEMO',
      captchaToken: cap.token,
      captchaAnswer: cap.answer
    });
  return res;
}

describe('CAPTCHA (رمز التحقق)', () => {
  it('يولّد تحديا مع token وإجابة (وضع الاختبار) وسؤال', async () => {
    const cap = await getCaptcha();
    expect(cap.token).toBeDefined();
    expect(cap.question).toContain('؟');
    expect(cap.svg).toContain('<svg');
    expect(cap.answer).toBeDefined();
  });

  it('يرفض بدء الدفع بإجابة خاطئة', async () => {
    const token = await getToken('parent@test.tn', 'parent123');
    const prisma = (await import('../src/db.js')).default;
    const sub = await createPendingSubscription(prisma);
    const cap = await getCaptcha();
    const res = await request(app)
      .post('/api/payments/checkout')
      .set('Authorization', `Bearer ${token}`)
      .send({
        subscriptionId: sub.id,
        provider: 'DEMO',
        captchaToken: cap.token,
        captchaAnswer: 99999
      });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('رمز التحقق');
  });

  it('يرفض بدء الدفع برمز منتهي/غير صالح', async () => {
    const token = await getToken('parent@test.tn', 'parent123');
    const prisma = (await import('../src/db.js')).default;
    const sub = await createPendingSubscription(prisma);
    const res = await request(app)
      .post('/api/payments/checkout')
      .set('Authorization', `Bearer ${token}`)
      .send({ subscriptionId: sub.id, provider: 'DEMO', captchaToken: 'bogus', captchaAnswer: 1 });
    expect(res.status).toBe(400);
  });
});

describe('Checkout (بدء عملية الدفع)', () => {
  it('يمنع من دون تسجيل دخول', async () => {
    const prisma = (await import('../src/db.js')).default;
    const sub = await createPendingSubscription(prisma);
    const cap = await getCaptcha();
    const res = await request(app).post('/api/payments/checkout').send({
      subscriptionId: sub.id,
      provider: 'DEMO',
      captchaToken: cap.token,
      captchaAnswer: cap.answer
    });
    expect(res.status).toBe(401);
  });

  it('يسمح للولي بدفع اشتراك ابنه وينشئ نية دفع معلقة', async () => {
    const token = await getToken('parent@test.tn', 'parent123');
    const prisma = (await import('../src/db.js')).default;
    const sub = await createPendingSubscription(prisma);
    const res = await startCheckout(token, sub.id);
    expect(res.status).toBe(201);
    expect(res.body.status).toBe('PENDING');
    expect(res.body.provider).toBe('DEMO');
    expect(res.body.amount).toBe(147);
    expect(res.body.checkoutUrl).toMatch(new RegExp(`^/api/payments/demo-checkout/${res.body.id}\\?t=`));
    expect(res.body.providerReference).toBeTruthy();
  });

  it('بوابة demo-checkout ترفض بلا توقيع صالح وتقبل بتوقيع المنصة', async () => {
    const token = await getToken('parent@test.tn', 'parent123');
    const prisma = (await import('../src/db.js')).default;
    const sub = await createPendingSubscription(prisma);
    const res = await startCheckout(token, sub.id);
    const id = res.body.id;
    const noSig = await request(app).get(`/api/payments/demo-checkout/${id}`);
    expect(noSig.status).toBe(403);
    const badSig = await request(app).get(`/api/payments/demo-checkout/${id}?t=${Date.now() + 99999}${'.deadbeef'}`);
    expect(badSig.status).toBe(403);
    const { demoCheckoutToken } = await import('../src/services/payments/demoProvider.js');
    const good = await request(app).get(`/api/payments/demo-checkout/${id}?t=${encodeURIComponent(demoCheckoutToken(id))}`);
    expect(good.status).toBe(200);
    expect(good.text).toContain('DEMO');
  });

  it('يمنع غير الولي/غير مالك الاشتراك من الدفع', async () => {
    const token = await getToken('teacher@test.tn', 'teacher123');
    const prisma = (await import('../src/db.js')).default;
    const sub = await createPendingSubscription(prisma);
    const res = await startCheckout(token, sub.id);
    expect(res.status).toBe(403);
  });

  it('يرفض الدفع على اشتراك مفعّل مسبقا', async () => {
    const token = await getToken('parent@test.tn', 'parent123');
    const prisma = (await import('../src/db.js')).default;
    const active = await prisma.subscription.findFirst({ where: { status: 'ACTIVE' } });
    const res = await startCheckout(token, active.id);
    expect(res.status).toBe(400);
  });

  it('يعيد 503 عند اختيار مزود غير مضبوط (STRIPE دون مفاتيح)', async () => {
    const token = await getToken('parent@test.tn', 'parent123');
    const prisma = (await import('../src/db.js')).default;
    const sub = await createPendingSubscription(prisma);
    const cap = await getCaptcha();
    const res = await request(app)
      .post('/api/payments/checkout')
      .set('Authorization', `Bearer ${token}`)
      .send({ subscriptionId: sub.id, provider: 'STRIPE', captchaToken: cap.token, captchaAnswer: cap.answer });
    expect(res.status).toBe(503);
  });
});

describe('Webhook / محاكاة المزود التجريبي', () => {
  it('سيناريو النجاح: يفعّل الاشتراك والحساب ويسجل دفعة ويشعر المستخدم', async () => {
    const prisma = (await import('../src/db.js')).default;
    const token = await getToken('parent@test.tn', 'parent123');
    const sub = await createPendingSubscription(prisma);
    const res = await startCheckout(token, sub.id);
    const intentId = res.body.id;
    const providerReference = res.body.providerReference;

    const complete = await request(app)
      .post(`/api/payments/demo-checkout/${intentId}/result`)
      .set('Authorization', `Bearer ${token}`)
      .send({ result: 'success' });
    expect(complete.status).toBe(200);
    expect(complete.body.status).toBe('SUCCEEDED');

    const updatedSub = await prisma.subscription.findUnique({ where: { id: sub.id } });
    expect(updatedSub.status).toBe('ACTIVE');

    const studentUser = await prisma.user.findUnique({ where: { email: 'student@test.tn' } });
    expect(studentUser.accountStatus).toBe('ACTIVE');

    const payment = await prisma.payment.findFirst({ where: { subscriptionId: sub.id } });
    expect(payment).toBeTruthy();
    expect(Number(payment.amount)).toBe(147);
    expect(payment.method).toBe('DEMO');
    expect(payment.reference).toBe(providerReference);

    const intent = await prisma.paymentIntent.findUnique({ where: { id: intentId } });
    expect(intent.status).toBe('SUCCEEDED');
    expect(intent.paidAt).toBeTruthy();

    const notifications = await prisma.notification.count();
    expect(notifications).toBeGreaterThan(0);

    const audit = await prisma.auditLog.findFirst({ where: { action: 'PAYMENT_SUCCEEDED' } });
    expect(audit).toBeTruthy();
    expect(audit.resourceId).toBe(intentId);
  });

  it('سيناريو الفشل: يعلّم النية فاشلة ويبقي الاشتراك معلقا', async () => {
    const prisma = (await import('../src/db.js')).default;
    const token = await getToken('parent@test.tn', 'parent123');
    const sub = await createPendingSubscription(prisma);
    const res = await startCheckout(token, sub.id);
    const intentId = res.body.id;

    const complete = await request(app)
      .post(`/api/payments/demo-checkout/${intentId}/result`)
      .set('Authorization', `Bearer ${token}`)
      .send({ result: 'failure' });
    expect(complete.status).toBe(200);
    expect(complete.body.status).toBe('FAILED');

    const updatedSub = await prisma.subscription.findUnique({ where: { id: sub.id } });
    expect(updatedSub.status).toBe('PENDING_PAYMENT');

    const intent = await prisma.paymentIntent.findUnique({ where: { id: intentId } });
    expect(intent.status).toBe('FAILED');
    expect(intent.failureMessage).toBeTruthy();

    const audit = await prisma.auditLog.findFirst({ where: { action: 'PAYMENT_FAILED' } });
    expect(audit).toBeTruthy();
  });

  it('سيناريو الإلغاء: يعلّم النية ملغاة', async () => {
    const prisma = (await import('../src/db.js')).default;
    const token = await getToken('parent@test.tn', 'parent123');
    const sub = await createPendingSubscription(prisma);
    const res = await startCheckout(token, sub.id);
    const intentId = res.body.id;

    const complete = await request(app)
      .post(`/api/payments/demo-checkout/${intentId}/result`)
      .set('Authorization', `Bearer ${token}`)
      .send({ result: 'cancel' });
    expect(complete.status).toBe(200);
    expect(complete.body.status).toBe('CANCELED');

    const intent = await prisma.paymentIntent.findUnique({ where: { id: intentId } });
    expect(intent.status).toBe('CANCELED');

    const audit = await prisma.auditLog.findFirst({ where: { action: 'PAYMENT_CANCELED' } });
    expect(audit).toBeTruthy();
  });

  it('تجاهل تكرار نفس الـ Webhook (idempotent)', async () => {
    const prisma = (await import('../src/db.js')).default;
    const token = await getToken('parent@test.tn', 'parent123');
    const sub = await createPendingSubscription(prisma);
    const res = await startCheckout(token, sub.id);
    const intentId = res.body.id;
    const providerReference = res.body.providerReference;

    await request(app)
      .post(`/api/payments/demo-checkout/${intentId}/result`)
      .set('Authorization', `Bearer ${token}`)
      .send({ result: 'success' });
    const raw = JSON.stringify({ type: 'SUCCEEDED', providerReference });
    const signature = crypto
      .createHmac('sha256', process.env.DEMO_WEBHOOK_SECRET)
      .update(raw)
      .digest('hex');
    const dup = await request(app)
      .post('/api/payments/webhook/DEMO')
      .set('Content-Type', 'application/json')
      .set('X-Demo-Signature', `sha256=${signature}`)
      .send(raw);
    expect(dup.status).toBe(200);
    expect(dup.body.already).toBe(true);
    expect(dup.body.status).toBe('SUCCEEDED');
  });

  it('يرفض Webhook من مزود غير معروف', async () => {
    const res = await request(app).post('/api/payments/webhook/FOO').send({});
    expect(res.status).toBe(400);
  });

  it('يرفض Webhook DEMO دون توقيع صالح', async () => {
    const res = await request(app).post('/api/payments/webhook/DEMO').send({ type: 'SUCCEEDED' });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('توقيع');
  });

  it('يرفض Webhook STB دون توقيع صالح', async () => {
    const res = await request(app).post('/api/payments/webhook/STB').send({ status: 'SUCCESS' });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('توقيع');
  });

  it('يرفض Webhook من Stripe دون توقيع صالح', async () => {
    const res = await request(app)
      .post('/api/payments/webhook/STRIPE')
      .set('stripe-signature', 't=123,v1=bad')
      .send({ type: 'checkout.session.completed' });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('توقيع');
  });

  it('يرفض محاكاة نتيجة دفع DEMO دون تسجيل دخول', async () => {
    const prisma = (await import('../src/db.js')).default;
    const token = await getToken('parent@test.tn', 'parent123');
    const sub = await createPendingSubscription(prisma);
    const res = await startCheckout(token, sub.id);
    const intentId = res.body.id;

    const complete = await request(app)
      .post(`/api/payments/demo-checkout/${intentId}/result`)
      .send({ result: 'success' });
    expect(complete.status).toBe(401);

    const intent = await prisma.paymentIntent.findUnique({ where: { id: intentId } });
    expect(intent.status).toBe('PENDING');
  });

  it('يمنع غير مالك الاشتراك من محاكاة نجاح الدفع', async () => {
    const prisma = (await import('../src/db.js')).default;
    const parentToken = await getToken('parent@test.tn', 'parent123');
    const sub = await createPendingSubscription(prisma);
    const res = await startCheckout(parentToken, sub.id);
    const intentId = res.body.id;

    const strangerToken = await getToken('teacher@test.tn', 'teacher123');
    const complete = await request(app)
      .post(`/api/payments/demo-checkout/${intentId}/result`)
      .set('Authorization', `Bearer ${strangerToken}`)
      .send({ result: 'success' });
    expect(complete.status).toBe(403);

    const intent = await prisma.paymentIntent.findUnique({ where: { id: intentId } });
    expect(intent.status).toBe('PENDING');
  });
});

describe('عمليات الدفع وسجلات التدقيق', () => {
  it('يعرض عمليات المستخدم الخاصة', async () => {
    const token = await getToken('parent@test.tn', 'parent123');
    const prisma = (await import('../src/db.js')).default;
    const sub = await createPendingSubscription(prisma);
    await startCheckout(token, sub.id);

    const res = await request(app).get('/api/payments/intents/mine').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBe(1);
    expect(res.body[0].status).toBe('PENDING');
  });

  it('يسمح بإلغاء عملية معلقة ثم يمنع الإلغاء المزدوج', async () => {
    const token = await getToken('parent@test.tn', 'parent123');
    const prisma = (await import('../src/db.js')).default;
    const sub = await createPendingSubscription(prisma);
    const res = await startCheckout(token, sub.id);
    const intentId = res.body.id;

    const cancel = await request(app)
      .post(`/api/payments/intents/${intentId}/cancel`)
      .set('Authorization', `Bearer ${token}`);
    expect(cancel.status).toBe(200);
    expect(cancel.body.status).toBe('CANCELED');

    const again = await request(app)
      .post(`/api/payments/intents/${intentId}/cancel`)
      .set('Authorization', `Bearer ${token}`);
    expect(again.status).toBe(400);
  });

  it('يسمح للمسؤول بعرض سجلات التدقيق ويمنع غير المسؤول', async () => {
    const parentToken = await getToken('parent@test.tn', 'parent123');
    const adminToken = await getToken('admin@education.tn', 'admin123');
    const prisma = (await import('../src/db.js')).default;
    const sub = await createPendingSubscription(prisma);
    await startCheckout(parentToken, sub.id);

    const denied = await request(app)
      .get('/api/payments/admin/audit-logs')
      .set('Authorization', `Bearer ${parentToken}`);
    expect(denied.status).toBe(403);

    const logs = await request(app)
      .get('/api/payments/admin/audit-logs?page=1&pageSize=10')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(logs.status).toBe(200);
    expect(logs.body.total).toBeGreaterThanOrEqual(1);
    const actions = logs.body.logs.map((l) => l.action);
    expect(actions).toContain('PAYMENT_CHECKOUT_CREATED');
  });

  it('يعرض قائمة الاشتراكات القابلة للدفع للولي', async () => {
    const token = await getToken('parent@test.tn', 'parent123');
    const prisma = (await import('../src/db.js')).default;
    const sub = await createPendingSubscription(prisma);
    const res = await request(app).get('/api/payments/payable').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    const all = [...res.body.own, ...res.body.children];
    expect(all.map((s) => s.id)).toContain(sub.id);
  });
});
