import prisma from '../db.js';
import { config } from '../config.js';
import { ApiError } from '../middleware/errorHandler.js';
import { getProvider, normalizeProviderName } from './payments/provider.js';
import { verifyCaptcha } from './captchaService.js';
import { audit } from './auditService.js';
import { notify } from './notify.js';
import { priceForType } from './schoolYear.js';
import { validateDiscountCode, consumeDiscountCode } from './discountService.js';
import { renewSubscription } from './subscriptionRenewalService.js';
import { createInvoice } from './invoiceService.js';

export const PAYABLE_STATUSES = ['PENDING_PAYMENT', 'SUSPENDED'];

async function canPayForSubscription(userId, role, subscription) {
  if (subscription.userId === userId) return true;
  if (role === 'PARENT') {
    const child = await prisma.student.findFirst({
      where: { userId, accountUserId: subscription.userId }
    });
    return Boolean(child);
  }
  return false;
}

export async function createCheckoutIntent({ subscriptionId, provider, userId, role, captchaToken, captchaAnswer, req, kind, discountCode }) {
  const subscription = await prisma.subscription.findUnique({ where: { id: subscriptionId } });
  if (!subscription) throw new ApiError(404, 'الاشتراك غير موجود');

  const allowed = await canPayForSubscription(userId, role, subscription);
  if (!allowed) throw new ApiError(403, 'لا تملك صلاحية الدفع لهذا الاشتراك');

  const renewalKind = kind === 'RENEWAL';
  if (renewalKind) {
    if (subscription.status !== 'ACTIVE') {
      throw new ApiError(400, 'الاشتراك غير مفعّل، التجديد التلقائي متاح للاشتراكات النشطة فقط');
    }
    if (subscription.renewalEnabled === false) {
      throw new ApiError(400, 'تم إلغاء التجديد التلقائي لهذا الاشتراك');
    }
  } else if (!PAYABLE_STATUSES.includes(subscription.status)) {
    throw new ApiError(400, 'هذا الاشتراك ليس في حالة تتطلب دفعا حاليا');
  }

  const captcha = verifyCaptcha(captchaToken, captchaAnswer);
  if (!captcha.ok) throw new ApiError(400, captcha.error);

  const providerName = normalizeProviderName(provider) || config.payment.defaultProvider;
  if (providerName === 'DEMO' && config.nodeEnv === 'production' && !config.payment.allowDemoPayments) {
    throw new ApiError(503, 'المزود التجريبي DEMO معطّل في الإنتاج — استعمل مزوداً حقيقياً أو اضبط ALLOW_DEMO_PAYMENTS=true صراحةً');
  }
  const providerInstance = getProvider(providerName);
  const baseAmount = subscription.amount != null ? Number(subscription.amount) : priceForType(subscription.type);

  if (renewalKind) {
    const existing = await prisma.paymentIntent.findFirst({
      where: {
        subscriptionId: subscription.id,
        status: 'PENDING',
        metadata: { path: ['kind'], equals: 'RENEWAL' },
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }]
      }
    });
    if (existing) return existing;
  }

  let discount = null;
  if (discountCode) {
    discount = await validateDiscountCode(discountCode, baseAmount);
  }
  const amount = discount ? discount.finalAmount : baseAmount;

  const metadata = {
    plan: subscription.plan,
    schoolYear: subscription.schoolYear,
    payerRole: role,
    provider: providerName,
    kind: renewalKind ? 'RENEWAL' : 'INITIAL'
  };
  if (discount) {
    metadata.discountCode = discount.code;
    metadata.discountType = discount.type;
    metadata.discountValue = discount.value;
    metadata.discountAmount = discount.discountAmount;
    metadata.originalAmount = baseAmount;
  }

  const intent = await prisma.paymentIntent.create({
    data: {
      subscriptionId: subscription.id,
      userId,
      provider: providerName,
      status: 'PENDING',
      amount,
      currency: config.payment.currency,
      metadata,
      expiresAt: new Date(Date.now() + 30 * 86400000)
    }
  });

  try {
    const result = await providerInstance.createCheckout({ intent, subscription, user: { id: userId, role } });
    const updated = await prisma.paymentIntent.update({
      where: { id: intent.id },
      data: {
        checkoutUrl: result.checkoutUrl || null,
        providerReference: result.providerReference || null
      }
    });

    await audit({
      actorId: userId,
      actorRole: role,
      action: renewalKind ? 'PAYMENT_RENEWAL_CREATED' : 'PAYMENT_CHECKOUT_CREATED',
      resource: 'PaymentIntent',
      resourceId: intent.id,
      ip: req?.ip || null,
      userAgent: req?.headers?.['user-agent'] || null,
      metadata: { provider: providerName, amount, subscriptionId: subscription.id, kind: metadata.kind, discountCode: discount?.code || null }
    });

    return updated;
  } catch (err) {
    await prisma.paymentIntent.update({
      where: { id: intent.id },
      data: { status: 'FAILED', failureMessage: err.message }
    });
    await audit({
      actorId: userId,
      actorRole: role,
      action: 'PAYMENT_CHECKOUT_FAILED',
      resource: 'PaymentIntent',
      resourceId: intent.id,
      ip: req?.ip || null,
      userAgent: req?.headers?.['user-agent'] || null,
      metadata: { provider: providerName, error: err.message }
    });
    throw err;
  }
}

async function activateSubscription(subscriptionId, amount, method, reference, actorId) {
  const sub = await prisma.subscription.findUnique({
    where: { id: subscriptionId },
    include: { user: { select: { id: true, role: true, email: true } } }
  });
  if (!sub) throw new ApiError(404, 'الاشتراك غير موجود');

  // ذرّية: تفعيل الاشتراك + تنشيط الحساب + ترقية الطلب + تسجيل الدفعة تُطبَّق
  // كلها أو لا شيء. لا يبقى اشتراك ACTIVE بلا Payment (فلوس بلا أثر).
  const payment = await prisma.$transaction(async (tx) => {
    await tx.subscription.update({ where: { id: sub.id }, data: { status: 'ACTIVE' } });
    if (['STUDENT', 'TEACHER'].includes(sub.user.role)) {
      await tx.user.update({ where: { id: sub.user.id }, data: { accountStatus: 'ACTIVE' } });
    }
    await tx.subscriptionRequest.updateMany({ where: { subscriptionId: sub.id }, data: { status: 'ACTIVE' } });

    return tx.payment.create({
      data: {
        subscriptionId: sub.id,
        amount,
        method: method || 'ONLINE',
        reference: reference || null,
        paidByUserId: actorId
      }
    });
  });

  const parentIds = await prisma.student
    .findMany({ where: { accountUserId: sub.user.id }, select: { userId: true } })
    .then((rows) => rows.map((r) => r.userId));

  await notify([...parentIds, sub.user.id], {
    type: 'PAID',
    title: 'تم تفعيل الحساب والاشتراك',
    body: `تم استلام الدفعة (${amount} د.ت) وتفعيل الاشتراك حتى ${new Date(sub.endDate).toLocaleDateString('ar-TN')}`,
    link: '/my-requests'
  });

  return payment;
}

export async function processWebhookEvent(event) {
  const { provider, providerReference, metadata } = event;
  // تطبيع دفاعي: بعض المنصات ترسل CANCELLED (بLLLL) بدل CANCELED — نوحّد
  // لتفادي سقوط الحدث في default: رغم أنه صالح.
  const rawType = String(event.type || '').toUpperCase();
  const type = rawType === 'CANCELLED' ? 'CANCELED' : rawType;

  let intent = null;
  if (providerReference) {
    intent = await prisma.paymentIntent.findUnique({ where: { providerReference } });
  }
  if (!intent && metadata?.intentId) {
    intent = await prisma.paymentIntent.findUnique({ where: { id: Number(metadata.intentId) } });
  }
  if (!intent) {
    await audit({
      actorId: null,
      actorRole: null,
      action: 'PAYMENT_WEBHOOK_UNKNOWN_INTENT',
      resource: 'PaymentIntent',
      ip: event.ip || null,
      userAgent: event.userAgent || null,
      metadata: { provider, type, providerReference }
    });
    return { ok: false, reason: 'intent_not_found' };
  }

  if (intent.status !== 'PENDING') {
    await audit({
      actorId: intent.userId,
      actorRole: null,
      action: 'PAYMENT_WEBHOOK_DUPLICATE',
      resource: 'PaymentIntent',
      resourceId: intent.id,
      ip: event.ip || null,
      userAgent: event.userAgent || null,
      metadata: { provider, type, currentStatus: intent.status }
    });
    return { ok: true, already: true, status: intent.status };
  }

  switch (type) {
    case 'SUCCEEDED': {
      const claimed = await prisma.paymentIntent.updateMany({
        where: { id: intent.id, status: 'PENDING' },
        data: { status: 'SUCCEEDED', paidAt: new Date() }
      });
      if (claimed.count === 0) {
        const current = await prisma.paymentIntent.findUnique({ where: { id: intent.id } });
        await audit({
          actorId: intent.userId,
          actorRole: null,
          action: 'PAYMENT_WEBHOOK_DUPLICATE',
          resource: 'PaymentIntent',
          resourceId: intent.id,
          ip: event.ip || null,
          userAgent: event.userAgent || null,
          metadata: { provider, type, currentStatus: current?.status }
        });
        return { ok: true, already: true, status: current?.status };
      }
      try {
        await finalizeSuccessfulPayment(intent, event);
      } catch (err) {
        // لا نعيد الحالة إلى FAILED — المال محصَّل لدى المزود والclaim استُهلك،
        // والتراجع يفقد الأثر المالي ويمنع إعادة المعالجة. نُبقي SUCCEEDED
        // مع علامة فشل التفعيل ليُتدارك يدوياً/بمسح تشافي لاحق.
        await prisma.paymentIntent.update({
          where: { id: intent.id },
          data: { failureMessage: `تثبيت متأخر — فشل التفعيل بعد نجاح الدفع: ${err.message}` }
        });
        await audit({
          actorId: intent.userId,
          actorRole: null,
          action: 'PAYMENT_FINALIZE_FAILED',
          resource: 'PaymentIntent',
          resourceId: intent.id,
          ip: event.ip || null,
          userAgent: event.userAgent || null,
          metadata: { provider, type, error: err.message, subscriptionId: intent.subscriptionId, needsManualFinalize: true }
        });
        throw new ApiError(502, 'تعذر إتمام عملية التفعيل بعد نجاح الدفع، تواصل مع الإدارة');
      }
      await audit({
        actorId: intent.userId,
        actorRole: null,
        action: 'PAYMENT_SUCCEEDED',
        resource: 'PaymentIntent',
        resourceId: intent.id,
        ip: event.ip || null,
        userAgent: event.userAgent || null,
        metadata: { provider, type, amount: intent.amount, subscriptionId: intent.subscriptionId, kind: intent.metadata?.kind || 'INITIAL' }
      });
      return { ok: true, status: 'SUCCEEDED' };
    }
    case 'FAILED': {
      const failed = await prisma.paymentIntent.updateMany({
        where: { id: intent.id, status: 'PENDING' },
        data: { status: 'FAILED', failureMessage: event.failureMessage || 'عملية الدفع فشلت' }
      });
      if (failed.count === 0) {
        const current = await prisma.paymentIntent.findUnique({ where: { id: intent.id } });
        return { ok: true, already: true, status: current?.status };
      }
      await audit({
        actorId: intent.userId,
        actorRole: null,
        action: 'PAYMENT_FAILED',
        resource: 'PaymentIntent',
        resourceId: intent.id,
        ip: event.ip || null,
        userAgent: event.userAgent || null,
        metadata: { provider, type, subscriptionId: intent.subscriptionId }
      });
      return { ok: true, status: 'FAILED' };
    }
    case 'CANCELED': {
      const canceled = await prisma.paymentIntent.updateMany({
        where: { id: intent.id, status: 'PENDING' },
        data: { status: 'CANCELED' }
      });
      if (canceled.count === 0) {
        const current = await prisma.paymentIntent.findUnique({ where: { id: intent.id } });
        return { ok: true, already: true, status: current?.status };
      }
      await audit({
        actorId: intent.userId,
        actorRole: null,
        action: 'PAYMENT_CANCELED',
        resource: 'PaymentIntent',
        resourceId: intent.id,
        ip: event.ip || null,
        userAgent: event.userAgent || null,
        metadata: { provider, type, subscriptionId: intent.subscriptionId }
      });
      return { ok: true, status: 'CANCELED' };
    }
    case 'EXPIRED': {
      const expired = await prisma.paymentIntent.updateMany({
        where: { id: intent.id, status: 'PENDING' },
        data: { status: 'EXPIRED' }
      });
      if (expired.count === 0) {
        const current = await prisma.paymentIntent.findUnique({ where: { id: intent.id } });
        return { ok: true, already: true, status: current?.status };
      }
      await audit({
        actorId: intent.userId,
        actorRole: null,
        action: 'PAYMENT_EXPIRED',
        resource: 'PaymentIntent',
        resourceId: intent.id,
        ip: event.ip || null,
        userAgent: event.userAgent || null,
        metadata: { provider, type, subscriptionId: intent.subscriptionId }
      });
      return { ok: true, status: 'EXPIRED' };
    }
    default:
      throw new ApiError(400, `نوع حدث دفع غير معروف: ${type}`);
  }
}

async function finalizeSuccessfulPayment(intent, event) {
  const kind = intent.metadata?.kind === 'RENEWAL' ? 'RENEWAL' : 'INITIAL';

  // حماية إعادة التشغيل (idempotency): إن وُجدت دفعة مسجَّلة لمرجع المزود نفسه
  // فلا نُنشئ أخرى — نضمن الفاتورة فقط ونعيد. يمنع ازدواج المال عند التثبيت
  // المتأخر/إعادة المعالجة اليدوية.
  if (intent.providerReference) {
    const existingPayment = await prisma.payment.findFirst({ where: { reference: intent.providerReference } });
    if (existingPayment) {
      const existingInvoice = await prisma.invoice.findFirst({ where: { paymentId: existingPayment.id } });
      if (existingInvoice) return existingInvoice;
      return createInvoice({ subscriptionId: existingPayment.subscriptionId, paymentId: existingPayment.id, intent });
    }
  }

  let payment;
  if (kind === 'RENEWAL') {
    const renewal = await renewSubscription({
      subscriptionId: intent.subscriptionId,
      actorId: intent.userId,
      provider: intent.provider,
      reference: intent.providerReference,
      amount: intent.amount
    });
    payment = renewal.payment;
  } else {
    payment = await activateSubscription(intent.subscriptionId, intent.amount, intent.provider, intent.providerReference, intent.userId);
  }

  if (intent.metadata?.discountCode) {
    // فشل استهلاك الكود (حُذف/استُعمل) يجب ألا يُجهض تثبيت دفعة ناجحة —
    // يسجَّل للمراجعة فقط.
    try {
      await consumeDiscountCode(intent.metadata.discountCode);
    } catch (err) {
      console.error('consumeDiscountCode failed (payment still valid):', err.message);
    }
  }

  const invoice = await createInvoice({
    subscriptionId: intent.subscriptionId,
    paymentId: payment.id,
    intent
  });

  await audit({
    actorId: intent.userId,
    actorRole: null,
    action: 'INVOICE_ISSUED',
    resource: 'Invoice',
    resourceId: invoice.id,
    ip: event.ip || null,
    userAgent: event.userAgent || null,
    metadata: { invoiceNumber: invoice.invoiceNumber, kind, subscriptionId: intent.subscriptionId }
  });

  return invoice;
}
