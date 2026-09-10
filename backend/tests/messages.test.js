import { beforeAll, afterAll, beforeEach, describe, it, expect } from 'vitest';
import { WebSocket } from 'ws';
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

async function createUnrelatedTeacher() {
  const bcrypt = await import('bcryptjs');
  return prisma.user.create({
    data: {
      firstName: 'سمير',
      lastName: 'الأستاذ',
      email: 'other-teacher@test.tn',
      passwordHash: await bcrypt.hash('teacher123', 4),
      role: 'TEACHER'
    }
  });
}

describe('messages (المرحلة 3.3 — المحادثة الفورية ولي ↔ أستاذ)', () => {
  it('يسمح للولي بمراسلة معلم ابنه عبر REST', async () => {
    const parentToken = await getToken('parent@test.tn', 'parent123');
    const teacher = await prisma.user.findFirst({ where: { role: 'TEACHER' } });
    const res = await request(app)
      .post('/api/messages/messages')
      .set('Authorization', `Bearer ${parentToken}`)
      .send({ recipientId: teacher.id, body: 'أريد متابعة مستوى ابني' });
    expect(res.status).toBe(201);
    expect(res.body.recipientId).toBe(teacher.id);
  });

  it('يسمح للأستاذ بمراسلة ولي تلميذه عبر REST', async () => {
    const teacherToken = await getToken('teacher@test.tn', 'teacher123');
    const parent = await prisma.user.findFirst({ where: { role: 'PARENT' } });
    const res = await request(app)
      .post('/api/messages/messages')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ recipientId: parent.id, body: 'السلامة، ابنكم ممتاز في الرياضيات' });
    expect(res.status).toBe(201);
  });

  it('يمنع الولي من مراسلة أستاذ ليس معلم ابنه', async () => {
    const parentToken = await getToken('parent@test.tn', 'parent123');
    const other = await createUnrelatedTeacher();
    const res = await request(app)
      .post('/api/messages/messages')
      .set('Authorization', `Bearer ${parentToken}`)
      .send({ recipientId: other.id, body: 'مرحبا' });
    expect(res.status).toBe(403);
  });

  it('يمنع الأستاذ من مراسلة ولي ليس من أولياء تلاميذه', async () => {
    const teacherToken = await getToken('teacher@test.tn', 'teacher123');
    const other = await createUnrelatedTeacher();
    const bcrypt = await import('bcryptjs');
    const strangerParent = await prisma.user.create({
      data: {
        firstName: 'غريب',
        lastName: 'ولي',
        email: 'stranger@test.tn',
        passwordHash: await bcrypt.hash('parent123', 4),
        role: 'PARENT'
      }
    });
    const res = await request(app)
      .post('/api/messages/messages')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ recipientId: strangerParent.id, body: 'مرحبا' });
    expect(res.status).toBe(403);
    expect(other.id).not.toBe(strangerParent.id);
  });

  it('يبعث REST رسالة ويستقبلها الأستاذ لحظيا عبر WebSocket', async () => {
    const parentToken = await getToken('parent@test.tn', 'parent123');
    const teacher = await prisma.user.findFirst({ where: { role: 'TEACHER' } });
    const teacherToken = await getToken('teacher@test.tn', 'teacher123');

    const teacherWs = await connectWs(teacherToken);
    const eventPromise = nextEvent(teacherWs, 'message:new');

    const res = await request(app)
      .post('/api/messages/messages')
      .set('Authorization', `Bearer ${parentToken}`)
      .send({ recipientId: teacher.id, body: 'رسالة لحظية من الولي' });
    expect(res.status).toBe(201);

    const evt = await eventPromise;
    expect(evt.message.body).toBe('رسالة لحظية من الولي');
    expect(evt.message.senderId).toBe(res.body.senderId);
    expect(evt.message.recipientId).toBe(teacher.id);
    teacherWs.close();
  });

  it('يرسل الأستاذ عبر WebSocket فيستقبلها الولي وتُحفظ في قاعدة البيانات', async () => {
    const parent = await prisma.user.findFirst({ where: { role: 'PARENT' } });
    const teacherToken = await getToken('teacher@test.tn', 'teacher123');
    const parentToken = await getToken('parent@test.tn', 'parent123');

    const parentWs = await connectWs(parentToken);
    const eventPromise = nextEvent(parentWs, 'message:new');
    const teacherWs = await connectWs(teacherToken);
    teacherWs.send(
      JSON.stringify({ type: 'message:send', recipientId: parent.id, body: 'رد لحظي من الأستاذ' })
    );

    const evt = await eventPromise;
    expect(evt.message.body).toBe('رد لحظي من الأستاذ');
    expect(evt.message.recipientId).toBe(parent.id);

    const stored = await prisma.message.findFirst({ where: { body: 'رد لحظي من الأستاذ' } });
    expect(stored).not.toBeNull();
    expect(stored.recipientId).toBe(parent.id);

    const unread = await request(app)
      .get('/api/messages/unread-count')
      .set('Authorization', `Bearer ${parentToken}`);
    expect(unread.body.count).toBe(1);

    parentWs.close();
    teacherWs.close();
  });

  it('يبث حدث الكتابة typing إلى الطرف الآخر', async () => {
    const parent = await prisma.user.findFirst({ where: { role: 'PARENT' } });
    const parentToken = await getToken('parent@test.tn', 'parent123');
    const teacherToken = await getToken('teacher@test.tn', 'teacher123');

    const parentWs = await connectWs(parentToken);
    const typingPromise = nextEvent(parentWs, 'typing');

    const teacherWs = await connectWs(teacherToken);
    teacherWs.send(JSON.stringify({ type: 'typing', recipientId: parent.id, active: true }));

    const evt = await typingPromise;
    expect(evt.from).toBe((await prisma.user.findFirst({ where: { role: 'TEACHER' } })).id);
    expect(evt.active).toBe(true);

    parentWs.close();
    teacherWs.close();
  });

  it('عند فتح الولي للمحادثة تصل إشارة قراءة للأستاذ وتُحدَّث العدادات', async () => {
    const parent = await prisma.user.findFirst({ where: { role: 'PARENT' } });
    const teacher = await prisma.user.findFirst({ where: { role: 'TEACHER' } });
    const teacherToken = await getToken('teacher@test.tn', 'teacher123');
    const parentToken = await getToken('parent@test.tn', 'parent123');

    await request(app)
      .post('/api/messages/messages')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ recipientId: parent.id, body: 'رسالة قبل القراءة' });

    let parentUnread = await request(app)
      .get('/api/messages/unread-count')
      .set('Authorization', `Bearer ${parentToken}`);
    expect(parentUnread.body.count).toBe(1);

    const teacherWs = await connectWs(teacherToken);
    const readPromise = nextEvent(teacherWs, 'message:read');

    const thread = await request(app)
      .get(`/api/messages/messages/${teacher.id}`)
      .set('Authorization', `Bearer ${parentToken}`);
    expect(thread.status).toBe(200);
    expect(thread.body).toHaveLength(1);

    const readEvt = await readPromise;
    expect(readEvt.readerId).toBe(parent.id);

    parentUnread = await request(app)
      .get('/api/messages/unread-count')
      .set('Authorization', `Bearer ${parentToken}`);
    expect(parentUnread.body.count).toBe(0);

    const stored = await prisma.message.findFirst({ where: { recipientId: parent.id } });
    expect(stored.readAt).not.toBeNull();

    teacherWs.close();
  });

  it('يجلب الولي قائمة معلمي أبنائه فقط كمرسلين محتملين', async () => {
    const parentToken = await getToken('parent@test.tn', 'parent123');
    await createUnrelatedTeacher();
    const res = await request(app)
      .get('/api/messages/recipients')
      .set('Authorization', `Bearer ${parentToken}`);
    expect(res.status).toBe(200);
    const teachers = res.body.filter((u) => u.role === 'TEACHER');
    expect(teachers).toHaveLength(1);
    expect(teachers[0].email).toBe('teacher@test.tn');
  });

  it('يجلب الأستاذ أولياء تلاميذه فقط كمرسلين محتملين', async () => {
    const teacherToken = await getToken('teacher@test.tn', 'teacher123');
    const bcrypt = await import('bcryptjs');
    await prisma.user.create({
      data: {
        firstName: 'غريب',
        lastName: 'ولي',
        email: 'stranger@test.tn',
        passwordHash: await bcrypt.hash('parent123', 4),
        role: 'PARENT'
      }
    });
    const res = await request(app)
      .get('/api/messages/recipients')
      .set('Authorization', `Bearer ${teacherToken}`);
    expect(res.status).toBe(200);
    const parents = res.body.filter((u) => u.role === 'PARENT');
    expect(parents).toHaveLength(1);
    expect(parents[0].email).toBe('parent@test.tn');
  });
});
