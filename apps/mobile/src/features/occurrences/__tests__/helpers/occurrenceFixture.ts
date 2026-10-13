import type { Occurrence } from
    '@/src/features/occurrences/models/Occurrence';

export function occurrenceFixture(
    overrides: Partial<Occurrence> = {},
): Occurrence {
    return {
        id: 1,
        title: 'Poste sem iluminação',
        category: 'ILUMINACAO_PUBLICA',
        region: 'REGIAO_METROPOLITANA_DO_RECIFE',
        description: 'A lâmpada do poste está apagada.',
        status: 'ABERTA',
        priority: 'MEDIA',
        createdAt: '2026-09-23T12:00:00.000Z',
        address: 'Rua do Sol, 100',
        latitude: -8.0476,
        longitude: -34.877,
        requesterEmail: 'cidadao@example.com',
        images: [],
        ...overrides,
    };
}
