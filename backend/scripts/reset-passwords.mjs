// إعادة تعيين كلمات سر الحسابات التجريبية/الإدارية.
// التشغيل من Render Shell:  node scripts/reset-passwords.mjs
// آمن: يحدّث فقط المستخدمين الموجودين، ولا يمسح أي بيانات.
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const TEST_PW = 'qarn-zeft-7alib-2026!';
const SUPER_PW = 'Super-Owner-2026!';

const MAP = {
  'admin@education.tn': TEST_PW,
  'director@test.tn': TEST_PW,
  'teacher@test.tn': TEST_PW,
  'student@test.tn': TEST_PW,
  'parent@test.tn': TEST_PW,
  'explorer@test.tn': TEST_PW,
  'super@education.tn': SUPER_PW
};

async function main() {
  for (const [email, pw] of Object.entries(MAP)) {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      console.log(`SKIP  ${email} (غير موجود)`);
      continue;
    }
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: await bcrypt.hash(pw, 10) }
    });
    console.log(`OK    ${email}  ←  ${pw}`);
  }
  console.log('\nتمت إعادة التعيين. سجّل الدخول بالكلمات أعلاه.');
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
