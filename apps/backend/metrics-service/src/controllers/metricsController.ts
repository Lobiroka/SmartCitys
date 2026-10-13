import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middlewares/authMiddleware';
import { getMetrics, refreshMetricsCache } from '../services/metricsService';

export async function getKpis(_req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const metrics = await getMetrics();
    return res.json(metrics);
  } catch (err) {
    next(err);
  }
}

export async function refreshKpis(_req: AuthRequest, res: Response, next: NextFunction) {
  try {

    const metrics = await refreshMetricsCache();
    return res.json(metrics);
  } catch (err) {
    next(err);
  }
}
