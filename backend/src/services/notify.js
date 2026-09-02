import prisma from '../db.js';
import { deliverEmail, deliverSms, emailChannelEnabled, smsChannelEnabled } from './notificationChannels.js';

export const CHANNELS = {
  IN_APP: 'IN_APP',
  PUSH: 'PUSH',
  EMAIL: 'EMAIL',
  SMS: 'SMS'
};

export const DEFAULT_CHANNELS = [CHANNELS.IN_APP, CHANNELS.PUSH, CHANNELS.EMAIL, CHANNELS.SMS];

export const PRIORITIES = ['LOW', 'NORMAL', 'HIGH', 'URGENT'];

function requestedChannels(payload) {
  const list = payload?.channels;
  let base = [...DEFAULT_CHANNELS];
  if (Array.isArray(list) && list.length) {
    base = [...new Set([CHANNELS.IN_APP, CHANNELS.PUSH, ...list])];
  }
  return base.filter((c) => Object.values(CHANNELS).includes(c));
}

function applicableChannels(user, requested) {
  const set = new Set(requested);
  const channels = [];
  if (set.has(CHANNELS.IN_APP)) channels.push(CHANNELS.IN_APP);
  if (set.has(CHANNELS.PUSH) && user.notifyPush !== false) channels.push(CHANNELS.PUSH);
  if (set.has(CHANNELS.EMAIL) && user.notifyEmail && emailChannelEnabled()) channels.push(CHANNELS.EMAIL);
  if (set.has(CHANNELS.SMS) && user.notifySms && smsChannelEnabled()) channels.push(CHANNELS.SMS);
  return channels;
}

async function pushRealtime(userId, notification) {
  try {
    const { sendToUser } = await import('../ws.js');
    sendToUser(userId, { type: 'notification:new', notification });
    const count = await prisma.notification.count({ where: { userId, read: false } });
    sendToUser(userId, { type: 'notification:unread', count });
  } catch {
    /* push اختياري — لا نكسر التدفق عند غيابه */
  }
}

async function queueChannel(user, channel, payload) {
  try {
    if (channel === CHANNELS.EMAIL) {
      const subject = String(payload.title || 'إشعار من بوابة رفيقي').slice(0, 200);
      const body = `${payload.title || ''}${payload.body ? `\n${payload.body}` : ''}`.slice(0, 5000);
      const outbox = await prisma.notificationOutbox.create({
        data: { userId: user.id, channel, to: user.email, subject, body, status: 'PENDING' }
      });
      const result = await deliverEmail({ to: user.email, subject, body });
      await prisma.notificationOutbox.update({
        where: { id: outbox.id },
        data: result.ok ? { status: 'SENT', sentAt: new Date() } : { status: 'FAILED', error: result.error }
      });
      return;
    }
    if (channel === CHANNELS.SMS) {
      const phone = user.phone;
      if (!phone) return;
      const body = `${payload.title || ''} ${payload.body || ''}`.trim().slice(0, 160);
      const outbox = await prisma.notificationOutbox.create({
        data: { userId: user.id, channel, to: phone, subject: null, body, status: 'PENDING' }
      });
      const result = await deliverSms({ to: phone, body });
      await prisma.notificationOutbox.update({
        where: { id: outbox.id },
        data: result.ok ? { status: 'SENT', sentAt: new Date() } : { status: 'FAILED', error: result.error }
      });
    }
  } catch {
    /* فشل القناة الخارجية لا يُسقط الإشعار داخل المنصة */
  }
}

export async function notify(userIds, payload) {
  const targets = [...new Set(userIds.filter(Boolean))];
  if (!targets.length) return;

  const users = await prisma.user.findMany({
    where: { id: { in: targets } },
    select: { id: true, email: true, phone: true, notifyEmail: true, notifyPush: true, notifySms: true }
  });

  const requested = requestedChannels(payload);

  for (const user of users) {
    const channels = applicableChannels(user, requested);
    if (!channels.length) continue;

    const channelStatus = {};
    for (const c of channels) {
      channelStatus[c] = c === CHANNELS.EMAIL || c === CHANNELS.SMS ? 'QUEUED' : 'SENT';
    }

    const notification = await prisma.notification.create({
      data: {
        userId: user.id,
        type: String(payload.type || 'INFO').slice(0, 50),
        title: String(payload.title || 'إشعار').slice(0, 300),
        body: payload.body ? String(payload.body).slice(0, 5000) : null,
        link: payload.link ? String(payload.link).slice(0, 300) : null,
        read: false,
        priority: payload.priority && PRIORITIES.includes(payload.priority) ? payload.priority : 'NORMAL',
        channels: requested,
        channelStatus,
        metadata: payload.metadata || null,
        schoolAnnouncementId: payload.schoolAnnouncementId || null
      }
    });

    await pushRealtime(user.id, notification);

    if (channels.includes(CHANNELS.EMAIL)) {
      await queueChannel(user, CHANNELS.EMAIL, payload);
    }
    if (channels.includes(CHANNELS.SMS)) {
      await queueChannel(user, CHANNELS.SMS, payload);
    }
  }
}

export async function notifyRole(roles, payload) {
  const users = await prisma.user.findMany({
    where: { role: { in: roles } },
    select: { id: true }
  });
  await notify(users.map((u) => u.id), payload);
}

export async function getUnreadCount(userId) {
  return prisma.notification.count({ where: { userId, read: false } });
}

export async function markAllRead(userId) {
  await prisma.notification.updateMany({
    where: { userId, read: false },
    data: { read: true, readAt: new Date() }
  });
  return getUnreadCount(userId);
}

export async function markRead(userId, notificationId) {
  await prisma.notification.updateMany({
    where: { id: notificationId, userId },
    data: { read: true, readAt: new Date() }
  });
  return getUnreadCount(userId);
}
