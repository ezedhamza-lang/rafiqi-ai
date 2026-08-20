import prisma from '../db.js';
import { notify } from './notify.js';
import { gatherStudentData, computeRisk } from './parentInsightService.js';

// ===== المرحلة 7.3 — إشعارات استباقية للولي عند ارتفاع خطر التعثر =====
//
// مسح دوري يفحص أبناء الأولياء ويرسل إشعاراً داخل المنصة (برابط لصفحة «رؤى
// ذكية») عندما يرتفع مستوى الخطر إلى HIGH/CRITICAL. يُجنّب التكرار عبر
// مهلة إعادة إشعار (cooldown) وإشعار فوري عند التصعيد.

const RISK_RANK = { LOW: 0, MEDIUM: 1, HIGH: 2, CRITICAL: 3 };
const DEFAULT_COOLDOWN_DAYS = 7;

export function riskRank(level) {
  return RISK_RANK[level] ?? 0;
}

function alertTitle(studentName) {
  return `تنبيه: مؤشرات تعثر محتملة لدى ${studentName}`;
}

function alertBody(risk, _studentName) {
  const scores = risk.stats;
  const parts = [];
  if (scores.gradedCount > 0) parts.push(`متوسط الدرجات ${scores.overallAvg}%`);
  if (scores.completionRate > 0) parts.push(`إنجاز التكليفات ${scores.completionRate}%`);
  if (scores.absenceRate > 0) parts.push(`نسبة الغياب ${scores.absenceRate}%`);
  return `درجة الخطر ${risk.riskScore}/100 (${risk.riskLabel}). ${parts.join('، ')}. افتح الرؤى الذكية لمعرفة الأسباب والأنشطة المقترحة.`;
}

export async function runParentInsightSweep({ now = new Date(), cooldownDays = DEFAULT_COOLDOWN_DAYS } = {}) {
  const allStudents = await prisma.student.findMany();
  const students = allStudents.filter((s) => s.accountUserId != null && s.userId != null);

  const alerted = [];
  let checked = 0;

  for (const s of students) {
    checked += 1;
    const data = await gatherStudentData(s.accountUserId);
    if (!data) continue;

    const risk = computeRisk(data);
    if (risk.riskLevel !== 'HIGH' && risk.riskLevel !== 'CRITICAL') continue;

    const parentId = s.userId;
    const last = await prisma.notification.findFirst({
      where: {
        userId: parentId,
        type: 'PARENT_RISK_ALERT',
        metadata: { path: ['studentId'], equals: String(s.id) }
      },
      orderBy: { createdAt: 'desc' }
    });

    const lastLevel = last?.metadata?.riskLevel != null
      ? riskRank(String(last.metadata.riskLevel))
      : last?.metadata?.level != null
        ? riskRank(String(last.metadata.level))
        : -1;
    const currentLevel = riskRank(risk.riskLevel);
    const cooldownPassed = last
      ? new Date(now).getTime() - new Date(last.createdAt).getTime() >= cooldownDays * 86400000
      : true;
    const escalated = currentLevel > lastLevel;

    if (last && !cooldownPassed && !escalated) continue;

    const name = `${data.student.firstName} ${data.student.lastName}`;
    await notify([parentId], {
      type: 'PARENT_RISK_ALERT',
      title: alertTitle(name),
      body: alertBody(risk, name),
      link: '/parent/insights',
      priority: risk.riskLevel === 'CRITICAL' ? 'URGENT' : 'HIGH',
      metadata: { studentId: String(s.id), studentName: name, riskLevel: risk.riskLevel, riskScore: risk.riskScore }
    });

    alerted.push({ studentId: s.id, parentId, studentName: name, riskLevel: risk.riskLevel, riskScore: risk.riskScore });
  }

  return { checked, alerted };
}

export async function startParentInsightScheduler() {
  const intervalMs = Number(process.env.INSIGHT_SWEEP_INTERVAL_MS || 12 * 60 * 60 * 1000);
  const timer = setInterval(() => {
    runParentInsightSweep().catch((err) => {
      console.error('parent insight sweep failed:', err.message);
    });
  }, intervalMs);
  timer.unref();
  return timer;
}
