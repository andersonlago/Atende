import { Router } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { prisma } from '../../database/prisma';
import { env } from '../../config/env';
import { auth, AuthRequest } from '../../middlewares/auth';
import { sendEmail, getPasswordResetTemplate, getInvitationTemplate, getWelcomeTemplate } from '../../services/email.service';

const router = Router();

// Validation schemas
const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

const resetPasswordSchema = z.object({
  token: z.string(),
  password: z.string().min(6),
});

const completeSignupSchema = z.object({
  token: z.string(),
  password: z.string().min(6),
  name: z.string().min(3),
});

/**
 * POST /login - Authenticate user
 */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = loginSchema.parse(req.body);

    const attendant = await prisma.attendant.findUnique({
      where: { email },
      select: { id: true, email: true, name: true, role: true, passwordHash: true },
    });

    if (!attendant) {
      res.status(401).json({ error: 'Credenciais inválidas' });
      return;
    }

    const validPassword = await bcrypt.compare(password, attendant.passwordHash);
    if (!validPassword) {
      res.status(401).json({ error: 'Credenciais inválidas' });
      return;
    }

    const token = jwt.sign(
      { id: attendant.id, email: attendant.email, role: attendant.role },
      env.JWT_SECRET,
      { expiresIn: env.JWT_EXPIRES_IN }
    );

    res.json({
      token,
      user: {
        id: attendant.id,
        email: attendant.email,
        name: attendant.name,
        role: attendant.role,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Dados inválidos', details: error.issues });
      return;
    }
    res.status(500).json({ error: 'Erro interno' });
  }
});

/**
 * GET /me - Get current user data
 */
router.get('/me', auth, async (req: AuthRequest, res) => {
  try {
    const user = await prisma.attendant.findUnique({
      where: { id: req.user!.id },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        status: true,
        mode: true,
        activeChats: true,
        maxChats: true,
        createdAt: true,
      },
    });

    if (!user) {
      res.status(404).json({ error: 'Usuário não encontrado' });
      return;
    }

    res.json(user);
  } catch (error) {
    res.status(500).json({ error: 'Erro interno' });
  }
});

/**
 * POST /logout - Logout (client-side token removal)
 */
router.post('/logout', auth, (req: AuthRequest, res) => {
  res.json({ message: 'Logout realizado com sucesso' });
});

/**
 * POST /forgot-password - Request password reset
 */
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = forgotPasswordSchema.parse(req.body);

    // Always return OK for security (don't reveal if email exists)
    const attendant = await prisma.attendant.findUnique({
      where: { email },
    });

    if (!attendant) {
      res.json({ message: 'Se o email existir, você receberá instruções' });
      return;
    }

    // Generate token
    const token = jwt.sign({ email, type: 'reset' }, env.JWT_SECRET, { expiresIn: '1h' });

    // Save reset request
    await prisma.passwordReset.create({
      data: {
        email,
        token,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
      },
    });

    // Send email
    const html = getPasswordResetTemplate(token, env.APP_URL);
    await sendEmail({
      to: email,
      subject: 'Recuperação de Senha',
      html,
    });

    res.json({ message: 'Se o email existir, você receberá instruções' });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.json({ message: 'Se o email existir, você receberá instruções' });
  }
});

/**
 * POST /reset-password - Reset password with token
 */
router.post('/reset-password', async (req, res) => {
  try {
    const { token, password } = resetPasswordSchema.parse(req.body);

    // Verify token
    const decoded = jwt.verify(token, env.JWT_SECRET) as { email: string; type: string };
    
    if (decoded.type !== 'reset') {
      res.status(400).json({ error: 'Token inválido' });
      return;
    }

    // Find reset request
    const resetRequest = await prisma.passwordReset.findFirst({
      where: {
        token,
        used: false,
        expiresAt: { gt: new Date() },
      },
    });

    if (!resetRequest) {
      res.status(400).json({ error: 'Token inválido ou expirado' });
      return;
    }

    // Hash new password
    const passwordHash = await bcrypt.hash(password, 10);

    // Update password
    await prisma.attendant.update({
      where: { email: resetRequest.email },
      data: { passwordHash },
    });

    // Mark token as used
    await prisma.passwordReset.update({
      where: { id: resetRequest.id },
      data: { used: true },
    });

    res.json({ message: 'Senha redefinida com sucesso' });
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      res.status(400).json({ error: 'Token inválido' });
      return;
    }
    res.status(500).json({ error: 'Erro interno' });
  }
});

/**
 * GET /validate-invite/:token - Validate invitation token
 */
router.get('/validate-invite/:token', async (req, res) => {
  try {
    const { token } = req.params;

    const invitation = await prisma.invitation.findFirst({
      where: {
        token,
        used: false,
        expiresAt: { gt: new Date() },
      },
    });

    if (!invitation) {
      res.status(400).json({ error: 'Convite inválido ou expirado' });
      return;
    }

    res.json({
      valid: true,
      email: invitation.email,
      name: invitation.name,
      maxChats: invitation.maxChats,
    });
  } catch (error) {
    res.status(500).json({ error: 'Erro interno' });
  }
});

/**
 * POST /complete-signup - Complete signup with invitation
 */
router.post('/complete-signup', async (req, res) => {
  try {
    const { token, password, name } = completeSignupSchema.parse(req.body);

    // Find invitation
    const invitation = await prisma.invitation.findFirst({
      where: {
        token,
        used: false,
        expiresAt: { gt: new Date() },
      },
    });

    if (!invitation) {
      res.status(400).json({ error: 'Convite inválido ou expirado' });
      return;
    }

    // Check if email already exists
    const existingUser = await prisma.attendant.findUnique({
      where: { email: invitation.email },
    });

    if (existingUser) {
      res.status(400).json({ error: 'Email já cadastrado' });
      return;
    }

    // Create user
    const passwordHash = await bcrypt.hash(password, 10);
    const attendant = await prisma.attendant.create({
      data: {
        email: invitation.email,
        passwordHash,
        name,
        role: 'ATTENDANT',
        status: 'OFFLINE',
        mode: 'SUGGEST',
        maxChats: invitation.maxChats,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
      },
    });

    // Mark invitation as used
    await prisma.invitation.update({
      where: { id: invitation.id },
      data: { used: true },
    });

    // Send welcome email
    const html = getWelcomeTemplate(name);
    await sendEmail({
      to: invitation.email,
      subject: 'Bem-vindo ao Sistema de Atendimento',
      html,
    });

    res.json({
      message: 'Cadastro realizado com sucesso',
      user: attendant,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Dados inválidos', details: error.issues });
      return;
    }
    res.status(500).json({ error: 'Erro interno' });
  }
});

export default router;
