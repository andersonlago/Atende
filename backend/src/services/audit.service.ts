import { prisma } from '../database/prisma';

interface CreateAuditLogInput {
  attendantId?: string;
  action: string;
  resource: string;
  resourceId?: string;
  details?: string;
  ipAddress?: string;
  userAgent?: string;
}

export class AuditService {
  /**
   * Registra uma ação de auditoria
   */
  async log(input: CreateAuditLogInput): Promise<void> {
    await prisma.auditLog.create({
      data: {
        attendantId: input.attendantId,
        action: input.action,
        resource: input.resource,
        resourceId: input.resourceId,
        details: input.details,
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
      },
    });
  }

  /**
   * Obtém logs de auditoria com filtros
   */
  async getLogs(filters: {
    attendantId?: string;
    action?: string;
    resource?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    offset?: number;
  }) {
    const where: any = {};

    if (filters.attendantId) {
      where.attendantId = filters.attendantId;
    }

    if (filters.action) {
      where.action = { contains: filters.action, mode: 'insensitive' };
    }

    if (filters.resource) {
      where.resource = { contains: filters.resource, mode: 'insensitive' };
    }

    if (filters.startDate || filters.endDate) {
      where.createdAt = {};
      if (filters.startDate) {
        where.createdAt.gte = filters.startDate;
      }
      if (filters.endDate) {
        where.createdAt.lte = filters.endDate;
      }
    }

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        include: {
          attendant: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: filters.limit ?? 100,
        skip: filters.offset ?? 0,
      }),
      prisma.auditLog.count({ where }),
    ]);

    return { logs, total };
  }

  /**
   * Exporta logs para CSV
   */
  async exportToCSV(filters: {
    attendantId?: string;
    startDate?: Date;
    endDate?: Date;
  }): Promise<string> {
    const { logs } = await this.getLogs({
      ...filters,
      limit: 10000,
    });

    const headers = [
      'ID',
      'Data/Hora',
      'Atendente',
      'Email',
      'Ação',
      'Recurso',
      'ID Recurso',
      'Detalhes',
      'IP',
    ];

    const rows = logs.map((log) => [
      log.id,
      log.createdAt.toISOString(),
      log.attendant?.name || 'Sistema',
      log.attendant?.email || '-',
      log.action,
      log.resource,
      log.resourceId || '-',
      (log.details || '').replace(/"/g, '""'),
      log.ipAddress || '-',
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map((row) =>
        row
          .map((cell) => `"${cell}"`)
          .join(',')
      ),
    ].join('\n');

    return csvContent;
  }
}

export const auditService = new AuditService();
