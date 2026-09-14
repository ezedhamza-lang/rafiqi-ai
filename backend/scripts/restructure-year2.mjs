import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';

const unitsPath = resolve('backend/curriculum/year2/math-units.json');
const practicePath = resolve('backend/scripts/practice-book-structured.json');

const units = JSON.parse(readFileSync(unitsPath, 'utf-8'));
const practice = JSON.parse(readFileSync(practicePath, 'utf-8'));

// Practice book lesson count per period
const practicePeriodCounts = { 1: 11, 2: 11, 3: 11, 4: 12, 5: 10, 6: 9 };

// Current unit count per period
const currentPeriodCounts = {};
for (const [key, unit] of Object.entries(units)) {
  if (key === '_meta') continue;
  const p = unit.period;
  currentPeriodCounts[p] = (currentPeriodCounts[p] || 0) + 1;
}
console.log('Current:', currentPeriodCounts);
console.log('Practice:', practicePeriodCounts);

// Check if we need to add lessons to period 5
const p5Current = currentPeriodCounts[5] || 0;
const p5Needed = practicePeriodCounts[5];
if (p5Current < p5Needed) {
  console.log(`Need to add ${p5Needed - p5Current} lessons to Period 5`);
}

// Build mapping from practice book codes to y2m IDs
const practiceToY2m = {};
for (const lesson of practice) {
  practiceToY2m[lesson.code] = lesson.y2mId;
}

// Fix the y2m45 duplicate - reassign period 5 lessons
let p5Counter = 46; // Period 5 starts at y2m46
for (const lesson of practice) {
  if (lesson.period === 5) {
    lesson.y2mId = `y2m${String(p5Counter).padStart(2, '0')}`;
    p5Counter++;
  }
}

console.log('\nPractice book mapping (Period 5):');
practice.filter(l => l.period === 5).forEach(l => console.log(`  ${l.code} -> ${l.y2mId}: ${l.title}`));

// Now restructure each unit's studentBlocks
function createRecallBlock(text) {
  return {
    kind: 'concept',
    section: 'recall',
    title: 'أتذكَّرُ',
    text: text
  };
}

function createLevel1Blocks(exercises) {
  return [{
    kind: 'concept',
    section: 'practice',
    title: 'المستوى 1 — أتدرَّبُ ★',
    text: 'تمارين أساسية لتثبيت ما تعلمته. لا تنتقل قبل إتقانها.'
  }, ...exercises];
}

function createLevel2Blocks(exercises) {
  return [{
    kind: 'concept',
    section: 'practice',
    title: 'المستوى 2 — أُتقِنُ ★★',
    text: 'تمارين تطبيقية تحتاج فهماً أعمق وتفكراً في اختيار العملية.'
  }, ...exercises];
}

function createLevel3Blocks(exercises) {
  return [{
    kind: 'concept',
    section: 'practice',
    title: 'المستوى 3 — أتفوَّقُ ★★★',
    text: 'تمارين إتقان للتفكير العميق — هنا يُظهر الأبطال قدرهم!'
  }, ...exercises];
}

function createChallengeBlock(text) {
  return {
    kind: 'concept',
    section: 'challenge',
    title: 'المسألة الصعبة — تحدّي الأبطال',
    text: text
  };
}

function createSelfEvalBlock() {
  return {
    kind: 'concept',
    section: 'selfeval',
    title: 'أقوّم نفسي',
    text: '☐ أُتقنت الدرس جيداً  ☐ أُراجع بعض الخطوات  ☐ أحتاج مساعدة معلمي'
  };
}

// Process each unit
let updatedCount = 0;
for (const [key, unit] of Object.entries(units)) {
  if (key === '_meta') continue;
  if (!unit.studentBlocks) continue;
  
  // Find matching practice lesson
  const practiceLesson = practice.find(l => l.y2mId === key);
  if (!practiceLesson) {
    console.log(`No practice lesson found for ${key}`);
    continue;
  }
  
  // Restructure studentBlocks
  const newBlocks = [];
  
  // Keep existing concept blocks (intro/explore) as source material
  const introBlocks = unit.studentBlocks.filter(b => 
    b.section === 'explore' || b.kind === 'concept' && b.title?.includes('أستكشف')
  );
  
  if (introBlocks.length > 0) {
    newBlocks.push(...introBlocks);
  }
  
  // Add recall block
  if (practiceLesson.recall) {
    // Clean up the recall text
    let recallText = practiceLesson.recall
      .replace(/أتذكَّرُ\s*/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    newBlocks.push(createRecallBlock(recallText));
  }
  
  // Add level 1 exercises (convert text to question blocks)
  if (practiceLesson.level1) {
    const exercises = extractExercises(practiceLesson.level1, 'level1');
    newBlocks.push(...createLevel1Blocks(exercises));
  }
  
  // Add level 2 exercises
  if (practiceLesson.level2) {
    const exercises = extractExercises(practiceLesson.level2, 'level2');
    newBlocks.push(...createLevel2Blocks(exercises));
  }
  
  // Add level 3 exercises
  if (practiceLesson.level3) {
    const exercises = extractExercises(practiceLesson.level3, 'level3');
    newBlocks.push(...createLevel3Blocks(exercises));
  }
  
  // Add challenge block
  if (practiceLesson.challenge) {
    let challengeText = practiceLesson.challenge
      .replace(/المسألةُ الصعبةُ\s*(—\s*تحدِّي الأبطالِ)?\s*/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    newBlocks.push(createChallengeBlock(challengeText));
  }
  
  // Add self-evaluation
  newBlocks.push(createSelfEvalBlock());
  
  // Update unit
  unit.studentBlocks = newBlocks;
  updatedCount++;
}

console.log(`\nUpdated ${updatedCount} units`);

// Write back
writeFileSync(unitsPath, JSON.stringify(units, null, 1), 'utf-8');
console.log('File saved');

function extractExercises(text, level) {
  const blocks = [];
  
  // Remove level header
  text = text.replace(/المستوى\s+\d+\s*—\s*(أتدرَّبُ|أُتقِنُ|أتفوَّقُ)\s*(أساسي|تطبيقي|إتقاني)?\s*/g, '');
  
  // Split by exercise numbers (1, 2, 3, etc.)
  const exerciseParts = text.split(/\n\s*\d+\s*\n/).filter(p => p.trim());
  
  for (const part of exerciseParts) {
    const cleanPart = part.replace(/\s+/g, ' ').trim();
    if (!cleanPart || cleanPart.length < 5) continue;
    
    // Check if it's a question
    if (cleanPart.includes('?') || cleanPart.includes('؟') || cleanPart.includes('أكمل') || cleanPart.includes('ارسم')) {
      blocks.push({
        kind: 'question',
        section: 'practice',
        title: level === 'level1' ? 'أتدرَّبُ' : level === 'level2' ? 'أُتقِنُ' : 'أتفوَّقُ',
        text: cleanPart,
        placeholder: 'أكتب إجابتي هنا'
      });
    } else {
      blocks.push({
        kind: 'concept',
        section: 'practice',
        title: level === 'level1' ? 'أتدرَّبُ' : level === 'level2' ? 'أُتقِنُ' : 'أتفوَّقُ',
        text: cleanPart
      });
    }
  }
  
  // If no exercises extracted, add the whole text as a single block
  if (blocks.length === 0 && text.trim()) {
    blocks.push({
      kind: 'question',
      section: 'practice',
      title: level === 'level1' ? 'أتدرَّبُ' : level === 'level2' ? 'أُتقِنُ' : 'أتفوَّقُ',
      text: text.trim(),
      placeholder: 'أكتب إجابتي هنا'
    });
  }
  
  return blocks;
}
