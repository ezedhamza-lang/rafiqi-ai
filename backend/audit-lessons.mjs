import { getLessonPages } from './src/services/curriculumService.js';

const norm = (s) => String(s || '')
  .trim().replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي')
  .replace(/\s+/g, ' ').replace(/[\u064B-\u0652]/g, '').toLowerCase();

const subjects = ['math', 'anisi', 'science', 'production'];
const grades = ['year1', 'year2', 'year3', 'year4', 'year5', 'year6'];

const report = [];

for (const gid of grades) {
  for (const sub of subjects) {
    let pages;
    try { pages = getLessonPages(sub, null, gid); } catch { continue; }
    if (!pages || !pages.length) continue;

    // 1) نصّات متكررة (نفس المقطع في دروس بعناوين مختلفة) — علامة اختلال
    const passageMap = new Map();
    // 2) أسئلة مكررة عبر دروس كثيرة بلا علاقة
    const questionMap = new Map();
    for (const p of pages) {
      const blocks = p.blocks || [];
      for (const b of blocks) {
        if (b.kind === 'concept' && (b.title === 'نص الانطلاق' || (b.text && b.text.length > 80))) {
          const key = norm(b.text).slice(0, 120);
          if (key.length < 20) continue;
          if (!passageMap.has(key)) passageMap.set(key, []);
          passageMap.get(key).push(p.title);
        }
        if (b.kind === 'question' && b.text) {
          const key = norm(b.text).slice(0, 80);
          if (key.length < 8) continue;
          if (!questionMap.has(key)) questionMap.set(key, []);
          questionMap.get(key).push(p.title);
        }
      }
    }

    const dupPassages = [...passageMap.entries()].filter(([, titles]) => new Set(titles).size > 1 && titles.length > 1);
    const dupQuestions = [...questionMap.entries()].filter(([, titles]) => new Set(titles).size > 3);

    // 3) دروس بلا أي محتوى حقيقي (فقط هدف/مرجع)
    const emptyLessons = pages.filter((p) => {
      const kinds = new Set((p.blocks || []).map((b) => b.kind));
      return !kinds.has('question') && !kinds.has('concept') && !kinds.has('activity') && !kinds.has('example') && !kinds.has('experiment');
    });

    if (dupPassages.length || dupQuestions.length || emptyLessons.length) {
      report.push(`\n=== ${gid}/${sub}: ${pages.length} درس ===`);
      if (dupPassages.length) {
        report.push(`-- مقطع مكرر في دروس مختلفة (${dupPassages.length}):`);
        for (const [key, titles] of dupPassages.slice(0, 6)) {
          report.push(`   «${key.slice(0, 60)}…» في: ${[...new Set(titles)].slice(0, 4).join(' ║ ')}`);
        }
      }
      if (dupQuestions.length) {
        report.push(`-- سؤال مكرر في +3 دروس (${dupQuestions.length}):`);
        for (const [key, titles] of dupQuestions.slice(0, 6)) {
          report.push(`   «${key.slice(0, 55)}…» في: ${[...new Set(titles)].slice(0, 5).join(' ║ ')}`);
        }
      }
      if (emptyLessons.length) {
        report.push(`-- ${emptyLessons.length} درس بلا محتوى (فقط هدف/مرجع):`);
        for (const p of emptyLessons.slice(0, 8)) report.push(`   ${p.id}: ${p.title}`);
        if (emptyLessons.length > 8) report.push(`   ... وغيرها ${emptyLessons.length - 8}`);
      }
    }
  }
}

console.log(report.join('\n') || 'لا اختلالات مكتشفة');