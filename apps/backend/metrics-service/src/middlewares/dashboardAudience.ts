import { Response, NextFunction } from 'express';
import { AuthRequest } from './authMiddleware';

export function dashboardAudience(req: AuthRequest, res: Response, next: NextFunction) {
  if (!req.user?.roles.some((role) => role === 'cidadao' || role === 'gestor')) {
    return res.status(403).json({ error: 'Acesso restrito a cidadãos e gestores' });
  }
  next();
}
