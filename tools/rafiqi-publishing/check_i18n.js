#!/usr/bin/env node
/**
 * check_i18n.js — حارس ملفات الترجمة (RAFIQI)
 * ------------------------------------------------------------------------
 * غرضه أن يمنع سقوط المنصة كلها بيضاء بسبب مفتاح مكرّر أو خاطئ النوع.
 *
 * لماذا؟ حدث فعلًا في 07/10/2026: أُضيف كائن "freeBooks" إلى قسم "footer"
 * وكان هناك مفتاح نصّي بنفس الاسم. JSON.parse لا يشتكِ من التكرار — يأخذ
 * الأخير صامتًا — فصار t('footer.freeBooks') يُرجع كائنًا بدل نصّ، ورمى
 * React الخطأ #31 (Objects are not valid as a React child) داخل <h4>،
 * فأصبح root.children.length === 0 أي الصفحة الرئيسية بيضاء تمامًا.
 *
 * الاستعمال:
 *     node tools/rafiqi-publishing/check_i18n.js
 *
 * الخروج: ALL OK / FAIL: <أسماء المفاتيح>
 *
 * القاعدة: لا تُكرّر اسم مفتاح داخل القسم نفسه ولا بين قسمين،
 *          واحذف المفتاح غير المستعمل من ar.json و en.json معًا.
 * ------------------------------------------------------------------------
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..', '..');

const FILES = [
  path.join(repoRoot, 'frontend', 'src', 'i18n', 'ar.json'),
  path.join(repoRoot, 'frontend', 'src', 'i18n', 'en.json'),
];

/**
 * كل مفتاح نستعمله فعليًا في الكود، مع نوعه الصحيح.
 * أضف أي مفتاح جديد هنا عند إنشائه.
 * القيمة 'undefined' تعني: هذا المفتاح يجب أن يكون محذوفًا (سياسة مقصودة).
 */
const EXPECTED = {
  // التذييل: قسم «الكتب المجانية» → نصّان فقط. الحزمة محذوفة (سياسة 07/10/2026)
  'footer.freeBooks': 'string',
  'footer.freeBooksBlog': 'string',
  'footer.freeBooksPack': 'undefined',

  // الصفحة الرئيسية: القسم كائن كامل — أي تكرار هنا يسقط المنصة
  'home.freeBooks': 'object',
  'home.freeBooks.title': 'string',
  'home.freeBooks.subtitle': 'string',
  'home.freeBooks.blogButton': 'string',
  'home.freeBooks.packButton': 'undefined',
  'home.servicesTitle': 'string',
};

const pick = (obj, dotted) =>
  dotted.split('.').reduce((acc, k) => (acc == null ? acc : acc[k]), obj);

const typeName = (v) =>
  v === undefined ? 'undefined' : Array.isArray(v) ? 'array' : typeof v;

let failed = 0;

for (const file of FILES) {
  if (!fs.existsSync(file)) {
    console.log(`SKIP (غير موجود): ${file}`);
    continue;
  }

  const raw = fs.readFileSync(file, 'utf8');
  let json;
  try {
    json = JSON.parse(raw);
  } catch (e) {
    console.log(`FAIL ${path.basename(file)}: JSON غير صالح — ${e.message}`);
    failed++;
    continue;
  }

  const problems = [];

  // 1) النوع الصحيح لكل مفتاح متوقّع
  for (const [key, want] of Object.entries(EXPECTED)) {
    const actual = typeName(pick(json, key));
    if (actual !== want) problems.push(`${key} = ${actual} (المتوقّع ${want})`);
  }

  // 2) كشف التكرار الحرفي: مفتاحان بنفس الاسم داخل الفرع الواحد.
  //    نبني مسارًا حقيقيًا من (المسافة البادئة + اسم المفتاح)، لا من الأرقام.
  const stack = []; // [{ indent, key }]
  const seen = new Map(); // "parent/key" -> أول مرة
  const dupes = [];
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^(\s*)"((?:[^"\\]|\\.)*)"\s*:/);
    if (!m) continue;
    const indent = m[1].length;
    // أغلق كل فرع عمقه >= عمق هذا السطر (يشمل الأوراق السابقة)
    while (stack.length && stack[stack.length - 1].indent >= indent) stack.pop();
    const path = `${stack.map((s) => s.key).join('/')}/${m[2]}`;
    if (seen.has(path)) dupes.push(path.replace(/^\//, ''));
    else seen.set(path, true);
    stack.push({ indent, key: m[2] });
  }
  if (dupes.length) {
    const uniq = [...new Set(dupes)];
    const shown = uniq.slice(0, 12).join(' ، ');
    problems.push(
      `مفاتيح مكرّرة (${uniq.length}): ${shown}${uniq.length > 12 ? ' …' : ''}`,
    );
  }

  if (problems.length) {
    failed++;
    console.log(`FAIL ${path.basename(file)}:`);
    for (const p of problems) console.log(`       - ${p}`);
  } else {
    console.log(`ALL OK  ${path.basename(file)}`);
  }
}

// 3) الحماية من عودة رابط الحزمة إلى المنصة (سياسة «التوزيع فقط»)
const feSrc = path.join(repoRoot, 'frontend', 'src');
if (fs.existsSync(feSrc)) {
  const walk = (dir) =>
    fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) => {
      const p = path.join(dir, d.name);
      if (d.isDirectory()) return walk(p);
      return /\.(jsx?|json)$/.test(d.name) ? [p] : [];
    });
  const zipHits = walk(feSrc).filter((f) =>
    /rafiqi-books-free-pack/.test(fs.readFileSync(f, 'utf8')),
  );
  if (zipHits.length) {
    failed++;
    console.log('FAIL رابط الحزمة عاد إلى المنصة (يُسمح فقط في صفحة «شاركنا» بالمدوّنة):');
    for (const f of zipHits) console.log(`       - ${path.relative(repoRoot, f)}`);
  } else {
    console.log('ALL OK  لا رابط حزمة في المنصة (سياسة التوزيع فقط)');
  }
}

console.log(failed ? `\n${failed} مشكلة — لا تنشر.` : '\nجاهز للنشر ✓');
process.exit(failed ? 1 : 0);
