import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authMiddleware } from '../auth.js';

const prisma = new PrismaClient();
const router = Router();

// GET /api/student/friends — list friends + pending requests
router.get('/friends', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;

    const friendships = await prisma.friendship.findMany({
      where: {
        OR: [
          { requesterId: userId, status: 'ACCEPTED' },
          { addresseeId: userId, status: 'ACCEPTED' },
        ],
      },
      include: {
        requester: { select: { id: true, firstName: true, lastName: true, level: true, xp: true } },
        addressee: { select: { id: true, firstName: true, lastName: true, level: true, xp: true } },
      },
    });

    const friends = friendships.map(f => {
      const other = f.requesterId === userId ? f.addressee : f.requester;
      return {
        id: other.id,
        name: `${other.firstName} ${other.lastName}`,
        level: other.level || 1,
        xp: other.xp || 0,
        friendshipId: f.id,
      };
    });

    const pendingRequests = await prisma.friendship.findMany({
      where: { addresseeId: userId, status: 'PENDING' },
      include: {
        requester: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    const requests = pendingRequests.map(r => ({
      id: r.id,
      userId: r.requesterId,
      name: `${r.requester.firstName} ${r.requester.lastName}`,
      createdAt: r.createdAt,
    }));

    res.json({ friends, requests });
  } catch (err) {
    console.error('Friends list error:', err);
    res.json({ friends: [], requests: [] });
  }
});

// GET /api/student/friends/search?q=name — search students
router.get('/friends/search', authMiddleware, async (req, res) => {
  try {
    const { q } = req.query;
    if (!q || q.length < 2) return res.json({ users: [] });

    const userId = req.user.id;
    const existing = await prisma.friendship.findMany({
      where: {
        OR: [
          { requesterId: userId },
          { addresseeId: userId },
        ],
      },
    });
    const excludeIds = existing.flatMap(f => [f.requesterId, f.addresseeId]).filter(id => id !== userId);

    const users = await prisma.user.findMany({
      where: {
        role: 'STUDENT',
        id: { not: userId, notIn: excludeIds },
        OR: [
          { firstName: { contains: q } },
          { lastName: { contains: q } },
        ],
      },
      select: { id: true, firstName: true, lastName: true, level: true },
      take: 10,
    });

    res.json({
      users: users.map(u => ({
        id: u.id,
        name: `${u.firstName} ${u.lastName}`,
        level: u.level || 1,
      })),
    });
  } catch (err) {
    console.error('Friends search error:', err);
    res.json({ users: [] });
  }
});

// POST /api/student/friends/request — send friend request
router.post('/friends/request', authMiddleware, async (req, res) => {
  try {
    const requesterId = req.user.id;

    // Validate the addressee before touching the database. A missing or non-numeric
    // `userId` used to reach prisma and surface as HTTP 500 (ISS-010); a string such
    // as "9" also slipped past the strict `===` self-check.
    const raw = req.body?.userId;
    const addresseeId = Number(raw);
    if (raw === undefined || raw === null || raw === '' || !Number.isInteger(addresseeId) || addresseeId <= 0) {
      return res.status(400).json({ error: 'المعرّف مطلوب ويجب أن يكون رقمًا صحيحًا', field: 'userId' });
    }

    if (addresseeId === requesterId) return res.status(400).json({ error: 'Cannot add yourself' });

    const recipient = await prisma.user.findUnique({ where: { id: addresseeId }, select: { id: true, role: true } });
    if (!recipient) return res.status(404).json({ error: 'المستخدم غير موجود' });
    if (recipient.role !== 'STUDENT') {
      return res.status(400).json({ error: 'يمكن إرسال طلب الصداقة إلى تلميذ فقط' });
    }

    const existing = await prisma.friendship.findFirst({
      where: {
        OR: [
          { requesterId, addresseeId },
          { requesterId: addresseeId, addresseeId: requesterId },
        ],
      },
    });

    if (existing) {
      return res.status(400).json({ error: 'Friend request already exists' });
    }

    const friendship = await prisma.friendship.create({
      data: { requesterId, addresseeId, status: 'PENDING' },
    });

    res.json({ success: true, id: friendship.id });
  } catch (err) {
    console.error('Friend request error:', err);
    res.status(500).json({ error: 'Failed to send request' });
  }
});

// POST /api/student/friends/accept/:id — accept friend request
router.post('/friends/accept/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const friendship = await prisma.friendship.findUnique({ where: { id } });

    if (!friendship || friendship.addresseeId !== req.user.id) {
      return res.status(404).json({ error: 'Request not found' });
    }

    await prisma.friendship.update({
      where: { id },
      data: { status: 'ACCEPTED' },
    });

    res.json({ success: true });
  } catch (err) {
    console.error('Accept friend error:', err);
    res.status(500).json({ error: 'Failed to accept' });
  }
});

// POST /api/student/friends/decline/:id — decline friend request
router.post('/friends/decline/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.friendship.delete({ where: { id } });
    res.json({ success: true });
  } catch (err) {
    console.error('Decline friend error:', err);
    res.status(500).json({ error: 'Failed to decline' });
  }
});

// DELETE /api/student/friends/:id — remove friend
router.delete('/friends/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.friendship.delete({ where: { id } });
    res.json({ success: true });
  } catch (err) {
    console.error('Remove friend error:', err);
    res.status(500).json({ error: 'Failed to remove' });
  }
});

export default router;
