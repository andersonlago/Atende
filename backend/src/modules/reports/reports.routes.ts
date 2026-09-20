import { Router, Request, Response } from 'express';
import { reportService } from '../../services/report.service';
import { auth, adminOnly } from '../../middlewares/auth';

const router = Router();

/**
 * GET /api/reports/attendance
 * Relatório de atendimentos
 */
router.get('/attendance', auth, adminOnly, async (req: Request, res: Response) => {
  try {
    const { startDate, endDate, attendantId } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        error: 'startDate e endDate são obrigatórios',
      });
    }

    const report = await reportService.getAttendanceReport(
      new Date(startDate as string),
      new Date(endDate as string),
      attendantId as string
    );

    res.json({
      success: true,
      data: report,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Erro ao gerar relatório',
    });
  }
});

/**
 * GET /api/reports/attendance/csv
 * Exporta relatório de atendimentos para CSV
 */
router.get('/attendance/csv', auth, adminOnly, async (req: Request, res: Response) => {
  try {
    const { startDate, endDate, attendantId } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        error: 'startDate e endDate são obrigatórios',
      });
    }

    const csv = await reportService.exportAttendanceReportToCSV(
      new Date(startDate as string),
      new Date(endDate as string),
      attendantId as string
    );

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="atendimentos-${Date.now()}.csv"`);
    res.send(csv);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Erro ao exportar relatório',
    });
  }
});

/**
 * GET /api/reports/satisfaction
 * Relatório de satisfação
 */
router.get('/satisfaction', auth, adminOnly, async (req: Request, res: Response) => {
  try {
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        error: 'startDate e endDate são obrigatórios',
      });
    }

    const report = await reportService.getSatisfactionReport(
      new Date(startDate as string),
      new Date(endDate as string)
    );

    res.json({
      success: true,
      data: report,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Erro ao gerar relatório',
    });
  }
});

/**
 * GET /api/reports/blocks
 * Relatório de bloqueios temporários
 */
router.get('/blocks', auth, adminOnly, async (req: Request, res: Response) => {
  try {
    const report = await reportService.getTemporaryBlocksReport();

    res.json({
      success: true,
      data: report,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Erro ao gerar relatório',
    });
  }
});

/**
 * GET /api/reports/ai-usage
 * Relatório de uso da IA
 */
router.get('/ai-usage', auth, adminOnly, async (req: Request, res: Response) => {
  try {
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        error: 'startDate e endDate são obrigatórios',
      });
    }

    const report = await reportService.getAIUsageReport(
      new Date(startDate as string),
      new Date(endDate as string)
    );

    res.json({
      success: true,
      data: report,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Erro ao gerar relatório',
    });
  }
});

/**
 * GET /api/reports/executive
 * Relatório executivo completo
 */
router.get('/executive', auth, adminOnly, async (req: Request, res: Response) => {
  try {
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        error: 'startDate e endDate são obrigatórios',
      });
    }

    const report = await reportService.getExecutiveReport(
      new Date(startDate as string),
      new Date(endDate as string)
    );

    res.json({
      success: true,
      data: report,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Erro ao gerar relatório',
    });
  }
});

export { router as reportRoutes };
export default router;
