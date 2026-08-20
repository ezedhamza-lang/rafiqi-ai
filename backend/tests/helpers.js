import prisma from '../src/db.js';
import bcrypt from 'bcryptjs';

export async function resetDatabase() {
  const tableNames = await prisma.$queryRaw`
    SELECT tablename FROM pg_tables WHERE schemaname='public'
  `;
  const tables = tableNames
    .map((t) => t.tablename)
    .filter((t) => t !== '_prisma_migrations');
  if (tables.length) {
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE "${tables.join('","')}" RESTART IDENTITY CASCADE`);
  }
}

export async function seedTestData() {
  const hash = (pw) => bcrypt.hash(pw, 4);

  const users = {};
  const demo = [
    { key: 'admin', firstName: 'مدير', lastName: 'المنصة', email: 'admin@education.tn', password: 'admin123', role: 'ADMIN' },
    { key: 'student', firstName: 'أحمد', lastName: 'التلميذ', email: 'student@test.tn', password: 'student123', role: 'STUDENT', accountStatus: 'ACTIVE' },
    { key: 'parent', firstName: 'محمد', lastName: 'الولي', email: 'parent@test.tn', password: 'parent123', role: 'PARENT' },
    { key: 'teacher', firstName: 'فاطمة', lastName: 'المعلمة', email: 'teacher@test.tn', password: 'teacher123', role: 'TEACHER' },
    { key: 'director', firstName: 'خالد', lastName: 'المدير', email: 'director@test.tn', password: 'director123', role: 'SCHOOL_DIRECTOR' },
    { key: 'super', firstName: 'نظامي', lastName: 'المنصة', email: 'super@education.tn', password: 'super123', role: 'SUPER_ADMIN' }
  ];

  for (const d of demo) {
    users[d.key] = await prisma.user.create({
      data: {
        firstName: d.firstName,
        lastName: d.lastName,
        email: d.email,
        passwordHash: await hash(d.password),
        role: d.role,
        accountStatus: d.accountStatus || 'ACTIVE'
      }
    });
  }

  const klass = await prisma.class.create({
    data: { name: 'قسم السنة الأولى أ', level: 'السنة الأولى أساسي', teacherId: users.teacher.id }
  });

  const student = await prisma.student.create({
    data: {
      userId: users.parent.id,
      accountUserId: users.student.id,
      classId: klass.id,
      firstName: 'أحمد',
      lastName: 'التلميذ',
      birthDate: new Date('2019-03-15'),
      cin: '00000000',
      gender: 'ذكر',
      level: 'السنة الأولى أساسي',
      schoolYear: '2026-2027'
    }
  });

  const sub = await prisma.subscription.create({
    data: {
      userId: users.student.id,
      type: 'STUDENT',
      plan: 'اشتراك تلميذ',
      schoolYear: '2026-2027',
      startDate: new Date('2026-09-01'),
      endDate: new Date('2027-06-30'),
      status: 'ACTIVE',
      amount: 147,
      studentId: student.id
    }
  });

  return { users, klass, student, sub };
}

export async function login(email, password) {
  const { app } = await import('../src/index.js');
  const request = (await import('supertest')).default;
  const res = await request(app).post('/api/auth/login').send({ email, password });
  return res;
}
