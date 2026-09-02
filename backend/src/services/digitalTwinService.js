// ===== المرحلة 4 — التوأم الرقمي للمدرسة + محاكي القرارات =====
//
// Digital Twin: نسخة رقمية حية من المدرسة — طلاب، أقسام، معلمون، حضور،
//   تقدم، مال، موارد — كلها في لقطة واحدة قابلة للمراقبة.
// Policy Simulator: «ماذا يحدث لو؟» — محاكاة أثر قرارات إدارية قبل تنفيذها
//   (فتح قسم جديد، زيادة عدد التلاميذ، تغيير ساعات...) بحسابات حتمية شفافة.

import prisma from '../db.js';
import { schoolStats } from './schoolScope.js';

/**
 * اللقطة الحية الكاملة لمدرسة (التوأم الرقمي)
 */
export async function buildSchoolTwin(schoolId) {
  const school = await prisma.school.findUnique({ where: { id: schoolId } });
  if (!school) return null;

  const [stats, classes, attendanceToday, recentProgress, quizzes, submissions, pendingRequests, liveSessions] =
    await Promise.all([
      schoolStats(schoolId),
      prisma.class.findMany({
        where: { schoolId },
        include: {
          teacher: { select: { firstName: true, lastName: true } },
          _count: { select: { students: true, quizzes: true } }
        },
        orderBy: { name: 'asc' }
      }),
      (async () => {
        const start = new Date();
        start.setHours(0, 0, 0, 0);
        const classIds = (await prisma.class.findMany({ where: { schoolId }, select: { id: true } })).map((c) => c.id);
        if (!classIds.length) return { present: 0, absent: 0, recorded: 0 };
        const records = await prisma.attendanceRecord.findMany({
          where: { classId: { in: classIds }, date: { gte: start } },
          select: { present: true }
        });
        return {
          recorded: records.length,
          present: records.filter((r) => r.present).length,
          absent: records.filter((r) => !r.present).length
        };
      })(),
      (async () => {
        const ids = (await prisma.user.findMany({ where: { schoolId }, select: { id: true } })).map((u) => u.id);
        if (!ids.length) return 0;
        const weekAgo = new Date(Date.now() - 7 * 86400000);
        return prisma.lessonProgress.count({ where: { userId: { in: ids }, completedAt: { gte: weekAgo } } });
      })(),
      prisma.quiz.count({ where: { class: { schoolId } } }),
      prisma.submission.count({ where: { quiz: { class: { schoolId } } } }),
      prisma.subscriptionRequest.count({ where: { class: { schoolId }, status: 'PENDING_APPROVAL' } }),
      prisma.liveSession.count({ where: { class: { schoolId }, status: 'SCHEDULED' } })
    ]);

  // مؤشرات مشتقة
  const attendanceRate = attendanceToday.recorded
    ? Math.round((attendanceToday.present / attendanceToday.recorded) * 100)
    : null;
  const quizParticipation = quizzes ? Math.round((submissions / Math.max(quizzes, 1)) * 100) : 0;

  // حالة الصحة العامة (أكاديمي/إداري) — مؤشرات بسيطة شفافة
  const health = {
    attendance: attendanceRate == null ? 'NO_DATA' : attendanceRate >= 90 ? 'GOOD' : attendanceRate >= 75 ? 'WATCH' : 'ALERT',
    activity: recentProgress > 20 ? 'GOOD' : recentProgress > 5 ? 'WATCH' : recentProgress > 0 ? 'LOW' : 'NO_DATA',
    requestsBacklog: pendingRequests > 10 ? 'ALERT' : pendingRequests > 3 ? 'WATCH' : 'GOOD'
  };

  return {
    school: { id: school.id, name: school.name, code: school.code, status: school.status },
    totals: stats,
    classes: classes.map((c) => ({
      id: c.id,
      name: c.name,
      level: c.level,
      teacher: c.teacher ? `${c.teacher.firstName} ${c.teacher.lastName}` : null,
      students: c._count.students,
      quizzes: c._count.quizzes
    })),
    today: { attendance: attendanceToday, attendanceRate },
    week: { lessonsCompleted: recentProgress },
    assessment: { quizzes, submissions, participationPct: quizParticipation },
    admin: { pendingRequests, scheduledLiveSessions: liveSessions },
    health,
    snapshotAt: new Date().toISOString()
  };
}

/**
 * محاكي القرارات — حسابات حتمية شفافة لسيناريوهات «ماذا لو».
 * السيناريوهات المدعومة:
 *  - add_class: فتح قسم جديد في مستوى معين
 *  - add_students: زيادة عدد التلاميذ في قسم
 *  - split_class: تقسيم قسم ممتلئ
 */
export async function simulatePolicy(schoolId, scenario) {
  const twin = await buildSchoolTwin(schoolId);
  if (!twin) return null;
  const { type, level, classId, studentsToAdd } = scenario || {};
  const assumptions = [
    'نسبة تلميذ/قسم مستهدفة: 25',
    'ساعة تدريس إضافية لكل قسم جديد: 20 سا/أسبوع',
    'الحسابات حتمية على البيانات الحالية — القرار النهائي للإدارة.'
  ];

  if (type === 'add_class') {
    const targetLevel = level || twin.classes[0]?.level || '';
    const sameLevel = twin.classes.filter((c) => c.level === targetLevel);
    const avgPerClass = sameLevel.length
      ? Math.round(sameLevel.reduce((s, c) => s + c.students, 0) / sameLevel.length)
      : 0;
    const newTotalClasses = twin.totals.classes + 1;
    return {
      scenario: 'add_class',
      input: { level: targetLevel },
      projected: {
        totalClasses: newTotalClasses,
        avgStudentsPerClass: Math.round((twin.totals.students) / newTotalClasses),
        extraTeachingHoursPerWeek: 20,
        teachersNeeded: sameLevel.length >= 1 ? 0 : 1
      },
      impact: [
        `عدد الأقسام: ${twin.totals.classes} → ${newTotalClasses}`,
        `متوسط كثافة القسم بمستوى ${targetLevel}: ${avgPerClass} تلميذاً`,
        sameLevel.length === 0 ? '⚠️ لا يوجد معلم حالي لهذا المستوى — يلزم تعيين.' : '✓ يوجد معلمون بنفس المستوى لإعادة التوزيع.'
      ],
      assumptions
    };
  }

  if (type === 'add_students') {
    const klass = twin.classes.find((c) => c.id === Number(classId)) || twin.classes[0];
    const add = Number(studentsToAdd) || 5;
    const after = klass.students + add;
    return {
      scenario: 'add_students',
      input: { classId: klass.id, studentsToAdd: add },
      projected: {
        className: klass.name,
        currentStudents: klass.students,
        afterStudents: after,
        densityStatus: after > 30 ? 'مزدحم (>30)' : after > 25 ? 'قرب الحد (26-30)' : 'مقبول (≤25)',
        seatsShortfall: Math.max(0, after - 30)
      },
      impact: [
        `كثافة القسم: ${klass.students} → ${after}`,
        after > 30 ? '⚠️ تجاوز الطاقة الاستيعابية القياسية — يُنصح بقسم موازٍ.' : '✓ ضمن الطاقة المقبولة.'
      ],
      assumptions
    };
  }

  if (type === 'split_class') {
    const klass = twin.classes.find((c) => c.id === Number(classId)) || [...twin.classes].sort((a, b) => b.students - a.students)[0];
    const half = Math.ceil(klass.students / 2);
    return {
      scenario: 'split_class',
      input: { classId: klass.id },
      projected: {
        originalClass: `${klass.name} (${klass.students})`,
        newClasses: [`${klass.name} أ (${half})`, `${klass.name} ب (${klass.students - half})`],
        extraTeachingHoursPerWeek: 20,
        teachersNeeded: 1
      },
      impact: [
        `تقسيم ${klass.name}: ${klass.students} → قسمين بـ${half} و${klass.students - half}`,
        'يلزم معلم إضافي وقاعة متاحة.'
      ],
      assumptions
    };
  }

  return { error: 'سيناريو غير مدعوم. الأنواع: add_class | add_students | split_class' };
}