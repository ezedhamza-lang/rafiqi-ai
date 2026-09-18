import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { requireAuth } from '../middleware/auth.js';
import {
  generateCertificate,
  generateLevelCertificate,
  generateSubjectCertificate,
} from '../services/certificateService.js';

const prisma = new PrismaClient();
const router = Router();

// GET /api/student/certificates — list earned certificates
router.get('/certificates', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { firstName: true, lastName: true, level: true, xp: true },
    });

    const certificates = [];

    // Level certificates
    for (let lvl = 2; lvl <= (user.level || 1); lvl++) {
      certificates.push({
        id: `level-${lvl}`,
        type: 'level',
        title: `شهادة المستوى ${lvl}`,
        description: `تهانينا! لقد وصلت إلى المستوى ${lvl}`,
        level: lvl,
        date: new Date().toISOString(),
      });
    }

    // Subject completion certificates (from progress)
    const progress = await prisma.studentProgress.findMany({
      where: { userId },
      include: { lesson: { include: { subject: true } } },
    });

    const subjectMap = {};
    progress.forEach(p => {
      const subName = p.lesson?.subject?.name;
      if (subName && !subjectMap[subName]) subjectMap[subName] = 0;
      if (subName && p.completed) subjectMap[subName]++;
    });

    Object.entries(subjectMap).forEach(([name, count]) => {
      if (count >= 5) { // certificate after 5 completed lessons in a subject
        certificates.push({
          id: `subject-${name}`,
          type: 'subject',
          title: `شهادة إتمام — ${name}`,
          description: `تم إتمام ${count} دروس في مادة ${name}`,
          subject: name,
          date: new Date().toISOString(),
        });
      }
    });

    // XP milestone certificates
    const xpMilestones = [100, 500, 1000, 2000, 5000];
    xpMilestones.forEach(xpThreshold => {
      if ((user.xp || 0) >= xpThreshold) {
        certificates.push({
          id: `xp-${xpThreshold}`,
          type: 'xp',
          title: `شهادة ${xpThreshold} XP`,
          description: `حصلت على ${xpThreshold} نقطة خبرة!`,
          xp: xpThreshold,
          date: new Date().toISOString(),
        });
      }
    });

    res.json({ certificates, student: user });
  } catch (err) {
    console.error('Certificates error:', err);
    res.json({ certificates: [], student: null });
  }
});

// GET /api/student/certificates/:type/:id/pdf — download certificate PDF
router.get('/certificates/:type/:id/pdf', requireAuth, async (req, res) => {
  try {
    const { type, id } = req.params;
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { firstName: true, lastName: true, level: true, xp: true },
    });

    const studentName = `${user.firstName} ${user.lastName}`;
    let pdfBytes;

    if (type === 'level') {
      const level = parseInt(id) || 2;
      pdfBytes = await generateLevelCertificate(studentName, level);
    } else if (type === 'subject') {
      pdfBytes = await generateSubjectCertificate(studentName, id);
    } else if (type === 'xp') {
      const xp = parseInt(id) || 100;
      pdfBytes = await generateCertificate({
        studentName,
        title: `شهادة ${xp} XP`,
        description: `حصلت على ${xp} نقطة خبرة!`,
        xp,
      });
    } else {
      return res.status(400).json({ error: 'Invalid certificate type' });
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="certificate-${type}-${id}.pdf"`);
    res.send(Buffer.from(pdfBytes));
  } catch (err) {
    console.error('Certificate PDF error:', err);
    res.status(500).json({ error: 'Failed to generate certificate' });
  }
});

// GET /api/student/leaderboard — honor board / weekly leaderboard
router.get('/leaderboard', requireAuth, async (req, res) => {
  try {
    const students = await prisma.user.findMany({
      where: { role: 'STUDENT' },
      select: {
        id: true, firstName: true, lastName: true,
        xp: true, coins: true, level: true, streakDays: true,
      },
      orderBy: { xp: 'desc' },
      take: 20,
    });

    const currentUserId = req.user.id;
    const currentRank = students.findIndex(s => s.id === currentUserId) + 1;

    res.json({
      leaderboard: students.map((s, i) => ({
        rank: i + 1,
        id: s.id,
        name: `${s.firstName} ${s.lastName}`,
        xp: s.xp || 0,
        coins: s.coins || 0,
        level: s.level || 1,
        streak: s.streakDays || 0,
        isMe: s.id === currentUserId,
      })),
      currentRank,
    });
  } catch (err) {
    console.error('Leaderboard error:', err);
    res.json({ leaderboard: [], currentRank: 0 });
  }
});

export default router;
