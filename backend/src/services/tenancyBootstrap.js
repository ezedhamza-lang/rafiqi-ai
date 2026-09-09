import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { notify } from './notify.js';

// العناوين الرسمية للأقسام من السنة الأولى ابتدائي إلى الرابعة ثانوي
export const OFFICIAL_LEVELS = [
  'السنة الأولى ابتدائي',
  'السنة الثانية ابتدائي',
  'السنة الثالثة ابتدائي',
  'السنة الرابعة ابتدائي',
  'السنة الخامسة ابتدائي',
  'السنة السادسة ابتدائي',
  'السنة الأولى ثانوي',
  'السنة الثانية ثانوي',
  'السنة الثالثة ثانوي',
  'السنة الرابعة ثانوي'
];

function easyPassword() {
  // رقم سري من 6 أرقام يسهل على الأسرة كتابته
  return String(100000 + crypto.randomInt(0, 900000));
}

async function ensureClasses(prisma) {
  const schools = await prisma.school.findMany({ select: { id: true } });
  let created = 0;
  for (const s of schools) {
    for (const level of OFFICIAL_LEVELS) {
      const exists = await prisma.class.findFirst({ where: { schoolId: s.id, level } });
      if (!exists) {
        await prisma.class.create({ data: { name: `${level} - أ`, level, schoolId: s.id } });
        created++;
      }
    }
  }
  return created;
}

async function ensureStudentCredentials(prisma) {
  // لكل طالب له حساب وليس لديه كلمة سر مؤقتة: أنشئ كلمة سهلة، اضبط حسابَه، خزّنها، وأخطر وليّه مرة واحدة.
  const students = await prisma.student.findMany({
    where: { accountUserId: { not: null }, tempPassword: null },
    include: { account: { select: { id: true, email: true } }, user: { select: { id: true, firstName: true, lastName: true } } }
  });
  let fixed = 0;
  for (const s of students) {
    if (!s.account) continue;
    const pw = easyPassword();
    await prisma.user.update({ where: { id: s.account.id }, data: { passwordHash: await bcrypt.hash(pw, 10) } });
    await prisma.student.update({ where: { id: s.id }, data: { tempPassword: pw } });
    if (s.user?.id && s.user.id !== s.account.id) {
      await notify([s.user.id], {
        type: 'CREDENTIALS',
        title: `بيانات دخول ابنك ${s.firstName} ${s.lastName}`,
        body: `البريد: ${s.account.email} — كلمة السر: ${pw}. ننصح بتغييرها بعد أول تسجيل دخول.`,
        link: '/parent'
      });
    }
    fixed++;
  }
  return fixed;
}

export async function runTenancyBootstrap(prisma) {
  const classes = await ensureClasses(prisma);
  const creds = await ensureStudentCredentials(prisma);
  if (classes || creds) console.log(`tenancy bootstrap: +${classes} classes, ${creds} student credential sets`);
}
