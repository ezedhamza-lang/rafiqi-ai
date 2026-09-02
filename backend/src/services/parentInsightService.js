import prisma from '../db.js';
import { subjectLabel } from './analyticsService.js';

// ===== المرحلة 7.3 — رؤى الولي: محرك توقع التعثر المبكر + ملخصات + أنشطة =====
//
// كل البيانات مأخوذة من سجلات المنصة الحقيقية (تكليفات/اختبارات/حضور/تقدم/تدريب
// تكيفي/شارات) بموجب قاعدة «لا نختلق محتوى». المقياس الترتيبي مبني على قواعد
// حتمية قابلة للشرح (no black box) مع إمكانية إثراء الملخص والأنشطة بالذكاء
// الاصطناعي عبر محتوى مبني على نفس البيانات الحقيقية.

export const RISK_LEVELS = {
  LOW: { label: 'مستقر', color: 'good' },
  MEDIUM: { label: 'متابعة', color: 'warn' },
  HIGH: { label: 'خطر تعثر', color: 'bad' },
  CRITICAL: { label: 'خطر شديد', color: 'critical' }
};

export function clamp100(n) {
  return Math.max(0, Math.min(100, Math.round(Number(n) || 0)));
}

function percentOf(submission) {
  if (!submission || !submission.totalPoints) return 0;
  return Math.round((submission.score / submission.totalPoints) * 100);
}

function avgOf(list) {
  const items = (list || []).filter((s) => s && Number.isFinite(s.percent));
  if (!items.length) return 0;
  return Math.round(items.reduce((sum, s) => sum + s.percent, 0) / items.length);
}

function normalizeSubject(code) {
  const c = String(code || '').trim();
  const map = {
    MATH: 'MATH',
    الرياضيات: 'MATH',
    'رياضيات': 'MATH',
    READING: 'READING',
    القراءة: 'READING',
    عربية: 'READING',
    'العربية': 'READING',
    SCIENCE: 'SCIENCE',
    'إيقاظ علمي': 'SCIENCE',
    'ايقاظ علمي': 'SCIENCE',
    'الإيقاظ العلمي': 'SCIENCE',
    STORIES: 'STORIES',
    قصص: 'STORIES',
    'القصص': 'STORIES'
  };
  return map[c] || c;
}

function subjectLabelSafe(code) {
  const n = normalizeSubject(code);
  if (n === 'MATH') return 'الرياضيات';
  if (n === 'READING') return 'القراءة';
  if (n === 'SCIENCE') return 'الإيقاظ العلمي';
  if (n === 'STORIES') return 'القصص';
  return subjectLabel(n);
}

// ===== تجميع البيانات الحقيقية للابن =====

export async function gatherStudentData(accountUserId) {
  const student = await prisma.student.findFirst({
    where: { accountUserId },
    include: { class: { select: { id: true, name: true, level: true, teacherId: true } }, account: true }
  });
  if (!student) return null;

  const classId = student.classId;
  const [assignments, assignmentSubs, quizzes, quizSubs, attendance, lessons, activities, adaptive, badges, officialSubs] =
    await Promise.all([
      classId ? prisma.assignment.findMany({ where: { classId }, orderBy: { dueDate: 'asc' } }) : Promise.resolve([]),
      prisma.assignmentSubmission.findMany({ where: { studentId: accountUserId } }),
      classId ? prisma.quiz.findMany({ where: { classId } }) : Promise.resolve([]),
      prisma.submission.findMany({
        where: { studentId: accountUserId },
        include: { quiz: { select: { subject: true, title: true } } }
      }),
      prisma.attendanceRecord.findMany({
        where: { studentId: accountUserId },
        orderBy: { date: 'desc' },
        take: 60
      }),
      prisma.lessonProgress.findMany({ where: { userId: accountUserId } }),
      prisma.activityLog.findMany({
        where: { studentId: accountUserId },
        orderBy: { createdAt: 'desc' },
        take: 30
      }),
      prisma.adaptiveCard.findMany({ where: { userId: accountUserId } }),
      prisma.studentBadge.findMany({ where: { studentId: accountUserId }, include: { badge: true } }),
      prisma.officialSubmission.findMany({ where: { studentId: accountUserId } })
    ]);

  return {
    student,
    assignments,
    assignmentSubs,
    quizzes,
    quizSubs,
    attendance,
    lessons,
    activities,
    adaptive,
    badges,
    officialSubs
  };
}

// ===== أداء المواد =====

export function subjectPerformance(data) {
  const rows = {};
  const push = (subject, percent, graded = true) => {
    const key = normalizeSubject(subject);
    if (!rows[key]) rows[key] = { subject: key, label: subjectLabelSafe(key), graded: [], total: 0, gradedCount: 0 };
    rows[key].total += 1;
    if (graded) {
      rows[key].graded.push({ percent });
      rows[key].gradedCount += 1;
    }
  };

  for (const a of data.assignments) {
    const sub = data.assignmentSubs.find((s) => s.assignmentId === a.id);
    push(a.subject, sub && sub.totalPoints ? percentOf(sub) : 0, Boolean(sub && sub.totalPoints));
  }
  for (const s of data.quizSubs) {
    push(s.quiz?.subject, percentOf(s), true);
  }
  for (const os of data.officialSubs) {
    const percent = os.score != null ? clamp100((os.score / 20) * 100) : 0;
    push(os.subject, percent, os.score != null);
  }

  return Object.values(rows).map((r) => ({
    subject: r.subject,
    label: r.label,
    total: r.total,
    gradedCount: r.gradedCount,
    avgPercent: avgOf(r.graded),
    strength: r.gradedCount > 0 && avgOf(r.graded) >= 60,
    weakness: r.gradedCount > 0 && avgOf(r.graded) < 60
  }));
}

// ===== محرك التوقع (قواعد حتمية قابلة للشرح) =====

export function computeRisk(data) {
  const { assignments, assignmentSubs, quizSubs, attendance, lessons, activities, adaptive } = data;
  const reasons = [];

  const gradedSubs = assignmentSubs.filter((s) => s.totalPoints);
  const quizGraded = quizSubs.filter((s) => s.totalPoints);

  const allGraded = [
    ...gradedSubs.map((s) => ({ percent: percentOf(s), date: s.gradedAt || s.createdAt })),
    ...quizGraded.map((s) => ({ percent: percentOf(s), date: s.createdAt }))
  ].sort((a, b) => new Date(a.date) - new Date(b.date));

  const overallAvg = avgOf(allGraded);
  let risk = 0;

  // 1) الأداء العام
  if (allGraded.length >= 1) {
    risk += Math.round((100 - overallAvg) * 0.4);
    if (overallAvg < 60) {
      reasons.push({
        key: 'LOW_PERFORMANCE',
        severity: 'high',
        title: 'أداء دون المتوسط',
        body: `متوسط الدرجات ${overallAvg}% عبر ${allGraded.length} تقييماً — دون عتبة التمكين (60%)`
      });
    }
  }

  // 2) التراجع الحديث
  if (allGraded.length >= 3) {
    const lastAvg = avgOf(allGraded.slice(-2));
    const prevAvg = avgOf(allGraded.slice(0, -2));
    if (prevAvg - lastAvg >= 15) {
      risk += 10;
      reasons.push({
        key: 'DECLINING_TREND',
        severity: 'high',
        title: 'تراجع حديث في الأداء',
        body: `متوسط آخر تقييمين (${lastAvg}%) أقل بـ ${prevAvg - lastAvg} نقطة عن متوسط ما قبلهما (${prevAvg}%)`
      });
    }
  }

  // 3) نسبة الإنجاز
  const pendingCount = assignments.filter((a) => !assignmentSubs.some((s) => s.assignmentId === a.id)).length;
  const completionRate = assignments.length ? Math.round(((assignments.length - pendingCount) / assignments.length) * 100) : null;
  if (assignments.length >= 1 && completionRate !== null) {
    risk += Math.round((100 - completionRate) * 0.3);
    if (completionRate < 50) {
      reasons.push({
        key: 'LOW_COMPLETION',
        severity: 'high',
        title: 'نسبة إنجاز منخفضة',
        body: `أنجز ${assignments.length - pendingCount} من ${assignments.length} تكليفاً (${completionRate}%)`
      });
    } else if (pendingCount > 0) {
      reasons.push({
        key: 'PENDING_OVERDUE',
        severity: 'medium',
        title: 'تكليفات غير مسلّمة',
        body: `${pendingCount} تكليف لم يُسلَّم بعد`
      });
    }
  }

  // 4) الحضور
  const last30 = attendance.filter((a) => new Date(a.date) >= new Date(Date.now() - 30 * 86400000));
  const absences = last30.filter((a) => !a.present).length;
  if (last30.length >= 1) {
    const absenceRatio = absences / last30.length;
    risk += Math.round(absenceRatio * 50);
    if (absenceRatio >= 0.2) {
      reasons.push({
        key: 'ABSENTEEISM',
        severity: 'high',
        title: 'غياب متكرر',
        body: `${absences} غياب من ${last30.length} يوم مرصود (${Math.round(absenceRatio * 100)}%) خلال آخر 30 يوماً`
      });
    }
  }

  // 5) التفاعل
  const lessonsCompleted = lessons.length;
  const adaptiveReviews = adaptive.reduce((sum, c) => sum + (c.reviewCount || 0), 0);
  const lowEngagement =
    lessonsCompleted < 2 && quizSubs.length < 2 && adaptiveReviews < 3 && activities.length < 3;
  if (lowEngagement) {
    risk += 10;
    reasons.push({
      key: 'LOW_ENGAGEMENT',
      severity: 'medium',
      title: 'تفاعل محدود مع المحتوى',
      body: 'نشاط قليل على المنصة: دروس مكتملة وتمارين ومتابعة شبه غائبة'
    });
  }

  risk = clamp100(risk);

  const riskLevel = risk >= 75 ? 'CRITICAL' : risk >= 55 ? 'HIGH' : risk >= 30 ? 'MEDIUM' : 'LOW';
  const hasData =
    assignments.length + quizSubs.length + attendance.length + lessons.length + adaptive.length + activities.length > 0;

  return {
    riskScore: risk,
    riskLevel,
    riskLabel: RISK_LEVELS[riskLevel].label,
    hasData,
    reasons,
    stats: {
      overallAvg,
      gradedCount: allGraded.length,
      completionRate: completionRate ?? 0,
      absenceRate: last30.length ? Math.round((absences / last30.length) * 100) : 0,
      lessonsCompleted,
      adaptiveReviews
    }
  };
}

// ===== ملخص حتمي مبني على البيانات =====

export function buildDeterministicSummary(data, risk) {
  const { student, assignments, assignmentSubs, quizSubs, attendance, lessons, adaptive, badges } = data;
  const name = `${student.firstName} ${student.lastName}`;
  const stats = risk.stats;
  const sentences = [];

  sentences.push(`تقرير ${name} (${student.class?.level || student.level || ''}).`);

  if (stats.gradedCount > 0) {
    sentences.push(`متوسط درجاته ${stats.overallAvg}% عبر ${stats.gradedCount} تقييماً`);
  }

  const parts = [];
  if (assignments.length > 0) {
    const done = assignmentSubs.length;
    parts.push(`أنجز ${done} من ${assignments.length} تكليفاً (${stats.completionRate}%)`);
  }
  if (quizSubs.length > 0) {
    parts.push(`أنجز ${quizSubs.length} اختباراً قصيراً`);
  }
  const last30 = attendance.filter((a) => new Date(a.date) >= new Date(Date.now() - 30 * 86400000));
  const absences = last30.filter((a) => !a.present).length;
  if (last30.length > 0) {
    parts.push(`${absences} غياب خلال آخر ${last30.length} يوماً مسجلاً`);
  }
  if (lessons.length > 0) {
    parts.push(`أتم ${lessons.length} درساً`);
  }
  const adaptiveReviews = adaptive.reduce((sum, c) => sum + (c.reviewCount || 0), 0);
  if (adaptiveReviews > 0) {
    parts.push(`مارس ${adaptiveReviews} مراجعة ذكية`);
  }
  if (badges.length > 0) {
    parts.push(`حاز ${badges.length} شارة`);
  }

  if (parts.length) {
    sentences.push(`في المنصة: ${parts.join('، ')}.`);
  } else {
    sentences.push('لا توجد بيانات كافية بعد لإصدار تقرير مفصل.');
  }

  const closing =
    risk.riskLevel === 'LOW'
      ? 'الأداء مستقر، واصل تشجيع ابنك على المواظبة.'
      : risk.riskLevel === 'MEDIUM'
        ? 'يحتاج ابنك إلى متابعة ودعم من المنزل. راجع نقاط القلق أدناه وجرّب الأنشطة المقترحة.'
        : 'هناك مؤشرات خطر تعثر مبكر. ننصح بتواصل عاجل مع المعلّم ومراجعة يومية منظمة.';

  return sentences.join(' ') + ' ' + closing;
}

// ===== أنشطة مقترحة حتمية (مبنية على نقاط ضعف حقيقية) =====

export function suggestActivities(data, risk) {
  const items = [];
  const { assignments, assignmentSubs, attendance, lessons, adaptive } = data;
  const perf = subjectPerformance(data);

  for (const subj of perf.filter((s) => s.weakness)) {
    items.push({
      key: `PRACTICE_${subj.subject}`,
      title: `تقوية مادة ${subj.label}`,
      detail: `متوسط درجات ${subj.avgPercent}% — خصص 15 دقيقة يومياً لمراجعة دروس ${subj.label} وإنجاز تمارين تفاعلية`,
      icon: 'school'
    });
  }

  const pending = assignments.filter((a) => !assignmentSubs.some((s) => s.assignmentId === a.id));
  if (pending.length > 0) {
    items.push({
      key: 'PENDING_ASSIGNMENTS',
      title: 'إنجاز التكليفات المتبقية',
      detail: `${pending.length} تكليف لم يُسلَّم بعد — ساعد ابنك على إنجازها قبل الموعد النهائي`,
      icon: 'assignment'
    });
  }

  const last30 = attendance.filter((a) => new Date(a.date) >= new Date(Date.now() - 30 * 86400000));
  const absences = last30.filter((a) => !a.present).length;
  if (last30.length > 0 && absences / last30.length >= 0.1) {
    items.push({
      key: 'ATTENDANCE',
      title: 'متابعة انتظام الحضور',
      detail: `${absences} غياب خلال آخر ${last30.length} يوماً — راجع مع ابنك أسباب الغياب وتأثيرها على المتابعة`,
      icon: 'event_busy'
    });
  }

  const lessonsCompleted = lessons.length;
  if (lessonsCompleted < 3) {
    items.push({
      key: 'LESSONS',
      title: 'إتمام دروس المنهج',
      detail: 'أتم ابنك دروساً قليلة على المنصة — اجعلا مراجعة درس واحد يومياً عادة ثابتة',
      icon: 'menu_book'
    });
  }

  const adaptiveReviews = adaptive.reduce((sum, c) => sum + (c.reviewCount || 0), 0);
  if (adaptiveReviews < 3) {
    items.push({
      key: 'ADAPTIVE',
      title: 'جلسة مراجعة ذكية',
      detail: 'اقترح على ابنك إجراء «مراجعة ذكية» قصيرة يومياً (10 أسئلة) — تعزز الحفظ وتساعد على اكتشاف الثغرات',
      icon: 'psychology'
    });
  }

  if (risk.riskLevel === 'HIGH' || risk.riskLevel === 'CRITICAL') {
    items.push({
      key: 'TEACHER_CONTACT',
      title: 'تواصل مع المعلّم',
      detail: 'بسبب مؤشرات خطر التعثر، ننصح بالتواصل مع المعلّم لوضع خطة دعم مشتركة',
      icon: 'forum'
    });
  }

  if (!items.length) {
    items.push({
      key: 'KEEP_GOING',
      title: 'مواصلة العادة الدراسية',
      detail: 'لا توجد نقاط قلق حالياً — واصل تشجيع ابنك على المواظبة اليومية ومكافأة تقدمه',
      icon: 'auto_awesome'
    });
  }

  return items;
}

// ===== نظرة عامة للاستجابة (بيانات حقيقية قابلة للعرض) =====

export function dataOverview(data) {
  const { assignments, assignmentSubs, quizSubs, attendance, lessons, adaptive, badges, activities } = data;
  const last30 = attendance.filter((a) => new Date(a.date) >= new Date(Date.now() - 30 * 86400000));
  const absences = last30.filter((a) => !a.present).length;
  const adaptiveReviews = adaptive.reduce((sum, c) => sum + (c.reviewCount || 0), 0);
  const correctCount = adaptive.reduce((sum, c) => sum + (c.correctCount || 0), 0);

  return {
    subjects: subjectPerformance(data),
    assignments: {
      total: assignments.length,
      submitted: assignmentSubs.length,
      pending: assignments.length - assignmentSubs.length
    },
    quizzesDone: quizSubs.length,
    attendance: {
      last30Days: last30.length,
      absent: absences,
      absenceRate: last30.length ? Math.round((absences / last30.length) * 100) : 0
    },
    lessonsCompleted: lessons.length,
    activitiesCount: activities.length,
    adaptive: {
      totalCards: adaptive.length,
      reviews: adaptiveReviews,
      accuracy: adaptiveReviews ? Math.round((correctCount / adaptiveReviews) * 100) : 0
    },
    badges: badges.map((b) => ({ key: b.badge.key, name: b.badge.name, icon: b.badge.icon }))
  };
}

// ===== سياق مضغوط لمزوّد الذكاء الاصطناعي =====

export function buildAiContext(data, risk) {
  const overview = dataOverview(data);
  return {
    student: {
      name: `${data.student.firstName} ${data.student.lastName}`,
      level: data.student.class?.level || data.student.level || ''
    },
    risk: {
      score: risk.riskScore,
      level: risk.riskLevel,
      label: risk.riskLabel,
      reasons: risk.reasons.map((r) => ({ key: r.key, title: r.title, body: r.body }))
    },
    subjects: overview.subjects,
    assignments: overview.assignments,
    quizzesDone: overview.quizzesDone,
    attendance: overview.attendance,
    lessonsCompleted: overview.lessonsCompleted,
    activitiesCount: overview.activitiesCount,
    adaptive: overview.adaptive,
    badges: overview.badges.map((b) => b.name)
  };
}
