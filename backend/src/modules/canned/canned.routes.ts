import { Router } from 'express';
import { auth, AuthRequest } from '../../middlewares/auth';
import { prisma } from '../../database/prisma';

const router = Router();

/**
 * GET / - Get canned responses for current attendant
 */
router.get('/', auth, async (req: AuthRequest, res) => {
  try {
    const canned = await prisma.cannedResponse.findMany({
      where: { attendantId: req.user!.id },
      orderBy: { createdAt: 'desc' },
    });
    res.json(canned);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar respostas' });
  }
});

/**
 * POST / - Create canned response
 */
router.post('/', auth, async (req: AuthRequest, res) => {
  try {
    const { title, content } = req.body;

    if (!title || !content) {
      res.status(400).json({ error: 'Título e conteúdo são obrigatórios' });
      return;
    }

    const canned = await prisma.cannedResponse.create({
      data: {
        title,
        content,
        attendantId: req.user!.id,
      },
    });

    res.json(canned);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao criar resposta' });
  }
});

/**
 * DELETE /:id - Delete canned response
 */
router.delete('/:id', auth, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    const canned = await prisma.cannedResponse.findUnique({
      where: { id },
    });

    if (!canned) {
      res.status(404).json({ error: 'Resposta não encontrada' });
      return;
    }

    if (canned.attendantId !== req.user!.id) {
      res.status(403).json({ error: 'Não autorizado' });
      return;
    }

    await prisma.cannedResponse.delete({
      where: { id },
    });

    res.json({ message: 'Resposta removida com sucesso' });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao remover resposta' });
  }
});

export default router;
