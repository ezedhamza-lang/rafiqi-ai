// حارس الهجرات — درس تعلّمناه بالقياس: هجرة في prisma/migrations لا تُسجَّل في
// قائمة الإقلاع (src/index.js) ⇒ تعمل محليًا وتفشل في الإنتاج (Render مجاني
// لا يشغّل prisma migrate deploy)، أو تفشل صامتًا داخل catch.
//
// هذا الاختبار يفشل عند أي هجرة جديدة غير مربوطة ⇒ لا يمكن «نسيانها» بصمت.
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const backend = path.resolve(here, '..');
const migrationsDir = path.join(backend, 'prisma', 'migrations');
const indexSrc = fs.readFileSync(path.join(backend, 'src', 'index.js'), 'utf8');

// استثناءات موثّقة: الهجرات التي أنشأت الجداول الأساسية ونفّذتها
// `prisma migrate deploy` عند أول نشر (قائمتها أدناه)، فهي ليست «إصلاحات
// تحتاج تكرارًا عند كل إقلاع» بل أساس القاعدة القائم بالفعل في الإنتاج.
const ALREADY_DEPLOYED = new Set([
  '20260814160830_init',
  '20260814170000_assignments',
  '20260814231202_payments',
  '20260815071723_subscriptions_invoices',
  '20260815080000_finance_dashboard',
  '20260815090715_live_sessions',
  '20260815101351_live_interactions',
  '20260815110500_notifications_message_center',
  '20260815120000_assignment_late_flag',
  '20260817044014_lesson_memos',
  '20260817100000_adaptive_learning',
  '20260817110000_lesson_progress',
  '20260817120000_system_settings',
  '20260819000000_add_i18n_fields',
  '20260820000000_refresh_tokens',
  '20260820010000_parent_notes'
]);

describe('حارس ترحيل الهجرات إلى قائمة الإقلاع', () => {
  const folders = fs
    .readdirSync(migrationsDir, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort();

  it('كل هجرة بعد أساس القاعدة مسجَّلة في src/index.js (تُطبَّق عند إقلاع الاستضافة)', () => {
    const missing = folders.filter((f) => !ALREADY_DEPLOYED.has(f) && !indexSrc.includes(`${f}/migration.sql`));
    expect(
      missing,
      `هجرات غير مسجَّلة في src/index.js — أضِف runSqlFileOnce لكل منها:\n${missing.join('\n')}`
    ).toEqual([]);
  });

  it('قائمة الاستثناءات ما زالت موجودة فعلًا (لا تبقّى مجلد محذوف)', () => {
    const dangling = [...ALREADY_DEPLOYED].filter((f) => !folders.includes(f));
    expect(dangling, `استثناءات لمجلدات لم تعد موجودة:\n${dangling.join('\n')}`).toEqual([]);
  });

  it('كل migration.sql موجود فعلًا داخل مجلّده', () => {
    const missing = folders.filter((f) => !fs.existsSync(path.join(migrationsDir, f, 'migration.sql')));
    expect(missing).toEqual([]);
  });

  it('لا يشير index.js إلى هجرة غير موجودة', () => {
    const referenced = [...indexSrc.matchAll(/'(\d{14}_[a-z0-9_]+)\/migration\.sql'/g)].map((m) => m[1]);
    const dangling = referenced.filter((r) => !folders.includes(r));
    expect(dangling, `مراجع لهجرات غير موجودة:\n${dangling.join('\n')}`).toEqual([]);
  });
});
