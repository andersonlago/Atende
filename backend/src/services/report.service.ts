import { prisma } from '../database/prisma';
import { Parser } from 'json2csv';

export class ReportService {
  /**
   * Gera relatório de métricas de atendimentos
   */
  async getAttendanceReport(
    startDate: Date,
    endDate: Date,
    attendantId?: string
  ) {
    const where: any = {
      createdAt: {
        gte: startDate,
        lte: endDate,
      },
    };

    if (attendantId) {
      where.attendantId = attendantId;
    }

    const chats = await prisma.chat.findMany({
      where,
      include: {
        attendant: {
          select: {
            id: true,
            name: true,
          },
        },
        contact: {
          select: {
            id: true,
            phone: true,
            name: true,
          },
        },
        messages: {
          select: {
            id: true,
            direction: true,
            type: true,
            createdAt: true,
          },
        },
      },
    });

    // Agrupa por atendente
    const byAttendant: Record<string, any> = {};

    for (const chat of chats) {
      const attId = chat.attendantId || 'unassigned';
      
      if (!byAttendant[attId]) {
        byAttendant[attId] = {
          attendantName: chat.attendant?.name || 'Não atribuído',
          totalChats: 0,
          closedChats: 0,
          waitingChats: 0,
          totalMessages: 0,
          avgResponseTime: 0,
          responseTimes: [] as number[],
        };
      }

      byAttendant[attId].totalChats++;
      
      if (chat.status === 'CLOSED') {
        byAttendant[attId].closedChats++;
      } else if (chat.status === 'WAITING') {
        byAttendant[attId].waitingChats++;
      }

      byAttendant[attId].totalMessages += chat.messages.length;

      // Calcula tempo de resposta (primeira resposta do atendente)
      if (chat.startedAt) {
        const firstMessage = chat.messages.find(m => m.direction === 'OUT');
        if (firstMessage) {
          const responseTime = 
            firstMessage.createdAt.getTime() - chat.startedAt.getTime();
          byAttendant[attId].responseTimes.push(responseTime);
        }
      }
    }

    // Calcula médias
    const result = Object.values(byAttendant).map((att: any) => ({
      ...att,
      avgResponseTime: att.responseTimes.length > 0
        ? Math.round(att.responseTimes.reduce((a: number, b: number) => a + b, 0) / att.responseTimes.length / 1000)
        : 0,
    }));

    return result;
  }

  /**
   * Exporta relatório para CSV
   */
  async exportAttendanceReportToCSV(
    startDate: Date,
    endDate: Date,
    attendantId?: string
  ): Promise<string> {
    const data = await this.getAttendanceReport(startDate, endDate, attendantId);

    const fields = [
      'attendantName',
      'totalChats',
      'closedChats',
      'waitingChats',
      'totalMessages',
      'avgResponseTime',
    ];

    const parser = new Parser({ fields });
    return parser.parse(data);
  }

  /**
   * Relatório de satisfação
   */
  async getSatisfactionReport(startDate: Date, endDate: Date) {
    const surveys = await prisma.satisfactionSurvey.findMany({
      where: {
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      include: {
        chat: {
          include: {
            attendant: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });

    const ratings = surveys.map(s => s.rating);
    const avgRating = ratings.length > 0
      ? ratings.reduce((a, b) => a + b, 0) / ratings.length
      : 0;

    const byRating = {
      5: surveys.filter(s => s.rating === 5).length,
      4: surveys.filter(s => s.rating === 4).length,
      3: surveys.filter(s => s.rating === 3).length,
      2: surveys.filter(s => s.rating === 2).length,
      1: surveys.filter(s => s.rating === 1).length,
    };

    return {
      totalSurveys: surveys.length,
      avgRating: Math.round(avgRating * 100) / 100,
      byRating,
      surveys,
    };
  }

  /**
   * Relatório de bloqueios temporários
   */
  async getTemporaryBlocksReport() {
    const now = new Date();
    
    const [activeBlocks, expiredBlocks] = await Promise.all([
      prisma.blockedContact.findMany({
        where: {
          isTemporary: true,
          expiresAt: {
            gte: now,
          },
        },
        orderBy: { expiresAt: 'asc' },
      }),
      prisma.blockedContact.findMany({
        where: {
          isTemporary: true,
          expiresAt: {
            lt: now,
          },
        },
        orderBy: { expiresAt: 'desc' },
      }),
    ]);

    return {
      activeBlocks: activeBlocks.length,
      expiredBlocks: expiredBlocks.length,
      activeBlocksList: activeBlocks,
      expiredBlocksList: expiredBlocks.slice(0, 50), // Últimos 50
    };
  }

  /**
   * Relatório de uso da IA
   */
  async getAIUsageReport(startDate: Date, endDate: Date) {
    const messages = await prisma.message.findMany({
      where: {
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
        direction: 'OUT',
        content: {
          contains: 'IA sugeriu:',
        },
      },
      include: {
        chat: {
          include: {
            attendant: {
              select: {
                id: true,
                name: true,
                mode: true,
              },
            },
          },
        },
      },
    });

    const byAttendant: Record<string, number> = {};
    
    for (const msg of messages) {
      const attId = msg.chat.attendantId || 'unknown';
      byAttendant[attId] = (byAttendant[attId] || 0) + 1;
    }

    return {
      totalAISuggestions: messages.length,
      byAttendant: Object.entries(byAttendant).map(([id, count]) => ({
        attendantId: id,
        usageCount: count,
      })),
    };
  }

  /**
   * Relatório geral executivo
   */
  async getExecutiveReport(startDate: Date, endDate: Date) {
    const [
      attendanceReport,
      satisfactionReport,
      blocksReport,
      aiReport,
    ] = await Promise.all([
      this.getAttendanceReport(startDate, endDate),
      this.getSatisfactionReport(startDate, endDate),
      this.getTemporaryBlocksReport(),
      this.getAIUsageReport(startDate, endDate),
    ]);

    return {
      period: { startDate, endDate },
      summary: {
        totalChats: attendanceReport.reduce((sum, att) => sum + att.totalChats, 0),
        closedChats: attendanceReport.reduce((sum, att) => sum + att.closedChats, 0),
        avgResponseTime: Math.round(
          attendanceReport.reduce((sum, att) => sum + att.avgResponseTime, 0) /
          (attendanceReport.length || 1)
        ),
        satisfactionRate: satisfactionReport.avgRating,
        activeBlocks: blocksReport.activeBlocks,
        aiSuggestions: aiReport.totalAISuggestions,
      },
      attendanceByAttendant: attendanceReport,
      satisfaction: satisfactionReport,
      blocks: blocksReport,
      aiUsage: aiReport,
    };
  }
}

export const reportService = new ReportService();
