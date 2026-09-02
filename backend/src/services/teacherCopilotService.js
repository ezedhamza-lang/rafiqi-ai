// ===== المرحلة 1 — مساعد المعلّم الذكي (Teacher Copilot) =====
// يجمع يوم المعلّم في نداء واحد: الدرس التالي المقترح حسب تقدم القسم،
// التصحيحات المعلقة، غياب اليوم، التلاميذ المعرضون للخطر — وكل اقتراح
// يحمل تفسيره (لماذا/الأدلة/الثقة) وفق طبقة الذكاء القابل للتفسير.
import prisma from '../db.js';
import { gatherStudentData, computeRisk } from './parentInsightService.js';
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

function subjectIdFor(label) {
  const s = String(label || '').toLowerCase();
  if (/رياض|math/.test(s)) return 'math';
  if (/قراءة|أنيسي|anisi|arabic/.test(s)) return 'anisi';
  if (/إيقاظ|ايقاظ|science/.test(s)) return 'science';
  if (/إنتاج|انتاج|production|writing/.test(s)) return 'production';
  if (/إسلامية|اسلامية|islamic/.test(s)) return 'islamic';
  if (/تقنية|tech/.test(s)) return 'tech';
  return null;
}

/**
 * الدرس التالي المقترح: أول درس في فهرس الكتاب لم يُكمله أغلب قسم بعد.
 * التفسير: نسبة الإتمام لكل درس مبنية على LessonProgress الفعلي للتلاميذ.
 */
async function suggestNextLesson(klass, subjectLabel) {
  const gradeId = gradeIdForLevel(klass.level);
  const subjectId = subjectIdFor(subjectLabel) || subjectIdFor(klass.level);
  if (!gradeId || !subjectId) return null;

  const pages = getLessonPages(subjectId, klass.level, gradeId);
  if (!pages.length) return null;

  const studentAccountIds = (await prisma.student.findMany({
    where: { classId: klass.id },
    select: { accountUserId: true }
  })).map((s) => s.accountUserId).filter(Boolean);

  const progress = await prisma.lessonProgress.findMany({
    where: { gradeId, subjectId, userId: { in: studentAccountIds.length ? studentAccountIds : [-1] } },
    select: { lessonId: true }
  });
  const doneCount = {};
  for (const p of progress) doneCount[p.lessonId] = (doneCount[p.lessonId] || 0) + 1;

  const total = Math.max(studentAccountIds.length, 1);
  const firstIncomplete = pages.find((p) => {
    const done = doneCount[p.id] || 0;
    return done / total < 0.6; // درس لم يُتقنه أغلب القسم بعد
  });
  if (!firstIncomplete) return null;
  const idx = pages.indexOf(firstIncomplete);
  const completionPct = Math.round(((doneCount[firstIncomplete.id] || 0) / total) * 100);
  return {
    lessonId: firstIncomplete.id,
    title: firstIncomplete.title,
    order: idx + 1,
    totalLessons: pages.length,
    classCompletionPct: completionPct,
    why: `أول درس في فهرس ${subjectLabel || subjectId} لم يُنجزه 60% من القسم بعد.`,
    evidence: [`إنجاز هذا الدرس حالياً: ${completionPct}% من تلاميذ القسم`],
    confidence: studentAccountIds.length >= 5 ? 'HIGH' : studentAccountIds.length > 0 ? 'MEDIUM' : 'LOW'
  };
}

/** التصحيحات المعلقة لدى المعلم */
async function pendingCorrections(teacherId) {
  const rows = await prisma.submittedExam.findMany({
    where: { teacherId, status: { in: ['SUBMITTED', 'SENT', 'IN_REVIEW'] } },
    select: { id: true, status: true, examTitle: true, createdAt: true }
  });
  return {
    count: rows.length,
    items: rows.slice(0, 5).map((r) => ({ id: r.id, title: r.examTitle, status: r.status })),
    why: rows.length ? 'أوراق مُسلّمة تنتظر تصحيحك — تأخير التصحيح يؤخر تغذية التلميذ.' : null,
    confidence: 'HIGH'
  };
}

/** غياب اليوم للقسم */
async function todayAbsences(classId) {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  const absences = await prisma.attendanceRecord.findMany({
    where: { classId, date: { gte: start, lte: end }, present: false },
    include: { student: { select: { firstName: true, lastName: true } } }
  });
  return {
    count: absences.length,
    names: absences.map((a) => `${a.student?.firstName || ''} ${a.student?.lastName || ''}`.trim()).filter(Boolean).slice(0, 8),
    why: absences.length ? 'غيابات مسجّلة اليوم — يُنصح بالتواصل مع الأولياء.' : null,
    confidence: 'HIGH'
  };
}

/** التلاميذ المعرضون للخطر في القسم (نفس قواعد رؤى الولي — عرض موحد للتفسير) */
async function atRiskStudents(classId) {
  const students = await prisma.student.findMany({
    where: { classId, accountUserId: { not: null } },
    select: { accountUserId: true, firstName: true, lastName: true }
  });
  const risky = [];
  for (const s of students) {
    try {
      const data = await gatherStudentData(s.accountUserId);
      if (!data) continue;
      const risk = computeRisk(data);
      if (risk.riskLevel === 'HIGH' || risk.riskLevel === 'CRITICAL') {
        risky.push({
          name: `${s.firstName} ${s.lastName}`,
          level: risk.riskLevel,
          score: risk.riskScore,
          reasons: risk.reasons?.slice(0, 3) || []
        });
      }
    } catch { /* تلميذ بلا بيانات كافية */ }
  }
  return {
    count: risky.length,
    items: risky.sort((a, b) => b.score - a.score),
    why: risky.length ? 'تلاميذ تتجاوز مؤشراتهم عتبة الخطر — تدخل مبكر أفضل من انتظار النتائج.' : null,
    confidence: risky.length ? 'MEDIUM' : 'HIGH'
  };
}

/** البريف اليومي الكامل للمعلم */
export async function buildDailyBriefing(teacherId, { classId, subject } = {}) {
  const classes = await prisma.class.findMany({
    where: { teacherId, ...(classId ? { id: Number(classId) } : {}) },
    orderBy: { name: 'asc' }
  });

  const corrections = await pendingCorrections(teacherId);

  const perClass = [];
  for (const klass of classes.slice(0, 6)) {
    const [nextLesson, absences, atRisk] = await Promise.all([
      suggestNextLesson(klass, subject),
      todayAbsences(klass.id),
      atRiskStudents(klass.id)
    ]);
    perClass.push({
      classId: klass.id,
      className: klass.name,
      level: klass.level,
      nextLesson,
      absences,
      atRisk
    });
  }

  // الاقتراحات مرتبة بالأولوية — كل اقتراح قابل للتفسير
  const suggestions = [];
  if (corrections.count > 0) {
    suggestions.push({
      action: 'صحّح الأوراق المعلقة',
      priority: corrections.count > 5 ? 'HIGH' : 'MEDIUM',
      why: corrections.why,
      evidence: [`${corrections.count} ورقة تنتظر التصحيح`],
      link: '/teacher/correction',
      confidence: 'HIGH'
    });
  }
  for (const pc of perClass) {
    if (pc.atRisk.count > 0) {
      suggestions.push({
        action: `راجع التلاميذ المعرضين للخطر في ${pc.className}`,
        priority: 'HIGH',
        why: pc.atRisk.why,
        evidence: pc.atRisk.items.map((s) => `${s.name}: ${s.level} (${s.score}/100)`),
        link: '/teacher/analytics',
        confidence: 'MEDIUM'
      });
    }
    if (pc.nextLesson) {
      suggestions.push({
        action: `ابدأ درس «${pc.nextLesson.title}» في ${pc.className}`,
        priority: 'MEDIUM',
        why: pc.nextLesson.why,
        evidence: pc.nextLesson.evidence,
        link: `/teacher/lesson-plan`,
        confidence: pc.nextLesson.confidence
      });
    }
    if (pc.absences.count > 0) {
      suggestions.push({
        action: `تابع غيابات اليوم في ${pc.className}`,
        priority: 'LOW',
        why: pc.absences.why,
        evidence: pc.absences.names,
        link: '/teacher/attendance',
        confidence: 'HIGH'
      });
    }
  }
  const rank = { HIGH: 0, MEDIUM: 1, LOW: 2 };
  suggestions.sort((a, b) => rank[a.priority] - rank[b.priority]);

  return {
    generatedAt: new Date().toISOString(),
    explainability: 'كل اقتراح مبني على بيانات فعلية (تقدم الدروس، التصحيح، الغياب، مؤشرات الخطر) مع ذكر الأدلة ودرجة الثقة — القرار النهائي للمعلّم.',
    corrections,
    classes: perClass,
    suggestions
  };
}