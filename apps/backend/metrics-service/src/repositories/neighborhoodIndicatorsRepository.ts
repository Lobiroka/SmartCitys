import { Prisma } from '@prisma/client';
import { getEtlPrisma } from '../lib/etlPrisma';

import type { NeighborhoodIndicatorRow } from '../types/dashboardData';
export type { NeighborhoodIndicatorRow } from '../types/dashboardData';

export async function findNeighborhoodIndicators(
  codigoBairro?: string,
): Promise<NeighborhoodIndicatorRow[]> {
  const filter = codigoBairro === undefined
    ? Prisma.empty
    : Prisma.sql`WHERE codigo_bairro = ${codigoBairro}`;

  return getEtlPrisma().$transaction(async (transaction) => {
    await transaction.$executeRaw`SET TRANSACTION READ ONLY`;
    await transaction.$executeRaw`SET LOCAL statement_timeout = '4s'`;
    return transaction.$queryRaw<NeighborhoodIndicatorRow[]>(Prisma.sql`
      SELECT codigo_bairro, bairro, populacao, domicilios_total,
             domicilios_rede_geral,
             percentual_rede_esgoto::double precision AS percentual_rede_esgoto,
             ano, data_extracao
      FROM public.recife_populacao_saneamento
      ${filter}
      ORDER BY bairro, codigo_bairro
    `);
  }, { maxWait: 5000, timeout: 6000 });
}
