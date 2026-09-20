import { Router, Request, Response } from 'express';
import { internalNoteService } from '../../services/internal-note.service';
import { auth } from '../../middlewares/auth';
import { auditService } from '../../services/audit.service';

const router = Router();

/**
 * POST /api/notes
 * Cria nota interna privada
 */
router.post('/', auth, async (req: Request, res: Response) => {
  try {
    const { contactId, content } = req.body;
    const attendantId = req.user?.id;

    if (!contactId || !content) {
      return res.status(400).json({
        success: false,
        error: 'contactId e content são obrigatórios',
      });
    }

    const note = await internalNoteService.create({
      contactId,
      attendantId: attendantId!,
      content,
    });

    await auditService.log({
      attendantId: attendantId!,
      action: 'NOTE_CREATED',
      resource: 'InternalNote',
      resourceId: note.id,
      details: `Nota criada para contato ${contactId}`,
    });

    res.json({
      success: true,
      data: note,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Erro ao criar nota',
    });
  }
});

/**
 * GET /api/notes/contact/:contactId
 * Obtém notas de um contato
 */
router.get('/contact/:contactId', auth, async (req: Request, res: Response) => {
  try {
    const { contactId } = req.params;
    const notes = await internalNoteService.getByContact(contactId);

    res.json({
      success: true,
      data: notes,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Erro ao obter notas',
    });
  }
});

/**
 * PUT /api/notes/:id
 * Atualiza nota
 */
router.put('/:id', auth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { content } = req.body;
    const attendantId = req.user?.id;

    if (!content) {
      return res.status(400).json({
        success: false,
        error: 'content é obrigatório',
      });
    }

    const note = await internalNoteService.update(id, attendantId!, content);

    await auditService.log({
      attendantId: attendantId!,
      action: 'NOTE_UPDATED',
      resource: 'InternalNote',
      resourceId: id,
      details: 'Nota atualizada',
    });

    res.json({
      success: true,
      data: note,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Erro ao atualizar nota',
    });
  }
});

/**
 * DELETE /api/notes/:id
 * Remove nota
 */
router.delete('/:id', auth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const attendantId = req.user?.id;

    await internalNoteService.delete(id, attendantId!);

    await auditService.log({
      attendantId: attendantId!,
      action: 'NOTE_DELETED',
      resource: 'InternalNote',
      resourceId: id,
      details: 'Nota removida',
    });

    res.json({
      success: true,
      message: 'Nota removida com sucesso',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Erro ao remover nota',
    });
  }
});

export { router as internalNoteRoutes };
export default router;
