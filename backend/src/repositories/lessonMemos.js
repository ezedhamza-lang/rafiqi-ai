import prisma from '../db.js';

/**
 * CRUD/ذاكرة مؤقتة على جدول lesson_memos — النظام الحالي لبناء المذكرات
 * من BookContent محليًا دون أي AI. المفتاح الفريد (bookId + lessonId) يجعل
 * نفس الدرس يولّد نفس المذكرة مهما طلبها المعلّم.
 */
export async function findByLesson(bookId, lessonId) {
  return prisma.lessonMemo.findUnique({
    where: { bookId_lessonId: { bookId, lessonId } }
  });
}

export async function findById(id) {
  return prisma.lessonMemo.findUnique({ where: { id: Number(id) } });
}

export async function listForTeacher(teacherId, limit = 50) {
  return prisma.lessonMemo.findMany({
    where: { teacherId },
    orderBy: { updatedAt: 'desc' },
    take: Math.min(Math.max(Number(limit) || 50, 1), 200)
  });
}

export async function create(data) {
  return prisma.lessonMemo.create({ data });
}

export async function upsert(data) {
  const { bookId, lessonId } = data;
  return prisma.lessonMemo.upsert({
    where: { bookId_lessonId: { bookId, lessonId } },
    create: data,
    update: data
  });
}

export async function deleteByLesson(bookId, lessonId) {
  return prisma.lessonMemo.deleteMany({ where: { bookId, lessonId } });
}

export async function deleteById(id, teacherId) {
  return prisma.lessonMemo.deleteMany({ where: { id: Number(id), teacherId } });
}
