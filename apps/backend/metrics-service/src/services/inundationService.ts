import { findInundationAreas } from '../repositories/inundationRepository';

export async function getInundationAreas() {
  try {
    const rows = await findInundationAreas();
    if (!rows.length) throw new Error('Camada SGB ainda não carregada');
    return {
      source: 'Serviço Geológico do Brasil (SGB/CPRM)',
      items: rows.map((row) => ({
        id: row.id, classe: row.classe, ano: row.ano,
        descricaoFonte: row.descricao_fonte, geometry: row.geometria,
        bbox: row.bbox, fonte: row.fonte, dataExtracao: row.data_extracao.toISOString(),
      })),
    };
  } catch {
    throw Object.assign(new Error('Camada de inundação temporariamente indisponível'), { status: 503 });
  }
}
