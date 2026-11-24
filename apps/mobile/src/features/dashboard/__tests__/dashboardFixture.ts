import type { Dashboard } from '../models/Dashboard';

export const dashboardFixture = (): Dashboard => ({
    updatedAt: '2026-11-18T12:00:00Z', source: 'IBGE/SIDRA · Prefeitura do Recife',
    occurrences: { total: 5, saneamento: 2, byStatus: { ABERTA: 3, EM_ANALISE: 1, RESOLVIDA: 1 } },
    matchedOccurrences: 3, unmatched: { withoutCoordinates: 1, outsideCoverage: 1, ambiguous: 0 },
    geography: { totalNeighborhoods: 1, mappedNeighborhoods: 1 },
    items: [{ codigoBairro: '001', bairro: 'Várzea', populacao: 70453, percentualRedeEsgoto: 50,
        ano: 2010, dataExtracao: '2026-11-18T12:00:00Z', occurrencesPer10k: 0.43,
        occurrences: { total: 3, saneamento: 1, byStatus: { ABERTA: 2, RESOLVIDA: 1 } } }],
});
