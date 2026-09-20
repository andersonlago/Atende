import { Router } from 'express';
import { auth, AuthRequest } from '../../middlewares/auth';
import * as queueService from './queue.service';

const router = Router();

/**
 * GET / - Get all waiting chats in queue
 */
router.get('/', auth, async (req: AuthRequest, res) => {
  try {
    const chats = await queueService.getQueueChats();
    res.json(chats);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar fila' });
  }
});

/**
 * POST /assign - Assign chat to current attendant
 */
router.post('/assign', auth, async (req: AuthRequest, res) => {
  try {
    const { chatId } = req.body;

    if (!chatId) {
      res.status(400).json({ error: 'Chat ID é obrigatório' });
      return;
    }

    const chat = await queueService.assignChat(chatId, req.user!.id);
    res.json(chat);
  } catch (error) {
    if (error instanceof Error) {
      res.status(400).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: 'Erro ao atribuir chat' });
  }
});

export default router;
