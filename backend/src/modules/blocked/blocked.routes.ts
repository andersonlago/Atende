import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../database/prisma';
import { auth, adminOnly, AuthRequest } from '../../middlewares/auth';
import { auditService } from '../../services/audit.service';

const router = Router();

const blockedSchema = z.object({
  phone: z.string().min(10),
  reason: z.string().optional(),
  isTemporary: z.boolean().optional(),
  durationHours: z.number().optional(), // Para bloqueio temporário
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
 * POST / - Block contact (suporta temporário e permanente)
 */
router.post('/', auth, adminOnly, async (req: AuthRequest, res) => {
  try {
    const { phone, reason, isTemporary, durationHours } = blockedSchema.parse(req.body);

    let expiresAt: Date | null = null;
    
    if (isTemporary && durationHours) {
      expiresAt = new Date(Date.now() + durationHours * 60 * 60 * 1000);
    }

    const blocked = await prisma.blockedContact.create({
      data: {
        phone: phone.replace(/\D/g, ''),
        reason: reason || null,
        blockedBy: req.user!.id,
        isTemporary: isTemporary || false,
        expiresAt,
      },
    });

    await auditService.log({
      attendantId: req.user!.id,
      action: 'CONTACT_BLOCKED',
      resource: 'BlockedContact',
      resourceId: blocked.id,
      details: `Telefone ${phone} bloqueado. Motivo: ${reason || 'N/A'}. Temporário: ${isTemporary}`,
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

    const blocked = await prisma.blockedContact.findUnique({ where: { id } });
    
    if (blocked) {
      await auditService.log({
        attendantId: req.user!.id,
        action: 'CONTACT_UNBLOCKED',
        resource: 'BlockedContact',
        resourceId: id,
        details: `Telefone ${blocked.phone} desbloqueado`,
      });
      
      await prisma.blockedContact.delete({
        where: { id },
      });
    }

    res.json({ message: 'Contato desbloqueado com sucesso' });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao desbloquear contato' });
  }
});

export default router;
