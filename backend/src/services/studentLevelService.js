import prisma from '../db.js';

export async function getStudentLevel(accountUserId) {
  const student = await prisma.student.findFirst({
    where: { accountUserId },
    select: { level: true, class: { select: { level: true } } }
  });
  if (!student) return null;
  return student.class?.level || student.level || null;
}