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

describe('review المرحلتين 1+2 — إصلاحات المراجعة (15-08-2026)', () => {
  describe('config.js — المتغيرات الإجبارية', () => {
    it('يرفض تحميل config.js عند غياب JWT_SECRET', async () => {
      const { spawnSync } = await import('child_process');
      const proc = spawnSync('node', ['--input-type=module', '-e', "import('./src/config.js')"], {
        cwd: process.cwd(),
        env: { ...process.env, JWT_SECRET: '', DATABASE_URL: 'postgresql://x:x@localhost:1/x' },
        encoding: 'utf8'
      });
      expect(proc.status).not.toBe(0);
      expect(proc.stderr || '').toContain('Missing required environment variable: JWT_SECRET');
    });
  });

  describe('admin.js — تحديث عنصر غير موجود', () => {
    it('يرجع 404 عند تحديث طلب تسجيل غير موجود', async () => {
      const token = await getToken('admin@education.tn', 'admin123');
      const res = await request(app)
        .put('/api/admin/registrations/999999')
        .set('Authorization', `Bearer ${token}`)
        .send({ status: 'VALIDATED' });
      expect(res.status).toBe(404);
      expect(res.body.error).toBe('طلب التسجيل غير موجود');
    });

    it('يرجع 404 عند تحديث طلب مساعدة غير موجود', async () => {
      const token = await getToken('admin@education.tn', 'admin123');
      const res = await request(app)
        .put('/api/admin/help-requests/999999')
        .set('Authorization', `Bearer ${token}`)
        .send({ status: 'RESOLVED' });
      expect(res.status).toBe(404);
      expect(res.body.error).toBe('طلب المساعدة غير موجود');
    });
  });

  describe('students.js — كشف بيانات مالية محدود الأدوار', () => {
    it('الأستاذ لا يرى اشتراكات التلاميذ المالية', async () => {
      const token = await getToken('teacher@test.tn', 'teacher123');
      const res = await request(app)
        .get('/api/students')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      for (const s of res.body) {
        expect(s.account).not.toHaveProperty('subscriptions');
      }
    });

    it('الولي يرى اشتراكات أبنائه', async () => {
      const token = await getToken('parent@test.tn', 'parent123');
      const res = await request(app)
        .get('/api/students')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.length).toBeGreaterThan(0);
      expect(res.body[0].account).toHaveProperty('subscriptions');
    });
  });

  describe('attendance.js — قيد قائمة القسم', () => {
    it('يرفض حفظ حضور لتلميذ غير مسجل في القسم', async () => {
      const token = await getToken('teacher@test.tn', 'teacher123');
      const prisma = (await import('../src/db.js')).default;
      const outsider = await prisma.user.create({
        data: {
          firstName: 'خارج',
          lastName: 'القسم',
          email: 'outside-att@test.tn',
          passwordHash: 'x',
          role: 'STUDENT',
          accountStatus: 'ACTIVE'
        }
      });
      const res = await request(app)
        .post('/api/teacher/attendance/save')
        .set('Authorization', `Bearer ${token}`)
        .send({ classId: 1, date: '2026-08-14', records: [{ studentId: outsider.id, present: false }] });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('بعض التلاميذ غير مسجلين في هذا القسم');
    });
  });

  describe('teacher.js — تسريب مفاتيح الإجابات و IDOR', () => {
    async function createQuiz(classId = 1) {
      const token = await getToken('teacher@test.tn', 'teacher123');
      const res = await request(app)
        .post('/api/teacher/quizzes')
        .set('Authorization', `Bearer ${token}`)
        .send({
          title: 'اختبار المراجعة',
          subject: 'MATH',
          classId,
          questions: [
            { id: 'q1', type: 'MCQ', prompt: 'ما هو 2+2؟', points: 2, options: ['3', '4', '5'], correctOption: '1' },
            { id: 'q2', type: 'TRUE_FALSE', prompt: 'الشمس تشرق.', points: 1, correctAnswer: 'TRUE' }
          ]
        });
      return { res, token };
    }

    it('قائمة اختبارات التلميذ لا تحتوي مفاتيح الإجابات', async () => {
      const { res: created } = await createQuiz();
      expect(created.status).toBe(201);
      const studentToken = await getToken('student@test.tn', 'student123');
      const res = await request(app)
        .get('/api/teacher/student/quizzes')
        .set('Authorization', `Bearer ${studentToken}`);
      expect(res.status).toBe(200);
      expect(res.body.length).toBeGreaterThan(0);
      for (const q of res.body) {
        for (const question of q.questions) {
          expect(question).not.toHaveProperty('correctOption');
          expect(question).not.toHaveProperty('correctAnswer');
          expect(question).not.toHaveProperty('orderItems');
        }
      }
    });

    it('تفاصيل اختبار للتلميذ لا تحتوي مفاتيح الإجابات', async () => {
      const { res: created } = await createQuiz();
      const studentToken = await getToken('student@test.tn', 'student123');
      const res = await request(app)
        .get(`/api/teacher/student/quizzes/${created.body.id}`)
        .set('Authorization', `Bearer ${studentToken}`);
      expect(res.status).toBe(200);
      for (const question of res.body.questions) {
        expect(question).not.toHaveProperty('correctOption');
        expect(question).not.toHaveProperty('correctAnswer');
      }
    });

    it('تلميذ لا يصل إلى اختبار قسم آخر (IDOR)', async () => {
      const prisma = (await import('../src/db.js')).default;
      const otherClass = await prisma.class.create({
        data: { name: 'قسم آخر', level: 'السنة الثانية أساسي', teacherId: 4 }
      });
      const { res: created } = await createQuiz(otherClass.id);
      const studentToken = await getToken('student@test.tn', 'student123');
      const res = await request(app)
        .get(`/api/teacher/student/quizzes/${created.body.id}`)
        .set('Authorization', `Bearer ${studentToken}`);
      expect(res.status).toBe(404);
    });

    it('إنشاء اختبار بدون أسئلة يعيد 400 برسالة واضحة', async () => {
      const token = await getToken('teacher@test.tn', 'teacher123');
      const res = await request(app)
        .post('/api/teacher/quizzes')
        .set('Authorization', `Bearer ${token}`)
        .send({ title: 'بدون أسئلة', subject: 'MATH', questions: [] });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('يجب إضافة سؤال واحد على الأقل');
    });
  });
});
