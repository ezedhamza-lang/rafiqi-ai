#!/usr/bin/env node
// حارس الملفات المكشوفة علنًا — لا تسرّب بيانات دخول إلى مجلّد public/
// ------------------------------------------------------------------------
// لماذا وُلد: 07/10/2026 — وُجد أن `public/README-updated.md` يُقدَّم مباشرةً
// من نطاق الإنتاج (https://rafiqi-platform.onrender.com/README-updated.md)
// وهو يحوي جدول كلمات سرّ افتراضية. كل ما في `public/` يصل للزائر كما هو.
//
// يفحص الملفات النصّية فقط (يتجاهل الصور/الصور المضغوطة).
// الاستعمال:  node scripts/check-public-secrets.mjs
// ------------------------------------------------------------------------
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PUBLIC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../public');

// كلمات سرّ تجريبية معروفة — أي ظهور لها في public/ = خطأ.
const DEMO_PASSWORDS = [
  'admin123', 'super123', 'student123', 'teacher123', 'director123', 'parent123',
];

// أنماط سرّ عامة (بيئة/رموز/مفاتيح).
const SECRET_PATTERNS = [
  { name: 'كلمة سرّ في متغيّر بيئة', re: /\b[A-Z_]*(?:PASSWORD|PASSWD|SECRET|PRIVATE_KEY|API_KEY)\s*=\s*['"]?[^\s'"]{6,}/ },
  { name: 'مفتاح خاص PEM', re: /-----BEGIN (?:RSA |EC )?PRIVATE KEY-----/ },
  { name: 'رمز وصول GitHub', re: /gh[pousr]_[A-Za-z0-9]{20,}/ },
  { name: 'مفتاح Stripe', re: /sk_live_[A-Za-z0-9]{16,}/ },
];

const TEXT_EXT = /\.(md|txt|html?|json|js|mjs|cjs|css|csv|xml|yml|yaml|sh|bat|env|example)$/i;
const SKIP_DIR = new Set(['node_modules', '.git']);

const walk = (dir, out = []) => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIR.has(e.name)) continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full, out);
    else if (TEXT_EXT.test(e.name)) out.push(full);
  }
  return out;
};

if (!fs.existsSync(PUBLIC)) {
  console.log('public/ غير موجود — تخطّي.');
  process.exit(0);
}

const problems = [];

for (const file of walk(PUBLIC)) {
  const rel = path.relative(PUBLIC, file).replace(/\\/g, '/');
  const text = fs.readFileSync(file, 'utf8');

  for (const pw of DEMO_PASSWORDS) {
    // السياق المسموح: داخل كود مصدر مُرقَّم خلف متغيّر بيئة وليس في public/
    if (text.includes(pw)) problems.push(`public/${rel}: كلمة سرّ تجريبية «${pw}»`);
  }
  for (const { name, re } of SECRET_PATTERNS) {
    if (re.test(text)) problems.push(`public/${rel}: ${name}`);
  }
}

if (problems.length) {
  console.error('✗ ملفات مكشوفة في public/ (تصل إلى كل زائر):');
  for (const p of problems.slice(0, 25)) console.error('  ' + p);
  if (problems.length > 25) console.error(`  … و${problems.length - 25} غيرها`);
  console.error('\nانقل الملف إلى خارج public/ أو احذف صفّ بيانات الدخول منه.');
  process.exit(1);
}

console.log('✓ لا سرّ في مجلّد public/');
