import prisma from '../db.js';

export const MESSAGE_POLICY = {
  TEACHER: ['PARENT', 'SCHOOL_DIRECTOR', 'ADMIN', 'SUPER_ADMIN'],
  PARENT: ['TEACHER', 'SCHOOL_DIRECTOR', 'ADMIN', 'SUPER_ADMIN'],
  SCHOOL_DIRECTOR: ['TEACHER', 'PARENT', 'ADMIN', 'SUPER_ADMIN'],
  ADMIN: ['TEACHER', 'PARENT', 'SCHOOL_DIRECTOR', 'SUPER_ADMIN'],
  SUPER_ADMIN: ['TEACHER', 'PARENT', 'SCHOOL_DIRECTOR', 'ADMIN'],
  STUDENT: []
};

export const MESSAGE_POLICY_TEXT = {
  TEACHER: 'يمكنك مراسلة أولياء تلاميذك ومدير مدرستك والإدارة العامة فقط.',
  PARENT: 'يمكنك مراسلة معلمي أبنائك ومدير المدرسة والإدارة العامة فقط.',
  SCHOOL_DIRECTOR: 'يمكنك مراسلة الأساتذة والأولياء والإدارة العامة.',
  ADMIN: 'يمكنك مراسلة أي طرف في المنصة.',
  SUPER_ADMIN: 'يمكنك مراسلة أي طرف في المنصة.',
  STUDENT: 'غير مسموح لك بإرسال رسائل.'
};

export function canMessage(senderRole, recipientRole) {
  return (MESSAGE_POLICY[senderRole] || []).includes(recipientRole);
}

export async function isAllowedContact(senderUser, recipientUser) {
  if (!canMessage(senderUser.role, recipientUser.role)) return false;
  if (senderUser.role === 'PARENT' && recipientUser.role === 'TEACHER') {
    const count = await prisma.student.count({
      where: { userId: senderUser.id, class: { teacherId: recipientUser.id } }
    });
    return count > 0;
  }
  if (senderUser.role === 'TEACHER' && recipientUser.role === 'PARENT') {
    const count = await prisma.class.count({
      where: { teacherId: senderUser.id, students: { some: { userId: recipientUser.id } } }
    });
    return count > 0;
  }
  return true;
}

export async function scopedRecipientIds(user) {
  if (user.role === 'PARENT') {
    const students = await prisma.student.findMany({
      where: { userId: user.id },
      select: { class: { select: { teacherId: true } } }
    });
    return [...new Set(students.map((s) => s.class?.teacherId).filter(Boolean))];
  }
  if (user.role === 'TEACHER') {
    const classes = await prisma.class.findMany({
      where: { teacherId: user.id },
      include: { students: { select: { userId: true } } }
    });
    return [...new Set(classes.flatMap((c) => c.students.map((s) => s.userId).filter(Boolean)))];
  }
  return null;
}
