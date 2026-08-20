import prisma from '../db.js';
import { listBooks, getLessonPages, findGradeByLevel } from './curriculumService.js';
import { difficultyLabel } from './adaptiveService.js';

// ===== المرحلة 7.3 — التعلم التكيفي المتقدم: خطة تعلّم شخصية =====
//
// خطة تعلّم شخصية تُعدّل مواد التلميذ وتمارينه ديناميكياً حسب أدائه في
// الاختبارات والواجبات والمراجعة المتقاربة (Spaced Repetition).
//
// بموجب قاعدة «لا نختلق محتوى»: كل الأرقام مأخوذة من سجلات المنصة الحقيقية
// (إجابات التكليفات، الاختبارات القصيرة، الاختبارات الرسمية، بطاقات المراجعة
// الذكية، الدروس المكتملة). المحرك حتمي قابل للشرح (no black box).

const PROFICIENCY_WEAK = 60;
const PROFICIENCY_STRONG = 80;
const REVIEWS_REQUIRED_FOR_ADJUST = 3;
const MAX_PLAN_ITEMS = 6;

// تعيين مادة التقييم (واجبات/اختبارات/اختبارات رسمية) إلى مادة المنهج (كتاب).
const ASSESSMENT_TO_SUBJECT = {
  MATH: 'math',
  READING: 'anisi',
  SCIENCE: 'science',
  STORIES: 'anisi'
};

export const SUBJECT_ICONS = {
  math: 'calculate',
  anisi: 'menu_book',
  science: 'science'
};

const STATUS_RANK = {
  WEAK: 0,
  MEDIUM: 1,
  NO_DATA: 2,
  STRONG: 3
};

export const STATUS_LABELS = {
  WEAK: 'تحتاج دعماً',
  MEDIUM: 'يسير جيداً — تحتاج ممارسة',
  STRONG: 'متقن',
  NO_DATA: 'لا توجد بيانات كافية'
};

function clampInt(n, min, max) {
  return Math.max(min, Math.min(max, Math.round(Number(n) || min)));
}

function percentOf(score, total) {
  if (!score || !total) return 0;
  return Math.round((Number(score) / Number(total)) * 100);
}

function avgOf(list) {
  const items = (list || []).filter((n) => Number.isFinite(n));
  if (!items.length) return 0;
  return Math.round(items.reduce((sum, n) => sum + n, 0) / items.length);
}

export function subjectOfAssessment(code) {
  return ASSESSMENT_TO_SUBJECT[String(code || '').trim().toUpperCase()] || null;
}

// ===== تجميع بيانات التلميذ الحقيقية =====

async function gatherStudentData(accountUserId) {
  const student = await prisma.student.findFirst({ where: { accountUserId } });
  if (!student) return null;

  const [assignmentSubs, quizSubs, officialSubs, adaptive, lessons] = await Promise.all([
    prisma.assignmentSubmission.findMany({
      where: { studentId: accountUserId },
      include: { assignment: { select: { subject: true, title: true } } }
    }),
    prisma.submission.findMany({
      where: { studentId: accountUserId },
      include: { quiz: { select: { subject: true, title: true } } }
    }),
    prisma.officialSubmission.findMany({ where: { studentId: accountUserId } }),
    prisma.adaptiveCard.findMany({ where: { userId: accountUserId } }),
    prisma.lessonProgress.findMany({ where: { userId: accountUserId } })
  ]);

  return { student, assignmentSubs, quizSubs, officialSubs, adaptive, lessons };
}

// تحديد سنوات التلميذ (السنة التي يتفاعل معها على المنصة، مع احتياط من مستواه).
// مستويات سجلات التلاميذ تكتب «أساسي» بينما عناوين المنهج تكتب «ابتدائي» — نحاول
// كلا الصيغتين في مطابقة المستوى.
async function resolveStudentGradeIds(accountUserId, level) {
  const [cards, lessons] = await Promise.all([
    prisma.adaptiveCard.findMany({ where: { userId: accountUserId }, select: { gradeId: true } }),
    prisma.lessonProgress.findMany({ where: { userId: accountUserId }, select: { gradeId: true } })
  ]);
  const fromRecords = [...new Set([...cards.map((c) => c.gradeId), ...lessons.map((l) => l.gradeId)])].filter(Boolean);
  if (fromRecords.length) return fromRecords;

  const normalized = String(level || '').trim().replace(/أساسي|اساسي/g, 'ابتدائي');
  for (const candidate of new Set([level, normalized])) {
    const grade = findGradeByLevel(candidate);
    if (grade) return [grade.id];
  }
  return [];
}

function adaptiveStats(cards) {
  let reviews = 0;
  let correct = 0;
  let dueNow = 0;
  let learned = 0;
  let diffSum = 0;
  let diffCount = 0;
  const now = Date.now();
  for (const c of cards) {
    reviews += c.reviewCount || 0;
    correct += c.correctCount || 0;
    if (c.dueAt <= new Date(now)) dueNow += 1;
    if ((c.repetitions || 0) >= 2) learned += 1;
    if (c.reviewCount > 0) {
      diffSum += c.difficulty || 1;
      diffCount += 1;
    }
  }
  return {
    totalCards: cards.length,
    reviews,
    accuracy: reviews ? Math.round((correct / reviews) * 100) : null,
    dueNow,
    learned,
    avgDifficulty: diffCount ? Math.round(diffSum / diffCount) : 1
  };
}

// ===== ملف كل مادة (من السجلات الحقيقية) =====

function subjectProfile({ gradeId, subjectId, subject }, data) {
  const assign = data.assignmentSubs.filter((s) => subjectOfAssessment(s.assignment?.subject) === subjectId);
  const quiz = data.quizSubs.filter((s) => subjectOfAssessment(s.quiz?.subject) === subjectId);
  const exams = data.officialSubs.filter((s) => subjectOfAssessment(s.subject) === subjectId);
  const cards = data.adaptive.filter((c) => c.gradeId === gradeId && c.subjectId === subjectId);
  const lessons = data.lessons.filter((l) => l.gradeId === gradeId && l.subjectId === subjectId);

  const gradedAssign = assign.filter((s) => s.totalPoints);
  const gradedQuiz = quiz.filter((s) => s.totalPoints);
  const gradedExams = exams.filter((s) => s.score != null);

  const assignAvg = avgOf(gradedAssign.map((s) => percentOf(s.score, s.totalPoints)));
  const quizAvg = avgOf(gradedQuiz.map((s) => percentOf(s.score, s.totalPoints)));
  const examAvg = avgOf(gradedExams.map((s) => Math.min(100, Math.round((Number(s.score) / 20) * 100))));

  const parts = [
    gradedAssign.length ? assignAvg : null,
    gradedQuiz.length ? quizAvg : null,
    gradedExams.length ? examAvg : null
  ].filter((v) => v != null);
  const assessmentAvg = parts.length ? Math.round(parts.reduce((a, b) => a + b, 0) / parts.length) : null;

  const adaptive = adaptiveStats(cards);
  const scores = [];
  if (assessmentAvg != null) scores.push(assessmentAvg);
  if (adaptive.accuracy != null) scores.push(adaptive.accuracy);
  const proficiency = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;

  const status = proficiency == null
    ? 'NO_DATA'
    : proficiency >= PROFICIENCY_STRONG
      ? 'STRONG'
      : proficiency >= PROFICIENCY_WEAK
        ? 'MEDIUM'
        : 'WEAK';

  // المستوى المستهدف يتغيّر ديناميكياً من الأداء: دقة عالية تصعّب، ودقة منخفضة تسهّل.
  const baseDifficulty = adaptive.reviews > 0
    ? adaptive.avgDifficulty
    : proficiency == null
      ? 1
      : proficiency < PROFICIENCY_WEAK ? 1 : proficiency >= PROFICIENCY_STRONG ? 3 : 2;
  let targetDifficulty = baseDifficulty;
  if (adaptive.reviews >= REVIEWS_REQUIRED_FOR_ADJUST && adaptive.accuracy != null) {
    if (adaptive.accuracy >= 80) targetDifficulty = Math.min(5, baseDifficulty + 1);
    else if (adaptive.accuracy <= 60) targetDifficulty = Math.max(1, baseDifficulty - 1);
  }

  return {
    gradeId,
    subjectId,
    subject,
    label: subject,
    icon: SUBJECT_ICONS[subjectId] || 'school',
    proficiency,
    status,
    statusLabel: STATUS_LABELS[status],
    assessment: {
      assignments: { graded: gradedAssign.length, avgPercent: gradedAssign.length ? assignAvg : null },
      quizzes: { graded: gradedQuiz.length, avgPercent: gradedQuiz.length ? quizAvg : null },
      exams: { graded: gradedExams.length, avgPercent: gradedExams.length ? examAvg : null },
      avgPercent: assessmentAvg
    },
    adaptive,
    lessonsCompleted: lessons.length,
    baseDifficulty,
    targetDifficulty,
    targetDifficultyLabel: difficultyLabel(targetDifficulty),
    adjusted: targetDifficulty !== baseDifficulty
  };
}

// ===== بناء الخطة الشاملة =====

export async function buildLearningPlan(accountUserId) {
  const data = await gatherStudentData(accountUserId);
  if (!data) return null;

  const gradeIds = await resolveStudentGradeIds(accountUserId, data.student?.level);
  const books = listBooks().filter((b) => gradeIds.includes(b.gradeId));

  // درس كل مادة مرة واحدة (للتوصيات وإحصاءات الإكمال)
  const lessonPages = new Map();
  for (const book of books) {
    const key = `${book.gradeId}:${book.subjectId}`;
    if (!lessonPages.has(key)) {
      lessonPages.set(key, getLessonPages(book.subjectId, book.grade, book.gradeId));
    }
  }

  const subjects = books.map((book) => {
    const profile = subjectProfile(book, data);
    const pages = lessonPages.get(`${book.gradeId}:${book.subjectId}`) || [];
    const completedKeys = new Set(
      data.lessons.filter((l) => l.gradeId === book.gradeId && l.subjectId === book.subjectId).map((l) => l.lessonId)
    );
    const remaining = pages.filter((p) => !completedKeys.has(p.id));
    const nextLesson = remaining[0] || null;
    return {
      ...profile,
      totalLessons: pages.length,
      remainingLessons: remaining.length,
      nextLesson: nextLesson ? { id: nextLesson.id, title: nextLesson.title } : null
    };
  });

  const assessed = subjects.filter((s) => s.proficiency != null);
  const overallAvg = assessed.length ? Math.round(assessed.reduce((sum, s) => sum + s.proficiency, 0) / assessed.length) : null;
  const overallStatus = assessed.length === 0
    ? 'NO_DATA'
    : overallAvg >= PROFICIENCY_STRONG
      ? 'STRONG'
      : overallAvg >= PROFICIENCY_WEAK
        ? 'MEDIUM'
        : 'WEAK';

  const ordered = subjects.slice().sort(
    (a, b) => STATUS_RANK[a.status] - STATUS_RANK[b.status] || b.adaptive.dueNow - a.adaptive.dueNow || b.assessment.avgPercent - a.assessment.avgPercent
  );

  const focusAreas = ordered
    .filter((s) => s.status === 'WEAK' || s.status === 'MEDIUM')
    .map((s) => ({
      gradeId: s.gradeId,
      subjectId: s.subjectId,
      label: s.label,
      status: s.status,
      proficiency: s.proficiency,
      dueNow: s.adaptive.dueNow
    }));

  const dailyPlan = [];
  for (const s of ordered) {
    if (dailyPlan.length >= MAX_PLAN_ITEMS) break;
    if (s.adaptive.dueNow > 0) {
      dailyPlan.push({
        type: 'REVIEW',
        gradeId: s.gradeId,
        subjectId: s.subjectId,
        label: s.label,
        icon: 'psychology',
        title: `راجع ${s.adaptive.dueNow} بطاقة مستحقة في ${s.label}`,
        detail: 'بطاقات التكرار المتقارب المستحقة اليوم — تعيد تثبيت ما تعلمته',
        link: '/student-space/adaptive'
      });
    }
    if (s.remainingLessons > 0 && dailyPlan.length < MAX_PLAN_ITEMS) {
      dailyPlan.push({
        type: 'LESSON',
        gradeId: s.gradeId,
        subjectId: s.subjectId,
        label: s.label,
        icon: 'menu_book',
        title: s.nextLesson
          ? `أكمل درس «${s.nextLesson.title}» في ${s.label}`
          : `أتم ${s.remainingLessons} درساً متبقياً في ${s.label}`,
        detail: `أتممت ${s.lessonsCompleted} من ${s.totalLessons} درساً في هذه المادة`,
        link: '/student-space/books'
      });
    }
    if ((s.status === 'WEAK' || s.status === 'MEDIUM') && dailyPlan.length < MAX_PLAN_ITEMS) {
      dailyPlan.push({
        type: 'EXERCISE',
        gradeId: s.gradeId,
        subjectId: s.subjectId,
        label: s.label,
        icon: 'edit_note',
        title: `تمرّن على ${s.label} بمستوى «${s.targetDifficultyLabel}»`,
        detail: `أداؤك في ${s.label} يستدعي ممارسة إضافية — اختر مستوى ${s.targetDifficultyLabel}`,
        link: '/student-space/adaptive'
      });
    }
  }
  if (!dailyPlan.length) {
    dailyPlan.push({
      type: 'ALL_DONE',
      gradeId: null,
      subjectId: null,
      label: null,
      icon: 'auto_awesome',
      title: 'لا توجد توصيات جديدة اليوم',
      detail: 'أنجزت كل المراجعات والدروس الموصى بها — واصل الإيقاع ذاته.',
      link: null
    });
  }

  const reasons = [];
  for (const s of subjects) {
    if (s.status === 'WEAK') {
      reasons.push(`متوسط درجاتك في ${s.label} ${s.proficiency}% — دون عتبة التمكين (${PROFICIENCY_WEAK}%)`);
    }
    if (s.adaptive.reviews >= 3 && s.adaptive.accuracy != null && s.adaptive.accuracy < 60) {
      reasons.push(`دقتك في المراجعة الذكية لـ ${s.label} ${s.adaptive.accuracy}% — راجع الأساسيات أولاً`);
    }
    if (s.adaptive.dueNow > 0) {
      reasons.push(`${s.adaptive.dueNow} بطاقة مراجعة مستحقة اليوم في ${s.label}`);
    }
    if (s.remainingLessons > 0) {
      reasons.push(`${s.remainingLessons} درساً في ${s.label} لم يُستكمل بعد`);
    }
  }

  const adjustments = subjects
    .filter((s) => s.adjusted && s.adaptive.reviews >= REVIEWS_REQUIRED_FOR_ADJUST)
    .map((s) => ({
      gradeId: s.gradeId,
      subjectId: s.subjectId,
      label: s.label,
      from: s.baseDifficulty,
      to: s.targetDifficulty,
      fromLabel: difficultyLabel(s.baseDifficulty),
      toLabel: s.targetDifficultyLabel,
      reason: s.targetDifficulty > s.baseDifficulty
        ? `دقتك في المراجعة الذكية لـ ${s.label} ${s.adaptive.accuracy}% تتجاوز 80% — صُعّب مستوى التمرين إلى «${s.targetDifficultyLabel}»`
        : `دقتك في المراجعة الذكية لـ ${s.label} ${s.adaptive.accuracy}% دون 60% — سُهّل مستوى التمرين إلى «${s.targetDifficultyLabel}»`
    }));

  return {
    generatedAt: new Date().toISOString(),
    student: {
      firstName: data.student?.firstName || '',
      lastName: data.student?.lastName || '',
      level: data.student?.level || ''
    },
    overall: {
      status: overallStatus,
      statusLabel: STATUS_LABELS[overallStatus],
      avgPercent: overallAvg,
      hasData: assessed.length > 0,
      focusAreas
    },
    subjects,
    dailyPlan,
    reasons: reasons.slice(0, 8),
    adjustments
  };
}

// ===== جلسة ممارسة موصى بها تتبع الخطة =====

async function mergeSessions(order, userId, limit) {
  const { buildSession } = await import('./adaptiveService.js');
  const items = [];
  const applied = [];
  for (const o of order) {
    if (items.length >= limit) break;
    const session = await buildSession(userId, o.gradeId, o.subjectId, limit - items.length);
    applied.push({ gradeId: o.gradeId, subjectId: o.subjectId, included: session.items.length });
    for (const item of session.items) {
      items.push({ ...item, gradeId: o.gradeId, subjectId: o.subjectId });
    }
  }
  return {
    items,
    meta: { total: items.length, limit, order: applied, basedOn: 'weakest-first' }
  };
}

export async function buildRecommendedSession(accountUserId, { gradeId, subjectId, limit = 10 } = {}) {
  const l = clampInt(limit, 1, 30);
  if (gradeId && subjectId) {
    return mergeSessions([{ gradeId, subjectId }], accountUserId, l);
  }
  const plan = await buildLearningPlan(accountUserId);
  if (!plan) return { items: [], meta: { total: 0, limit: l, order: [], basedOn: 'weakest-first' } };
  const order = plan.subjects
    .map((s) => ({ gradeId: s.gradeId, subjectId: s.subjectId, rank: STATUS_RANK[s.status], due: s.adaptive.dueNow }))
    .sort((a, b) => a.rank - b.rank || b.due - a.due);
  return mergeSessions(order, accountUserId, l);
}
