export type DashboardCounts = {
    total: number;
    saneamento: number;
    byStatus: Record<string, number>;
};

export type NeighborhoodDashboard = {
    codigoBairro: string;
    bairro: string;
    populacao: number | null;
    percentualRedeEsgoto: number | null;
    ano: number | null;
    dataExtracao: string | null;
    occurrences: DashboardCounts;
    occurrencesPer10k: number | null;
};

export type Dashboard = {
    updatedAt: string;
    source: string;
    occurrences: DashboardCounts;
    matchedOccurrences: number;
    unmatched: { withoutCoordinates: number; outsideCoverage: number; ambiguous: number };
    geography: { totalNeighborhoods: number; mappedNeighborhoods: number };
    items: NeighborhoodDashboard[];
};
