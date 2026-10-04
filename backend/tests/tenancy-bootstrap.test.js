import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import prisma from '../src/db.js';
import bcrypt from 'bcryptjs';
import { runTenancyBootstrap, countStudentsWithoutCredentials } from '../src/services/tenancyBootstrap.js';

// المرحلة E: الإقلاع لا يلمس بيانات الدخول إطلاقًا.
// السبب: Render المجاني = إقلاع بارد كل دقائق؛ أي كتابة تلقائية لكلمة سر تعني
// أن كلمة سر المستخدم (أو بطاقته المطبوعة) قد تتبدّل بلا سبب مرئي.
// الإصدار صار قرارًا صريحًا: صفحة المدير · أداة issue-credentials · موافقة الطلب.
describe('tenancyBootstrap — الإقلاع لا يكتب كلمة سر (المرحلة E)', () => {
  const hash = (pw) => bcrypt.hash(pw, 4);

  beforeAll(async () => {
    await prisma.school.create({ data: { code: 'SCH-BOOT', name: 'مدرسة البوتستراب' } });
  });

  afterAll(async () => {
    await prisma.class.deleteMany({ where: { name: { startsWith: 'قسم بوت' } } });
    await prisma.user.deleteMany({ where: { OR: [{ email: { startsWith: 'boot-' } }, { email: { startsWith: 'parent-boot-' } }] } });
    await prisma.school.deleteMany({ where: { code: 'SCH-BOOT' } });
  });

  beforeEach(async () => {
    await prisma.student.deleteMany({ where: { lastName: 'بوت' } });
    await prisma.class.deleteMany({ where: { name: { startsWith: 'قسم بوت' } } });
    await prisma.user.deleteMany({ where: { OR: [{ email: { startsWith: 'boot-' } }, { email: { startsWith: 'parent-boot-' } }] } });
  });

  async function makeStudent({ email, password, withRefreshToken, tempPassword = null }) {
    const parent = await prisma.user.create({
      data: {
        firstName: 'ولي',
        lastName: 'تجريبي',
        email: `parent-${email}`,
        passwordHash: await hash('parent1234'),
        role: 'PARENT',
        accountStatus: 'ACTIVE',
        schoolId: (await prisma.school.findUnique({ where: { code: 'SCH-BOOT' } })).id
      }
    });
    const account = await prisma.user.create({
      data: {
        firstName: 'تلميذ',
        lastName: 'بوت',
        email,
        passwordHash: await hash(password),
        role: 'STUDENT',
        accountStatus: 'ACTIVE',
        schoolId: (await prisma.school.findUnique({ where: { code: 'SCH-BOOT' } })).id
      }
    });
    const klass = await prisma.class.create({
      data: { name: `قسم بوت ${email}`, level: 'السنة الثانية ابتدائي', schoolId: account.schoolId }
    });
    const student = await prisma.student.create({
      data: {
        userId: parent.id,
        accountUserId: account.id,
        classId: klass.id,
        firstName: 'تلميذ',
        lastName: 'بوت',
        birthDate: new Date('2018-05-05'),
        level: 'السنة الثانية ابتدائي',
        schoolYear: '2026-2027',
        tempPassword
      }
    });
    if (withRefreshToken) {
      // أول دخول ⇒ يُصدر رمز تجديد (دليل أن التلميذ تحكّم في كلمة سره)
      await prisma.refreshToken.create({
        data: { tokenHash: `rt-hash-${email}`, userId: account.id, expiresAt: new Date(Date.now() + 86400000) }
      });
    }
    return { account, student };
  }

  it('لا يلمس كلمة سر تلميذ غيّرها (لديه رمز تجديد) عبر إعادتَي تشغيل متتاليتين', async () => {
    const { account, student } = await makeStudent({
      email: 'boot-changed@classe.tn',
      password: '00000001',
      withRefreshToken: true
    });

    await runTenancyBootstrap(prisma);
    await runTenancyBootstrap(prisma);

    const afterAccount = await prisma.user.findUnique({ where: { id: account.id } });
    const afterStudent = await prisma.student.findUnique({ where: { id: student.id } });
    expect(await bcrypt.compare('00000001', afterAccount.passwordHash)).toBe(true);
    expect(afterStudent.tempPassword).toBeNull();
  });

  it('لا يكتب كلمة سر لمصغّر حسابه لم يُستخدم قط (بلا رمز تجديد)', async () => {
    const { account, student } = await makeStudent({
      email: 'boot-fresh@classe.tn',
      password: 'قيمة-قديمة',
      withRefreshToken: false
    });

    await runTenancyBootstrap(prisma);
    await runTenancyBootstrap(prisma);

    const afterAccount = await prisma.user.findUnique({ where: { id: account.id } });
    const afterStudent = await prisma.student.findUnique({ where: { id: student.id } });
    expect(await bcrypt.compare('قيمة-قديمة', afterAccount.passwordHash)).toBe(true);
    expect(afterStudent.tempPassword).toBeNull();
    // ويظلّ محسوبًا ضمن «بلا بيانات دخول» ليصدرها المدير متى شاء
    expect(await countStudentsWithoutCredentials(prisma)).toBeGreaterThan(0);
  });

  it('الإقلاع ينشئ الأقسام الناقصة فقط (لا يمسّ شيئًا آخر)', async () => {
    await runTenancyBootstrap(prisma);
    const created = await prisma.class.findFirst({ where: { schoolId: (await prisma.school.findUnique({ where: { code: 'SCH-BOOT' } })).id, level: 'السنة الأولى ابتدائي' } });
    expect(created).toBeTruthy();
  });

  it('لا يمسّ التلميذ الذي ما زال يحمل كلمة سر مؤقتة من موافقة المدير', async () => {
    const { account, student } = await makeStudent({
      email: 'boot-pending@classe.tn',
      password: '628998',
      withRefreshToken: false,
      tempPassword: '628998'
    });

    await runTenancyBootstrap(prisma);

    const afterAccount = await prisma.user.findUnique({ where: { id: account.id } });
    const afterStudent = await prisma.student.findUnique({ where: { id: student.id } });
    expect(afterStudent.tempPassword).toBe('628998');
    expect(await bcrypt.compare('628998', afterAccount.passwordHash)).toBe(true);
  });
});