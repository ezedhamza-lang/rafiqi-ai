import { pathToFileURL } from 'url';
import fs from 'fs';

/**
 * فاحص جودة المذكرات — يولّد 5 مذكرات لكل سنة من دروس/فترات مختلفة
 * ويبحث آليًا عن: الحقول الفارغة، مراحل بلا محتوى، إيموجي/تنسيق ملوث،
 * تكرار الأنشطة بين المراحل، غياب محتوى الكسور في دروسها.
 * الاستخدام (من مجلد backend): node scripts/audit-memos.mjs
 */
process.env.NODE_ENV = process.env.NODE_ENV || 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'audit-secret';
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://x:x@localhost:5/x';

const base = pathToFileURL(process.cwd() + '/').href;
const { getLessonPages } = await import(base + 'src/services/curriculumService.js');
const { resolveMethodology } = await import(base + 'src/services/methodologyResolver.js');
const { buildSpecMemo } = await import(base + 'src/services/memoEngine.js');

const YEARS = ['year1', 'year2', 'year3', 'year4', 'year5', 'year6'];
const AR = { year1: 'الأولى', year2: 'الثانية', year3: 'الثالثة', year4: 'الرابعة', year5: 'الخامسة', year6: 'السادسة' };
let total = 0;
const stats = {};
for (const grade of YEARS) {
  let pages = [];
  let subjId = 'math';
  for (const sid of ['math2', 'math']) {
    const ps = getLessonPages(sid, null, grade);
    const rich = ps.filter((p) => p.blocks && p.blocks.length && p.blocks.some((b) => b.kind !== 'concept' || (b.text || '').length > 30));
    if (rich.length > pages.length) { pages = rich; subjId = sid; }
  }
  if (!pages.length) { stats[grade] = 'غير مرقمن'; continue; }
  const step = Math.max(1, Math.floor(pages.length / 5));
  const picks = [pages[0], ...[1, 2, 3, 4].map((i) => pages[Math.min(pages.length - 1, i * step)])];
  const profile = resolveMethodology({ subject: 'رياضيات', level: `السنة ${AR[grade]} أساسي` });
  let ok = 0;
  for (const lesson of picks) {
    const spec = buildSpecMemo({ profile, lesson, ctx: { subject: 'رياضيات', level: `السنة ${AR[grade]} أساسي`, gradeId: grade, subjectId: subjId } });
    let iss = 0;
    if (!spec.competencies.component || !spec.competencies.distinctiveObjective) iss++;
    const allT = spec.rows.map((r) => String(r.teacherActivity));
    allT.forEach((t, i) => {
      const lines = t.split('\n').map((x) => x.trim()).filter((x) => x && !/^\.+$/.test(x));
      if (!lines.length) { iss++; console.log('EMPTY', grade, lesson.id, spec.rows[i].stage.split('\n')[0]); }
      if (/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}]|\*\*/u.test(t)) { iss++; console.log('EMOJI', grade, lesson.id); }
    });
    const seen = new Set();
    for (const t of allT) {
      for (const ln of t.split('\n').map((x) => x.replace(/^•\s*/, '').split(' — ')[0].trim())) {
        if (ln && !/^\.+$/.test(ln)) { if (seen.has(ln)) { iss++; console.log('DUP', grade, lesson.id, ln.slice(0, 40)); } seen.add(ln); }
      }
    }
    if (/(كسر|نصف|ثلث|ربع)/.test(lesson.title) && !/(ربع|نصف|ثلث|[¼½¾]|\d,\d|\d\/\d)/.test(allT.join(' '))) { iss++; console.log('FRAC', grade, lesson.id); }
    total += iss;
    if (!iss) ok++;
  }
  stats[grade] = `${ok}/5`;
}
console.log('TOTAL ISSUES:', total, '|', JSON.stringify(stats));
fs.writeFileSync('audit-memos-report.json', JSON.stringify({ total, stats, at: new Date().toISOString() }, null, 2));
process.exitCode = total ? 1 : 0;
