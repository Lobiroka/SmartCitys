import type {
    OccurrenceCategory,
    OccurrencePriority,
    OccurrenceRegion,
    OccurrenceStatus,
} from '@/src/features/occurrences/models/Occurrence';

export type OccurrenceImageApiDto = {
    id_imagem: number;
    caminho_file: string;
    data_upload: string;
    denuncia_id: number;
};

export type OccurrenceApiDto = {
    id_denuncia: number;
    titulo: string;
    categoria: OccurrenceCategory;
    regiao: OccurrenceRegion;
    descricao: string;
    status: OccurrenceStatus;
    prioridade: OccurrencePriority;
    data_registro: string;
    endereco: string;
    latitude?: number | string | null;
    longitude?: number | string | null;
    email_solicitante: string | null;
    cidadao_id: number;
    imagens: OccurrenceImageApiDto[];
};

export type SaveOccurrenceApiDto = {
    titulo: string;
    categoria: OccurrenceCategory;
    regiao: OccurrenceRegion;
    descricao: string;
    endereco: string;
    prioridade: OccurrencePriority;
    latitude: number;
    longitude: number;
    imagens?: string[];
};

export type OccurrencePageApiDto = {
    data: OccurrenceApiDto[];
    pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
    };
};
