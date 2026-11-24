import { getEtlPrisma } from '../lib/etlPrisma';
import type { PolygonGeometry } from '../utils/neighborhoodGeometry';

export type InundationRow = {
  id: string;
  classe: 'Baixa' | 'Média' | 'Alta';
  ano: number | null;
  descricao_fonte: string | null;
  geometria: PolygonGeometry;
  bbox: [number, number, number, number];
  fonte: string;
  data_extracao: Date;
};

export async function findInundationAreas(): Promise<InundationRow[]> {
  return getEtlPrisma().$transaction(async (transaction) => {
    await transaction.$executeRaw`SET TRANSACTION READ ONLY`;
    await transaction.$executeRaw`SET LOCAL statement_timeout = '4s'`;
    return transaction.$queryRaw<InundationRow[]>`
      SELECT id::text, classe, ano, descricao_fonte, geometria, bbox, fonte, data_extracao
      FROM public.recife_inundacao_sgb ORDER BY id
    `;
  }, { maxWait: 5000, timeout: 6000 });
}
