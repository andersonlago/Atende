import { Router } from 'express';
import { prisma } from '../../database/prisma';
import { auth, adminOnly, AuthRequest } from '../../middlewares/auth';

const router = Router();

/**
 * GET /dashboard - Get dashboard metrics (admin only)
 */
router.get('/dashboard', auth, adminOnly, async (req: AuthRequest, res) => {
  try {
    // Total chats today
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const totalChatsToday = await prisma.chat.count({
      where: {
        createdAt: { gte: today },
      },
    });

    // Chats in service
    const chatsInService = await prisma.chat.count({
      where: { status: 'IN_SERVICE' },
    });

    // Chats waiting
    const chatsWaiting = await prisma.chat.count({
      where: { status: 'WAITING' },
    });

    // Chats closed today
    const closedToday = await prisma.chat.count({
      where: {
        status: 'CLOSED',
        finishedAt: { gte: today },
      },
    });

    // Total contacts
    const totalContacts = await prisma.contact.count();

    // Active attendants
    const activeAttendants = await prisma.attendant.count({
      where: { status: 'ONLINE' },
    });

    // Average response time (simplified)
    const avgResponseTime = await prisma.$queryRaw`
      SELECT AVG(EXTRACT(EPOCH FROM (started_at - created_at))) as avg_seconds
      FROM "Chat"
      WHERE started_at IS NOT NULL
      AND created_at >= NOW() - INTERVAL '7 days'
    `;

    // Chats by attendant
    const chatsByAttendant = await prisma.attendant.findMany({
      where: { status: 'ONLINE' },
      select: {
        id: true,
        name: true,
        activeChats: true,
        maxChats: true,
        chats: {
          where: {
            createdAt: { gte: today },
          },
          _count: true,
        },
      },
    });

    res.json({
      totalChatsToday,
      chatsInService,
      chatsWaiting,
      closedToday,
      totalContacts,
      activeAttendants,
      avgResponseTime: avgResponseTime[0]?.avg_seconds || 0,
      attendants: chatsByAttendant.map(a => ({
        id: a.id,
        name: a.name,
        activeChats: a.activeChats,
        maxChats: a.maxChats,
        chatsToday: a.chats._count,
      })),
    });
  } catch (error) {
    console.error('Metrics error:', error);
    res.status(500).json({ error: 'Erro ao buscar métricas' });
  }
});

export default router;
