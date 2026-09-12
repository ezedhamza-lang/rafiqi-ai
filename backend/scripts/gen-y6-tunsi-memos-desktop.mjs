process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'postgresql://school_user:school_pass@localhost:5432/school_platform_test';
process.env.JWT_SECRET = 'test-secret-test-secret-32';

import fs from 'fs';
import path from 'path';
import os from 'os';

const DESKTOP = path.join('C:', 'Users', 'ezedd', 'Desktop', 'مذكرات-س6-رفيقي');
fs.mkdirSync(DESKTOP, { recursive: true });

const rasmi = JSON.parse(fs.readFileSync(new URL('../curriculum/year6/tunsi-math6-lessons.json', import.meta.url), 'utf8'));
const { generateMemo } = await import('../src/services/lessonMemoService.js');
const prisma = (await import('../src/db.js')).default;
const { buildMemoPdf } = await import('../src/services/exportService.js');
const teacher = await prisma.user.findFirst({ where: { role: 'TEACHER' } });

const pick = process.argv[2] ? process.argv[2].split(',') : ['r6s07', 'r6s32', 'r6s09'];
for (const id of pick) {
  const lesson = rasmi[id];
  if (!lesson) { console.log('SKIP', id, 'غير موجود'); continue; }
  const { memo } = await generateMemo({ teacherId: teacher.id, subject: 'math-tunsi', level: 'السنة السادسة أساسي', lessonTitle: lesson.title });
  const c = typeof memo.content === 'string' ? JSON.parse(memo.content) : memo.content;
  const rows = c.spec?.rows || [];
  const filled = rows.filter((r) => String(r.teacherActivity || '').replace(/•/g, '').trim().length > 10).length;
  const buf = await buildMemoPdf(memo);
  const file = path.join(DESKTOP, `مذكرة-${id}-${String(lesson.title).replace(/[\\/:*?"<>|]/g, '').slice(0, 42)}.pdf`);
  fs.writeFileSync(file, buf);
  console.log(`✓ ${id} «${lesson.title.slice(0, 45)}» مراحل-ممتلئة=${filled}/${rows.length} pdf=${(buf.length / 1024).toFixed(0)}KB`);
}
await prisma.$disconnect();
console.log('\nالمجلد:', DESKTOP);
