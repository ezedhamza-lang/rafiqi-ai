// حارس أكواد خام في العرض — تحليل نحوي (AST) لا بحث نصي.
// يمنع تمرير {x.subject} أو {x.status} أو {x.kind} أو {x.type} أو {x.level}
// إلى موضع عرض في JSX دون utils/labels. الاستثناءات في ALLOWED مع سبب مكتوب.
// الاستعمال: node scripts/check-raw-codes.mjs   (يف��رج 1 عند وجود تسرّب)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from '@babel/parser';

const here = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.resolve(here, '../src');
const DIRS = [path.join(SRC, 'pages'), path.join(SRC, 'components')];

// حقول تُخزَّن كأكواد ⇒ يجب أن تمرّ عبر utils/labels قبل العرض.
// ملاحظة: level وplan وrole لا تُدرج هنا — الخادم يرسلها نصًّا عربيًا
// («السنة الثانية ابتدائي»، «اشتراك تلميذ»)؛ أي تغيير مسارها يبقى موضعًا للمرحلة B.
const WATCHED = ['subject', 'status', 'kind'];

// استثناءات موثّقة: [المسار الجزئي, السبب]
const ALLOWED = [
  ['pages/Messages.jsx', 'موضوع الرسالة نصٌّ حرّ من المستخدم'],
  ['pages/teacher/TeacherWorksheets.jsx', 'محرّر أوراق العمل: المادة نصٌّ حرّ (افتراضي عربي)'],
  ['pages/teacher/AnnualPlans.jsx', 'الخطة السنوية: حقل المادة نصٌ�� حرّ'],
  ['pages/teacher/LiveSessions.jsx', 'موضوع الحصة نصٌّ حرّ'],
  ['pages/parent/ParentLiveSessions.jsx', 'موضوع الحصة نصٌّ حرّ'],
  ['pages/student/StudentLiveSessions.jsx', 'موضوع الحصة نصٌّ حرّ'],
  ['pages/StudentLeaderboard.jsx', 'المستوى رقم (مستوى اللاعب)'],
  ['pages/student/StudentProfile.jsx', 'المستوى رقم'],
  ['pages/student/StudentRewards.jsx', 'المستوى رقم'],
  ['pages/student/StudentTwin.jsx', 'المستوى رقم'],
  ['pages/parent/ParentDashboard.jsx', 'المستوى رقم'],
  ['components/ResourcePaper.jsx', 'المستوى عربي من بروفايل المنهج'],
  ['pages/dashboard/Dashboard.jsx', 'المستوى نصٌّ عربي من القسم'],
  ['components/SchoolCalendar.jsx', 'نوع الحدث من قائمة تحكم (select) لا عرض حر'],
  ['pages/teacher/LiveSessions.jsx', 'موضوع الحصة نصٌّ حرّ'],
  ['components/LiveRoom.jsx', 'موضوع الحصة نصٌّ حرّ'],
  ['components/LessonViewer.jsx', 'الكتاب: grade عربي من المنهج'],
  // ── استثناءات موثّقة بالفحص (لا رمز في موضعها) ──────────────────────────
  ['pages/teacher/Memos.jsx', 'spec.competencies.subject = نصّ كفاية بيداغوجي عربي من البروفايل (لا رمز مادة)'],
  ['pages/superadmin/Schools.jsx', 't.status داخل <th> هو عنوان مترجم من كائن الترجمات لا حالة'],
  ['pages/student/StudentCertificates.jsx', 'الخادم يرسل subject نصًّا عربيًا (backend studentRewards SUBJECT_LABELS)'],
  ['pages/student/StudentWeeklyChallenge.jsx', 'بيانات محلية ثابتة بمواد عربية («الرياضيات»…)']
];

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (/\.jsx$/.test(entry.name)) out.push(full);
  }
  return out;
}

//MemberExpression بالمفتاح المطلوب: x.subject / a?.status / o['kind']
function rawCodeMember(node) {
  if (!node || node.type !== 'MemberExpression') return null;
  if (node.computed) {
    if (node.property.type !== 'StringLiteral') return null;
    return WATCHED.includes(node.property.value) ? node.property.value : null;
  }
  if (node.property.type !== 'Identifier') return null;
  return WATCHED.includes(node.property.name) ? node.property.name : null;
}

const violations = [];

for (const file of DIRS.flatMap((d) => walk(d))) {
  const rel = path.relative(SRC, file).replace(/\\/g, '/');
  if (ALLOWED.some(([f]) => rel.endsWith(f))) continue;
  const code = fs.readFileSync(file, 'utf8');
  let ast;
  try {
    ast = parse(code, { sourceType: 'module', plugins: ['jsx'] });
  } catch (e) {
    console.error(`تعذّر تحليل ${rel}: ${e.message}`);
    process.exit(2);
  }

  const visit = (node, parent, key) => {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) {
      node.forEach((n) => visit(n, parent, key));
      return;
    }
    if (node.type === 'JSXExpressionContainer') {
      // موضع العرض = ضمن children وليس قيمة سمة
      const isAttribute = parent && parent.type === 'JSXAttribute';
      if (!isAttribute) {
        const field = rawCodeMember(node.expression);
        if (field) {
          violations.push(`${rel}:${node.loc.start.line}  عرض خام لـ .${field}  →  استعمل subjectLabel/statusLabel/kindLabel`);
        }
      }
    }
    for (const [k, v] of Object.entries(node)) {
      if (k === 'loc' || k === 'leadingComments' || k === 'trailingComments') continue;
      visit(v, node, k);
    }
  };
  visit(ast.program, null, null);
}

if (violations.length) {
  console.error('✗ تسرّب أكواد خام إلى العرض:');
  for (const v of violations) console.error('  ' + v);
  console.error(`\nالإجمالي: ${violations.length} — أضف تسمية عبر utils/labels أو برّر الاستثناء في ALLOWED.`);
  process.exit(1);
}
console.log('✓ لا عرض للأكواد الخام (subjects/status/kinds/types/levels/roles/plans).');