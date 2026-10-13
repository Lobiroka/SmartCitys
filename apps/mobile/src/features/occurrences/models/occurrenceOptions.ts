import type {
    OccurrenceCategory,
    OccurrencePriority,
    OccurrenceRegion,
    OccurrenceStatus,
} from './Occurrence';

export const occurrenceCategories: {
    value: OccurrenceCategory;
    label: string;
}[] = [
    { value: 'ILUMINACAO_PUBLICA', label: 'Iluminação pública' },
    { value: 'MANUTENCAO_DE_VIAS', label: 'Manutenção de vias' },
    { value: 'SANEAMENTO', label: 'Saneamento' },
    { value: 'COLETA_DE_LIXO', label: 'Coleta de lixo' },
    { value: 'FISCALIZACAO', label: 'Fiscalização' },
    { value: 'SEGURANCA', label: 'Segurança' },
    { value: 'SINALIZACAO_DE_TRANSITO', label: 'Sinalização de trânsito' },
    { value: 'OUTROS_EMPECILHOS', label: 'Outros' },
];

export const occurrenceRegions: {
    value: OccurrenceRegion;
    label: string;
}[] = [
    { value: 'REGIAO_METROPOLITANA_DO_RECIFE', label: 'Região Metropolitana' },
    { value: 'ZONA_DA_MATA', label: 'Zona da Mata' },
    { value: 'AGRESTE', label: 'Agreste' },
    { value: 'SERTAO', label: 'Sertão' },
    { value: 'OUTRA', label: 'Outra' },
];

export const occurrencePriorities: {
    value: OccurrencePriority;
    label: string;
}[] = [
    { value: 'BAIXA', label: 'Baixa' },
    { value: 'MEDIA', label: 'Média' },
    { value: 'ALTA', label: 'Alta' },
];

export const occurrenceStatuses: {
    value: OccurrenceStatus;
    label: string;
}[] = [
    { value: 'ABERTA', label: 'Aberta' },
    { value: 'EM_ANALISE', label: 'Em análise' },
    { value: 'RESOLVIDA', label: 'Resolvida' },
];

export function occurrenceLabel<T extends string>(
    options: { value: T; label: string }[],
    value: T,
): string {
    return options.find((option) => option.value === value)?.label ?? value;
}
