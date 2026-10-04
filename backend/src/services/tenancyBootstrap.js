import { OFFICIAL_LEVELS } from '../curriculum/levels.js';

// العناوين الرسمية للأقسام تأتي من السجلّ الواحد curriculum/levels.js
// (كان هنا قائمة مستقلة من 10 مستويات ⇒ غير متسقة مع public/levels الذي فيه 13).
export { OFFICIAL_LEVELS };

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

// إحصاء تلاميذ بلا بيانات دخول — للعرض والتشخيص فقط.
// لا يكتب ولا يغيّر أي كلمة سر (المرحلة E): كلمة سر المستخدم ملكه، ولا يجوز
// لعملية إقلاع أن تولّد له واحدة دون أمر صريح من المدير.
export async function countStudentsWithoutCredentials(prisma) {
  return prisma.student.count({
    where: {
      accountUserId: { not: null },
      tempPassword: null,
      credentialsIssuedAt: null,
      account: { refreshTokens: { none: {} } }
    }
  });
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

/**
 * إقلاع الخادم: ينشئ الأقسام الناقصة ويزيل الطلبات المكرّرة فقط.
 * لا يمسّ بيانات الدخول إطلاقًا (المرحلة E) — الإصدار تم عبر
 * services/studentCredentials.js: من صفحة المدير، أو من أداة الإدارة
 * `npm run issue-credentials -- --class 33`، أو من موافقة طلب التسجيل.
 */
export async function runTenancyBootstrap(prisma) {
  const classes = await ensureClasses(prisma);
  const dupes = await dedupePendingRequests(prisma);
  if (classes || dupes) console.log(`tenancy bootstrap: +${classes} classes, ${dupes} duplicate requests removed`);
}
