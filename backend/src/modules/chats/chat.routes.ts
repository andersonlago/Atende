import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { prisma } from '../../database/prisma';
import { auth, AuthRequest } from '../../middlewares/auth';
import { sendTextMessage, sendMediaByType } from '../../services/waha.service';
import { saveMedia, getMimeType } from '../../services/media.service';
import { sendMessageToAI, getAIStatus } from '../../services/ai.service';
import { emitToAll, emitToAttendant } from '../../socket';

const router = Router();

// Multer config for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 25 * 1024 * 1024, // 25MB
  },
});

// Validation schemas
const messageSchema = z.object({
  content: z.string().min(1),
});

const transferSchema = z.object({
  toAttendantId: z.string(),
  reason: z.string().optional(),
});

/**
 * GET / - Get chats in service for current attendant
 */
router.get('/', auth, async (req: AuthRequest, res) => {
  try {
    const chats = await prisma.chat.findMany({
      where: {
        attendantId: req.user!.id,
        status: 'IN_SERVICE',
      },
      include: {
        contact: {
          include: {
            tags: true,
          },
        },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    const formattedChats = chats.map(chat => ({
      ...chat,
      lastMessage: chat.messages[0] || null,
    }));

    res.json(formattedChats);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar chats' });
  }
});

/**
 * GET /:id - Get chat details with history
 */
router.get('/:id', auth, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    const chat = await prisma.chat.findUnique({
      where: { id },
      include: {
        contact: {
          include: {
            tags: true,
          },
        },
        attendant: true,
        messages: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!chat) {
      res.status(404).json({ error: 'Chat não encontrado' });
      return;
    }

    // Get last 10 closed chats from same contact for history
    const closedChats = await prisma.chat.findMany({
      where: {
        contactId: chat.contactId,
        status: 'CLOSED',
        id: { not: chat.id },
      },
      orderBy: { finishedAt: 'desc' },
      take: 10,
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    res.json({
      current: chat,
      history: closedChats,
    });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar chat' });
  }
});

/**
 * POST /:id/messages - Send text message
 */
router.post('/:id/messages', auth, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { content } = messageSchema.parse(req.body);

    const chat = await prisma.chat.findUnique({
      where: { id },
      include: { contact: true, attendant: true },
    });

    if (!chat) {
      res.status(404).json({ error: 'Chat não encontrado' });
      return;
    }

    // Check if attendant is assigned
    if (chat.attendantId !== req.user!.id && chat.status === 'IN_SERVICE') {
      res.status(403).json({ error: 'Chat não pertence a você' });
      return;
    }

    // Send via WAHA
    const phone = chat.contact.phone.replace(/\D/g, '');
    await sendTextMessage(phone, content);

    // Save message
    const message = await prisma.message.create({
      data: {
        chatId: id,
        direction: 'OUT',
        type: 'text',
        content,
      },
    });

    // Update chat updated at
    await prisma.chat.update({
      where: { id },
      data: { updatedAt: new Date() },
    });

    // Emit events
    if (chat.attendantId) {
      emitToAttendant(chat.attendantId, 'new:message', {
        chatId: id,
        message,
      });
    }

    res.json(message);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Dados inválidos', details: error.issues });
      return;
    }
    console.error('Send message error:', error);
    res.status(500).json({ error: 'Erro ao enviar mensagem' });
  }
});

/**
 * POST /:id/media - Send media message
 */
router.post('/:id/media', auth, upload.single('file'), async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const file = req.file;
    const caption = req.body.caption || '';

    if (!file) {
      res.status(400).json({ error: 'Arquivo é obrigatório' });
      return;
    }

    const chat = await prisma.chat.findUnique({
      where: { id },
      include: { contact: true },
    });

    if (!chat) {
      res.status(404).json({ error: 'Chat não encontrado' });
      return;
    }

    // Determine media type
    const mimeType = file.mimetype;
    let type = 'document';
    if (mimeType.startsWith('image/')) type = 'image';
    else if (mimeType.startsWith('audio/')) type = 'audio';
    else if (mimeType.startsWith('video/')) type = 'video';

    // Save media
    const fileName = saveMedia(file.buffer, file.originalname);
    const mediaUrl = `${process.env.APP_URL}/media/${fileName}`;

    // Send via WAHA
    const phone = chat.contact.phone.replace(/\D/g, '');
    await sendMediaByType(phone, mediaUrl, type, file.originalname, caption);

    // Save message
    const message = await prisma.message.create({
      data: {
        chatId: id,
        direction: 'OUT',
        type,
        content: caption || file.originalname,
        mediaUrl: `/media/${fileName}`,
        mediaMime: mimeType,
        mediaSize: file.size,
      },
    });

    // Update chat
    await prisma.chat.update({
      where: { id },
      data: { updatedAt: new Date() },
    });

    // Emit event
    if (chat.attendantId) {
      emitToAttendant(chat.attendantId, 'new:message', {
        chatId: id,
        message,
      });
    }

    res.json(message);
  } catch (error) {
    console.error('Send media error:', error);
    res.status(500).json({ error: 'Erro ao enviar mídia' });
  }
});

/**
 * POST /:id/finish - Finish chat
 */
router.post('/:id/finish', auth, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    const chat = await prisma.chat.findUnique({
      where: { id },
      include: { attendant: true },
    });

    if (!chat) {
      res.status(404).json({ error: 'Chat não encontrado' });
      return;
    }

    if (chat.attendantId !== req.user!.id) {
      res.status(403).json({ error: 'Não autorizado' });
      return;
    }

    // Update chat
    await prisma.chat.update({
      where: { id },
      data: {
        status: 'CLOSED',
        finishedAt: new Date(),
      },
    });

    // Update attendant active chats
    if (chat.attendant) {
      await prisma.attendant.update({
        where: { id: chat.attendantId },
        data: { activeChats: Math.max(0, chat.attendant.activeChats - 1) },
      });
    }

    // Emit event
    emitToAttendant(chat.attendantId, 'chat:updated', {
      chatId: id,
      status: 'CLOSED',
    });

    res.json({ message: 'Chat finalizado com sucesso' });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao finalizar chat' });
  }
});

/**
 * POST /:id/transfer - Transfer chat to another attendant
 */
router.post('/:id/transfer', auth, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { toAttendantId, reason } = transferSchema.parse(req.body);

    const chat = await prisma.chat.findUnique({
      where: { id },
      include: { attendant: true, contact: true },
    });

    if (!chat) {
      res.status(404).json({ error: 'Chat não encontrado' });
      return;
    }

    if (chat.attendantId !== req.user!.id) {
      res.status(403).json({ error: 'Não autorizado' });
      return;
    }

    // Get target attendant
    const targetAttendant = await prisma.attendant.findUnique({
      where: { id: toAttendantId },
    });

    if (!targetAttendant) {
      res.status(404).json({ error: 'Atendente destino não encontrado' });
      return;
    }

    if (targetAttendant.status !== 'ONLINE') {
      res.status(400).json({ error: 'Atendente destino está offline' });
      return;
    }

    if (targetAttendant.activeChats >= targetAttendant.maxChats) {
      res.status(400).json({ error: 'Atendente destino com capacidade máxima' });
      return;
    }

    // Create system message
    await prisma.message.create({
      data: {
        chatId: id,
        direction: 'SYSTEM',
        type: 'text',
        content: `Chat transferido de ${chat.attendant?.name} para ${targetAttendant.name}${reason ? `: ${reason}` : ''}`,
      },
    });

    // Update chat
    await prisma.chat.update({
      where: { id },
      data: {
        attendantId: toAttendantId,
        status: 'IN_SERVICE',
      },
    });

    // Update attendants active chats
    await prisma.attendant.update({
      where: { id: chat.attendantId! },
      data: { activeChats: Math.max(0, chat.attendant!.activeChats - 1) },
    });

    await prisma.attendant.update({
      where: { id: toAttendantId },
      data: { activeChats: targetAttendant.activeChats + 1 },
    });

    // Emit events
    emitToAttendant(chat.attendantId!, 'chat:updated', {
      chatId: id,
      action: 'transferred',
    });

    emitToAttendant(toAttendantId, 'chat:assigned', {
      chatId: id,
      contactName: chat.contact.name || chat.contact.phone,
    });

    res.json({ message: 'Chat transferido com sucesso' });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Dados inválidos', details: error.issues });
      return;
    }
    res.status(500).json({ error: 'Erro ao transferir chat' });
  }
});

/**
 * GET /:id/available-attendants - Get available attendants for transfer
 */
router.get('/:id/available-attendants', auth, async (req: AuthRequest, res) => {
  try {
    const attendants = await prisma.attendant.findMany({
      where: {
        status: 'ONLINE',
        id: { not: req.user!.id },
      },
      select: {
        id: true,
        name: true,
        activeChats: true,
        maxChats: true,
      },
    });

    // Filter by capacity
    const available = attendants.filter(a => a.activeChats < a.maxChats);

    res.json(available);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar atendentes' });
  }
});

export default router;
