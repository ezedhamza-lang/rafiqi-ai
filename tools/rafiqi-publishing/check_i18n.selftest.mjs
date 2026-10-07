// اختبار حتمي: هل يلتقط check_i18n.js المفتاح المكرّر فعلًا؟
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const here = path.dirname(fileURLToPath(import.meta.url));
// هذا الملف في tools/rafiqi-publishing/ ← الجذر مستويان لأعلى (نفس check_i18n.js)
const repoRoot = path.resolve(here, '..', '..');
const ar = path.join(repoRoot, 'frontend', 'src', 'i18n', 'ar.json');
const backup = fs.readFileSync(ar);

// إدخال الخلل نفسه الذي سقط به 07/10/2026: كائن بنفس اسم مفتاح نصّي
const raw = backup.toString('utf8');
const injected = raw.replace(
  '"footer": {',
  '"footer": {\n    "freeBooks": { "title": "X" },',
);
if (injected === raw) {
  console.log('لم يُعثر على موقع الحقن — تغيّر بنية الملف؟');
  process.exit(2);
}
fs.writeFileSync(ar, injected, 'utf8');

let code = 0;
try {
  const out = execFileSync('node', [path.join(here, 'check_i18n.js')], {
    encoding: 'utf8',
    cwd: repoRoot,
  });
  console.log(out.trim());
  code = 0; // لم يكتشف = فشل الاختبار
  console.log('\n✗ فشل: السكربت لم يكتشف المفتاح المكرّر');
  code = 1;
} catch (e) {
  console.log((e.stdout || '').toString().trim());
  const caught = /مفاتيح مكرّرة|footer\.freeBooks/.test((e.stdout || '').toString());
  console.log(caught ? '\n✓ نجح: اكتشف الخلل المحقون' : '\n✗ فشل: خطأ آخر غير المتوقّع');
  code = caught ? 0 : 1;
} finally {
  fs.writeFileSync(ar, backup);
  const restored = fs.readFileSync(ar).equals(backup);
  console.log(`\nاستُعيد ar.json سليمًا: ${restored ? 'نعم ✓' : 'لا ✗'}`);
  if (!restored) code = 1;
}
process.exit(code);
