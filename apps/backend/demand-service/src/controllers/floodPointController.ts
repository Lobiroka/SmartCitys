import type { Request, Response } from 'express';

import { listFloodPoints } from '../repositories/FloodPointRepository';

export async function getFloodPoints(_req: Request, res: Response): Promise<void> {
  try {
    const points = await listFloodPoints();
    res.json({ points });
  } catch (error) {
    console.warn('[alagamentos] Leitura do Neon falhou:', error instanceof Error ? error.name : 'erro');
    res.status(503).json({ error: 'Os pontos de alagamento estão indisponíveis no momento.' });
  }
}
