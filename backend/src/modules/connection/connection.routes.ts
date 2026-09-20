import { Router, Request, Response } from 'express';
import { connectionService } from '../../services/connection.service';
import { auth, adminOnly } from '../../middlewares/auth';
import { env } from '../../config/env';

const router = Router();

/**
 * GET /api/connection/status
 * Obtém status da conexão WAHA em tempo real
 */
router.get('/status', auth, async (req: Request, res: Response) => {
  try {
    const sessionId = req.query.sessionId as string || env.WAHA_SESSION_NAME;
    const status = await connectionService.getStatus(sessionId);

    res.json({
      success: true,
      data: status,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Erro ao obter status',
    });
  }
});

/**
 * POST /api/connection/reconnect
 * Tenta reconectar com backoff exponencial
 */
router.post('/reconnect', auth, adminOnly, async (req: Request, res: Response) => {
  try {
    const sessionId = req.body.sessionId || env.WAHA_SESSION_NAME;
    const maxAttempts = req.body.maxAttempts || 5;

    const success = await connectionService.reconnectWithBackoff(sessionId, maxAttempts);

    if (success) {
      res.json({
        success: true,
        message: 'Reconexão bem-sucedida',
      });
    } else {
      res.status(503).json({
        success: false,
        error: 'Falha na reconexão após múltiplas tentativas',
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Erro ao reconectar',
    });
  }
});

/**
 * GET /api/connection/qr-code
 * Obtém QR Code para autenticação
 */
router.get('/qr-code', auth, adminOnly, async (req: Request, res: Response) => {
  try {
    const sessionId = req.query.sessionId as string || env.WAHA_SESSION_NAME;
    const qrCode = await connectionService.getQRCode(sessionId);

    res.json({
      success: true,
      data: { qrCode },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Erro ao obter QR Code',
    });
  }
});

export { router as connectionRoutes };
export default router;
