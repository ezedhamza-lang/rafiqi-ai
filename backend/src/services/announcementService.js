import prisma from '../db.js';
import { notify } from './notify.js';

export const ANNOUNCEMENT_CATEGORIES = ['GENERAL', 'URGENT', 'EXAM', 'EVENT', 'OTHER'];

const AUDIENCE_ROLES = {
  ALL: ['STUDENT', 'PARENT', 'TEACHER', 'SCHOOL_DIRECTOR', 'ADMIN', 'SUPER_ADMIN'],
  STUDENT: ['STUDENT'],
  PARENT: ['PARENT'],
  TEACHER: ['TEACHER'],
  DIRECTOR: ['SCHOOL_DIRECTOR', 'ADMIN'],
  ADMIN: ['ADMIN', 'SUPER_ADMIN']
};

// schoolId != null ⇒ الجمهور محصور بتلك المدرسة (عزل مدارس). null ⇒ عالمي (للمشرف/الإدارة).
export async function resolveAudienceUserIds({ audience, level, schoolId = null }) {
  const raw = Array.isArray(audience) && audience.length ? audience : ['ALL'];
  const roles = [...new Set(raw.flatMap((a) => AUDIENCE_ROLES[a] || [a]))];
  if (!roles.length) return [];

  const users = await prisma.user.findMany({
    where: {
      role: { in: roles },
      accountStatus: 'ACTIVE',
      ...(schoolId != null ? { schoolId } : {})
    },
    select: { id: true, role: true }
  });

  let studentIdSet = null;
  if (level && roles.includes('STUDENT')) {
    const students = await prisma.student.findMany({
      where: { level, ...(schoolId != null ? { schoolId } : {}) },
      select: { accountUserId: true }
    });
    studentIdSet = new Set(students.map((s) => s.accountUserId).filter(Boolean));
  }

  return users
    .filter((u) => !(studentIdSet && u.role === 'STUDENT') || studentIdSet.has(u.id))
    .map((u) => u.id);
}

export async function publishAnnouncement({ title, body, category, priority, audience, level, link, createdBy, schoolId = null, channels }) {
  const announcement = await prisma.schoolAnnouncement.create({
    data: {
      title: String(title).trim().slice(0, 200),
      body: String(body).trim().slice(0, 5000),
      category: category && ANNOUNCEMENT_CATEGORIES.includes(category) ? category : 'GENERAL',
      priority: priority && ['LOW', 'NORMAL', 'HIGH', 'URGENT'].includes(priority) ? priority : 'NORMAL',
      audience: Array.isArray(audience) && audience.length ? audience : ['ALL'],
      level: level || null,
      link: link || null,
      status: 'PUBLISHED',
      schoolId,
      createdBy
    }
  });

  const userIds = await resolveAudienceUserIds({ audience: announcement.audience, level: announcement.level, schoolId });

  await notify(userIds, {
    type: 'ANNOUNCEMENT',
    title: `إعلان: ${announcement.title}`,
    body: announcement.body,
    link: announcement.link || '/message-center',
    channels,
    priority: announcement.priority,
    schoolAnnouncementId: announcement.id,
    metadata: { announcementId: announcement.id, category: announcement.category }
  });

  return { announcement, recipients: userIds.length };
}
