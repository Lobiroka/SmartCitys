import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middlewares/authMiddleware';
import { getInundationAreas } from '../services/inundationService';

export async function inundationAreas(_req: AuthRequest, res: Response, next: NextFunction) {
  try {
    res.setHeader('Cache-Control', 'private, max-age=300');
    return res.json(await getInundationAreas());
  } catch (error) {
    next(error);
  }
}
