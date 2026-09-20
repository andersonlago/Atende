import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../database/prisma';
import { auth, adminOnly, AuthRequest } from '../../middlewares/auth';

const router = Router();

const businessHoursSchema = z.object({
  dayOfWeek: z.number().int().min(0).max(6),
  openTime: z.string().regex(/^\d{2}:\d{2}$/),
  closeTime: z.string().regex(/^\d{2}:\d{2}$/),
  enabled: z.boolean().default(true),
});

/**
 * GET / - List all business hours
 */
router.get('/', auth, async (req: AuthRequest, res) => {
  try {
    const hours = await prisma.businessHours.findMany({
      orderBy: { dayOfWeek: 'asc' },
    });
    res.json(hours);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar horário' });
  }
});

/**
 * POST / - Create or update business hours
 */
router.post('/', auth, adminOnly, async (req: AuthRequest, res) => {
  try {
    const { dayOfWeek, openTime, closeTime, enabled } = businessHoursSchema.parse(req.body);

    const bh = await prisma.businessHours.upsert({
      where: { id: `bh-${dayOfWeek}` },
      update: { openTime, closeTime, enabled },
      create: {
        id: `bh-${dayOfWeek}`,
        dayOfWeek,
        openTime,
        closeTime,
        enabled,
      },
    });

    res.json(bh);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Dados inválidos', details: error.issues });
      return;
    }
    res.status(500).json({ error: 'Erro ao salvar horário' });
  }
});

/**
 * PUT /:id - Update business hours
 */
router.put('/:id', auth, adminOnly, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { openTime, closeTime, enabled } = z.object({
      openTime: z.string().regex(/^\d{2}:\d{2}$/),
      closeTime: z.string().regex(/^\d{2}:\d{2}$/),
      enabled: z.boolean(),
    }).parse(req.body);

    const bh = await prisma.businessHours.update({
      where: { id },
      data: { openTime, closeTime, enabled },
    });

    res.json(bh);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Dados inválidos', details: error.issues });
      return;
    }
    res.status(500).json({ error: 'Erro ao atualizar horário' });
  }
});

export default router;
