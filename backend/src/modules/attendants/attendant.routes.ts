import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../database/prisma';
import { auth, adminOnly, AuthRequest } from '../../middlewares/auth';
import { sendEmail, getInvitationTemplate } from '../../services/email.service';
import { env } from '../../config/env';

const router = Router();

// Validation schemas
const inviteSchema = z.object({
  email: z.string().email(),
  name: z.string().min(3),
  maxChats: z.number().int().positive().default(5),
});

const updateAttendantSchema = z.object({
  name: z.string().min(3).optional(),
  role: z.enum(['ADMIN', 'ATTENDANT']).optional(),
  maxChats: z.number().int().positive().optional(),
  status: z.enum(['ONLINE', 'OFFLINE']).optional(),
});

/**
 * GET / - List all attendants (admin only)
 */
router.get('/', auth, adminOnly, async (req: AuthRequest, res) => {
  try {
    const attendants = await prisma.attendant.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
        mode: true,
        activeChats: true,
        maxChats: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(attendants);
  } catch (error) {
    res.status(500).json({ error: 'Erro interno' });
  }
});

/**
 * POST /invite - Send invitation email (admin only)
 */
router.post('/invite', auth, adminOnly, async (req: AuthRequest, res) => {
  try {
    const { email, name, maxChats } = inviteSchema.parse(req.body);

    // Check if email already exists
    const existingUser = await prisma.attendant.findUnique({
      where: { email },
    });

    if (existingUser) {
      res.status(400).json({ error: 'Email já cadastrado' });
      return;
    }

    // Check if invitation already exists
    const existingInvite = await prisma.invitation.findUnique({
      where: { email },
    });

    if (existingInvite && !existingInvite.used && existingInvite.expiresAt > new Date()) {
      res.status(400).json({ error: 'Convite já enviado para este email' });
      return;
    }

    // Generate token
    const token = jwt.sign({ email, type: 'invite' }, env.JWT_SECRET, { expiresIn: '7d' });

    // Create or update invitation
    await prisma.invitation.upsert({
      where: { email },
      update: {
        token,
        name,
        maxChats,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        used: false,
      },
      create: {
        email,
        token,
        name,
        maxChats,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        used: false,
      },
    });

    // Send email
    const html = getInvitationTemplate(name, token, env.APP_URL);
    await sendEmail({
      to: email,
      subject: 'Convite para Sistema de Atendimento',
      html,
    });

    res.json({ message: 'Convite enviado com sucesso' });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Dados inválidos', details: error.issues });
      return;
    }
    res.status(500).json({ error: 'Erro interno' });
  }
});

/**
 * PATCH /:id - Update attendant (admin only)
 */
router.patch('/:id', auth, adminOnly, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const data = updateAttendantSchema.parse(req.body);

    const attendant = await prisma.attendant.update({
      where: { id },
      data,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
        mode: true,
        activeChats: true,
        maxChats: true,
      },
    });

    res.json(attendant);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Dados inválidos', details: error.issues });
      return;
    }
    res.status(500).json({ error: 'Erro interno' });
  }
});

/**
 * DELETE /:id - Delete attendant (admin only)
 */
router.delete('/:id', auth, adminOnly, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    // Prevent deleting self
    if (id === req.user!.id) {
      res.status(400).json({ error: 'Não é possível excluir sua própria conta' });
      return;
    }

    await prisma.attendant.delete({
      where: { id },
    });

    res.json({ message: 'Atendente removido com sucesso' });
  } catch (error) {
    res.status(500).json({ error: 'Erro interno' });
  }
});

/**
 * PATCH /status - Update own status
 */
router.patch('/status', auth, async (req: AuthRequest, res) => {
  try {
    const { status } = z.object({ status: z.enum(['ONLINE', 'OFFLINE']) }).parse(req.body);

    const attendant = await prisma.attendant.update({
      where: { id: req.user!.id },
      data: { status },
      select: {
        id: true,
        email: true,
        name: true,
        status: true,
        mode: true,
      },
    });

    res.json(attendant);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Dados inválidos', details: error.issues });
      return;
    }
    res.status(500).json({ error: 'Erro interno' });
  }
});

/**
 * PATCH /mode - Update own mode (AUTO/SUGGEST/MANUAL)
 */
router.patch('/mode', auth, async (req: AuthRequest, res) => {
  try {
    const { mode } = z.object({ mode: z.enum(['AUTO', 'SUGGEST', 'MANUAL']) }).parse(req.body);

    const attendant = await prisma.attendant.update({
      where: { id: req.user!.id },
      data: { mode },
      select: {
        id: true,
        email: true,
        name: true,
        mode: true,
      },
    });

    res.json(attendant);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Dados inválidos', details: error.issues });
      return;
    }
    res.status(500).json({ error: 'Erro interno' });
  }
});

export default router;
