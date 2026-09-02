import prisma from '../src/db.js';

// إنشاء/ضمان المدرسة الافتراضية وربط المستخدمين والأقسام بها
const school = await prisma.school.upsert({
  where: { code: 'SCH-001' },
  update: {},
  create: { name: 'المدرسة النموذجية', code: 'SCH-001', status: 'ACTIVE' }
});
await prisma.user.updateMany({ where: { schoolId: null, role: { not: 'SUPER_ADMIN' } }, data: { schoolId: school.id } });
await prisma.class.updateMany({ where: { schoolId: null }, data: { schoolId: school.id } });
console.log('school:', school.name, '| id:', school.id);
console.log('users linked:', await prisma.user.count({ where: { schoolId: school.id } }));
console.log('classes linked:', await prisma.class.count({ where: { schoolId: school.id } }));
await prisma.$disconnect();