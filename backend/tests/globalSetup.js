import { execSync } from 'child_process';

process.env.NODE_ENV = 'test';
process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL ||
  'postgresql://school_user:school_pass@localhost:5432/school_platform_test?schema=public';
process.env.JWT_SECRET = 'test-jwt-secret-key';

export default function setup() {
  execSync('npx prisma migrate deploy', { stdio: 'inherit', cwd: process.cwd() });
}
