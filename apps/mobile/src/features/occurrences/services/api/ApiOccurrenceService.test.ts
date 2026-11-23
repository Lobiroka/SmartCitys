import type { SaveOccurrenceInput } from '@/src/features/occurrences/models/Occurrence';
import type { OccurrenceApiDto } from '@/src/features/occurrences/services/api/OccurrenceApiDto';
import type { HttpClient } from '@/src/shared/http/HttpClient';

import { ApiOccurrenceService } from './ApiOccurrenceService';

function createOccurrenceDto(
    overrides: Partial<OccurrenceApiDto> = {},
): OccurrenceApiDto {
    return {
        id_denuncia: 15,
        titulo: 'Poste apagado',
        categoria: 'ILUMINACAO_PUBLICA',
        regiao: 'REGIAO_METROPOLITANA_DO_RECIFE',
        descricao: 'Lâmpada queimada na esquina',
        status: 'ABERTA',
        prioridade: 'ALTA',
        data_registro: '2026-11-20T10:00:00.000Z',
        endereco: 'Rua da Aurora, 100',
        latitude: '-8.0578',
        longitude: '-34.8829',
        email_solicitante: 'cidadao@teste.com',
        cidadao_id: 7,
        imagens: [],
        ...overrides,
    };
}

describe('ApiOccurrenceService', () => {
    it('lista as ocorrências do cidadão com paginação padrão e filtros', async () => {
        const dto = createOccurrenceDto();
        const pagination = { page: 1, limit: 20, total: 1, totalPages: 1 };
        const request = jest.fn()
            .mockResolvedValueOnce({ data: [dto], pagination })
            .mockResolvedValueOnce({ data: [], pagination });
        const service = new ApiOccurrenceService({ request } satisfies HttpClient);

        const primeiraPagina = await service.listMine();
        await service.listMine({
            page: 2,
            limit: 10,
            search: '  poste  ',
            status: 'ABERTA',
        });

        expect(primeiraPagina).toMatchObject({
            data: [
                {
                    id: 15,
                    title: 'Poste apagado',
                    latitude: -8.0578,
                    longitude: -34.8829,
                },
            ],
            pagination,
        });
        expect(request.mock.calls).toEqual([
            ['/demands/my-demands?page=1&limit=20'],
            ['/demands/my-demands?page=2&limit=10&search=poste&status=ABERTA'],
        ]);
    });

    it('lista o feed público usando limite padrão de 100 itens', async () => {
        const pagination = { page: 1, limit: 100, total: 0, totalPages: 0 };
        const request = jest.fn().mockResolvedValueOnce({ data: [], pagination });
        const service = new ApiOccurrenceService({ request } satisfies HttpClient);

        const resultado = await service.listFeed({ status: 'RESOLVIDA' });

        expect(resultado).toEqual({ data: [], pagination });
        expect(request).toHaveBeenCalledWith(
            '/demands/feed?page=1&limit=100&status=RESOLVIDA',
        );
    });

    it('envia o payload mapeado ao criar, consultar, atualizar e remover ocorrência', async () => {
        const dto = createOccurrenceDto({ id_denuncia: 22 });
        const input: SaveOccurrenceInput = {
            title: 'Buraco na via',
            category: 'MANUTENCAO_DE_VIAS',
            region: 'REGIAO_METROPOLITANA_DO_RECIFE',
            description: 'Asfalto cedendo próximo ao meio-fio',
            address: 'Av. Boa Viagem, 500',
            priority: 'MEDIA',
            latitude: -8.119,
            longitude: -34.894,
            images: ['data:image/png;base64,abc'],
        };
        const expectedBody = {
            titulo: 'Buraco na via',
            categoria: 'MANUTENCAO_DE_VIAS',
            regiao: 'REGIAO_METROPOLITANA_DO_RECIFE',
            descricao: 'Asfalto cedendo próximo ao meio-fio',
            endereco: 'Av. Boa Viagem, 500',
            prioridade: 'MEDIA',
            latitude: -8.119,
            longitude: -34.894,
            imagens: ['data:image/png;base64,abc'],
        };

        const request = jest.fn()
            .mockResolvedValueOnce(dto)
            .mockResolvedValueOnce(dto)
            .mockResolvedValueOnce(dto)
            .mockResolvedValueOnce(undefined);
        const service = new ApiOccurrenceService({ request } satisfies HttpClient);

        const criada = await service.create(input);
        const consultada = await service.getById(22);
        const atualizada = await service.update(22, input);
        await service.remove(22);

        expect(criada.id).toBe(22);
        expect(consultada.id).toBe(22);
        expect(atualizada.id).toBe(22);
        expect(request.mock.calls).toEqual([
            ['/demands', { method: 'POST', body: expectedBody }],
            ['/demands/22'],
            ['/demands/22', { method: 'PATCH', body: expectedBody }],
            ['/demands/22', { method: 'DELETE' }],
        ]);
    });
});
