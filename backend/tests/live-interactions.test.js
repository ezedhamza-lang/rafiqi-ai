import { beforeAll, afterAll, beforeEach, describe, it, expect } from 'vitest';
import { WebSocket } from 'ws';
import bcrypt from 'bcryptjs';
import { resetDatabase, seedTestData } from './helpers.js';

let request;
let app;
let server;
let prisma;

const WS_URL = 'ws://localhost:3999/ws';

function connectWs(token) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(WS_URL, [`bearer-${token}`]);
    ws.on('open', () => resolve(ws));
    ws.on('error', (err) => reject(err));
  });
}

function nextEvent(ws, type, timeout = 8000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error(`انقضت المهلة في انتظار حدث ${type}`));
    }, timeout);
    const handler = (data) => {
      let parsed;
      try {
        parsed = JSON.parse(data.toString());
      } catch {
        return;
      }
      if (parsed.type === type) {
        cleanup();
        resolve(parsed);
      }
    };
    const cleanup = () => {
      clearTimeout(timer);
      ws.off('message', handler);
    };
    ws.on('message', handler);
  });
}

function sendJson(ws, payload) {
  ws.send(JSON.stringify(payload));
}

// Join a live room and wait for the presence broadcast that confirms the join
// completed server-side (the socket is then registered for room broadcasts).
// This avoids a race where an action is sent before the joining socket is
// routable, which can drop the corresponding room event.
async function joinRoom(ws, room) {
  sendJson(ws, { type: 'live:presence', room, action: 'join' });
  return nextEvent(ws, 'live:presence');
}

beforeAll(async () => {
  const { default: supertest } = await import('supertest');
  request = supertest;
  const mod = await import('../src/index.js');
  app = mod.app;
  server = mod.server;
  prisma = (await import('../src/db.js')).default;
  if (!server.listening) {
    await new Promise((resolve) => server.listen(3999, resolve));
  }
});

afterAll(async () => {
  if (server.listening) {
    await new Promise((resolve) => server.close(resolve));
  }
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

function iso(hoursFromNow, extraMinutes = 0) {
  return new Date(Date.now() + hoursFromNow * 3600 * 1000 + extraMinutes * 60000).toISOString();
}

async function createStartedSession() {
  const teacherToken = await getToken('teacher@test.tn', 'teacher123');
  const created = await request(app)
    .post('/api/teacher/live')
    .set('Authorization', `Bearer ${teacherToken}`)
    .send({
      title: 'حصة تفاعلات حية',
      subject: 'الرياضيات',
      classId: 1,
      startsAt: iso(-1),
      endsAt: iso(1)
    });
  const startRes = await request(app)
    .post(`/api/teacher/live/${created.body.id}/start`)
    .set('Authorization', `Bearer ${teacherToken}`);
  return { session: startRes.body.session, teacherToken, startRes };
}

describe('live interactions (تفاعلات الحصة الحية — 5.2)', () => {
  it('يعرض دعم التفاعلات في معلومات المزوّد', async () => {
    const token = await getToken('teacher@test.tn', 'teacher123');
    const res = await request(app).get('/api/live/config').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.supportsInteractions).toEqual({ chat: true, raiseHand: true, screenShare: true });
  });

  it('الأستاذ يجدول ويبدأ حصة ثم يقرأ سجل الدردشة الفارغ', async () => {
    const { session } = await createStartedSession();
    const studentToken = await getToken('student@test.tn', 'student123');
    const res = await request(app)
      .get(`/api/student/live/${session.id}/chat`)
      .set('Authorization', `Bearer ${studentToken}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('تلميذ خارج القسم لا يستطيع قراءة دردشة حصة القسم', async () => {
    const { session } = await createStartedSession();
    const adminToken = await getToken('admin@education.tn', 'admin123');
    const ok = await request(app)
      .get(`/api/teacher/live/${session.id}/chat`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(ok.status).toBe(200);
    const other = await prisma.user.create({
      data: {
        firstName: 'غريب',
        lastName: 'عن القسم',
        email: 'outsider@test.tn',
        passwordHash: await bcrypt.hash('other123', 4),
        role: 'STUDENT',
        accountStatus: 'ACTIVE'
      }
    });
    await prisma.student.create({
      data: {
        userId: other.id,
        accountUserId: other.id,
        firstName: 'غريب',
        lastName: 'عن القسم',
        birthDate: new Date('2018-01-01'),
        cin: '99999999',
        gender: 'ذكر',
        level: 'السنة الأولى أساسي',
        schoolYear: '2026-2027'
      }
    });
    const outsiderToken = await getToken('outsider@test.tn', 'other123');
    const res = await request(app)
      .get(`/api/student/live/${session.id}/chat`)
      .set('Authorization', `Bearer ${outsiderToken}`);
    expect(res.status).toBe(403);
  });

  it('تلميذ يكتب في الدردشة الحية فيصل الأستاذ ويُحفظ في قاعدة البيانات', async () => {
    const { session } = await createStartedSession();
    const studentToken = await getToken('student@test.tn', 'student123');
    const teacherToken = await getToken('teacher@test.tn', 'teacher123');

    const teacherWs = await connectWs(teacherToken);
    const studentWs = await connectWs(studentToken);

    await joinRoom(teacherWs, session.roomName);
    await joinRoom(studentWs, session.roomName);

    const received = nextEvent(teacherWs, 'live:chat:new');
    sendJson(studentWs, { type: 'live:chat', room: session.roomName, body: 'أهلاً أستاذتي، عندي سؤال' });

    const evt = await received;
    expect(evt.room).toBe(session.roomName);
    expect(evt.message.body).toBe('أهلاً أستاذتي، عندي سؤال');
    expect(evt.message.sender.role).toBe('STUDENT');

    const history = await request(app)
      .get(`/api/student/live/${session.id}/chat`)
      .set('Authorization', `Bearer ${studentToken}`);
    expect(history.status).toBe(200);
    expect(history.body.length).toBe(1);
    expect(history.body[0].body).toBe('أهلاً أستاذتي، عندي سؤال');

    teacherWs.close();
    studentWs.close();
  });

  it('رسالة فارغة لا تُرسل ولا تُحفظ، والرسالة الطويلة تُقتطع', async () => {
    const { session } = await createStartedSession();
    const studentToken = await getToken('student@test.tn', 'student123');
    const studentWs = await connectWs(studentToken);
    await joinRoom(studentWs, session.roomName);
    sendJson(studentWs, { type: 'live:chat', room: session.roomName, body: '   ' });
    const received = nextEvent(studentWs, 'live:chat:new');
    sendJson(studentWs, { type: 'live:chat', room: session.roomName, body: 'x'.repeat(600) });
    const evt = await received;
    expect(evt.message.body.length).toBe(500);
    await new Promise((r) => setTimeout(r, 300));
    const messages = await prisma.liveChatMessage.findMany({ where: { sessionId: session.id } });
    expect(messages.length).toBe(1);
    expect(messages[0].body.length).toBe(500);
    studentWs.close();
  });

  it('تلميذ يرفع يده فتصل الحالة للأستاذ وتظهر في نقطة التفاعلات، ثم يخفضها الأستاذ', async () => {
    const { session } = await createStartedSession();
    const studentToken = await getToken('student@test.tn', 'student123');
    const teacherToken = await getToken('teacher@test.tn', 'teacher123');

    const teacherWs = await connectWs(teacherToken);
    const studentWs = await connectWs(studentToken);
    await joinRoom(teacherWs, session.roomName);
    await joinRoom(studentWs, session.roomName);

    const raised = nextEvent(teacherWs, 'live:raised-hands');
    sendJson(studentWs, { type: 'live:raise-hand', room: session.roomName, action: 'raise' });
    const evt = await raised;
    expect(evt.hands.length).toBe(1);
    expect(evt.hands[0].role).toBe('STUDENT');

    const interactions = await request(app)
      .get(`/api/teacher/live/${session.id}/interactions`)
      .set('Authorization', `Bearer ${teacherToken}`);
    expect(interactions.status).toBe(200);
    expect(interactions.body.raisedHands.length).toBe(1);

    const lowered = nextEvent(teacherWs, 'live:raised-hands');
    const lowerRes = await request(app)
      .post(`/api/teacher/live/${session.id}/hand/${evt.hands[0].userId}/lower`)
      .set('Authorization', `Bearer ${teacherToken}`);
    expect(lowerRes.status).toBe(200);
    const evt2 = await lowered;
    expect(evt2.hands.length).toBe(0);

    teacherWs.close();
    studentWs.close();
  });

  it('تلميذ يشارك شاشته فيراها الأستاذ في التفاعلات، ثم يوقفها الأستاذ', async () => {
    const { session } = await createStartedSession();
    const studentToken = await getToken('student@test.tn', 'student123');
    const teacherToken = await getToken('teacher@test.tn', 'teacher123');

    const teacherWs = await connectWs(teacherToken);
    const studentWs = await connectWs(studentToken);
    await joinRoom(teacherWs, session.roomName);
    await joinRoom(studentWs, session.roomName);

    const shareEvt = nextEvent(teacherWs, 'live:screen-share');
    sendJson(studentWs, { type: 'live:screen-share', room: session.roomName, action: 'start' });
    const evt = await shareEvt;
    expect(evt.shares.length).toBe(1);
    expect(evt.shares[0].role).toBe('STUDENT');

    const interactions = await request(app)
      .get(`/api/teacher/live/${session.id}/interactions`)
      .set('Authorization', `Bearer ${teacherToken}`);
    expect(interactions.body.screenShares.length).toBe(1);

    const stopped = nextEvent(teacherWs, 'live:screen-share');
    const stopRes = await request(app)
      .post(`/api/teacher/live/${session.id}/screen/${evt.shares[0].userId}/stop`)
      .set('Authorization', `Bearer ${teacherToken}`);
    expect(stopRes.status).toBe(200);
    const evt2 = await stopped;
    expect(evt2.shares.length).toBe(0);

    teacherWs.close();
    studentWs.close();
  });

  it('مغادرة التلميذ للغرفة تُنهي يده ومشاركته تلقائياً', async () => {
    const { session } = await createStartedSession();
    const studentToken = await getToken('student@test.tn', 'student123');
    const teacherToken = await getToken('teacher@test.tn', 'teacher123');

    const teacherWs = await connectWs(teacherToken);
    const studentWs = await connectWs(studentToken);
    await joinRoom(teacherWs, session.roomName);
    await joinRoom(studentWs, session.roomName);

    const raised = nextEvent(teacherWs, 'live:raised-hands');
    sendJson(studentWs, { type: 'live:raise-hand', room: session.roomName, action: 'raise' });
    await raised;

    const shareEvt = nextEvent(teacherWs, 'live:screen-share');
    sendJson(studentWs, { type: 'live:screen-share', room: session.roomName, action: 'start' });
    await shareEvt;

    const leftHands = nextEvent(teacherWs, 'live:raised-hands');
    const leftShares = nextEvent(teacherWs, 'live:screen-share');
    sendJson(studentWs, { type: 'live:presence', room: session.roomName, action: 'leave' });

    const handsEvt = await leftHands;
    const sharesEvt = await leftShares;
    expect(handsEvt.hands.length).toBe(0);
    expect(sharesEvt.shares.length).toBe(0);

    teacherWs.close();
    studentWs.close();
  });

  it('تلميذ خارج القسم لا يستطيع رفع يده أو كتابة رسالة في غرفة ليست من حصصه', async () => {
    const { session } = await createStartedSession();
    const other = await prisma.user.create({
      data: {
        firstName: 'غريب',
        lastName: 'آخر',
        email: 'outsider2@test.tn',
        passwordHash: await bcrypt.hash('other123', 4),
        role: 'STUDENT',
        accountStatus: 'ACTIVE'
      }
    });
    await prisma.student.create({
      data: {
        userId: other.id,
        accountUserId: other.id,
        firstName: 'غريب',
        lastName: 'آخر',
        birthDate: new Date('2018-01-01'),
        cin: '88888888',
        gender: 'ذكر',
        level: 'السنة الأولى أساسي',
        schoolYear: '2026-2027'
      }
    });
    const outsiderToken = await getToken('outsider2@test.tn', 'other123');
    const ws = await connectWs(outsiderToken);
    sendJson(ws, { type: 'live:presence', room: session.roomName, action: 'join' });
    const errorEvt = nextEvent(ws, 'live:chat:error');
    sendJson(ws, { type: 'live:chat', room: session.roomName, body: 'لا يجب أن تصل' });
    const err = await errorEvt;
    expect(err.error).toBe('لا يمكنك الكتابة في هذه الغرفة');
    ws.close();
  });

  it('تلميذ لا يستطيع الدردشة أو رفع اليد في حصة مجدولة لم تبدأ بعد', async () => {
    const teacherToken = await getToken('teacher@test.tn', 'teacher123');
    const created = await request(app)
      .post('/api/teacher/live')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({
        title: 'حصة لاحقة',
        subject: 'الرياضيات',
        classId: 1,
        startsAt: iso(1),
        endsAt: iso(2)
      });
    const roomName = created.body.roomName;

    const studentToken = await getToken('student@test.tn', 'student123');
    const ws = await connectWs(studentToken);

    const presenceError = nextEvent(ws, 'live:presence:error');
    sendJson(ws, { type: 'live:presence', room: roomName, action: 'join' });
    const presErr = await presenceError;
    expect(presErr.error).toBe('لا يمكنك الانضمام إلى هذه الغرفة');

    const chatError = nextEvent(ws, 'live:chat:error');
    sendJson(ws, { type: 'live:chat', room: roomName, body: 'رسالة قبل البث' });
    const chatErr = await chatError;
    expect(chatErr.error).toBe('لا يمكنك الكتابة في هذه الغرفة');

    const stored = await prisma.liveChatMessage.count({ where: { sessionId: created.body.id } });
    expect(stored).toBe(0);

    ws.close();
  });
});
