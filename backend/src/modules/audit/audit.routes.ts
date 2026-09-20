import { Router, Request, Response } from 'express';
import { auditService } from '../../services/audit.service';
import { auth, adminOnly } from '../../middlewares/auth';

const router = Router();

/**
 * GET /api/audit/logs
 * Obtém logs de auditoria com filtros
 */
router.get('/logs', auth, adminOnly, async (req: Request, res: Response) => {
  try {
    const { 
      attendantId, 
      action, 
      resource, 
      startDate, 
      endDate,
      limit = '100',
      offset = '0'
    } = req.query;

    const logs = await auditService.getLogs({
      attendantId: attendantId as string,
      action: action as string,
      resource: resource as string,
      startDate: startDate ? new Date(startDate as string) : undefined,
      endDate: endDate ? new Date(endDate as string) : undefined,
      limit: parseInt(limit as string),
      offset: parseInt(offset as string),
    });

    res.json({
      success: true,
      ...logs,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Erro ao obter logs',
    });
  }
});

/**
 * GET /api/audit/export
 * Exporta logs para CSV
 */
router.get('/export', auth, adminOnly, async (req: Request, res: Response) => {
  try {
    const { attendantId, startDate, endDate } = req.query;

    const csv = await auditService.exportToCSV({
      attendantId: attendantId as string,
      startDate: startDate ? new Date(startDate as string) : undefined,
      endDate: endDate ? new Date(endDate as string) : undefined,
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="audit-${Date.now()}.csv"`);
    res.send(csv);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Erro ao exportar logs',
    });
  }
});

export { router as auditRoutes };
export default router;
