import { prisma } from '../database/prisma';
import { auditService } from './audit.service';

interface GDPRRequest {
  contactId: string;
  reason: string;
  requestedBy: string;
}

export class GDPRService {
  /**
   * Registra consentimento do contato (LGPD/GDPR)
   */
  async recordConsent(contactId: string, ipAddress?: string): Promise<void> {
    await prisma.contact.update({
      where: { id: contactId },
      data: {
        consentGiven: true,
        consentDate: new Date(),
      },
    });

    await auditService.log({
      action: 'CONSENT_RECORDED',
      resource: 'Contact',
      resourceId: contactId,
      details: 'Consentimento LGPD/GDPR registrado',
      ipAddress,
    });
  }

  /**
   * Revoga consentimento do contato
   */
  async revokeConsent(contactId: string, ipAddress?: string): Promise<void> {
    await prisma.contact.update({
      where: { id: contactId },
      data: {
        consentGiven: false,
        consentDate: null,
      },
    });

    await auditService.log({
      action: 'CONSENT_REVOKED',
      resource: 'Contact',
      resourceId: contactId,
      details: 'Consentimento LGPD/GDPR revogado',
      ipAddress,
    });
  }

  /**
   * Implementa direito ao esquecimento - anonimiza dados do contato
   * Mantém chats e mensagens para histórico, mas remove dados pessoais
   */
  async anonymizeContact(
    contactId: string,
    request: GDPRRequest
  ): Promise<void> {
    const contact = await prisma.contact.findUnique({
      where: { id: contactId },
      include: {
        chats: {
          include: {
            messages: true,
          },
        },
      },
    });

    if (!contact) {
      throw new Error('Contato não encontrado');
    }

    // Anonimiza nome e telefone
    const anonymousPhone = `ANON_${contact.id.substring(0, 8)}`;
    
    await prisma.contact.update({
      where: { id: contactId },
      data: {
        name: '[ANONIMIZADO]',
        phone: anonymousPhone,
        anonymizedAt: new Date(),
        consentGiven: false,
        consentDate: null,
      },
    });

    // Remove tags associadas
    await prisma.tag.updateMany({
      where: {
        contacts: {
          some: { id: contactId },
        },
      },
      data: {
        contacts: {
          disconnect: { id: contactId },
        },
      },
    });

    // Anonimiza mensagens com conteúdo pessoal (opcional, mantém estrutura)
    await prisma.message.updateMany({
      where: { chat: { contactId } },
      data: {
        content: {
          set: '[CONTEÚDO ANONIMIZADO]',
        },
      },
    });

    // Remove notas internas
    await prisma.internalNote.deleteMany({
      where: { contactId },
    });

    // Log de auditoria
    await auditService.log({
      action: 'DATA_ANONYMIZED',
      resource: 'Contact',
      resourceId: contactId,
      details: `Direito ao esquecimento exercido. Solicitante: ${request.requestedBy}. Motivo: ${request.reason}`,
    });
  }

  /**
   * Exporta todos os dados de um contato (direito à portabilidade)
   */
  async exportData(contactId: string): Promise<any> {
    const contact = await prisma.contact.findUnique({
      where: { id: contactId },
      include: {
        chats: {
          include: {
            messages: {
              orderBy: { createdAt: 'asc' },
            },
            attendant: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
        tags: true,
        internalNotes: {
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

    if (!contact) {
      throw new Error('Contato não encontrado');
    }

    return {
      contact: {
        id: contact.id,
        phone: contact.phone,
        name: contact.name,
        consentGiven: contact.consentGiven,
        consentDate: contact.consentDate,
        createdAt: contact.createdAt,
      },
      tags: contact.tags,
      chats: contact.chats.map((chat) => ({
        id: chat.id,
        status: chat.status,
        startedAt: chat.startedAt,
        finishedAt: chat.finishedAt,
        attendant: chat.attendant,
        messages: chat.messages,
      })),
      internalNotes: contact.internalNotes,
      exportedAt: new Date().toISOString(),
    };
  }

  /**
   * Obtém contatos sem consentimento
   */
  async getContactsMissingConsent() {
    return prisma.contact.findMany({
      where: {
        consentGiven: false,
        anonymizedAt: null,
      },
      select: {
        id: true,
        phone: true,
        name: true,
        createdAt: true,
      },
    });
  }
}

export const gdprService = new GDPRService();
