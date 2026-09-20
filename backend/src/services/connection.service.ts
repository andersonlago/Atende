import { prisma } from '../database/prisma';
import axios from 'axios';
import { env } from '../config/env';

export class ConnectionService {
  /**
   * Atualiza o status da conexão WAHA
   */
  async updateStatus(
    sessionId: string,
    status: 'CONNECTED' | 'DISCONNECTED' | 'CONNECTING' | 'ERROR',
    options?: {
      qrCode?: string;
      errorMessage?: string;
    }
  ): Promise<void> {
    await prisma.connectionStatus.upsert({
      where: { sessionId },
      update: {
        status,
        lastSeen: new Date(),
        qrCode: options?.qrCode,
        errorMessage: options?.errorMessage,
        reconnectAttempts: status === 'ERROR' ? { increment: 1 } : 0,
      },
      create: {
        sessionId,
        status,
        lastSeen: new Date(),
        qrCode: options?.qrCode,
        errorMessage: options?.errorMessage,
      },
    });
  }

  /**
   * Obtém status atual da conexão
   */
  async getStatus(sessionId: string = env.WAHA_SESSION_NAME) {
    const status = await prisma.connectionStatus.findUnique({
      where: { sessionId },
    });

    if (!status) {
      return {
        sessionId,
        status: 'DISCONNECTED' as const,
        lastSeen: null,
        qrCode: null,
        errorMessage: null,
        reconnectAttempts: 0,
      };
    }

    return status;
  }

  /**
   * Tenta reconectar com backoff exponencial
   */
  async reconnectWithBackoff(
    sessionId: string,
    maxAttempts: number = 5
  ): Promise<boolean> {
    const status = await this.getStatus(sessionId);
    
    if (status.reconnectAttempts >= maxAttempts) {
      await this.updateStatus(sessionId, 'ERROR', {
        errorMessage: 'Máximo de tentativas de reconexão atingido',
      });
      return false;
    }

    // Backoff exponencial: 2^attempt * 1000ms
    const delay = Math.min(
      Math.pow(2, status.reconnectAttempts) * 1000,
      30000 // Máximo 30 segundos
    );

    await new Promise((resolve) => setTimeout(resolve, delay));

    try {
      // Tenta conectar ao WAHA
      const response = await axios.get(`${env.WAHA_URL}/api/status`, {
        headers: { 'X-Api-Key': env.WAHA_API_KEY },
        timeout: 5000,
      });

      if (response.data.connected) {
        await this.updateStatus(sessionId, 'CONNECTED');
        return true;
      }

      throw new Error('WAHA não está conectado');
    } catch (error) {
      await this.updateStatus(sessionId, 'ERROR', {
        errorMessage: error instanceof Error ? error.message : 'Falha na reconexão',
      });
      return false;
    }
  }

  /**
   * Reseta contador de tentativas de reconexão
   */
  async resetReconnectAttempts(sessionId: string): Promise<void> {
    await prisma.connectionStatus.update({
      where: { sessionId },
      data: { reconnectAttempts: 0 },
    });
  }

  /**
   * Obtém QR Code para autenticação
   */
  async getQRCode(sessionId: string = env.WAHA_SESSION_NAME): Promise<string | null> {
    const status = await this.getStatus(sessionId);
    return status.qrCode || null;
  }
}

export const connectionService = new ConnectionService();
