// محاكاة تجربة التلميذ س1-س6: إنشاء أقسام/معلمين/تلاميذ ثم دخول كل تلميذ
// وسحب كل ما يراه فعلياً في المنصة، وتقييم تغطية المحتوى لكل سنة ومادة.
import prisma from '../src/db.js';
import bcrypt from 'bcryptjs';
import { resetDatabase } from '../tests/helpers.js';
import { getLessonPages, listBooks, getBookExercises } from '../src/services/curriculumService.js';

const hash = (pw) => bcrypt.hash(pw, 4);
const YEAR_NAMES = [
  ['year1', 'السنة الأولى', 'السنة الأولى أساسي'],
  ['year2', 'السنة الثانية', 'السنة الثانية أساسي'],
  ['year3', 'السنة الثالثة', 'السنة الثالثة أساسي'],
  ['year4', 'السنة الرابعة', 'السنة الرابعة أساسي'],
  ['year5', 'السنة الخامسة', 'السنة الخامسة أساسي'],
  ['year6', 'السنة السادسة', 'السنة السادسة أساسي']
];
const STUDENT_NAMES = ['سارة', 'يوسف', 'ليلى', 'آدم', 'نور', 'رانية'];

await resetDatabase();

const created = [];
for (let i = 0; i < 6; i += 1) {
  const [gradeId, shortName, level] = YEAR_NAMES[i];
  const teacher = await prisma.user.create({
    data: {
      firstName: `معلمة`, lastName: `قسم ${shortName}`,
      email: `teacher${i + 1}@sim.tn`, passwordHash: await hash('teacher123'),
      role: 'TEACHER', accountStatus: 'ACTIVE'
    }
  });
  const klass = await prisma.class.create({
    data: { name: `قسم ${shortName} أ`, level, teacherId: teacher.id }
  });
  const studentUser = await prisma.user.create({
    data: {
      firstName: STUDENT_NAMES[i], lastName: 'التلميذة',
      email: `student${gradeId}@sim.tn`, passwordHash: await hash('student123'),
      role: 'STUDENT', accountStatus: 'ACTIVE'
    }
  });
  const parent = await prisma.user.create({
    data: {
      firstName: `ولي ${STUDENT_NAMES[i]}`, lastName: 'العائلة',
      email: `parent${i + 1}@sim.tn`, passwordHash: await hash('parent123'),
      role: 'PARENT', accountStatus: 'ACTIVE'
    }
  });
  const student = await prisma.student.create({
    data: {
      userId: parent.id, accountUserId: studentUser.id, classId: klass.id,
      firstName: STUDENT_NAMES[i], lastName: 'التلميذة',
      birthDate: new Date(2014 + i, 3, 10), cin: String(10000000 + i * 1111),
      gender: 'أنثى', level, schoolYear: '2026-2027'
    }
  });
  await prisma.subscription.create({
    data: {
      userId: studentUser.id, type: 'STUDENT', plan: 'اشتراك تلميذ',
      schoolYear: '2026-2027', startDate: new Date('2026-09-01'),
      endDate: new Date('2027-06-30'), status: 'ACTIVE', amount: 147, studentId: student.id
    }
  });
  created.push({ gradeId, level, teacher, klass, student, studentUser });
}

const SUBJECT_LABELS = { math: 'رياضيات', anisi: 'قراءة', science: 'إيقاظ علمي', production: 'إنتاج كتابي' };

function contentStats(pages) {
  const total = pages.length;
  let withRealText = 0, withQuestions = 0, withPassage = 0, withPassageAndQ = 0, empty = 0;
  const allQuestions = [];
  for (const p of pages) {
    const blocks = p.blocks || [];
    const kinds = blocks.map((b) => b.kind);
    const passage = blocks.find((b) => b.kind === 'concept' && (b.text || '').length >= 40);
    const qs = blocks.filter((b) => b.kind === 'question');
    if (passage) withPassage += 1;
    if (qs.length) withQuestions += 1;
    if (passage && qs.length) withPassageAndQ += 1;
    if (blocks.filter((b) => b.kind === 'concept' || b.kind === 'question' || b.kind === 'activity' || b.kind === 'experiment' || b.kind === 'example').length === 0) empty += 1;
    for (const q of qs) {
      allQuestions.push({
        text: q.text || '',
        maxNum: Math.max(0, ...(q.text || '').match(/\d+/g)?.map(Number) || []),
        hasOptions: Array.isArray(q.options) && q.options.length > 1,
        answerOk: q.answer !== undefined
      });
    }
  }
  const nums = allQuestions.filter((q) => q.maxNum > 0).map((q) => q.maxNum);
  return {
    total, withRealText, withQuestions, withPassage, withPassageAndQ, empty,
    questionCount: allQuestions.length,
    mcqRatio: allQuestions.length ? +(allQuestions.filter((q) => q.hasOptions).length / allQuestions.length).toFixed(2) : 0,
    maxNumberUsed: nums.length ? Math.max(...nums) : 0,
    avgWordsPerQuestion: allQuestions.length
      ? +(allQuestions.reduce((s, q) => s + q.text.split(/\s+/).length, 0) / allQuestions.length).toFixed(1)
      : 0
  };
}

const report = { matrix: [], books: {} };
for (const { gradeId } of created) {
  const books = listBooks('TN');
  const myBooks = books.filter((b) => b.gradeId === gradeId);
  report.books[gradeId] = myBooks.map((b) => ({
    subjectId: b.subjectId, subject: b.subject, totalPages: b.totalPages
  }));
  const row = { grade: gradeId, subjects: {} };
  for (const b of myBooks) {
    const pages = getLessonPages(b.subjectId, null, gradeId);
    const exercises = getBookExercises(b.subjectId, null, gradeId);
    row.subjects[b.subjectId] = {
      label: SUBJECT_LABELS[b.subjectId] || b.subject,
      pages: contentStats(pages),
      exercisesCount: exercises.length
    };
  }
  report.matrix.push(row);
}

console.log(JSON.stringify(report, null, 1));
const { writeFileSync } = await import('fs');
writeFileSync('C:/Users/ezedd/AppData/Local/Temp/opencode/sim-report.json', JSON.stringify(report, null, 1), 'utf8');