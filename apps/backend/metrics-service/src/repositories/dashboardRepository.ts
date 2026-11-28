import { prisma } from '../lib/prisma';
import { getEtlPrisma } from '../lib/etlPrisma';

import type { DashboardOccurrenceRow, DashboardNeighborhoodRow } from '../types/dashboardData';
export type { DashboardOccurrenceRow, DashboardNeighborhoodRow } from '../types/dashboardData';

export async function findDashboardOccurrences(): Promise<DashboardOccurrenceRow[]> {
  // Sem títulos, descrições, fotos ou informações pessoais no resumo público autenticado.
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SET TRANSACTION READ ONLY`;
    await tx.$executeRaw`SET LOCAL statement_timeout = '4s'`;
    return tx.$queryRaw<DashboardOccurrenceRow[]>`
      SELECT categoria::text, status::text, latitude, longitude FROM demand.denuncias
    `;
  }, { maxWait: 5000, timeout: 6000 });
}

// APRESENTAÇÃO ETL — o backend lê os indicadores prata e os limites no Neon
// em transação somente de leitura. A permissão SELECT também é configurada
// no papel do banco usado pela conexão DATABASE_URL_ETL.
export async function findDashboardNeighborhoods(): Promise<DashboardNeighborhoodRow[]> {
  return getEtlPrisma().$transaction(async (tx) => {
    await tx.$executeRaw`SET TRANSACTION READ ONLY`;
    await tx.$executeRaw`SET LOCAL statement_timeout = '4s'`;
    return tx.$queryRaw<DashboardNeighborhoodRow[]>`
      SELECT i.codigo_bairro, i.bairro, i.populacao, i.domicilios_total,
        i.domicilios_rede_geral, i.percentual_rede_esgoto::double precision AS percentual_rede_esgoto,
        i.ano, i.data_extracao, l.geometria, l.data_extracao AS limites_data_extracao
      FROM public.recife_populacao_saneamento i
      LEFT JOIN public.recife_bairros_limites l USING (codigo_bairro)
      ORDER BY i.codigo_bairro
    `;
  }, { maxWait: 5000, timeout: 6000 });
}
