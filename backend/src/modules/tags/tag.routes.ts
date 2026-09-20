import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../database/prisma';
import { auth, AuthRequest } from '../../middlewares/auth';

const router = Router();

const tagSchema = z.object({
  name: z.string().min(1),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).default('#10b981'),
});

/**
 * GET / - List all tags
 */
router.get('/', auth, async (req: AuthRequest, res) => {
  try {
    const tags = await prisma.tag.findMany({
      orderBy: { name: 'asc' },
    });
    res.json(tags);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar tags' });
  }
});

/**
 * POST / - Create tag
 */
router.post('/', auth, async (req: AuthRequest, res) => {
  try {
    const { name, color } = tagSchema.parse(req.body);

    const tag = await prisma.tag.create({
      data: { name, color },
    });

    res.json(tag);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Dados inválidos', details: error.issues });
      return;
    }
    res.status(500).json({ error: 'Erro ao criar tag' });
  }
});

/**
 * DELETE /:id - Delete tag
 */
router.delete('/:id', auth, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    await prisma.tag.delete({
      where: { id },
    });

    res.json({ message: 'Tag removida com sucesso' });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao remover tag' });
  }
});

/**
 * POST /contacts/:contactId/tags - Add tag to contact
 */
router.post('/contacts/:contactId/tags', auth, async (req: AuthRequest, res) => {
  try {
    const { contactId } = req.params;
    const { tagId } = req.body;

    if (!tagId) {
      res.status(400).json({ error: 'Tag ID é obrigatório' });
      return;
    }

    // Get contact
    const contact = await prisma.contact.findUnique({
      where: { id: contactId },
      include: { tags: true },
    });

    if (!contact) {
      res.status(404).json({ error: 'Contato não encontrado' });
      return;
    }

    // Check if tag already exists
    const hasTag = contact.tags.some(t => t.id === tagId);
    if (hasTag) {
      res.status(400).json({ error: 'Tag já adicionada' });
      return;
    }

    // Connect tag to contact
    await prisma.contact.update({
      where: { id: contactId },
      data: {
        tags: {
          connect: { id: tagId },
        },
      },
    });

    res.json({ message: 'Tag adicionada com sucesso' });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao adicionar tag' });
  }
});

/**
 * DELETE /contacts/:contactId/tags/:tagId - Remove tag from contact
 */
router.delete('/contacts/:contactId/tags/:tagId', auth, async (req: AuthRequest, res) => {
  try {
    const { contactId, tagId } = req.params;

    await prisma.contact.update({
      where: { id: contactId },
      data: {
        tags: {
          disconnect: { id: tagId },
        },
      },
    });

    res.json({ message: 'Tag removida com sucesso' });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao remover tag' });
  }
});

export default router;
