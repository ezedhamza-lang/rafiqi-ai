import prisma from '../db.js';
import { config } from '../config.js';
import { ApiError } from '../middleware/errorHandler.js';
import { getProvider, normalizeProviderName } from './payments/provider.js';
import { notify } from './notify.js';
import { priceForType, nextSchoolYear, schoolYearBounds } from './schoolYear.js';

export const RENEWAL_WINDOW_DAYS = 7;

function parentIdsOf(userId) {
  return prisma.student
    .findMany({ where: { accountUserId: userId }, select: { userId: true } })
    .then((rows) => rows.map((r) => r.userId));
}

export async function renewSubscription({ subscriptionId, actorId, provider, reference, amount }) {
  const sub = await prisma.subscription.findUnique({
    where: { id: subscriptionId },
    include: { user: { select: { id: true, role: true, email: true } } }
  });
  if (!sub) throw new ApiError(404, 'الاشتراك غير موجود');
  if (sub.status !== 'ACTIVE') throw new ApiError(400, 'الاشتراك غير مفعّل، لا يمكن تجديده');

  const schoolYear = nextSchoolYear(sub.schoolYear);
  const { start, end } = schoolYearBounds(schoolYear);

  await prisma.subscription.update({
    where: { id: sub.id },
    data: { schoolYear, startDate: start, endDate: end, status: 'ACTIVE', cancelledAt: null }
  });
  if (['STUDENT', 'TEACHER'].includes(sub.user.role)) {
    await prisma.user.update({ where: { id: sub.user.id }, data: { accountStatus: 'ACTIVE' } });
  }
  await prisma.subscriptionRequest.updateMany({
    where: { subscriptionId: sub.id },
    data: { status: 'ACTIVE', schoolYear }
  });

  const payment = await prisma.payment.create({
    data: {
      subscriptionId: sub.id,
      amount,
      method: provider || 'ONLINE',
      reference: reference || null,
      paidByUserId: actorId
    }
  });

  const parents = await parentIdsOf(sub.user.id);
  await notify([...parents, sub.user.id], {
    type: 'RENEWED',
    title: 'تم تجديد الاشتراك تلقائيا',
    body: `تم تجديد اشتراكك للسنة الدراسية ${schoolYear} بعد استلام الدفعة (${amount} د.ت)`,
    link: '/payment'
  });

  return { payment, schoolYear };
}

async function canManageRenewal(sub, actorId, role) {
  if (sub.userId === actorId) return true;
  if (['ADMIN', 'SUPER_ADMIN'].includes(role)) return true;
  if (role === 'PARENT') {
    const child = await prisma.student.findFirst({
      where: { userId: actorId, accountUserId: sub.userId }
    });
    return Boolean(child);
  }
  return false;
}

export async function cancelAutoRenewal(subscriptionId, actorId, role) {
  const sub = await prisma.subscription.findUnique({ where: { id: subscriptionId } });
  if (!sub) throw new ApiError(404, 'الاشتراك غير موجود');
  if (!(await canManageRenewal(sub, actorId, role))) {
    throw new ApiError(403, 'لا تملك صلاحية إلغاء التجديد لهذا الاشتراك');
  }
  const updated = await prisma.subscription.update({
    where: { id: sub.id },
    data: { renewalEnabled: false, cancelledAt: new Date() }
  });
  return updated;
}

export async function enableAutoRenewal(subscriptionId, actorId, role) {
  const sub = await prisma.subscription.findUnique({ where: { id: subscriptionId } });
  if (!sub) throw new ApiError(404, 'الاشتراك غير موجود');
  if (!(await canManageRenewal(sub, actorId, role))) {
    throw new ApiError(403, 'لا تملك صلاحية تفعيل التجديد لهذا الاشتراك');
  }
  const updated = await prisma.subscription.update({
    where: { id: sub.id },
    data: { renewalEnabled: true, cancelledAt: null }
  });
  return updated;
}

export async function createRenewalIntent({ subscription, actorId, role, provider }) {
  const existing = await prisma.paymentIntent.findFirst({
    where: {
      subscriptionId: subscription.id,
      status: 'PENDING',
      metadata: { path: ['kind'], equals: 'RENEWAL' },
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }]
    }
  });
  if (existing) return existing;

  const providerName = normalizeProviderName(provider) || config.payment.defaultProvider;
  const providerInstance = getProvider(providerName);
  const amount = subscription.amount != null ? Number(subscription.amount) : priceForType(subscription.type);

  const intent = await prisma.paymentIntent.create({
    data: {
      subscriptionId: subscription.id,
      userId: actorId,
      provider: providerName,
      status: 'PENDING',
      amount,
      currency: config.payment.currency,
      metadata: {
        plan: subscription.plan,
        schoolYear: subscription.schoolYear,
        payerRole: role,
        provider: providerName,
        kind: 'RENEWAL',
        source: 'AUTO_RENEWAL'
      },
      expiresAt: new Date(Date.now() + 30 * 86400000)
    }
  });

  try {
    const result = await providerInstance.createCheckout({
      intent,
      subscription,
      user: { id: actorId, role }
    });
    return prisma.paymentIntent.update({
      where: { id: intent.id },
      data: {
        checkoutUrl: result.checkoutUrl || null,
        providerReference: result.providerReference || null
      }
    });
  } catch (err) {
    await prisma.paymentIntent.update({
      where: { id: intent.id },
      data: { status: 'FAILED', failureMessage: err.message }
    });
    throw err;
  }
}

export async function expireStalePaymentIntents({ now = new Date() } = {}) {
  const result = await prisma.paymentIntent.updateMany({
    where: { status: 'PENDING', expiresAt: { not: null, lte: now } },
    data: { status: 'EXPIRED' }
  });
  return result.count;
}

export async function runRenewalSweep({ now = new Date(), provider } = {}) {
  await expireStalePaymentIntents({ now });
  const inWindow = new Date(now.getTime() + RENEWAL_WINDOW_DAYS * 86400000);
  const subscriptions = await prisma.subscription.findMany({
    where: {
      status: 'ACTIVE',
      renewalEnabled: true,
      endDate: { lte: inWindow }
    },
    include: { user: { select: { id: true, firstName: true, lastName: true, email: true, role: true } } }
  });

  const created = [];
  for (const sub of subscriptions) {
    const existing = await prisma.paymentIntent.findFirst({
      where: {
        subscriptionId: sub.id,
        status: 'PENDING',
        metadata: { path: ['kind'], equals: 'RENEWAL' },
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }]
      }
    });
    if (existing) continue;

    let intent;
    try {
      intent = await createRenewalIntent({ subscription: sub, actorId: sub.user.id, role: sub.user.role, provider });
    } catch {
      continue;
    }

    const parents = await parentIdsOf(sub.user.id);
    await notify([...parents, sub.user.id], {
      type: 'RENEWAL_REMINDER',
      title: 'اشتراكك يقترب من الانتهاء',
      body: `تم تجهيز عملية تجديد تلقائي. أكمل الدفع ليواصل اشتراكك حتى تاريخ ${new Date(schoolYearBounds(nextSchoolYear(sub.schoolYear)).end).toLocaleDateString('ar-TN')}`,
      link: '/payment'
    });
    created.push(intent.id);
  }
  return created;
}

export async function startRenewalScheduler() {
  const intervalMs = Number(process.env.RENEWAL_SWEEP_INTERVAL_MS || 6 * 60 * 60 * 1000);
  const timer = setInterval(() => {
    runRenewalSweep().catch((err) => {
      console.error('renewal sweep failed:', err.message);
    });
  }, intervalMs);
  timer.unref();
  return timer;
}
