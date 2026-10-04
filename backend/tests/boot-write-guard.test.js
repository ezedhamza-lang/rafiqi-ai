// حارس المرحلة E: لا يُكتب سرّ في مسار الإقلاع.
// السبب: على Render المجاني (إقلاع بارد كل دقائق) كانت كل كتابة تلقائية تعني أن
// كلمة سر التلميذ أو بطاقته المطبوعة قد تتبدّل بلا سبب مرئي. الإصدار الآن
// قرار صريح: صفحة المدير · src/cli/issue-credentials.js · موافقة الطلب.
//
// أي كتابة `passwordHash` داخل خدمات الإقلاع تسقط هذا الاختبار.
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const backend = path.resolve(here, '..');

const BOOTSTRAP_SERVICES = ['services/tenancyBootstrap.js', 'services/migrationRunner.js'];

describe('حارس: الإقلاع لا يكتب بيانات دخول', () => {
  it('tenancyBootstrap لا يستورد bcrypt ولا يكتب passwordHash', () => {
    const src = fs.readFileSync(path.join(backend, 'src', 'services', 'tenancyBootstrap.js'), 'utf8');
    expect(src, 'tenancyBootstrap استورد bcrypt').not.toMatch(/from\s+'bcryptjs'/);
    expect(src, 'tenancyBootstrap يكتب passwordHash').not.toMatch(/passwordHash/);
    // يكتب tempPassword = لا يقرأه (فلتر count.where مسموح)
    expect(src, 'tenancyBootstrap يكتب tempPassword').not.toMatch(/data:\s*\{[^}]*tempPassword/);
  });

  it('لا خدمة إقلاع أخرى تكتب كلمة سر', () => {
    for (const rel of BOOTSTRAP_SERVICES) {
      const full = path.join(backend, 'src', rel);
      if (!fs.existsSync(full)) continue;
      const src = fs.readFileSync(full, 'utf8');
      expect(src, `${rel} يكتب passwordHash`).not.toMatch(/passwordHash/);
    }
  });

  it('لا random id / easyPassword في مسار الإقلاع', () => {
    const src = fs.readFileSync(path.join(backend, 'src', 'services', 'tenancyBootstrap.js'), 'utf8');
    expect(src, 'مولّد كلمة سر في مسار الإقلاع').not.toMatch(/easyPassword|randomInt/);
  });

  it('الإصدار الصريح موجود: خدمة واحدة + أداة إدارة', () => {
    const svc = path.join(backend, 'src', 'services', 'studentCredentials.js');
    const cli = path.join(backend, 'src', 'cli', 'issue-credentials.js');
    expect(fs.existsSync(svc), 'خدمة إصدار البيانات مفقودة').toBe(true);
    expect(fs.existsSync(cli), 'أداة issue-credentials مفقودة').toBe(true);
    // الأداة هي المكان الوحيد الذي يمرّ بـ--student/--class ويطبع كلمات السر
    const cliSrc = fs.readFileSync(cli, 'utf8');
    expect(cliSrc).toMatch(/issueStudentCredentials/);
    expect(cliSrc).toMatch(/--dry-run/);
    expect(cliSrc).toMatch(/--only-missing/);
  });

  it('صفحة المدير تستخدم الخدمة نفسها (لا نسخة ثانية من منطق الإصدار)', () => {
    const routes = fs.readFileSync(path.join(backend, 'src', 'routes', 'director.js'), 'utf8');
    expect(routes).toMatch(/issueStudentCredentials/);
    // الاستثناء الوحيد المباشر لـbcrypt هو موافقة الطلب: تُنشئ الحساب داخل
    // معاملة واحدة (hash لعميل جديد) — وهي فعل إداري صريح لا إقلاع.
    const bcryptUses = [...routes.matchAll(/bcrypt\.\w+/g)].map((m) => m[0]);
    expect(bcryptUses, 'استعمالات bcrypt في المسار').toEqual(['bcrypt.hash']);
    expect(routes).toMatch(/router\.put\(\s*'\/requests\/:id\/approve'/);
  });
});
