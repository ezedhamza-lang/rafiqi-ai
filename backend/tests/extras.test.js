import { beforeAll, afterAll, describe, expect, test } from 'vitest';
import { resetDatabase, seedTestData, login } from './helpers.js';

let tokens = {};
let data = {};

beforeAll(async () => {
  await resetDatabase();
  data = await seedTestData();
  const res = await login('student@test.tn', 'student123');
  tokens.student = res.body.token;
  const tres = await login('teacher@test.tn', 'teacher123');
  tokens.teacher = tres.body.token;
});

afterAll(async () => {
  const prisma = (await import('../src/db.js')).default;
  await prisma.$disconnect();
});

describe('بطاقات المراجعة', () => {
  test('توليد بطاقات من دروس الرياضيات السنة الأولى', async () => {
    const { app } = await import('../src/index.js');
    const request = (await import('supertest')).default;
    const res = await request(app)
      .get('/api/student/flashcards?gradeId=year1&subjectId=math')
      .set('Authorization', `Bearer ${tokens.student}`);
    expect(res.status).toBe(200);
    expect(res.body.total).toBeGreaterThan(0);
    expect(res.body.cards[0]).toHaveProperty('front');
    expect(res.body.cards[0]).toHaveProperty('back');
    expect(res.body.cards[0].back.length).toBeGreaterThan(0);
  });

  test('يرفض البطاقات دون معرّفي السنة والمادة', async () => {
    const { app } = await import('../src/index.js');
    const request = (await import('supertest')).default;
    const res = await request(app).get('/api/student/flashcards').set('Authorization', `Bearer ${tokens.student}`);
    expect(res.status).toBe(400);
  });
});

describe('تقييد المحتوى بمستوى التلميذ', () => {
  test('تلميذ س1 يرى دروسه فقط ويُمنع من مستوى آخر (بطاقات + تكيّف)', async () => {
    const { app } = await import('../src/index.js');
    const request = (await import('supertest')).default;
    const auth = { Authorization: `Bearer ${tokens.student}` };

    const mine = await request(app)
      .get('/api/student/flashcards?gradeId=year1&subjectId=math')
      .set(auth);
    expect(mine.status).toBe(200);
    expect(mine.body.gradeId).toBe('year1');

    const forbidden = await request(app)
      .get('/api/student/flashcards?gradeId=year3&subjectId=math')
      .set(auth);
    expect(forbidden.status).toBe(403);

    const session = await request(app)
      .get('/api/student/adaptive/session?gradeId=year3&subjectId=math')
      .set(auth);
    expect(session.status).toBe(403);

    const ownSession = await request(app)
      .get('/api/student/adaptive/session?gradeId=year1&subjectId=math&limit=2')
      .set(auth);
    expect(ownSession.status).toBe(200);

    const profile = await request(app).get('/api/student/profile').set(auth);
    expect(profile.status).toBe(200);
    expect(profile.body.gradeId).toBe('year1');
  });
});

describe('تحدي اليوم', () => {
  test('يعيد أهداف التحدي المحسوبة من السجلات', async () => {
    const { app } = await import('../src/index.js');
    const request = (await import('supertest')).default;
    const res = await request(app).get('/api/student/challenge/today').set('Authorization', `Bearer ${tokens.student}`);
    expect(res.status).toBe(200);
    expect(res.body.goals.length).toBe(3);
    expect(typeof res.body.completed).toBe('boolean');
  });
});

describe('روتين اليوم', () => {
  test('يعيد الواجبات المستحقة والمراجعات والدرس المقترح والتحدي', async () => {
    const { app } = await import('../src/index.js');
    const request = (await import('supertest')).default;
    const res = await request(app).get('/api/student/daily-routine').set('Authorization', `Bearer ${tokens.student}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.pendingAssignments)).toBe(true);
    expect(typeof res.body.dueReviews).toBe('number');
    expect(res.body.challenge).toBeTruthy();
  });
});

describe('دفتر درجات الأستاذ', () => {
  test('يعرض صفوف تلاميذ القسم والمعدلات', async () => {
    const { app } = await import('../src/index.js');
    const request = (await import('supertest')).default;
    const res = await request(app)
      .get(`/api/teacher/gradebook?classId=${data.klass.id}`)
      .set('Authorization', `Bearer ${tokens.teacher}`);
    expect(res.status).toBe(200);
    expect(res.body.studentsCount).toBe(1);
    expect(res.body.rows.length).toBe(1);
    expect(res.body.rows[0]).toHaveProperty('average');
  });

  test('يرفض دفتر درجات قسم ليس للأستاذ', async () => {
    const prisma = (await import('../src/db.js')).default;
    const other = await prisma.class.create({ data: { name: 'قسم آخر', level: 'السنة الثانية' } });
    const { app } = await import('../src/index.js');
    const request = (await import('supertest')).default;
    const res = await request(app)
      .get(`/api/teacher/gradebook?classId=${other.id}`)
      .set('Authorization', `Bearer ${tokens.teacher}`);
    expect(res.status).toBe(403);
  });
});

describe('ملاحظات الولي', () => {
  test('الولي يرسل ملاحظة لأستاذ ابنه ويصل الأستاذ ويرد', async () => {
    const { app } = await import('../src/index.js');
    const request = (await import('supertest')).default;
    const pres = await login('parent@test.tn', 'parent123');
    const teachers = await request(app)
      .get('/api/parent/notes/teachers')
      .set('Authorization', `Bearer ${pres.body.token}`);
    expect(teachers.status).toBe(200);
    expect(teachers.body.length).toBe(1);
    expect(teachers.body[0].teacherId).toBe(data.users.teacher.id);

    const created = await request(app)
      .post('/api/parent/notes')
      .set('Authorization', `Bearer ${pres.body.token}`)
      .send({ studentId: data.users.student.id, teacherId: data.users.teacher.id, content: 'ابني يحتاج متابعة في القراءة' });
    expect(created.status).toBe(201);

    const list = await request(app).get('/api/parent/notes').set('Authorization', `Bearer ${pres.body.token}`);
    expect(list.body.length).toBe(1);
    expect(list.body[0].content).toContain('متابعة');

    const tlist = await request(app).get('/api/teacher/notes').set('Authorization', `Bearer ${tokens.teacher}`);
    expect(tlist.body.length).toBe(1);

    const reply = await request(app)
      .post(`/api/teacher/notes/${created.body.id}/reply`)
      .set('Authorization', `Bearer ${tokens.teacher}`)
      .send({ reply: 'سنرافقه في الحصة القادمة' });
    expect(reply.status).toBe(200);

    const after = await request(app).get('/api/parent/notes').set('Authorization', `Bearer ${pres.body.token}`);
    expect(after.body[0].reply).toContain('سنرافقه');
  });

  test('يرفض ملاحظة قصيرة', async () => {
    const { app } = await import('../src/index.js');
    const request = (await import('supertest')).default;
    const pres = await login('parent@test.tn', 'parent123');
    const res = await request(app)
      .post('/api/parent/notes')
      .set('Authorization', `Bearer ${pres.body.token}`)
      .send({ studentId: data.users.student.id, teacherId: data.users.teacher.id, content: 'لا' });
    expect(res.status).toBe(400);
  });
});