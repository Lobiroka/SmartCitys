import { Request, Response, NextFunction } from 'express';
import { getNeighborhoodIndicators } from '../services/neighborhoodIndicatorsService';

export async function listNeighborhoodIndicators(req: Request, res: Response, next: NextFunction) {
  const codigoBairro = req.query.codigoBairro;
  if (codigoBairro !== undefined && (
    typeof codigoBairro !== 'string' || !/^\d{1,20}$/.test(codigoBairro)
  )) {
    return res.status(400).json({ error: 'codigoBairro deve conter de 1 a 20 dígitos' });
  }

  try {
    return res.json(await getNeighborhoodIndicators(codigoBairro));
  } catch (error) {
    next(error);
  }
}
