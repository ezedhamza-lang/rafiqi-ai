// تطابق الصلاحيات بين الواجهة والخادم في فضاء المدير.
//
// خلل حقيقي (04-10): الـAPI يسمح لـSUPER_ADMIN بكل مسارات المدير، لكن
// `RequireRole` في App.jsx وحاجز DirectorDashboard كانا يقبلان
// SCHOOL_DIRECTOR|ADMIN فقط ⇒ صاحب المنصّة مُنع من صفحة بطاقات الدخول التي
// الخادم يسمح له بها. هذا الاختبار يمنع تكرار الانفصال: كل دور في قائمة
// الخادم (adminMiddleware) يجب أن يفتح فضاء المدير في الواجهة أيضًا.
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const backend = path.resolve(here, '..');
const frontend = path.join(backend, '..', 'frontend', 'src');

const read = (p) => fs.readFileSync(p, 'utf8');

describe('تطابق أدوار فضاء المدير بين الواجهة والخادم', () => {
  // المصدر truth: قائمة أدوار الـAPI في auth.js (adminMiddleware)
  const authSrc = read(path.join(backend, 'src', 'auth.js'));
  const apiRolesMatch = authSrc.match(/adminMiddleware\s*=\s*requireRole\(([^)]+)\)/);
  expect(apiRolesMatch, 'تعذّر قراءة adminMiddleware').toBeTruthy();
  const apiRoles = apiRolesMatch[1]
    .split(',')
    .map((s) => s.trim().replace(/['"]/g, ''))
    .filter(Boolean);
  expect(apiRoles).toContain('SUPER_ADMIN');

  it('RequireRole في App.jsx يحتوي كل أدوار الـAPI', () => {
    const app = read(path.join(frontend, 'App.jsx'));
    const line = app.split('\n').find((l) => l.includes('path="/director/*"'));
    expect(line, 'مسار /director/* غير موجود').toBeTruthy();
    for (const role of apiRoles) {
      expect(line, `الدور ${role} غير مسموح في /director`).toContain(`'${role}'`);
    }
  });

  it('حاجز DirectorDashboard الداخلي يطابق RequireRole', () => {
    const dash = read(path.join(frontend, 'pages', 'director', 'DirectorDashboard.jsx'));
    const guard = dash.match(/!\[([^\]]+)\]\.includes\(user\.role\)/);
    expect(guard, 'حاجز الأدوار غير موجود').toBeTruthy();
    for (const role of apiRoles) {
      expect(guard[1], `الدور ${role} محجوب داخل المكوّن`).toContain(role);
    }
  });

  it('الإجراءات الحسّاسة لم تُفتح مع الفتح العام (الموافقة للمدير وحده)', () => {
    const roles = read(path.join(frontend, 'roles.js'));
    // الموافقة على طلبات التسجيل: SCHOOL_DIRECTOR فقط — كما في الخادم
    // (PUT /requests/:id/approve خلف requireRole('SCHOOL_DIRECTOR'))
    expect(roles).toMatch(/canApproveRequests[\s\S]{0,120}role === 'SCHOOL_DIRECTOR'/);
    // المالية: ADMIN|SUPER_ADMIN كما في الخادم
    expect(roles).toMatch(/canManageFinance[\s\S]{0,140}'ADMIN',\s*'SUPER_ADMIN'/);
  });

  it('الواجهة تعرض المسار في التبويبات (لا رابط ميت)', () => {
    const dash = read(path.join(frontend, 'pages', 'director', 'DirectorDashboard.jsx'));
    expect(dash).toMatch(/to:\s*'credentials'/);
    expect(dash).toMatch(/path="credentials"/);
  });
});
