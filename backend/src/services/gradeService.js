import prisma from '../db.js';

// ===== خدمة المعدلات والرتبات — الطريقة الرسمية التونسية =====
// معدل الثلاثي للمادة = متوسط العلامات المكوّنة/المصححة (على 20)
// معدل قسم الثلاثي = Σ(معدل المادة × المعامل) / Σ المعاملات
// المعدل السنوي = (الثلاثي1 + الثلاثي2 + 2×الثلاثي3) / 4   (صيغة المنشور: الثلاثي الأخير مرجّح)

export const DAYS_AR = ['', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

export const PERIOD_TIMES = [
  { n: 1, from: '08:00', to: '08:45' },
  { n: 2, from: '08:45', to: '09:30' },
  { n: 3, from: '09:30', to: '10:15' },
  { n: 4, from: '10:30', to: '11:15', note: 'after break' },
  { n: 5, from: '13:30', to: '14:15' },
  { n: 6, from: '14:15', to: '15:00' }
];

export const PERIOD_LABELS = { 1: 'الثلاثي الأول', 2: 'الثلاثي الثاني', 3: 'الثلاثي الثالث', annual: 'المعدل السنوي' };

export const SUBJECT_LABELS = {
  MATH: 'الرياضيات',
  READING: 'القراءة والنصوص',
  ANISI: 'أنيسي — القراءة',
  SCIENCE: 'الإيقاظ العلمي',
  STORIES: 'القصص والمجال الأخلاقي',
  PRODUCTION: 'الإنتاج الكتابي',
  FRENCH: 'الفرنسية',
  ENGLISH: 'الإنجليزية',
  CIVIC: 'التربية المدنية',
  SPORTS: 'التربية البدنية',
  ART: 'التربية التشكيلية',
  TECH: 'التربية التكنولوجية',
  MUSIC: 'التربية الموسيقية',
  QURAN: 'التربية القرآنية',
  GENERAL: 'نشاط عام'
};

// معاملات افتراضية معتمدة ابتدائيًا — قابلة للتعديل لكل قسم من «مواد الأقسام»
export const DEFAULT_COEFFICIENTS = {
  MATH: 4, READING: 4, ANISI: 4, SCIENCE: 2, PRODUCTION: 2,
  STORIES: 1, QURAN: 1, FRENCH: 2, ENGLISH: 1, CIVIC: 1,
  SPORTS: 1, ART: 1, MUSIC: 1, TECH: 1, GENERAL: 1
};

const ALIAS = { ANISI: 'READING', EME: 'SCIENCE', EPS: 'SPORTS' };

export function canonicalSubject(s) {
  const u = String(s || '').trim().toUpperCase();
  return ALIAS[u] || u;
}

export function subjectLabel(code) {
  return SUBJECT_LABELS[code] || SUBJECT_LABELS[canonicalSubject(code)] || code || '';
}

export function round2(x) {
  return Math.round(Number(x) * 100) / 100;
}

export function trimesterWindows(schoolYear) {
  const y = parseInt(String(schoolYear || '2026-2027').slice(0, 4), 10) || new Date().getFullYear();
  return {
    1: [new Date(y, 8, 1), new Date(y, 11, 15)],
    2: [new Date(y + 1, 0, 1), new Date(y + 1, 2, 15)],
    3: [new Date(y + 1, 2, 16), new Date(y + 1, 5, 30)]
  };
}

export function mentionFor(mean) {
  if (mean === null || mean === undefined) return null;
  if (mean >= 14) return 'تجدير مفض';
  if (mean >= 12) return 'تجدير حسن';
  if (mean >= 10) return 'أحمد';
  if (mean >= 9) return 'قرب المقبول';
  return 'لا بد من المراجعة';
}

export function decisionFor(annual) {
  if (annual === null || annual === undefined) return null;
  if (annual >= 10) return 'ناجح — الانتقال إلى السنة الموالية';
  if (annual >= 8) return 'ناجح بملاحظة — يُنصح بالمراجعة صيفًا';
  return 'الإعادة واردة حسب مجلس القسم';
}

async function subjectMeansForWindow(userIds, classId, window) {
  const map = new Map(userIds.map((u) => [u, new Map()]));
  if (!userIds.length) return map;
  const dateFilter = window
    ? { createdAt: { gte: window[0], lte: window[1] } }
    : {};
  const [subs, asgs, offs] = await Promise.all([
    prisma.submission.findMany({
      where: { studentId: { in: userIds }, quiz: { classId }, ...dateFilter },
      select: { studentId: true, score: true, totalPoints: true, quiz: { select: { subject: true } } }
    }),
    prisma.assignmentSubmission.findMany({
      where: { studentId: { in: userIds }, assignment: { classId }, ...dateFilter },
      include: { assignment: { select: { subject: true } } }
    }),
    prisma.officialSubmission.findMany({
      where: { studentId: { in: userIds }, exam: { classId }, ...dateFilter },
      select: { studentId: true, score: true, exam: { select: { subject: true } } }
    })
  ]);
  const push = (uid, subj, val) => {
    if (!map.has(uid)) return;
    const code = canonicalSubject(subj);
    const m = map.get(uid);
    if (!m.has(code)) m.set(code, []);
    m.get(code).push(val);
  };
  for (const s of subs) {
    if (s.totalPoints > 0 && s.score !== null) push(s.studentId, s.quiz?.subject, (s.score / s.totalPoints) * 20);
  }
  for (const s of asgs) {
    if (s.totalPoints > 0 && s.score !== null) push(s.studentId, s.assignment?.subject, (s.score / s.totalPoints) * 20);
  }
  for (const s of offs) {
    // الامتحانات الرسمية مصححة أصلاً على 20
    if (s.score !== null && s.score !== undefined) push(s.studentId, s.exam?.subject, Math.min(20, Math.max(0, Number(s.score))));
  }
  const means = new Map();
  for (const [uid, bySub] of map) {
    const m = new Map();
    for (const [code, vals] of bySub) m.set(code, round2(vals.reduce((a, b) => a + b, 0) / vals.length));
    means.set(uid, m);
  }
  return means;
}

function weightedMean(subjectMeans, subjects) {
  let num = 0;
  let den = 0;
  for (const s of subjects) {
    const code = canonicalSubject(s.subject);
    const mark = subjectMeans.get(code);
    if (mark === undefined || mark === null) continue;
    const coef = Number(s.coefficient) || 1;
    num += mark * coef;
    den += coef;
  }
  return den > 0 ? round2(num / den) : null;
}

export async function computeClassGrades(classId, period = '1') {
  const klass = await prisma.class.findUnique({
    where: { id: classId },
    include: { school: { select: { name: true } } }
  });
  if (!klass) return null;

  const [programmed, students] = await Promise.all([
    prisma.classSubject.findMany({
      where: { classId },
      include: { teacher: { select: { firstName: true, lastName: true } } },
      orderBy: { subject: 'asc' }
    }),
    prisma.student.findMany({ where: { classId }, orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }] })
  ]);

  const userIds = students.map((s) => s.accountUserId).filter(Boolean);
  const wins = trimesterWindows(klass.schoolYear);
  const triKeys = [1, 2, 3];
  const meansByTri = {};
  for (const t of triKeys) {
    meansByTri[t] = await subjectMeansForWindow(userIds, classId, wins[t]);
  }
  const meansForPeriod = period === 'annual' ? null : meansByTri[Number(period)];

  let rows = students.map((st) => {
    const uid = st.accountUserId;
    const triMeans = {};
    for (const t of triKeys) triMeans[t] = weightedMean(meansByTri[t].get(uid) || new Map(), programmed);
    let annual = null;
    {
      let wSum = 0;
      let vSum = 0;
      for (const t of triKeys) {
        if (triMeans[t] !== null) {
          const w = t === 3 ? 2 : 1;
          wSum += w;
          vSum += triMeans[t] * w;
        }
      }
      if (wSum > 0) annual = round2(vSum / wSum);
    }
    const marks = {};
    const srcMeans = period === 'annual' ? null : meansForPeriod.get(uid);
    for (const p of programmed) {
      const code = canonicalSubject(p.subject);
      let mark = null;
      if (period === 'annual') {
        const parts = [];
        for (const t of triKeys) {
          const mt = meansByTri[t].get(uid)?.get(code);
          if (mt !== undefined) parts.push({ t, v: mt });
        }
        if (parts.length) {
          const w = parts.reduce((acc, x) => acc + (x.t === 3 ? 2 : 1), 0);
          mark = round2(parts.reduce((acc, x) => acc + x.v * (x.t === 3 ? 2 : 1), 0) / w);
        }
      } else {
        mark = srcMeans?.get(code) ?? null;
      }
      marks[code] = mark;
    }
    const chosen = period === 'annual' ? annual : triMeans[Number(period)];
    return {
      studentUserId: uid,
      firstName: st.firstName,
      lastName: st.lastName,
      marks,
      triMeans,
      annual,
      mean: chosen,
      mention: mentionFor(chosen),
      decision: period === 'annual' ? decisionFor(chosen) : null
    };
  });

  const ranked = rows.filter((r) => r.mean !== null).sort((a, b) => b.mean - a.mean);
  let lastMean = null;
  let lastRank = 0;
  for (let i = 0; i < ranked.length; i++) {
    if (ranked[i].mean !== lastMean) {
      lastMean = ranked[i].mean;
      lastRank = i + 1;
    }
    ranked[i].rank = lastRank;
  }
  for (const r of rows) if (r.rank === undefined) r.rank = null;
  rows = rows.sort((a, b) => (a.lastName || '').localeCompare(b.lastName || '', 'ar') || (a.firstName || '').localeCompare(b.firstName || '', 'ar'));

  return {
    class: { id: klass.id, name: klass.name, level: klass.level, schoolYear: klass.schoolYear, schoolName: klass.school?.name || '' },
    period,
    periodLabel: PERIOD_LABELS[period] || period,
    subjects: programmed.map((p) => ({
      code: canonicalSubject(p.subject),
      raw: p.subject,
      label: subjectLabel(p.subject),
      coefficient: p.coefficient,
      teacher: p.teacher ? `${p.teacher.firstName} ${p.teacher.lastName}` : ''
    })),
    rows,
    studentsCount: students.length,
    effectifs: rows.filter((r) => r.mean !== null).length
  };
}

export async function buildCertificate(classId, studentUserId, period) {
  const data = await computeClassGrades(classId, period);
  if (!data) return null;
  const row = data.rows.find((r) => r.studentUserId === studentUserId);
  if (!row) return null;
  const products = data.subjects.map((s) => ({
    ...s,
    mark: row.marks[s.code] ?? null,
    product: row.marks[s.code] != null ? round2(row.marks[s.code] * s.coefficient) : null
  }));
  const sumProducts = round2(products.reduce((a, x) => a + (x.product || 0), 0));
  const sumCoefs = data.subjects.reduce((a, x) => a + (Number(x.coefficient) || 1), 0);
  return {
    student: { firstName: row.firstName, lastName: row.lastName },
    class: data.class,
    period: data.period,
    periodLabel: data.periodLabel,
    subjects: products,
    sumProducts,
    sumCoefs,
    mean: row.mean,
    triMeans: row.triMeans,
    annual: row.annual,
    rank: row.rank,
    effectifs: data.effectifs,
    mention: row.mention,
    decision: row.decision
  };
}
