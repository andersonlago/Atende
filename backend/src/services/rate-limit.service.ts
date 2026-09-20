import { prisma } from '../database/prisma';

interface RateLimitCheckResult {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
}

export class RateLimitService {
  private static readonly WINDOW_MS = 60 * 1000; // 1 minuto
  private static readonly MAX_REQUESTS = 20; // Limite por minuto

  /**
   * Verifica se o telefone pode enviar mensagem dentro do limite
   * Implementa sliding window para controle de rate limiting
   */
  async checkLimit(phone: string): Promise<RateLimitCheckResult> {
    const now = new Date();
    const windowStart = new Date(now.getTime() - this.WINDOW_MS);

    // Limpa registros antigos e obtém/count atual
    await prisma.rateLimit.deleteMany({
      where: {
        windowStart: {
          lt: windowStart,
        },
      },
    });

    let rateLimit = await prisma.rateLimit.findFirst({
      where: {
        phone,
        windowStart: {
          gte: windowStart,
        },
      },
    });

    if (!rateLimit) {
      // Cria novo registro na janela atual
      rateLimit = await prisma.rateLimit.create({
        data: {
          phone,
          windowStart: now,
          count: 1,
        },
      });

      return {
        allowed: true,
        remaining: this.MAX_REQUESTS - 1,
        resetAt: new Date(now.getTime() + this.WINDOW_MS),
      };
    }

    const remaining = Math.max(0, this.MAX_REQUESTS - rateLimit.count);
    const resetAt = new Date(rateLimit.windowStart.getTime() + this.WINDOW_MS);

    if (rateLimit.count >= this.MAX_REQUESTS) {
      return {
        allowed: false,
        remaining: 0,
        resetAt,
      };
    }

    // Incrementa contador
    await prisma.rateLimit.update({
      where: { id: rateLimit.id },
      data: { count: rateLimit.count + 1 },
    });

    return {
      allowed: true,
      remaining: remaining - 1,
      resetAt,
    };
  }

  /**
   * Reseta o limite para um telefone (uso administrativo)
   */
  async resetLimit(phone: string): Promise<void> {
    await prisma.rateLimit.deleteMany({
      where: { phone },
    });
  }

  /**
   * Obtém status atual do rate limit
   */
  async getStatus(phone: string): Promise<{ count: number; resetAt: Date | null }> {
    const now = new Date();
    const windowStart = new Date(now.getTime() - this.WINDOW_MS);

    const rateLimit = await prisma.rateLimit.findFirst({
      where: {
        phone,
        windowStart: {
          gte: windowStart,
        },
      },
    });

    if (!rateLimit) {
      return { count: 0, resetAt: null };
    }

    return {
      count: rateLimit.count,
      resetAt: new Date(rateLimit.windowStart.getTime() + this.WINDOW_MS),
    };
  }
}

export const rateLimitService = new RateLimitService();
