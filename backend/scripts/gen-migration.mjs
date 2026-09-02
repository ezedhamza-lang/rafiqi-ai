import { execSync } from 'child_process';
import fs from 'fs';

const sql = execSync(
  'npx prisma migrate diff --from-migrations ./prisma/migrations --to-schema-datamodel ./prisma/schema.prisma --shadow-database-url postgresql://school_user:school_pass@localhost:5432/school_platform?schema=public --script',
  { cwd: process.cwd(), encoding: 'utf8' }
);

// تعبئة التراجعية الآمنة: مدرسة افتراضية ثم ربط كل المستخدمين والأقسام بها
const backfill = `
-- >>> تعدد المدارس: المدرسة الافتراضية + ربط البيانات القائمة <<<
INSERT INTO "School" ("name", "code", "status", "createdAt", "updatedAt")
SELECT 'المدرسة النموذجية', 'SCH-001', 'ACTIVE', NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM "School" WHERE "code" = 'SCH-001');

UPDATE "User" SET "schoolId" = (SELECT id FROM "School" WHERE code = 'SCH-001')
WHERE "schoolId" IS NULL AND "role" <> 'SUPER_ADMIN';

UPDATE "Class" SET "schoolId" = (SELECT id FROM "School" WHERE code = 'SCH-001')
WHERE "schoolId" IS NULL;
`;

const full = sql + backfill;
const stamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
const dir = `prisma/migrations/${stamp}_multi_school_tenancy`;
fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(`${dir}/migration.sql`, full, 'utf8');
console.log('migration written:', dir);
console.log('bytes:', Buffer.byteLength(full));