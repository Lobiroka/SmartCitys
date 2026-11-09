import type { NextFunction, Response } from 'express';

import { registerPushToken, unregisterPushToken } from '../services/pushNotificationService';
import type { AuthRequest } from '../middlewares/authMiddleware';
import { httpError } from '../utils/httpError';

function parsePushToken(token: unknown): string {
  if (typeof token !== 'string' || !/^(ExponentPushToken|ExpoPushToken)\[[A-Za-z0-9_-]{1,128}\]$/.test(token)) {
    throw httpError('Token de notificação inválido.', 400);
  }
  return token;
}

export async function registerPushDevice(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const token = parsePushToken(req.body?.token);
    await registerPushToken(token, req.user!.subject);
    res.sendStatus(204);
  } catch (error) {
    next(error);
  }
}

export async function unregisterPushDevice(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const token = parsePushToken(req.body?.token);
    await unregisterPushToken(token, req.user!.subject);
    res.sendStatus(204);
  } catch (error) {
    next(error);
  }
}
