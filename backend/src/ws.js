import { WebSocketServer } from 'ws';
import jwt from 'jsonwebtoken';
import prisma from './db.js';
import { config } from './config.js';
import { isAllowedContact } from './services/messagingPolicy.js';
import { notify } from './services/notify.js';

const JWT_SECRET = config.jwtSecret;

const clients = new Map();
const livePresence = new Map();
const roomSockets = new Map();
const liveRaisedHands = new Map();
const liveScreenShares = new Map();

export function sendToUser(userId, payload) {
  const set = clients.get(userId);
  if (!set) return false;
  const raw = JSON.stringify(payload);
  let sent = 0;
  for (const client of set) {
    if (client.readyState === 1) {
      client.send(raw);
      sent += 1;
    }
  }
  return sent > 0;
}

function broadcastToRoom(room, payload) {
  const sockets = roomSockets.get(room);
  if (!sockets) return;
  const raw = JSON.stringify(payload);
  for (const client of sockets) {
    if (client.readyState === 1) client.send(raw);
  }
}

export async function broadcastUnread(userId) {
  try {
    const count = await prisma.message.count({
      where: { recipientId: userId, readAt: null }
    });
    sendToUser(userId, { type: 'unread', count });
  } catch {
    /* ignore */
  }
}

async function loadUser(userId) {
  try {
    return await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        role: true,
        accountStatus: true
      }
    });
  } catch {
    return null;
  }
}

async function handleMessageSend(ws, userId, data) {  const recipientId = Number(data.recipientId);
  const body = String(data.body || '').trim().slice(0, 5000);
  const subject = data.subject ? String(data.subject).trim().slice(0, 200) : null;
  if (!recipientId || recipientId === userId || !body) return;

  const [sender, recipient] = await Promise.all([loadUser(userId), loadUser(recipientId)]);
  if (!sender || !recipient) return;

  const allowed = await isAllowedContact(sender, recipient);
  if (!allowed) {
    sendToUser(userId, { type: 'message:error', error: 'صلاحية غير كافية', recipientId });
    return;
  }

  const message = await prisma.message.create({
    data: { senderId: userId, recipientId, subject, body },
    include: { sender: { select: { id: true, firstName: true, lastName: true, role: true } } }
  });

  sendToUser(recipientId, { type: 'message:new', message });
  await broadcastUnread(recipientId);

  await notify([recipientId], {
    type: 'MESSAGE',
    title: `رسالة جديدة من ${sender.firstName} ${sender.lastName}`,
    body: subject || body.slice(0, 120),
    link: '/messages'
  });
}

async function handleMessageRead(ws, userId, data) {
  const senderId = Number(data.senderId);
  if (!senderId) return;
  await prisma.message.updateMany({
    where: { senderId, recipientId: userId, readAt: null },
    data: { readAt: new Date() }
  });
  await broadcastUnread(userId);
  sendToUser(senderId, { type: 'message:read', readerId: userId });
}

function isAdminRole(role) {
  return ['ADMIN', 'SCHOOL_DIRECTOR', 'SUPER_ADMIN'].includes(role);
}

async function authorizeRoom(room, user) {
  try {
    const session = await prisma.liveSession.findUnique({ where: { roomName: room } });
    if (!session) return null;
    if (session.status === 'ENDED' || session.status === 'CANCELLED') return null;
    if (user.role === 'TEACHER') {
      return session.teacherId === user.id ? session : null;
    }
    if (isAdminRole(user.role)) return session;
    const now = new Date();
    const effectivelyLive =
      session.status === 'LIVE' ||
      (session.status === 'SCHEDULED' && now >= session.startsAt && now < session.endsAt);
    if (!effectivelyLive) return null;
    if (session.classId === null) return session;
    if (user.role === 'STUDENT') {
      const count = await prisma.student.count({ where: { accountUserId: user.id, classId: session.classId } });
      return count ? session : null;
    }
    if (user.role === 'PARENT') {
      const count = await prisma.student.count({ where: { userId: user.id, classId: session.classId } });
      return count ? session : null;
    }
    return null;
  } catch {
    return null;
  }
}

function serializeRaisedHands(room) {
  return Array.from(liveRaisedHands.get(room)?.values() || []).map((h) => ({
    userId: h.userId,
    name: h.name,
    role: h.role,
    raisedAt: h.raisedAt
  }));
}

function serializeScreenShares(room) {
  return Array.from(liveScreenShares.get(room)?.values() || []).map((s) => ({
    userId: s.userId,
    name: s.name,
    role: s.role,
    startedAt: s.startedAt
  }));
}

async function broadcastRaisedHands(room) {
  broadcastToRoom(room, { type: 'live:raised-hands', room, hands: serializeRaisedHands(room) });
}

async function broadcastScreenShares(room) {
  broadcastToRoom(room, { type: 'live:screen-share', room, shares: serializeScreenShares(room) });
}

async function handleLiveChat(userId, room, body) {
  const user = await loadUser(userId);
  if (!user) return;
  const clean = String(body || '').trim().slice(0, 500);
  if (!clean) return;
  const session = await authorizeRoom(room, user);
  if (!session) {
    sendToUser(userId, { type: 'live:chat:error', room, error: 'لا يمكنك الكتابة في هذه الغرفة' });
    return;
  }
  const message = await prisma.liveChatMessage.create({
    data: { sessionId: session.id, senderId: userId, body: clean },
    include: { sender: { select: { id: true, firstName: true, lastName: true, role: true } } }
  });
  broadcastToRoom(room, {
    type: 'live:chat:new',
    room,
    message: {
      id: message.id,
      sessionId: message.sessionId,
      sender: message.sender,
      body: message.body,
      createdAt: message.createdAt
    }
  });
}

async function handleRaiseHand(userId, room, action) {
  const user = await loadUser(userId);
  if (!user) return;
  const session = await authorizeRoom(room, user);
  if (!session) return;

  if (action === 'lower') {
    liveRaisedHands.get(room)?.delete(userId);
    if (liveRaisedHands.get(room)?.size === 0) liveRaisedHands.delete(room);
    await prisma.liveRaisedHand.upsert({
      where: { sessionId_userId: { sessionId: session.id, userId } },
      update: { status: 'LOWERED', loweredAt: new Date() },
      create: { sessionId: session.id, userId, status: 'LOWERED', loweredAt: new Date() }
    });
  } else {
    let hands = liveRaisedHands.get(room);
    if (!hands) {
      hands = new Map();
      liveRaisedHands.set(room, hands);
    }
    hands.set(userId, {
      userId,
      name: `${user.firstName} ${user.lastName}`,
      role: user.role,
      raisedAt: new Date().toISOString()
    });
    await prisma.liveRaisedHand.upsert({
      where: { sessionId_userId: { sessionId: session.id, userId } },
      update: { status: 'RAISED', loweredAt: null },
      create: { sessionId: session.id, userId, status: 'RAISED' }
    });
  }
  await broadcastRaisedHands(room);
}

async function handleScreenShare(userId, room, action) {
  const user = await loadUser(userId);
  if (!user) return;
  const session = await authorizeRoom(room, user);
  if (!session) return;

  if (action === 'stop') {
    liveScreenShares.get(room)?.delete(userId);
    if (liveScreenShares.get(room)?.size === 0) liveScreenShares.delete(room);
    await prisma.liveScreenShare.upsert({
      where: { sessionId_userId: { sessionId: session.id, userId } },
      update: { active: false, stoppedAt: new Date() },
      create: { sessionId: session.id, userId, active: false, stoppedAt: new Date() }
    });
  } else {
    let shares = liveScreenShares.get(room);
    if (!shares) {
      shares = new Map();
      liveScreenShares.set(room, shares);
    }
    shares.set(userId, {
      userId,
      name: `${user.firstName} ${user.lastName}`,
      role: user.role,
      startedAt: new Date().toISOString()
    });
    await prisma.liveScreenShare.upsert({
      where: { sessionId_userId: { sessionId: session.id, userId } },
      update: { active: true, startedAt: new Date(), stoppedAt: null },
      create: { sessionId: session.id, userId, active: true, startedAt: new Date() }
    });
  }
  await broadcastScreenShares(room);
}

function leaveRoom(ws, room) {
  const sockets = roomSockets.get(room);
  if (sockets) {
    sockets.delete(ws);
    if (sockets.size === 0) roomSockets.delete(room);
  }
  const members = livePresence.get(room);
  if (members) {
    members.delete(ws.userId);
    if (members.size === 0) livePresence.delete(room);
  }
  liveRaisedHands.get(room)?.delete(ws.userId);
  if (liveRaisedHands.get(room)?.size === 0) liveRaisedHands.delete(room);
  liveScreenShares.get(room)?.delete(ws.userId);
  if (liveScreenShares.get(room)?.size === 0) liveScreenShares.delete(room);
  if (ws.liveRoom === room) ws.liveRoom = null;
  broadcastRaisedHands(room).catch(() => {});
  broadcastScreenShares(room).catch(() => {});
}

async function handleLivePresence(ws, userId, room, action) {
  try {
    const user = await loadUser(userId);
    if (!user) return;

    if (action === 'leave') {
      leaveRoom(ws, room);
    } else {
      const session = await authorizeRoom(room, user);
      if (!session) {
        sendToUser(userId, { type: 'live:presence:error', room, error: 'لا يمكنك الانضمام إلى هذه الغرفة' });
        return;
      }
      if (ws.liveRoom && ws.liveRoom !== room) leaveRoom(ws, ws.liveRoom);
      ws.liveRoom = room;
      let members = livePresence.get(room);
      if (!members) {
        members = new Map();
        livePresence.set(room, members);
      }
      members.set(userId, {
        id: userId,
        name: `${user.firstName} ${user.lastName}`,
        role: user.role
      });
      if (!roomSockets.has(room)) roomSockets.set(room, new Set());
      roomSockets.get(room).add(ws);
    }
    const payload = {
      type: 'live:presence',
      room,
      users: Array.from(livePresence.get(room)?.values() || [])
    };
    broadcastToRoom(room, payload);
  } catch {
    /* ignore */
  }
}

export function getLiveRoomInteractions(room) {
  return {
    room,
    raisedHands: serializeRaisedHands(room),
    screenShares: serializeScreenShares(room)
  };
}

export async function lowerRaisedHand(room, userId, sessionId) {
  liveRaisedHands.get(room)?.delete(userId);
  if (liveRaisedHands.get(room)?.size === 0) liveRaisedHands.delete(room);
  if (sessionId) {
    try {
      await prisma.liveRaisedHand.upsert({
        where: { sessionId_userId: { sessionId, userId } },
        update: { status: 'LOWERED', loweredAt: new Date() },
        create: { sessionId, userId, status: 'LOWERED', loweredAt: new Date() }
      });
    } catch {
      /* ignore */
    }
  }
  await broadcastRaisedHands(room);
}

export async function stopScreenShare(room, userId, sessionId) {
  liveScreenShares.get(room)?.delete(userId);
  if (liveScreenShares.get(room)?.size === 0) liveScreenShares.delete(room);
  if (sessionId) {
    try {
      await prisma.liveScreenShare.upsert({
        where: { sessionId_userId: { sessionId, userId } },
        update: { active: false, stoppedAt: new Date() },
        create: { sessionId, userId, active: false, stoppedAt: new Date() }
      });
    } catch {
      /* ignore */
    }
  }
  await broadcastScreenShares(room);
}

export function setupWs(server) {
  const wss = new WebSocketServer({
    server,
    path: '/ws',
    // نقبل التوكن عبر بروتوكول فرعي `bearer-<jwt>` بدل وضعه في الرابط
    // (الرابط قد يُسجَّل في سجلات الوسيط). نختار البروتوكول المُرسَل.
    handleProtocols: (protocols) => {
      for (const p of protocols) {
        if (typeof p === 'string' && p.startsWith('bearer-')) return p;
      }
      return true;
    }
  });

  wss.on('connection', (ws, req) => {
    let userId = null;
    try {
      // أمان: التوكن عبر البروتوكول الفرعي فقط — لا عبر ?token= في الرابط
      // (روابط الاستعلام تُسجَّل في سجلات الوسيط/المتصفح).
      const proto = String(req.headers['sec-websocket-protocol'] || '');
      const bearer = proto.split(',').map((s) => s.trim()).find((p) => p.startsWith('bearer-'));
      const token = bearer ? bearer.slice('bearer-'.length) : null;
      if (token) {
        const payload = jwt.verify(token, JWT_SECRET);
        userId = payload.id;
      }
    } catch {
      /* invalid token */
    }

    if (!userId) {
      ws.close(4001, 'unauthorized');
      return;
    }

    // التسجيل متزامن فوراً (حتى لا تسبق الأحداث اكتمالَ الفحص غير المتزامن)،
    // ثم فحص حالة الحساب: الموقوف/المنتهي يُفصل ويُسحب من الشبكة.
    ws.userId = userId;
    if (!clients.has(userId)) clients.set(userId, new Set());
    clients.get(userId).add(ws);

    prisma.user
      .findUnique({ where: { id: userId }, select: { accountStatus: true } })
      .then((account) => {
        if (!account || account.accountStatus !== 'ACTIVE') {
          clients.get(userId)?.delete(ws);
          if (clients.get(userId)?.size === 0) clients.delete(userId);
          try { ws.close(4003, 'account-inactive'); } catch { /* ignore */ }
        }
      })
      .catch(() => {
        clients.get(userId)?.delete(ws);
        if (clients.get(userId)?.size === 0) clients.delete(userId);
        try { ws.close(4001, 'unauthorized'); } catch { /* ignore */ }
      });

    ws.on('message', (raw) => {
      let data;
      try {
        data = JSON.parse(raw.toString());
      } catch {
        return;
      }
      switch (data.type) {
        case 'message:send':
          handleMessageSend(ws, userId, data).catch(() => {});
          break;
        case 'message:read':
          handleMessageRead(ws, userId, data).catch(() => {});
          break;
        case 'typing': {
          const targetId = data.recipientId;
          const targetClients = clients.get(targetId);
          if (targetClients) {
            for (const client of targetClients) {
              if (client !== ws && client.readyState === 1) {
                client.send(JSON.stringify({ type: 'typing', from: userId, active: !!data.active }));
              }
            }
          }
          break;
        }
        case 'live:presence': {
          const room = data.room;
          if (!room || typeof room !== 'string') break;
          handleLivePresence(ws, userId, room, data.action === 'leave' ? 'leave' : 'join');
          break;
        }
        case 'live:chat': {
          const room = data.room;
          if (!room || typeof room !== 'string') break;
          handleLiveChat(userId, room, data.body).catch(() => {});
          break;
        }
        case 'live:raise-hand': {
          const room = data.room;
          if (!room || typeof room !== 'string') break;
          handleRaiseHand(userId, room, data.action === 'lower' ? 'lower' : 'raise').catch(() => {});
          break;
        }
        case 'live:screen-share': {
          const room = data.room;
          if (!room || typeof room !== 'string') break;
          handleScreenShare(userId, room, data.action === 'stop' ? 'stop' : 'start').catch(() => {});
          break;
        }
        default:
          break;
      }
    });

    ws.on('close', () => {
      const set = clients.get(userId);
      if (set) {
        set.delete(ws);
        if (set.size === 0) clients.delete(userId);
      }
      if (ws.liveRoom) leaveRoom(ws, ws.liveRoom);
    });
  });

  return wss;
}
