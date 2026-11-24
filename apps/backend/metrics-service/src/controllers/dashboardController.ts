import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middlewares/authMiddleware';
import { getDashboard } from '../services/dashboardService';

export async function dashboardSummary(_req: AuthRequest, res: Response, next: NextFunction) {
  try {
    // Resumo agregado disponível para cidadãos e gestores, sem detalhes pessoais.
    res.setHeader('Cache-Control', 'no-store');
    return res.json(await getDashboard());
  } catch (error) {
    next(error);
  }
}
