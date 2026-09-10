import fs from 'fs';

const FILE = 'prisma/schema.prisma';
let src = fs.readFileSync(FILE, 'utf8');

const WANT = {
  Student: ['userId', 'classId'],
  Registration: ['userId', 'studentId', 'classId'],
  Payment: ['paidByUserId'],
  Subscription: ['studentId'],
  Quiz: ['teacherId'],
  OfficialExam: ['teacherId'],
  AnnualPlan: ['teacherId'],
  Class: ['teacherId'],
  SubmittedExam: ['classId'],
  AttendanceRecord: ['recordedBy'],
  CalendarEvent: ['createdBy'],
  SchoolAnnouncement: ['createdBy'],
  Refund: ['refundedBy'],
  DiscountCode: ['createdBy'],
  HelpRequest: ['userId']
};

function modelBounds(name) {
  const start = src.indexOf(`model ${name} {`);
  if (start === -1) throw new Error(`model ${name} not found`);
  const end = src.indexOf('\n}', start);
  if (end === -1) throw new Error(`model ${name} has no closing brace`);
  return [start, end];
}

for (const [model, cols] of Object.entries(WANT)) {
  const [start, end] = modelBounds(model);
  const block = src.slice(start, end);
  const additions = cols
    .filter((c) => !block.includes(`@@index([${c}])`))
    .map((c) => `  @@index([${c}])`);
  if (!additions.length) { console.log(`${model}: ok`); continue; }
  src = src.slice(0, end) + '\n' + additions.join('\n') + src.slice(end);
  console.log(`${model}: +${additions.length}`);
}

const [ds, de] = modelBounds('DiscountCode');
const dcBlock = src.slice(ds, de).replace(/value\s+Float/, 'value       Decimal @db.Decimal(12, 3)');
src = src.slice(0, ds) + dcBlock + src.slice(de);
console.log('DiscountCode.value → Decimal(12,3)');

fs.writeFileSync(FILE, src, 'utf8');
