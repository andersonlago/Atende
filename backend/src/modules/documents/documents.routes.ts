import { Router } from 'express';
import { auth, adminOnly, AuthRequest } from '../../middlewares/auth';
import { prisma } from '../../database/prisma';
import * as aiService from '../../services/ai.service';

const router = Router();

/**
 * GET / - List documents in AnythingLLM workspace
 */
router.get('/', auth, adminOnly, async (req: AuthRequest, res) => {
  try {
    const documents = await aiService.getWorkspaceDocuments();
    res.json(documents);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar documentos' });
  }
});

/**
 * POST /upload - Upload document to AnythingLLM
 */
router.post('/upload', auth, adminOnly, async (req: AuthRequest, res) => {
  try {
    // This would need file upload handling - simplified for now
    res.status(501).json({ error: 'Upload deve ser feito via interface do AnythingLLM' });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao fazer upload' });
  }
});

/**
 * DELETE /:fileName - Delete document from AnythingLLM
 */
router.delete('/:fileName', auth, adminOnly, async (req: AuthRequest, res) => {
  try {
    const { fileName } = req.params;
    
    const success = await aiService.deleteDocument(fileName);
    
    if (!success) {
      res.status(500).json({ error: 'Falha ao remover documento' });
      return;
    }

    res.json({ message: 'Documento removido com sucesso' });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao remover documento' });
  }
});

export default router;
