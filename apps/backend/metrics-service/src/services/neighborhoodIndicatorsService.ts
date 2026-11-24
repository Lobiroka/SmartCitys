import { findNeighborhoodIndicators } from '../repositories/neighborhoodIndicatorsRepository';

export async function getNeighborhoodIndicators(codigoBairro?: string) {
  try {
    const rows = await findNeighborhoodIndicators(codigoBairro);
    return {
      source: 'IBGE/SIDRA',
      total: rows.length,
      items: rows.map((row) => ({
        codigoBairro: row.codigo_bairro,
        bairro: row.bairro,
        populacao: row.populacao,
        domiciliosTotal: row.domicilios_total,
        domiciliosRedeGeral: row.domicilios_rede_geral,
        percentualRedeEsgoto: row.percentual_rede_esgoto,
        ano: row.ano,
        dataExtracao: row.data_extracao?.toISOString() ?? null,
      })),
    };
  } catch {
    // Não expor URLs, credenciais ou detalhes do banco na resposta HTTP.
    throw Object.assign(new Error('Indicadores da ETL temporariamente indisponíveis'), {
      status: 503,
    });
  }
}
