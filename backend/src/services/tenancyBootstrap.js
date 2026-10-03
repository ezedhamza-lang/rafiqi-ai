import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { notify } from './notify.js';
import { OFFICIAL_LEVELS } from '../curriculum/levels.js';

// العناوين الرسمية للأقسام تأتي من السجلّ الواحد curriculum/levels.js
// (كان هنا قائمة مستقلة من 10 مستويات ⇒ غير متسقة مع public/levels الذي فيه 13).
export { OFFICIAL_LEVELS };

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
  // لكل طالب له حساب وليس لديه كلمة سر مؤقتة ولم يدخل بحسابه إطلاقًا:
  // أنشئ كلمة سهلة، اضبط حسابَه، خزّنها، وأخطر وليّه مرة واحدة.
  //
  // حارس أساسي (إصلاح عطل قاتل): التلميذ الذي غيّر كلمة سره بنفسه لا بد أن يحتفظ بها.
  // دليل الدخول = وجود رمز تجديد واحد على الأقل (يُصدر عند أول دخول).
  // بدون هذا الحارس كان كل إقلاع خادم (Render free = إقلاع بارد كل ~15 دقيقة)
  // يعيد كتابة كلمة سر كل تلميذ غيّرها بقيمة عشوائية ⇒ حسابات التلاميذ تُبطَل بلا سبب.
  const students = await prisma.student.findMany({
    where: {
      accountUserId: { not: null },
      tempPassword: null,
      account: { refreshTokens: { none: {} } }
    },
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

async function dedupePendingRequests(prisma) {
  // يدمج الطلبات المكرّرة المعلّقة (نفس الولي+الاسم+المستوى+السنة): يُبقي الأقدم ويحذف التوأم.
  const pend = await prisma.subscriptionRequest.findMany({
    where: { status: 'PENDING_APPROVAL' },
    orderBy: { createdAt: 'asc' }
  });
  const seen = new Map();
  const toDelete = [];
  for (const r of pend) {
    const key = `${r.parentId}|${r.firstName.trim()}|${r.lastName.trim()}|${r.level}|${r.schoolYear}`;
    if (seen.has(key)) toDelete.push(r.id);
    else seen.set(key, r.id);
  }
  if (toDelete.length) await prisma.subscriptionRequest.deleteMany({ where: { id: { in: toDelete } } });
  return toDelete.length;
}

export async function runTenancyBootstrap(prisma) {
  const classes = await ensureClasses(prisma);
  const creds = await ensureStudentCredentials(prisma);
  const dupes = await dedupePendingRequests(prisma);
  if (classes || creds || dupes) console.log(`tenancy bootstrap: +${classes} classes, ${creds} cred sets, ${dupes} duplicate requests removed`);
}
