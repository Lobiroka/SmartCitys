import { Request, Response, NextFunction } from 'express';
import type {AuthenticatedUser, } from '../types/authenticatedUser'
import {verifyAccessToken} from "../config/verifyAccessToken";


export interface AuthRequest extends Request {
  user?: AuthenticatedUser;
}

export async function authMiddleware(
    req: AuthRequest,
    res: Response,
    next: NextFunction) {

  const authHeader = req.headers.authorization;
  const match = authHeader?.match(/^Bearer\s+(\S+)$/i);

  if (!match) {
    return res.status(401).json({ error: 'Token não fornecido ou malformado' });
  }

  try {
    req.user = await verifyAccessToken(match[1]);
  } catch {
    return res.status(401).json({ error: 'Não foi possível validar o token' });
  }

  next();
}


export function gestor(req: AuthRequest, res: Response, next: NextFunction) {
  if (!req.user?.roles.includes('gestor')) {
    return res.status(403).json({ error: 'Acesso Restrito ao gestor' });
  }
  next();
}
