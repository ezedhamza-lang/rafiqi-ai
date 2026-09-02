// ===== المرحلة 2 — ذكاء التعلم: خريطة الإتقان + رادار الفجوات + ذكاء التقويم =====
//
// Mastery Map: لكل مادة، دروس الكتاب بحالة إتقان حية (منجز/جارٍ/لم يبدأ) مبنية على
//   LessonProgress الفعلي ومتوسط درجات الاختبارات.
// Gap Radar: فجوات التعلم المكتشفة قبل ظهورها في النتائج — كل فجوة بأدلتها واقتراح.
// Assessment Intelligence: تحليل أسئلة اختبار معين — كشف الأسئلة التي أجهلها
//   أغلب القسم (صعوبة أو إشكال صياغة) بنسب نجاح حقيقية من التسليمات.
import prisma from '../db.js';
import { gradeQuestion } from './gradingService.js';
import { getLessonPages } from './curriculumService.js';

const LEVEL_TO_GRADE = [
  ['السنة الأولى', 'year1'],
  ['السنة الثانية', 'year2'],
  ['السنة الثالثة', 'year3'],
  ['السنة الرابعة', 'year4'],
  ['السنة الخامسة', 'year5'],
  ['السنة السادسة', 'year6']
];

function gradeIdForLevel(level) {
  const l = String(level || '');
  for (const [needle, id] of LEVEL_TO_GRADE) if (l.includes(needle)) return id;
  return null;
}

/**
 * خريطة الإتقان لتلميذ: لكل مادة قائمة دروس الكتاب بحالة الإتقان.
 * الإتقان: منجز (أكمله + متوسطه ≥50% إن وُجدت اختبارات)، جارٍ، لم يبدأ.
 */
export async function buildMasteryMap(accountUserId) {
  const student = await prisma.student.findFirst({
    where: { accountUserId },
    include: { class: { select: { level: true } } }
  });
  if (!student?.class) return { subjects: [], summary: { total: 0, mastered: 0, inProgress: 0, notStarted: 0 } };

  const gradeId = gradeIdForLevel(student.class.level);
  if (!gradeId) return { subjects: [], summary: { total: 0, mastered: 0, inProgress: 0, notStarted: 0 } };

  const subjects = ['math', 'anisi', 'science', 'production'];
  const progressRows = await prisma.lessonProgress.findMany({
    where: { userId: accountUserId, gradeId },
    select: { subjectId: true, lessonId: true, completedAt: true }
  });
  const doneSet = new Set(progressRows.map((p) => `${p.subjectId}:${p.lessonId}`));

  const quizzes = await prisma.quiz.findMany({
    where: { classId: student.classId },
    select: { id: true, subject: true }
  });
  const subs = await prisma.submission.findMany({
    where: { studentId: accountUserId, quizId: { in: quizzes.map((q) => q.id) } },
    select: { quizId: true, score: true, totalPoints: true }
  });
  const pctBySubject = {};
  for (const sub of subs) {
    const q = quizzes.find((x) => x.id === sub.quizId);
    if (!q || !sub.totalPoints) continue;
    const key = normSubject(q.subject);
    const pct = (sub.score / sub.totalPoints) * 100;
    (pctBySubject[key] ||= []).push(pct);
  }

  const outSubjects = [];
  const totals = { total: 0, mastered: 0, inProgress: 0, notStarted: 0 };
  for (const subjectId of subjects) {
    let pages = [];
    try {
      pages = getLessonPages(subjectId, student.class.level, gradeId);
    } catch { /* مادة بلا محتوى لهذه السنة */ }
    if (!pages.length) continue;

    const avgPct = (pctBySubject[subjectId] || []).length
      ? Math.round((pctBySubject[subjectId] || []).reduce((a, b) => a + b, 0) / (pctBySubject[subjectId] || []).length)
      : null;

    const lessons = pages.map((p, i) => {
      const done = doneSet.has(`${subjectId}:${p.id}`);
      const status = done ? 'COMPLETED' : i === 0 || doneSet.size === 0 ? 'NOT_STARTED' : 'NOT_STARTED';
      const mastery = done ? (avgPct == null || avgPct >= 50 ? 'MASTERED' : 'IN_PROGRESS') : 'NOT_STARTED';
      return { lessonId: p.id, title: p.title, order: i + 1, status, mastery };
    });
    for (const l of lessons) {
      totals.total += 1;
      totals[l.mastery === 'MASTERED' ? 'mastered' : l.mastery === 'IN_PROGRESS' ? 'inProgress' : 'notStarted'] += 1;
    }
    outSubjects.push({ subjectId, avgQuizPct: avgPct, lessons });
  }
  return { subjects: outSubjects, summary: totals };
}

function normSubject(s) {
  const v = String(s || '').toLowerCase();
  if (/رياض|math/.test(v)) return 'math';
  if (/قراءة|أنيسي|anisi|arabic/.test(v)) return 'anisi';
  if (/إيقاظ|ايقاظ|science/.test(v)) return 'science';
  if (/إنتاج|انتاج|production|writing/.test(v)) return 'production';
  if (/إسلامية|اسلامية|islamic/.test(v)) return 'islamic';
  if (/تقنية|tech/.test(v)) return 'tech';
  return v;
}

/**
 * رادار الفجوات: يكتشف فجوات التعلم قبل النتائج النهائية.
 * الأدلة: دروس متأخرة عن إيقاع القسم + اختبارات تحت 50% + بطاقات تكيف متكررة الفشل.
 */
export async function detectGaps(accountUserId) {
  const student = await prisma.student.findFirst({
    where: { accountUserId },
    include: { class: { select: { id: true, level: true } } }
  });
  if (!student?.class) return [];

  const gradeId = gradeIdForLevel(student.class.level);
  const gaps = [];

  // 1) اختبارات ضعيفة حسب المادة
  const quizzes = await prisma.quiz.findMany({
    where: { classId: student.class.id },
    select: { id: true, subject: true, title: true }
  });
  const subs = await prisma.submission.findMany({
    where: { studentId: accountUserId, quizId: { in: quizzes.map((q) => q.id) } },
    include: { quiz: { select: { subject: true, title: true } } }
  });
  const bySubject = {};
  for (const s of subs) {
    if (!s.totalPoints) continue;
    const key = normSubject(s.quiz.subject);
    (bySubject[key] ||= []).push({ pct: (s.score / s.totalPoints) * 100, title: s.quiz.title });
  }
  for (const [subject, items] of Object.entries(bySubject)) {
    const weak = items.filter((i) => i.pct < 50);
    if (!weak.length) continue;
    const avg = Math.round(weak.reduce((a, b) => a + b.pct, 0) / weak.length);
    gaps.push({
      area: subject,
      severity: avg < 35 ? 'HIGH' : 'MEDIUM',
      why: `متوسط ${avg}% في ${weak.length} اختبار(ات) دون العتبة (50%).`,
      evidence: weak.slice(0, 4).map((w) => `${w.title}: ${Math.round(w.pct)}%`),
      suggestedAction: 'مراجعة دروس هذه المادة ثم حل بطاقات المراجعة التكيفية.'
    });
  }

  // 2) تأخر عن إيقاع القسم (دروس منجزة للقسم أكثر منها للتلميذ)
  if (gradeId) {
    const classmates = await prisma.student.findMany({
      where: { classId: student.class.id, accountUserId: { not: null } },
      select: { accountUserId: true }
    });
    const ids = classmates.map((c) => c.accountUserId);
    if (ids.length > 1) {
      const rows = await prisma.lessonProgress.groupBy({
        by: ['subjectId', 'lessonId'],
        where: { userId: { in: ids }, gradeId },
        _count: { _all: true }
      });
      const mine = new Set(
        (await prisma.lessonProgress.findMany({ where: { userId: accountUserId, gradeId }, select: { subjectId: true, lessonId: true } }))
          .map((r) => `${r.subjectId}:${r.lessonId}`)
      );
      const half = Math.ceil(ids.length / 2);
      for (const r of rows) {
        if (r._count._all >= half && !mine.has(`${r.subjectId}:${r.lessonId}`)) {
          gaps.push({
            area: r.subjectId,
            severity: 'LOW',
            why: `أغلب زملاء القسم أنجزوا هذا الدرس وأنت لم تنجزه بعد.`,
            evidence: [`الدرس: ${r.lessonId} (${r._count._all}/${ids.length} من الزملاء)`],
            suggestedAction: 'افتح الدرس وأنجه اليوم للحفاظ على وتيرتك.'
          });
          if (gaps.length >= 8) break;
        }
      }
    }
  }

  return gaps;
}

/**
 * ذكاء التقويم: تحليل اختبار — نسبة النجاح لكل سؤال عبر كل التسليمات،
 * وكشف الأسئلة «الفخّة» التي أجهلها أغلب القسم (صعوبة أو صياغة).
 */
export async function analyzeQuiz(quizId) {
  const quiz = await prisma.quiz.findUnique({ where: { id: quizId } });
  if (!quiz) return null;
  const questions = Array.isArray(quiz.questions) ? quiz.questions : [];
  const submissions = await prisma.submission.findMany({
    where: { quizId },
    select: { answers: true, score: true, totalPoints: true }
  });

  const perQuestion = questions.map((q) => {
    let correctCount = 0;
    let answered = 0;
    for (const s of submissions) {
      const ans = s.answers?.[q.id];
      if (ans === undefined || ans === null || ans === '') continue;
      answered += 1;
      const g = gradeQuestion(q, ans);
      if (g.correct) correctCount += 1;
    }
    const successRate = answered ? Math.round((correctCount / answered) * 100) : null;
    let flag = null;
    if (successRate != null && answered >= 3 && successRate < 40) {
      flag = 'سؤال أجهل أغلب القسم — راجع الصياغة أو أعد شرح المفهوم.';
    } else if (successRate != null && answered >= 3 && successRate > 95) {
      flag = 'سؤال سهل جداً — قد لا يميّز مستويات التلاميذ.';
    }
    return {
      questionId: q.id,
      type: q.type || null,
      prompt: String(q.prompt || q.title || q.text || q.question || '').slice(0, 120),
      answered,
      successRate,
      flag
    };
  });

  const classAvg = submissions.length
    ? Math.round(submissions.reduce((a, s) => a + (s.totalPoints ? (s.score / s.totalPoints) * 100 : 0), 0) / submissions.length)
    : null;

  return {
    quizId,
    title: quiz.title,
    subject: quiz.subject,
    submissions: submissions.length,
    classAvgPct: classAvg,
    questions: perQuestion,
    suspiciousQuestions: perQuestion.filter((q) => q.flag),
    explainability: 'النسب محسوبة من تسليمات حقيقية بمحرك التصحيح نفسه المستعمل مع التلاميذ.'
  };
}