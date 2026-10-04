// أداة إصدار بيانات دخول التلاميذ (المرحلة E).
//
// لماذا أداة منفصلة؟ كان الخادم — عند كل إقلاع — يكتب كلمة سر عشوائية لكل
// تلميذ لا يجد «دليل دخول». على Render المجاني (إقلاع بارد كل دقائق) هذا يعني
// أن كلمة السر قد تتبدّل بلا سبب مرئي. الآن:
//
//   • الإقلاع لا يكتب كلمة سر أبدًا (tenancyBootstrap) — فقط ينشئ الأقسام الناقصة.
//   • الإصدار قرار صريح: من صفحة المدير (بطاقات الدخول)، أو من هذه الأداة.
//
// الاستعمال (لا يُضبط أي متغيّر بيئة من تلقاءه):
//   npm run issue-credentials -- --list --class 33
//   npm run issue-credentials -- --class 33                    ← لمن لا بيانات له
//   npm run issue-credentials -- --class 33 --only-missing=false --password 11223344
//   npm run issue-credentials -- --student 88 --mode temporary
//
// الخيارات:
//   --class <id>          قسم واحد (مطلوب مع --list أو الإصدار الجماعي)
//   --student <id>        تلميذ واحد (يغني عن --class)
//   --mode card|temporary البطاقة دائمة أم مؤقتة (افتراضي card)
//   --password <text>     كلمة سر واحدة لكل من يشملهم الأمر (6 أحرف فأكثر)
//   --only-missing        (افتراضي true) لا تكتب فوق كلمة سر حيّة؛ --only-missing=false لإعادة الكل
//   --list                عرض المستحقّين فقط بلا كتابة
//   --dry-run             عرض ما سيحدث بلا كتابة
//   --school <id>         حصر 학교 (للتشغيل على الإنتاج بحذر)
import prisma from '../db.js';
import { issueStudentCredentials } from '../services/studentCredentials.js';
import { countStudentsWithoutCredentials } from '../services/tenancyBootstrap.js';

function parseArgs(argv) {
  const out = { onlyMissing: true, list: false, dryRun: false, mode: 'card' };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => argv[++i];
    if (a === '--class') out.classId = Number(next());
    else if (a === '--student') out.studentId = Number(next());
    else if (a === '--school') out.schoolId = Number(next());
    else if (a === '--mode') out.mode = next();
    else if (a === '--password') out.password = next();
    else if (a === '--only-missing') out.onlyMissing = next() !== 'false';
    else if (a === '--list') out.list = true;
    else if (a === '--dry-run') out.dryRun = true;
    else if (a === '--help' || a === '-h') out.help = true;
    else throw new Error(`خيار غير معروف: ${a}`);
  }
  return out;
}

const HELP = `إصدار بيانات دخول التلاميذ

  --class <id>          قسم واحد
  --student <id>        تلميذ واحد
  --mode card|temporary بطاقة دائمة (افتراضي) أو مؤقتة (تغيير عند أول دخول)
  --password <text>     كلمة سر واحدة للجميع (6 أحرف فأكثر)
  --only-missing=false  إعادة الإصدار للجميع (افتراضي: لمن لا بيانات له فقط)
  --list                عرض المستحقّين بلا كتابة
  --dry-run             عرض ما سيحدث بلا كتابة
  --school <id>         حصر مدرسة واحدة`;

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || (!args.classId && !args.studentId && !args.list)) {
    console.log(HELP);
    process.exit(args.help ? 0 : 1);
  }
  if (!['card', 'temporary'].includes(args.mode)) {
    console.error('نوع غير معروف. استعمل card أو temporary');
    process.exit(1);
  }

  const rows = [];
  if (args.studentId) {
    const s = await prisma.student.findFirst({
      where: { id: args.studentId, ...(args.schoolId ? { class: { schoolId: args.schoolId } } : {}) },
      include: { account: { select: { id: true, email: true, schoolId: true } }, class: { select: { name: true, schoolId: true } } }
    });
    if (!s) throw new Error('التلميذ غير موجود');
    if (!s.account) throw new Error('هذا التلميذ ليس له حساب دخول بعد');
    rows.push(s);
  } else {
    const klass = await prisma.class.findFirst({
      where: { id: args.classId, ...(args.schoolId ? { schoolId: args.schoolId } : {}) },
      select: { id: true, name: true, level: true, schoolYear: true }
    });
    if (!klass) throw new Error('القسم غير موجود');
    const students = await prisma.student.findMany({
      where: { classId: klass.id, accountUserId: { not: null } },
      include: { account: { select: { id: true, email: true, schoolId: true } }, class: { select: { name: true, schoolId: true } } }
    });
    for (const s of students) {
      if (args.onlyMissing && s.credentialsIssuedAt) continue;
      rows.push(s);
    }
    if (rows.length) rows[0].__class = klass;
  }

  console.log(`المستحقّون: ${rows.length}`);
  if (!rows.length) {
    const pending = await countStudentsWithoutCredentials(prisma);
    console.log(`لا أحد مستحقّ. تلاميذ بلا بيانات دخول في القاعدة كلها: ${pending}`);
    await prisma.$disconnect();
    return;
  }

  if (args.list) {
    for (const s of rows) {
      console.log(`  #${s.id} ${s.firstName} ${s.lastName}  ${s.account.email}  [${s.class?.name || '—'}]`);
    }
    await prisma.$disconnect();
    return;
  }

  const cards = [];
  for (const s of rows) {
    if (args.dryRun) {
      console.log(`  [dry-run] سأصدر بطاقة لـ ${s.firstName} ${s.lastName} (${s.account.email})`);
      continue;
    }
    const card = await issueStudentCredentials(
      prisma,
      {
        studentId: s.id,
        accountId: s.account.id,
        email: s.account.email,
        firstName: s.firstName,
        lastName: s.lastName,
        className: s.class?.name ?? null,
        level: s.level,
        schoolYear: s.schoolYear
      },
      { password: args.password, mode: args.mode }
    );
    cards.push(card);
    console.log(`  ${card.firstName} ${card.lastName}  ${card.email}  ⇒  ${card.password}`);
  }

  console.log(`\nصدرت ${cards.length} بطاقة${args.dryRun ? ' (معاينة فقط)' : ''}.`);
  if (cards.length) {
    console.log('احفظها الآن في مكان آمن — البطاقة لا تُعرض ثانية.');
  }
  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error('خطأ:', err.message);
  try { await prisma.$disconnect(); } catch { /* ignore */ }
  process.exit(1);
});
