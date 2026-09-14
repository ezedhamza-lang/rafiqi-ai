import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';

const textPath = resolve('backend/scripts/practice-book-extract.txt');
const unitsPath = resolve('backend/curriculum/year2/math-units.json');

const text = readFileSync(textPath, 'utf-8');
const lines = text.split('\n');

// Extract lesson titles from the table of contents (lines 100-255)
const lessons = [];
let currentPeriod = 0;

for (let i = 99; i < 255; i++) {
  const line = lines[i]?.trim().replace(/\t/g, ' ');
  if (!line) continue;
  
  // Match period headers (handle Arabic diacritics)
  const periodMatch = line.match(/الفترة\s*ُ?\s+(الأولى|الثانية|الثالثة|الرابعة|الخامسة|السادسة)/);
  if (periodMatch) {
    const periods = ['الأولى', 'الثانية', 'الثالثة', 'الرابعة', 'الخامسة', 'السادسة'];
    currentPeriod = periods.indexOf(periodMatch[1]) + 1;
    continue;
  }
  
  // Match lesson entries: "1. المجموعاتُ — المجموعاتُ ومكوِّناتُها والعلاقةُ بينَها [P1-1]"
  const lessonMatch = line.match(/^(\d+)\.\s+(.+?)\s+\[([PFTR]\d+-\d+)\]/);
  if (lessonMatch && currentPeriod > 0) {
    lessons.push({
      num: parseInt(lessonMatch[1]),
      title: lessonMatch[2].trim(),
      code: lessonMatch[3],
      period: currentPeriod,
      y2mId: `y2m${String((currentPeriod - 1) * 11 + parseInt(lessonMatch[1])).padStart(2, '0')}`
    });
  }
}

console.log(`Found ${lessons.length} lessons in table of contents`);
lessons.forEach(l => console.log(`  ${l.y2mId} (${l.code}): P${l.period} L${l.num} - ${l.title}`));

// Now extract content for each lesson
// Find lesson content sections by looking for the lesson header pattern
const lessonSections = [];
let i = 0;

while (i < lines.length) {
  const line = lines[i]?.trim();
  
  // Look for lesson start pattern: "1. المجموعاتُ — المجموعاتُ ومكوِّناتُها والعلاقةُ بينَها [P1-1]"
  const lessonStart = line?.match(/^(\d+)\.\s+(.+?)\s+\[([PFTR]\d+-\d+)\]/);
  if (lessonStart && i > 250) { // After table of contents
    const code = lessonStart[3];
    const lesson = lessons.find(l => l.code === code);
    if (lesson) {
      // Find the end of this lesson (next lesson or end of file)
      let endIdx = lines.length;
      for (let j = i + 1; j < lines.length; j++) {
        const nextLine = lines[j]?.trim();
        if (nextLine?.match(/^\d+\.\s+.+\s+\[[PFTR]\d+-\d+\]/) && j > 250) {
          endIdx = j;
          break;
        }
      }
      
      const content = lines.slice(i, endIdx).join('\n');
      
      // Extract sections
      const recallMatch = content.match(/أتذكَّرُ[\s\S]*?(?=المستوى\s+1|$)/);
      const level1Match = content.match(/المستوى\s+1\s*—\s*أتدرَّبُ[\s\S]*?(?=المستوى\s+2|المسألة\s+الصعبة|$)/);
      const level2Match = content.match(/المستوى\s+2\s*—\s*أُتقِنُ[\s\S]*?(?=المستوى\s+3|المسألة\s+الصعبة|$)/);
      const level3Match = content.match(/المستوى\s+3\s*—\s*أتفوَّقُ[\s\S]*?(?=المسألة\s+الصعبة|$)/);
      const challengeMatch = content.match(/المسألةُ الصعبةُ[\s\S]*?(?=مسوَّدتُي|أَقَوِّمُ|$)/);
      const selfEvalMatch = content.match(/أَقَوِّمُ نفسي[\s\S]*$/);
      
      lessonSections.push({
        ...lesson,
        recall: recallMatch ? recallMatch[0].trim() : null,
        level1: level1Match ? level1Match[0].trim() : null,
        level2: level2Match ? level2Match[0].trim() : null,
        level3: level3Match ? level3Match[0].trim() : null,
        challenge: challengeMatch ? challengeMatch[0].trim() : null,
        selfEval: selfEvalMatch ? selfEvalMatch[0].trim() : null,
        fullContent: content.substring(0, 500)
      });
    }
  }
  i++;
}

console.log(`\nExtracted content for ${lessonSections.length} lessons`);

// Show first lesson as sample
if (lessonSections.length > 0) {
  const s = lessonSections[0];
  console.log(`\n=== Sample: ${s.y2mId} - ${s.title} ===`);
  console.log('Recall:', s.recall?.substring(0, 200));
  console.log('Level1:', s.level1?.substring(0, 200));
  console.log('Challenge:', s.challenge?.substring(0, 200));
}

// Save extracted data
writeFileSync(
  resolve('backend/scripts/practice-book-structured.json'),
  JSON.stringify(lessonSections, null, 2),
  'utf-8'
);
console.log('\nSaved to practice-book-structured.json');
