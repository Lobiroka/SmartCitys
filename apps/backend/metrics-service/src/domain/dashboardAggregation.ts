import { containsPoint, geometryBounds } from '../utils/neighborhoodGeometry';
import type { DashboardNeighborhoodRow, DashboardOccurrenceRow } from '../types/dashboardData';

function counts() {
  return { total: 0, saneamento: 0, byStatus: { ABERTA: 0, EM_ANALISE: 0, RESOLVIDA: 0 } as Record<string, number> };
}
function add(target: ReturnType<typeof counts>, occurrence: DashboardOccurrenceRow) {
  target.total++;
  if (occurrence.categoria === 'SANEAMENTO') target.saneamento++;
  target.byStatus[occurrence.status] = (target.byStatus[occurrence.status] ?? 0) + 1;
}

export function buildDashboard(occurrences: DashboardOccurrenceRow[], rows: DashboardNeighborhoodRow[]) {
  const overall = counts();
  const groups = rows.map((row) => ({
    row, bounds: row.geometria ? geometryBounds(row.geometria) : null, counts: counts(),
  }));
  const unmatched = { withoutCoordinates: 0, outsideCoverage: 0, ambiguous: 0 };
  for (const occurrence of occurrences) {
    add(overall, occurrence);
    const { latitude, longitude } = occurrence;
    if (latitude === null || longitude === null || !Number.isFinite(latitude) || !Number.isFinite(longitude)
      || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) {
      unmatched.withoutCoordinates++;
      continue;
    }
    const matches = groups.filter(({ row, bounds }) => bounds && row.geometria
      && longitude >= bounds[0] && latitude >= bounds[1] && longitude <= bounds[2] && latitude <= bounds[3]
      && containsPoint(row.geometria, [longitude, latitude]));
    if (matches.length === 1) add(matches[0].counts, occurrence);
    else if (matches.length > 1) unmatched.ambiguous++;
    else unmatched.outsideCoverage++;
  }
  const items = groups.map(({ row, counts: neighborhoodCounts }) => ({
    codigoBairro: row.codigo_bairro,
    bairro: row.bairro?.replace(/ - Recife - PE$/, '') ?? row.codigo_bairro,
    populacao: row.populacao,
    percentualRedeEsgoto: row.percentual_rede_esgoto,
    ano: row.ano,
    dataExtracao: row.data_extracao?.toISOString() ?? null,
    occurrences: neighborhoodCounts,
    occurrencesPer10k: row.populacao !== null && row.populacao > 0
      ? Math.round(neighborhoodCounts.total / row.populacao * 10000 * 100) / 100 : null,
  })).sort((a, b) => b.occurrences.total - a.occurrences.total || a.bairro.localeCompare(b.bairro, 'pt-BR'));
  return {
    updatedAt: new Date().toISOString(),
    source: 'IBGE/SIDRA · Prefeitura do Recife',
    occurrences: overall,
    matchedOccurrences: items.reduce((sum, item) => sum + item.occurrences.total, 0),
    unmatched,
    geography: {
      totalNeighborhoods: rows.length,
      mappedNeighborhoods: rows.filter((row) => row.geometria !== null).length,
    },
    items,
  };
}
