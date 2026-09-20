import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../database/prisma';
import { auth, adminOnly, AuthRequest } from '../../middlewares/auth';

const router = Router();

const blockedSchema = z.object({
  phone: z.string().min(10),
  reason: z.string().optional(),
});

/**
 * GET / - List all blocked contacts
 */
router.get('/', auth, adminOnly, async (req: AuthRequest, res) => {
  try {
    const blocked = await prisma.blockedContact.findMany({
      orderBy: { createdAt: 'desc' },
    });
    res.json(blocked);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar bloqueados' });
  }
});

/**
 * POST / - Block contact
 */
router.post('/', auth, adminOnly, async (req: AuthRequest, res) => {
  try {
    const { phone, reason } = blockedSchema.parse(req.body);

    const blocked = await prisma.blockedContact.create({
      data: {
        phone: phone.replace(/\D/g, ''),
        reason: reason || null,
        blockedBy: req.user!.id,
      },
    });

    res.json(blocked);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Dados inválidos', details: error.issues });
      return;
    }
    res.status(500).json({ error: 'Erro ao bloquear contato' });
  }
});

/**
 * DELETE /:id - Unblock contact
 */
router.delete('/:id', auth, adminOnly, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    await prisma.blockedContact.delete({
      where: { id },
    });

    res.json({ message: 'Contato desbloqueado com sucesso' });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao desbloquear contato' });
  }
});

export default router;
