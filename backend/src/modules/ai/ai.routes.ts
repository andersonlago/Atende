import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../database/prisma';
import { auth, AuthRequest } from '../../middlewares/auth';
import { sendMessageToAI, getAIStatus } from '../../services/ai.service';

const router = Router();

const suggestSchema = z.object({
  chatId: z.string(),
  message: z.string(),
});

/**
 * POST /suggest - Generate AI suggestion for a message
 */
router.post('/suggest', auth, async (req: AuthRequest, res) => {
  try {
    const { chatId, message } = suggestSchema.parse(req.body);

    // Check if AI is online
    const aiOnline = await getAIStatus();
    if (!aiOnline) {
      res.status(503).json({ error: 'IA indisponível no momento' });
      return;
    }

    // Get chat context (last 10 messages)
    const chat = await prisma.chat.findUnique({
      where: { id: chatId },
      include: {
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
        contact: true,
      },
    });

    if (!chat) {
      res.status(404).json({ error: 'Chat não encontrado' });
      return;
    }

    // Build context for AI
    const context = chat.messages
      .reverse()
      .map(m => `${m.direction === 'IN' ? 'Cliente' : 'Atendente'}: ${m.content}`)
      .join('\n');

    // Generate suggestion
    const prompt = `Contexto da conversa:\n${context}\n\nÚltima mensagem do cliente: ${message}\n\nGere uma resposta profissional e útil em português do Brasil.`;
    
    const suggestion = await sendMessageToAI(prompt);

    res.json({ suggestion, aiOnline: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Dados inválidos', details: error.issues });
      return;
    }
    console.error('AI suggestion error:', error);
    res.status(500).json({ error: 'Erro ao gerar sugestão' });
  }
});

/**
 * GET /status - Get AI service status
 */
router.get('/status', auth, async (req: AuthRequest, res) => {
  try {
    const online = await getAIStatus();
    res.json({ online });
  } catch (error) {
    res.json({ online: false });
  }
});

export default router;
