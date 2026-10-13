import { Response, NextFunction } from 'express';
import { AuthRequest } from './authMiddleware';

export function roleMiddleware(...roles: Array<'cidadao' | 'gestor'>) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {

    if (!req.user) {
      return res.status(401).json({ error: 'Usuário não autenticado' });
    }

    const userRoles = req.user.roles;
    const permitido = roles.some(role => userRoles.includes(role));

    if (!permitido) {
      return res.status(403).json({ error: 'Acesso negado para este perfil' });
    }

    next();
  };
}
