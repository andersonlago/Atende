import { prisma } from '../database/prisma';

interface CreateNoteInput {
  contactId: string;
  attendantId: string;
  content: string;
}

export class InternalNoteService {
  /**
   * Cria uma nota interna privada
   */
  async create(input: CreateNoteInput) {
    return prisma.internalNote.create({
      data: {
        contactId: input.contactId,
        attendantId: input.attendantId,
        content: input.content,
      },
      include: {
        attendant: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
  }

  /**
   * Obtém notas de um contato
   */
  async getByContact(contactId: string) {
    return prisma.internalNote.findMany({
      where: { contactId },
      include: {
        attendant: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Atualiza uma nota
   */
  async update(noteId: string, attendantId: string, content: string) {
    const note = await prisma.internalNote.findUnique({
      where: { id: noteId },
    });

    if (!note || note.attendantId !== attendantId) {
      throw new Error('Nota não encontrada ou permissão negada');
    }

    return prisma.internalNote.update({
      where: { id: noteId },
      data: { content },
    });
  }

  /**
   * Remove uma nota
   */
  async delete(noteId: string, attendantId: string) {
    const note = await prisma.internalNote.findUnique({
      where: { id: noteId },
    });

    if (!note || note.attendantId !== attendantId) {
      throw new Error('Nota não encontrada ou permissão negada');
    }

    return prisma.internalNote.delete({
      where: { id: noteId },
    });
  }
}

export const internalNoteService = new InternalNoteService();
