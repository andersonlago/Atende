import { Request, Response, NextFunction } from 'express';

/**
 * Middleware global para tratamento de erros
 */
export const errorHandler = (
  err: Error & { status?: number; code?: string },
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  console.error('❌ Error:', err);

  const status = err.status || 500;
  const message = err.message || 'Erro interno do servidor';

  // Prisma errors
  if (err.code === 'P2002') {
    res.status(409).json({ error: 'Conflito: registro já existe' });
    return;
  }

  if (err.code === 'P2025') {
    res.status(404).json({ error: 'Recurso não encontrado' });
    return;
  }

  // Zod validation errors
  if ('issues' in err && Array.isArray(err.issues)) {
    res.status(400).json({ 
      error: 'Validação falhou',
      details: err.issues 
    });
    return;
  }

  res.status(status).json({ error: message });
};
