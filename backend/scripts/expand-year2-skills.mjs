import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';

const unitsPath = resolve('backend/curriculum/year2/math-units.json');
const skillsPath = resolve('backend/curriculum/year2/skills-map-math.json');

const units = JSON.parse(readFileSync(unitsPath, 'utf-8'));
const skills = JSON.parse(readFileSync(skillsPath, 'utf-8'));

// Domain to skills mapping
const domainSkills = {
  'المجموعات': {
    skills: ['set-classification', 'counting'],
    competencies: ['التصرف في المجموعات ومكوّناتها'],
  },
  'الأعداد والعمليات': {
    skills: ['number-sense', 'calculation', 'place-value'],
    competencies: ['توظيف العمليات الحسابية في نطاق مناسب'],
  },
  'حلّ المشكل': {
    skills: ['problem-solving', 'analytical-thinking'],
    competencies: ['حلّ وضعيات مشكل دالة'],
  },
  'الأشكال الهندسية والخطوط': {
    skills: ['geometry', 'spatial-reasoning'],
    competencies: ['استعمال خاصيّات الأشكال الهندسية'],
  },
  'المقادير (النقود)': {
    skills: ['measurement', 'money'],
    competencies: ['التصرف في المقادير'],
  },
  'توظيف المكتسبات وتقييمها': {
    skills: ['self-assessment', 'consolidation'],
    competencies: ['تقييم التمكّن من المكتسبات'],
  }
};

// Generate learning objectives based on unit title
function generateObjectives(unit) {
  const title = unit.title;
  const domain = unit.domain;
  
  if (domain === 'المجموعات') {
    return ['يُميّز المجموعات ومكوّناتها ويعيدها'];
  }
  if (domain === 'الأعداد والعمليات') {
    if (title.includes('الجمع')) return ['يجمع عددين مناسبين بالاحتفاظ ومن دونه'];
    if (title.includes('الطرح')) return ['يطرح عددين مناسبين بالتفكيك ومن دونه'];
    if (title.includes('القراءة')) return ['يقرأ ويكتب أعداداً في النطاق المحدد'];
    if (title.includes('التفكيك')) return ['يفكّك ويُركّب الأعداد حسب.place value'];
    if (title.includes('المقارنة')) return ['يقارن ويُرتّب أعداداً في النطاق المحدد'];
    if (title.includes('العشرات')) return ['يُمثّل العدد بالعشرات والآحاد'];
    if (title.includes('المكمّل')) return ['يُكمّل عدد إلى عدد آخر'];
    return ['يتوظّف الأعداد والعمليات في وضعيات مناسبة'];
  }
  if (domain === 'حلّ المشكل') {
    return ['يحلّ وضعيات مشكل من محيطه اليومي'];
  }
  if (domain === 'الأشكال الهندسية والخطوط') {
    if (title.includes('المضلّع')) return ['يتعرّف على المضلّعات ويُميّزها'];
    if (title.includes('الخط')) return ['يريّز ويُميّز الخطوط المستقيمة والمنحنية'];
    return ['يُوظّف الأشكال الهندسية في تصفّح بيئته'];
  }
  if (domain === 'المقادير (النقود)') {
    return ['يتصرّف في القطع النقدية المتداولة'];
  }
  return ['يُوظّف المكتسبات في وضعيات جديدة'];
}

// Process each unit
for (const [key, unit] of Object.entries(units)) {
  if (key === '_meta') continue;
  if (!unit.studentBlocks) continue;
  if (skills.lessons[key]) continue; // Skip already curated
  
  const config = domainSkills[unit.domain] || domainSkills['الأعداد والعمليات'];
  
  skills.lessons[key] = {
    learningObjectives: generateObjectives(unit),
    competencies: config.competencies,
    skills: config.skills,
    indicators: [`ينجز أنشطة الدرس ${unit.num} ب-level مقبول`],
    prerequisites: key === 'y2m01' ? [] : ['number-sense'],
    expectedOutcomes: [`يُظهر تمكّناً من محتوى الدرس ${unit.num}`],
    source: 'auto'
  };
}

console.log(`Total curated lessons: ${Object.values(skills.lessons).filter(l => l.source === 'curated').length}`);
console.log(`Total auto-generated lessons: ${Object.values(skills.lessons).filter(l => l.source === 'auto').length}`);
console.log(`Total lessons: ${Object.keys(skills.lessons).length}`);

writeFileSync(skillsPath, JSON.stringify(skills, null, 2), 'utf-8');
console.log('Skills map saved');
