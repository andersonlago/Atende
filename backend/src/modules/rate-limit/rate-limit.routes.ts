import { Router, Request, Response } from 'express';
import { rateLimitService } from '../../services/rate-limit.service';
import { authMiddleware } from '../../middlewares/auth';
import { adminOnly } from '../../middlewares/auth';

const router = Router();

/**
 * GET /api/rate-limit/status/:phone
 * Obtém status do rate limit para um telefone
 */
router.get('/status/:phone', authMiddleware, adminOnly, async (req: Request, res: Response) => {
  try {
    const { phone } = req.params;
    const status = await rateLimitService.getStatus(phone);
    
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
 * POST /api/rate-limit/reset/:phone
 * Reseta limite para um telefone (admin)
 */
router.post('/reset/:phone', authMiddleware, adminOnly, async (req: Request, res: Response) => {
  try {
    const { phone } = req.params;
    await rateLimitService.resetLimit(phone);
    
    res.json({
      success: true,
      message: 'Limite resetado com sucesso',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Erro ao resetar limite',
    });
  }
});

export { router as rateLimitRoutes };export default router;
