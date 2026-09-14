import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';

const filePath = resolve('backend/curriculum/year2/math-units.json');
const data = JSON.parse(readFileSync(filePath, 'utf-8'));

// Domain-specific pedagogical basis and activities
const domainConfig = {
  'المجموعات': {
    pedagogicalBasis: 'يُ building the concept of sets through visual observation and counting, which is foundational for number sense. Students learn to classify, compare, and count elements in sets.',
    activities: [
      '_microscope: Observe pictures and identify sets',
      'counting: Count elements in each set',
      'comparison: Compare sets (more/less/equal)',
      'sorting: Classify objects into sets based on properties'
    ]
  },
  'الأعداد والعمليات': {
    pedagogicalBasis: 'Building number sense through place value understanding (ones, tens, hundreds) and developing fluency in addition and subtraction. Students progress from concrete representation to abstract calculation.',
    activities: [
      'placeValue: Represent numbers using tens and ones blocks',
      'calculation: Practice addition and subtraction with and without regrouping',
      'numberLine: Use number line for comparison and ordering',
      'wordProblems: Solve real-world addition and subtraction problems'
    ]
  },
  'حلّ المشكل': {
    pedagogicalBasis: 'Developing problem-solving skills through structured situations. Students learn to understand the problem, identify relevant information, plan a solution, and verify results.',
    activities: [
      'situationAnalysis: Read and understand the problem situation',
      'informationExtraction: Identify key information and what is being asked',
      'strategySelection: Choose appropriate operation(s) to solve',
      'solutionWriting: Write the solution clearly and verify the answer'
    ]
  },
  'الأشكال الهندسية والخطوط': {
    pedagogicalBasis: 'Building spatial sense through recognition, drawing, and description of geometric shapes and lines. Students develop visual-spatial reasoning.',
    activities: [
      'recognition: Identify and name geometric shapes',
      'drawing: Draw straight, curved, and broken lines',
      'description: Describe properties of shapes',
      'construction: Build shapes using materials'
    ]
  },
  'المقادير (النقود)': {
    pedagogicalBasis: 'Developing understanding of monetary values through practical situations. Students learn to identify coins, calculate totals, and make change.',
    activities: [
      'identification: Recognize and name different coin denominations',
      'counting: Count combinations of coins',
      'calculation: Calculate total amounts and change',
      'shopping: Simulate buying and selling scenarios'
    ]
  },
  'توظيف المكتسبات وتقييمها': {
    pedagogicalBasis: 'Consolidation and assessment of learning across all domains covered in the period. Students demonstrate mastery of skills through varied exercises.',
    activities: [
      'review: Review key concepts from the period',
      'practice: Complete mixed exercises covering all domains',
      'assessment: Demonstrate understanding through performance tasks',
      'reflection: Reflect on learning achievements'
    ]
  }
};

// Process each unit
let updatedCount = 0;
for (const [key, unit] of Object.entries(data)) {
  if (key === '_meta') continue;
  if (!unit.studentBlocks) continue;
  
  // Add pedagogicalBasis if missing
  if (!unit.pedagogicalBasis) {
    const config = domainConfig[unit.domain];
    if (config) {
      unit.pedagogicalBasis = config.pedagogicalBasis;
      updatedCount++;
    }
  }
  
  // Add activities if missing
  if (!unit.activities) {
    const config = domainConfig[unit.domain];
    if (config) {
      unit.activities = config.activities;
    }
  }
  
  // Ensure all blocks have section
  for (const block of unit.studentBlocks) {
    if (!block.section) {
      // Assign section based on kind
      if (block.kind === 'concept' && block.title?.includes('أستكشف')) {
        block.section = 'explore';
      } else if (block.kind === 'concept' && block.title?.includes('أتذكَّر')) {
        block.section = 'recall';
      } else if (block.kind === 'question' || block.kind === 'table') {
        block.section = 'practice';
      } else {
        block.section = 'practice';
      }
    }
  }
}

console.log(`Updated ${updatedCount} units with pedagogicalBasis`);

// Write back
writeFileSync(filePath, JSON.stringify(data, null, 1), 'utf-8');
console.log('File saved');
