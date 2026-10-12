import { scopeLessonsForTrimester } from './src/exams/curriculum-index.js';
for (const lvl of ['year3', 'year5']) {
  const { lessons } = scopeLessonsForTrimester({ level: lvl, subject: 'math', trimester: 1 });
  console.log('==', lvl, '—', lessons.length, 'دروس');
  lessons.forEach((l, i) => console.log(' ', i, '|', l.title, '|', (l.competencies || []).join('؛ '), '|', (l.objectives || []).slice(0, 3).join('؛ ')));
}
