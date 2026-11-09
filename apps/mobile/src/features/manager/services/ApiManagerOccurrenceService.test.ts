import { ApiManagerOccurrenceService } from './ApiManagerOccurrenceService';
import type { HttpClient } from '@/src/shared/http/HttpClient';

describe('ApiManagerOccurrenceService', () => {
    it('usa rotas do gestor para paginar e carregar os detalhes', async () => {
        const row = {
            id_denuncia: 42, titulo: 'Via bloqueada', endereco: null,
            latitude: '-8.05', longitude: '-34.9', imagens: [],
        };
        const pagination = { page: 2, limit: 20, total: 21, totalPages: 2 };
        const request = jest.fn()
            .mockResolvedValueOnce({ data: [row], pagination })
            .mockResolvedValueOnce(row);
        const service = new ApiManagerOccurrenceService({ request } satisfies HttpClient);

        expect(await service.list(2)).toMatchObject({ data: [{ id: 42 }], pagination });
        expect(await service.get(42)).toMatchObject({ address: '', latitude: -8.05 });
        expect(request.mock.calls).toEqual([['/demands/gestor?page=2'], ['/demands/gestor/42']]);
    });

    it('envia cada mudança separadamente e lê os valores confirmados pela API', async () => {
        const request = jest.fn()
            .mockResolvedValueOnce({ denuncia: { status: 'EM_ANALISE', prioridade: 'MEDIA' } })
            .mockResolvedValueOnce({ denuncia: { status: 'EM_ANALISE', prioridade: 'ALTA' } });
        const service = new ApiManagerOccurrenceService({ request } satisfies HttpClient);

        await expect(service.update(42, { status: 'EM_ANALISE' }))
            .resolves.toEqual({ status: 'EM_ANALISE', priority: 'MEDIA' });
        await expect(service.update(42, { priority: 'ALTA' }))
            .resolves.toEqual({ status: 'EM_ANALISE', priority: 'ALTA' });
        expect(request.mock.calls).toEqual([
            ['/demands/gestor/42/status', { method: 'PATCH', body: { status: 'EM_ANALISE' } }],
            ['/demands/gestor/42/prioridade', { method: 'PATCH', body: { prioridade: 'ALTA' } }],
        ]);
    });
});
