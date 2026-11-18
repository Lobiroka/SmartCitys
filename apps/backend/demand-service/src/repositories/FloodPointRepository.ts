import { PrismaClient } from '@prisma/client';

type FloodPoint = {
  id: string;
  neighborhood: string | null;
  neighborhoodKey: string | null;
  latitude: number;
  longitude: number;
};

let analytics: PrismaClient | undefined;

export async function listFloodPoints(): Promise<FloodPoint[]> {
  const url = process.env.ANALYTICS_DATABASE_URL?.trim();
  if (!url) {
    throw new Error('ANALYTICS_DATABASE_URL ausente');
  }

  analytics ??= new PrismaClient({ datasources: { db: { url } } });

  return analytics.$transaction(async (transaction) => {
    await transaction.$executeRaw`SET TRANSACTION READ ONLY`;
    await transaction.$executeRaw`SET LOCAL statement_timeout = '5s'`;
    return transaction.$queryRaw<FloodPoint[]>`
      SELECT id_externo::text AS id, bairro AS neighborhood, bairro_chave AS "neighborhoodKey",
             latitude, longitude
      FROM public.smartcity_pontos_alagamento
      WHERE fonte = 'esig_emlurb_recife'
      ORDER BY id_externo
    `;
  }, { timeout: 7000 });
}
