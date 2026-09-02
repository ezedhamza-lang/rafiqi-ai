export const SUBJECT_LABELS = {
  MATH: 'الرياضيات',
  READING: 'القراءة',
  SCIENCE: 'الإيقاظ العلمي',
  STORIES: 'القصص'
};

export function subjectLabel(code) {
  return SUBJECT_LABELS[code] || code || 'عام';
}

export function percent(submission) {
  if (!submission || !submission.totalPoints) return 0;
  return Math.round((submission.score / submission.totalPoints) * 100);
}

export function avgPercent(list) {
  const graded = (list || []).filter((s) => s && s.totalPoints);
  if (!graded.length) return 0;
  return Math.round(graded.reduce((sum, s) => sum + percent(s), 0) / graded.length);
}

export function buildStudentReport({ student, klass, assignments = [], submissions = [] }) {
  const subMap = new Map(submissions.map((s) => [s.assignmentId, s]));
  const graded = submissions.filter((s) => s.totalPoints);

  const bySubject = {};
  for (const a of assignments) {
    if (!bySubject[a.subject]) {
      bySubject[a.subject] = { subject: a.subject, label: subjectLabel(a.subject), total: 0, submitted: 0, gradedSubs: [] };
    }
    bySubject[a.subject].total += 1;
    const sub = subMap.get(a.id);
    if (sub) {
      bySubject[a.subject].submitted += 1;
      if (sub.totalPoints) bySubject[a.subject].gradedSubs.push(sub);
    }
  }

  const subjects = Object.values(bySubject).map((s) => {
    const avg = avgPercent(s.gradedSubs);
    const completion = s.total ? Math.round((s.submitted / s.total) * 100) : 0;
    return {
      subject: s.subject,
      label: s.label,
      total: s.total,
      submitted: s.submitted,
      completion,
      avgPercent: avg,
      strength: s.submitted > 0 && avg >= 60,
      weakness: s.submitted > 0 && avg < 60
    };
  });

  const strengths = subjects.filter((s) => s.strength);
  const weaknesses = subjects.filter((s) => s.weakness);

  const trend = graded
    .map((s) => {
      const a = assignments.find((x) => x.id === s.assignmentId);
      return {
        date: s.createdAt,
        subject: a?.subject,
        subjectLabel: a ? subjectLabel(a.subject) : '',
        title: a?.title || '',
        percent: percent(s)
      };
    })
    .sort((x, y) => new Date(x.date) - new Date(y.date));

  const overallAvg = avgPercent(graded);
  const completionRate = assignments.length ? Math.round((submissions.length / assignments.length) * 100) : 0;

  const alerts = [];

  if (trend.length >= 3) {
    const lastAvg = avgPercent(trend.slice(-2).map((t) => ({ totalPoints: 100, score: t.percent })));
    const prevAvg = avgPercent(trend.slice(0, -2).map((t) => ({ totalPoints: 100, score: t.percent })));
    if (prevAvg - lastAvg >= 15) {
      alerts.push({
        type: 'DECLINING_GRADES',
        severity: 'high',
        title: 'تراجع في الأداء',
        body: `متوسط آخر تقييمين (${lastAvg}%) أقل بـ ${prevAvg - lastAvg} نقطة عن متوسط ما قبلهما (${prevAvg}%)`
      });
    }
  }

  if (assignments.length >= 3 && completionRate < 50) {
    alerts.push({
      type: 'LOW_COMPLETION',
      severity: 'high',
      title: 'نسبة إنجاز منخفضة',
      body: `أنجز التلميذ ${submissions.length} من ${assignments.length} تكليفا (${completionRate}%)`
    });
  }

  const now = new Date();
  const overdue = assignments.filter((a) => a.dueDate && new Date(a.dueDate) < now && !subMap.get(a.id));
  if (overdue.length) {
    alerts.push({
      type: 'OVERDUE',
      severity: 'medium',
      title: 'تكليفات متأخرة',
      body: `${overdue.length} تكليف لم يُسلَّم رغم تجاوز آخر أجل له`
    });
  }

  if (graded.length >= 2 && overallAvg < 50) {
    alerts.push({
      type: 'LOW_AVERAGE',
      severity: 'medium',
      title: 'معدل عام ضعيف',
      body: `المعدل العام للتلميذ ${overallAvg}%`
    });
  }

  return {
    student: student ? { id: student.id, firstName: student.firstName, lastName: student.lastName } : null,
    class: klass ? { id: klass.id, name: klass.name, level: klass.level } : null,
    summary: {
      assignmentsTotal: assignments.length,
      submitted: submissions.length,
      completionRate,
      avgPercent: overallAvg,
      gradedCount: graded.length
    },
    subjects,
    strengths,
    weaknesses,
    trend,
    alerts
  };
}

export function buildClassReport({ klass, students = [], assignments = [], submissions = [] }) {
  const assignmentsTotal = assignments.length;
  const rows = students.map((st) => {
    const subs = submissions.filter((s) => s.studentId === st.accountUserId);
    const graded = subs.filter((s) => s.totalPoints);
    const completion = assignmentsTotal ? Math.round((subs.length / assignmentsTotal) * 100) : 0;
    const avg = avgPercent(graded);
    const atRisk = (assignmentsTotal >= 3 && completion < 50) || (graded.length >= 2 && avg < 50);
    return {
      studentId: st.accountUserId,
      firstName: st.account?.firstName || st.firstName,
      lastName: st.account?.lastName || st.lastName,
      submitted: subs.length,
      total: assignmentsTotal,
      completionRate: completion,
      avgPercent: avg,
      atRisk
    };
  });

  const atRiskStudents = rows.filter((r) => r.atRisk);

  const perAssignment = assignments.map((a) => {
    const subs = submissions.filter((s) => s.assignmentId === a.id);
    const graded = subs.filter((s) => s.totalPoints);
    return {
      id: a.id,
      title: a.title,
      subject: a.subject,
      subjectLabel: subjectLabel(a.subject),
      submitted: subs.length,
      totalStudents: students.length,
      completion: students.length ? Math.round((subs.length / students.length) * 100) : 0,
      avgPercent: avgPercent(graded)
    };
  });

  const overallAvg = rows.length ? Math.round(rows.reduce((sum, r) => sum + r.avgPercent, 0) / rows.length) : 0;
  const overallCompletion = rows.length ? Math.round(rows.reduce((sum, r) => sum + r.completionRate, 0) / rows.length) : 0;

  return {
    class: { id: klass?.id, name: klass?.name, level: klass?.level },
    summary: {
      studentsCount: rows.length,
      assignmentsTotal,
      overallCompletion,
      overallAvg,
      atRiskCount: atRiskStudents.length
    },
    students: rows,
    atRiskStudents,
    perAssignment
  };
}
