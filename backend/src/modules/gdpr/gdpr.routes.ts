import { Router, Request, Response } from 'express';
import { gdprService } from '../../services/gdpr.service';
import { auth, adminOnly } from '../../middlewares/auth';

const router = Router();

/**
 * POST /api/gdpr/consent/:contactId
 * Registra consentimento LGPD/GDPR
 */
router.post('/consent/:contactId', auth, async (req: Request, res: Response) => {
  try {
    const { contactId } = req.params;
    const ipAddress = req.ip || req.socket.remoteAddress || undefined;

    await gdprService.recordConsent(contactId, ipAddress);

    res.json({
      success: true,
      message: 'Consentimento registrado com sucesso',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Erro ao registrar consentimento',
    });
  }
});

/**
 * DELETE /api/gdpr/consent/:contactId
 * Revoga consentimento LGPD/GDPR
 */
router.delete('/consent/:contactId', auth, async (req: Request, res: Response) => {
  try {
    const { contactId } = req.params;
    const ipAddress = req.ip || req.socket.remoteAddress || undefined;

    await gdprService.revokeConsent(contactId, ipAddress);

    res.json({
      success: true,
      message: 'Consentimento revogado com sucesso',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Erro ao revogar consentimento',
    });
  }
});

/**
 * POST /api/gdpr/anonymize/:contactId
 * Anonimiza dados do contato (direito ao esquecimento)
 */
router.post('/anonymize/:contactId', auth, adminOnly, async (req: Request, res: Response) => {
  try {
    const { contactId } = req.params;
    const { reason } = req.body;
    const requestedBy = req.user?.email || 'admin';

    if (!reason) {
      return res.status(400).json({
        success: false,
        error: 'reason é obrigatório',
      });
    }

    await gdprService.anonymizeContact(contactId, {
      contactId,
      reason,
      requestedBy,
    });

    res.json({
      success: true,
      message: 'Dados anonimizados com sucesso',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Erro ao anonimizar dados',
    });
  }
});

/**
 * GET /api/gdpr/export/:contactId
 * Exporta dados do contato (direito à portabilidade)
 */
router.get('/export/:contactId', auth, async (req: Request, res: Response) => {
  try {
    const { contactId } = req.params;
    const data = await gdprService.exportData(contactId);

    res.json({
      success: true,
      data,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Erro ao exportar dados',
    });
  }
});

/**
 * GET /api/gdpr/missing-consent
 * Lista contatos sem consentimento
 */
router.get('/missing-consent', auth, adminOnly, async (req: Request, res: Response) => {
  try {
    const contacts = await gdprService.getContactsMissingConsent();

    res.json({
      success: true,
      data: contacts,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Erro ao obter lista',
    });
  }
});

export { router as gdprRoutes };
export default router;
