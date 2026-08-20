import prisma from '../db.js';
import { notify } from './notify.js';
import { getVideoProvider } from './videoProvider/index.js';

export function sanitizeRoomName(title) {
  const base = String(title || 'session')
    .trim()
    .replace(/[^a-zA-Z0-9\u0600-\u06FF\u0660-\u0669\u00e8\u00e9\u00ea\s-]/g, '')
    .replace(/\s+/g, '-')
    .slice(0, 40);
  const slug = base || 'session';
  return `${slug}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

export async function classStudentAndParentIds(classId) {
  if (!classId) return { students: [], parents: [] };
  const klass = await prisma.class.findUnique({
    where: { id: classId },
    include: { students: { select: { userId: true, accountUserId: true } } }
  });
  if (!klass) return { students: [], parents: [] };
  const students = klass.students.filter((s) => s.accountUserId).map((s) => s.accountUserId);
  const parents = klass.students.map((s) => s.userId).filter(Boolean);
  return { students, parents };
}

export function serializeSession(session) {
  if (!session) return session;
  return {
    ...session,
    recordings: (session.recordings || []).map((r) => ({
      id: r.id,
      sessionId: r.sessionId,
      title: r.title,
      fileUrl: r.fileUrl,
      sizeBytes: r.sizeBytes,
      durationSec: r.durationSec,
      status: r.status,
      availableAt: r.availableAt,
      createdAt: r.createdAt
    }))
  };
}

export async function reconcileSession(session) {
  if (!session) return session;
  if (session.status === 'CANCELLED' || session.status === 'ENDED') return session;
  const now = new Date();
  if (session.status === 'SCHEDULED' && now >= session.startsAt && now < session.endsAt) {
    return prisma.liveSession.update({ where: { id: session.id }, data: { status: 'LIVE' } });
  }
  if ((session.status === 'SCHEDULED' || session.status === 'LIVE') && now >= session.endsAt) {
    return finalizeSession(session);
  }
  return session;
}

export async function finalizeSession(session) {
  const provider = getVideoProvider();
  const existing = await prisma.liveRecording.findFirst({ where: { sessionId: session.id } });
  if (!existing) {
    let info = {
      providerRecordingId: null,
      title: `${session.title} (تسجيل)`,
      fileUrl: null,
      sizeBytes: null,
      durationSec: null,
      failed: true
    };
    try {
      info = await provider.finalizeRecording({ session });
    } catch {
      /* تعذّر التوليد — تُسجَّل FAILED وتنتهي الحصة رغم ذلك */
    }
    await prisma.liveRecording.create({
      data: {
        sessionId: session.id,
        providerRecordingId: info.providerRecordingId || null,
        title: info.title || `${session.title} (تسجيل)`,
        fileUrl: info.fileUrl || null,
        sizeBytes: info.sizeBytes || null,
        durationSec: info.durationSec || null,
        status: info.fileUrl ? 'AVAILABLE' : info.failed ? 'FAILED' : 'PROCESSING',
        availableAt: info.fileUrl ? new Date() : null
      }
    });

    if (info.fileUrl) {
      const { students, parents } = await classStudentAndParentIds(session.classId);
      const body = 'يمكنكم الآن مشاهدة أو تحميل تسجيل الحصة من فضاء الحصص المباشرة.';
      if (students.length) {
        await notify(students, {
          type: 'LIVE_RECORDING',
          title: `تسجيل حصة «${session.title}» متاح`,
          body,
          link: '/student-space/live'
        });
      }
      if (parents.length) {
        await notify(parents, {
          type: 'LIVE_RECORDING',
          title: `تسجيل حصة «${session.title}» متاح`,
          body,
          link: '/parent/live'
        });
      }
    }
    return prisma.liveSession.update({ where: { id: session.id }, data: { status: 'ENDED' } });
  }
  return prisma.liveSession.update({ where: { id: session.id }, data: { status: 'ENDED' } });
}
