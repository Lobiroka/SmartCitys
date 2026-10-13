export type OccurrenceImage = {
    id: number;
    path: string;
    uploadedAt: string;
};

export type OccurrenceCategory =
    | 'ILUMINACAO_PUBLICA'
    | 'MANUTENCAO_DE_VIAS'
    | 'SANEAMENTO'
    | 'COLETA_DE_LIXO'
    | 'FISCALIZACAO'
    | 'SEGURANCA'
    | 'SINALIZACAO_DE_TRANSITO'
    | 'OUTROS_EMPECILHOS';

export type OccurrenceRegion =
    | 'REGIAO_METROPOLITANA_DO_RECIFE'
    | 'ZONA_DA_MATA'
    | 'AGRESTE'
    | 'SERTAO'
    | 'OUTRA';

export type OccurrenceStatus =
    | 'ABERTA'
    | 'EM_ANALISE'
    | 'RESOLVIDA';

export type OccurrencePriority =
    | 'ALTA'
    | 'MEDIA'
    | 'BAIXA';

export type Occurrence = {
    id: number;
    title: string;
    category: OccurrenceCategory;
    region: OccurrenceRegion;
    description: string;
    status: OccurrenceStatus;
    priority: OccurrencePriority;
    createdAt: string;
    address: string;
    latitude: number | null;
    longitude: number | null;
    requesterEmail?: string | null;
    images: OccurrenceImage[];
};

export type SaveOccurrenceInput = {
    title: string;
    category: OccurrenceCategory;
    region: OccurrenceRegion;
    description: string;
    address: string;
    priority: OccurrencePriority;
    latitude: number;
    longitude: number;
    images?: string[];
};
