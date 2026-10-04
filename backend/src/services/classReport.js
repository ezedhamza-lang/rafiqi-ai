// تقرير القسم (المرحلة D) — منطق واحد نظيف، مستقل عن Express.
//
// لماذا خدمة؟ لأن التقرير يُستهلك من: مسار الـAPI، اختبار، وطبع Commissioner.
// القواعد التي لا تُكسر:
//  • honesty: ما لم يُصحَّح يدويًّا يُبقى «بانتظار التصحيح» ولا يُحسب صفرًا.
//  • الحضور يُحتسب من سجلّ AttendanceRecord (present=false = غياب) لا من افتراض.
//  • مصفوفة التلاميذ: صف لكل تلميذ × عمود لكل عمل (امتحان/واجب/اختبار).
//  • إتقان الكفايات: من جدول الإسناد نفسه (criteria) لا من إعادة اشتقاق.
import { gradeOfficialExam } from './officialExamService.js';

function pct(score, max) {
  if (max == null || max <= 0) return null;
  return Math.round((score / max) * 100);
}

function dayKey(date) {
  return new Date(date).toISOString().slice(0, 10);
}

/**
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {{ classId:number, teacherId?:number|null, from?:string|null, to?:string|null }} opts
 */
export async function buildClassReport(prisma, { classId, teacherId = null, from = null, to = null }) {
  const klass = await prisma.class.findFirst({
    where: { id: Number(classId), ...(teacherId ? { teacherId } : {}) },
    select: { id: true, name: true, level: true, schoolYear: true, teacher: { select: { id: true, firstName: true, lastName: true } } }
  });
  if (!klass) return null;

  const students = await prisma.student.findMany({
    where: { classId: klass.id, accountUserId: { not: null } },
    include: { account: { select: { id: true, email: true, accountStatus: true } } },
    orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }]
  });

  const accountIds = students.map((s) => s.account?.id).filter(Boolean);
  const range = {};
  if (from || to) {
    if (from) range.gte = new Date(`${from}T00:00:00.000Z`);
    if (to) range.lte = new Date(`${to}T23:59:59.999Z`);
  }

  const [attendance, exams, assignments, quizzes] = await Promise.all([
    prisma.attendanceRecord.findMany({
      where: { classId: klass.id, ...(accountIds.length ? { studentId: { in: accountIds } } : {}), ...(Object.keys(range).length ? { date: range } : {}) },
      select: { studentId: true, date: true, present: true }
    }),
    prisma.officialExam.findMany({
      where: { classId: klass.id },
      select: { id: true, title: true, subject: true, content: true, published: true, createdAt: true }
    }),
    prisma.assignment.findMany({
      where: { classId: klass.id },
      select: { id: true, title: true, subject: true, status: true, dueDate: true }
    }),
    prisma.quiz.findMany({
      where: { classId: klass.id },
      select: { id: true, title: true, subject: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
      take: 50
    })
  ]);

  const examContentById = new Map(exams.map((e) => [e.id, e.content]));

  const examIds = exams.map((e) => e.id);
  const assignmentIds = assignments.map((a) => a.id);
  const quizIds = quizzes.map((q) => q.id);

  const [officialSubs, assignmentSubs, quizSubs] = await Promise.all([
    examIds.length
      ? prisma.officialSubmission.findMany({ where: { examId: { in: examIds } }, select: { examId: true, studentId: true, score: true, answers: true, status: true, createdAt: true } })
      : [],
    assignmentIds.length
      ? prisma.assignmentSubmission.findMany({ where: { assignmentId: { in: assignmentIds } }, select: { assignmentId: true, studentId: true, score: true, totalPoints: true, status: true, late: true, createdAt: true } })
      : [],
    quizIds.length
      ? prisma.submission.findMany({ where: { quizId: { in: quizIds } }, select: { quizId: true, studentId: true, score: true, totalPoints: true, createdAt: true } })
      : []
  ]);

  // ── الحضور ───────────────────────────────────────────────────────────────
  const attendanceByStudent = new Map();
  const attendanceDays = new Set();
  for (const rec of attendance) {
    attendanceDays.add(dayKey(rec.date));
    const cur = attendanceByStudent.get(rec.studentId) || { present: 0, absent: 0 };
    if (rec.present) cur.present += 1;
    else cur.absent += 1;
    attendanceByStudent.set(rec.studentId, cur);
  }
  const totalAttendanceDays = attendanceDays.size;

  // ── الأعمال (امتحان رسمي / واجب / اختبار سريع) ──────────────────────────
  const items = [
    ...exams.map((e) => ({
      kind: 'exam',
      id: `exam-${e.id}`,
      refId: e.id,
      title: e.title,
      subject: e.subject,
      published: e.published,
      max: Number(e.content?.totalPoints) || 20,
      date: e.createdAt
    })),
    ...assignments.map((a) => ({
      kind: 'assignment',
      id: `assignment-${a.id}`,
      refId: a.id,
      title: a.title,
      subject: a.subject,
      published: a.status === 'PUBLISHED',
      max: null,
      date: a.dueDate || a.createdAt
    })),
    ...quizzes.map((q) => ({
      kind: 'quiz',
      id: `quiz-${q.id}`,
      refId: q.id,
      title: q.title,
      subject: q.subject,
      published: true,
      max: null,
      date: null
    }))
  ].sort((a, b) => new Date(a.date ?? 0) - new Date(b.date ?? 0));

  const officialByStudentExam = new Map();
  for (const s of officialSubs) officialByStudentExam.set(`${s.studentId}:${s.examId}`, s);
  const assignmentByStudentAssignment = new Map();
  for (const s of assignmentSubs) assignmentByStudentAssignment.set(`${s.studentId}:${s.assignmentId}`, s);
  const quizByStudentQuiz = new Map();
  for (const s of quizSubs) quizByStudentQuiz.set(`${s.studentId}:${s.quizId}`, s);

  // ── إتقان الكفايات (من جدول الإسناد في محتوى الامتحان) ───────────────────
  const criterionIndex = new Map(); // examId:criterion -> { label, mastery }
  for (const e of exams) {
    const criteria = Array.isArray(e.content?.criteria) ? e.content.criteria : [];
    for (const c of criteria) criterionIndex.set(`${e.id}:${c.id}`, { label: c.label, mastery: c.mastery });
  }

  const rows = students.map((s) => {
    const accountId = s.account?.id ?? null;
    const cells = {};
    const mastery = {};

    for (const item of items) {
      if (!accountId) continue;
      if (item.kind === 'exam') {
        const sub = officialByStudentExam.get(`${accountId}:${item.refId}`);
        if (!sub) {
          cells[item.id] = { state: 'missing' };
          continue;
        }
        const graded = gradeOfficialExam(examContentById.get(item.refId), sub.answers ?? {});
        const pendingManual = sub.status !== 'CORRECTED' || graded.needsManualGrading;
        cells[item.id] = {
          state: pendingManual ? 'pending' : 'graded',
          score: sub.score ?? null,
          max: item.max,
          percent: pendingManual ? null : pct(sub.score ?? 0, item.max),
          status: sub.status,
          needsManualGrading: graded.needsManualGrading,
          reason: graded.reason,
          total: graded.total,
          totalMax: graded.totalMax
        };
        for (const cr of graded.criteria) {
          const key = `${item.id}|${cr.criterion}`;
          mastery[key] = {
            label: cr.label,
            masteryKey: cr.masteryKey,
            masteryLabel: cr.masteryLabel,
            earned: cr.earned,
            autoCorrected: cr.autoCorrected,
            pendingManualCount: cr.pendingManualCount
          };
        }
      } else if (item.kind === 'assignment') {
        const sub = assignmentByStudentAssignment.get(`${accountId}:${item.refId}`);
        if (!sub) {
          cells[item.id] = { state: 'missing' };
          continue;
        }
        cells[item.id] = {
          state: sub.status === 'GRADED' ? 'graded' : 'submitted',
          score: sub.score ?? null,
          max: sub.totalPoints ?? null,
          percent: sub.totalPoints ? pct(sub.score ?? 0, sub.totalPoints) : null,
          status: sub.status,
          late: sub.late
        };
      } else {
        const sub = quizByStudentQuiz.get(`${accountId}:${item.refId}`);
        if (!sub) {
          cells[item.id] = { state: 'missing' };
          continue;
        }
        cells[item.id] = {
          state: 'graded',
          score: sub.score ?? null,
          max: sub.totalPoints ?? null,
          percent: sub.totalPoints ? pct(sub.score ?? 0, sub.totalPoints) : null
        };
      }
    }

    const att = accountId ? attendanceByStudent.get(accountId) : null;
    return {
      studentId: accountId,
      firstName: s.firstName,
      lastName: s.lastName,
      email: s.account?.email ?? null,
      attendance: {
        present: att?.present ?? 0,
        absent: att?.absent ?? 0,
        rate: totalAttendanceDays > 0 && att ? Math.round((att.present / totalAttendanceDays) * 100) : null
      },
      cells,
      mastery
    };
  });

  // سُلّم الإتقان الرسمي (criteria-grids.js / OfficialExams.jsx): none/below/min/max
  const MASTERY_SCALE = { max: 4, min: 3, below: 2, none: 1 };

  const criteriaSummary = [...criterionIndex.entries()].map(([key, meta]) => {
    const [examPart, criterion] = key.split(':');
    const itemId = `exam-${examPart}`;
    const values = rows.map((r) => r.mastery[`${itemId}|${criterion}`]).filter(Boolean);
    const gradedValues = values.filter((v) => v.masteryKey);
    const masteryIndex = gradedValues.length
      ? Math.round((gradedValues.reduce((a, v) => a + (MASTERY_SCALE[v.masteryKey] ?? 0), 0) / gradedValues.length) * 100) / 100
      : null;
    // متوسط النقاط المكتسبة لتلك الكفاية (من جدول الإسناد) — مفيد للمعلم
    const earnedAvg = gradedValues.length
      ? Math.round((gradedValues.reduce((a, v) => a + (v.earned ?? 0), 0) / gradedValues.length) * 100) / 100
      : null;
    return {
      key,
      itemId,
      criterion,
      label: meta.label,
      mastery: meta.mastery,
      max: meta.mastery?.max ?? null,
      studentsAttempted: values.length,
      studentsGraded: gradedValues.length,
      pendingManual: values.filter((v) => v.pendingManualCount > 0 || !v.masteryKey).length,
      masteryIndex,
      earnedAvg,
      // توزيع التلاميذ على سلّم الإتقان (بلا نسبة مئوية مفقودة)
      distribution: gradedValues.reduce((acc, v) => {
        acc[v.masteryKey] = (acc[v.masteryKey] || 0) + 1;
        return acc;
      }, {})
    };
  });

  return {
    class: {
      id: klass.id,
      name: klass.name,
      level: klass.level,
      schoolYear: klass.schoolYear,
      teacher: klass.teacher ? { id: klass.teacher.id, name: `${klass.teacher.firstName} ${klass.teacher.lastName}` } : null
    },
    range: { from, to },
    attendanceDays: totalAttendanceDays,
    items,
    criteria: criteriaSummary,
    rows,
    totals: {
      students: rows.length,
      items: items.length,
      attendanceRecords: attendance.length,
      pendingManual: Object.values(rows).reduce(
        (acc, r) => acc + Object.values(r.cells).filter((c) => c.state === 'pending').length,
        0
      )
    }
  };
}
