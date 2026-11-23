import { act, renderHook, waitFor } from '@testing-library/react-native';

import { createOccurrenceServiceMock } from
    '@/src/features/occurrences/__tests__/helpers/createOccurrenceServiceMock';
import { occurrenceFixture } from
    '@/src/features/occurrences/__tests__/helpers/occurrenceFixture';
import {
    filterOccurrences,
    useOccurrenceListViewModel,
} from './useOccurrenceListViewModel';

jest.mock('expo-router', () => {
    const React = jest.requireActual<typeof import('react')>('react');
    return {
        useFocusEffect: (callback: () => void | (() => void)) =>
            React.useEffect(callback, [callback]),
    };
});

describe('useOccurrenceListViewModel', () => {
    it('carrega as ocorrências do cidadão ao receber foco', async () => {
        const service = createOccurrenceServiceMock();
        const occurrence = occurrenceFixture();
        service.listMine.mockResolvedValue({
            data: [occurrence],
            pagination: { page: 1, limit: 100, total: 1, totalPages: 1 },
        });

        const { result } = renderHook(() =>
            useOccurrenceListViewModel({ service }),
        );
        await act(async () => { await Promise.resolve(); });

        await waitFor(() => expect(result.current.isLoading).toBe(false));
        expect(service.listMine).toHaveBeenCalledWith({ page: 1, limit: 100 });
        expect(result.current.occurrences).toEqual([occurrence]);
    });

    it('pesquisa e filtra também registros depois da primeira página', async () => {
        const service = createOccurrenceServiceMock();
        const firstPage = Array.from({ length: 100 }, (_, index) =>
            occurrenceFixture({ id: index + 1 }),
        );
        const last = occurrenceFixture({ id: 101, title: 'Demanda antiga', status: 'RESOLVIDA' });
        service.listMine.mockResolvedValueOnce({
            data: firstPage,
            pagination: { page: 1, limit: 100, total: 101, totalPages: 2 },
        }).mockResolvedValueOnce({
            data: [last],
            pagination: { page: 2, limit: 100, total: 101, totalPages: 2 },
        });
        const { result } = renderHook(() => useOccurrenceListViewModel({ service }));

        await waitFor(() => expect(result.current.occurrences).toHaveLength(101));
        expect(service.listMine).toHaveBeenNthCalledWith(2, { page: 2, limit: 100 });
        act(() => {
            result.current.setSearch('antiga');
            result.current.setStatus('RESOLVIDA');
        });
        expect(result.current.filteredOccurrences).toEqual([last]);
    });

    it('preserva a lista anterior quando uma página posterior falha', async () => {
        const service = createOccurrenceServiceMock();
        const saved = occurrenceFixture();
        service.listMine.mockResolvedValueOnce({
            data: [saved],
            pagination: { page: 1, limit: 100, total: 1, totalPages: 1 },
        }).mockResolvedValueOnce({
            data: [occurrenceFixture({ id: 2 })],
            pagination: { page: 1, limit: 100, total: 101, totalPages: 2 },
        }).mockRejectedValueOnce(new Error('Falha na segunda página'));
        const { result } = renderHook(() => useOccurrenceListViewModel({ service }));
        await waitFor(() => expect(result.current.occurrences).toEqual([saved]));

        await act(async () => result.current.load(true));

        expect(result.current.occurrences).toEqual([saved]);
        expect(result.current.error).toBe('Falha na segunda página');
        expect(result.current.isRefreshing).toBe(false);
    });

    it('ignora uma resposta antiga quando uma atualização termina primeiro', async () => {
        const service = createOccurrenceServiceMock();
        let resolveOld!: (value: Awaited<ReturnType<typeof service.listMine>>) => void;
        const updated = occurrenceFixture({ id: 2, status: 'EM_ANALISE' });
        service.listMine.mockReturnValueOnce(new Promise((resolve) => { resolveOld = resolve; }))
            .mockResolvedValueOnce({
                data: [updated],
                pagination: { page: 1, limit: 100, total: 1, totalPages: 1 },
            });
        const { result } = renderHook(() => useOccurrenceListViewModel({ service }));
        await act(async () => result.current.load(true));
        await act(async () => resolveOld({
            data: [occurrenceFixture()],
            pagination: { page: 1, limit: 100, total: 1, totalPages: 1 },
        }));

        expect(result.current.occurrences).toEqual([updated]);
    });

    it('remove o item da lista apenas depois de o serviço confirmar', async () => {
        const service = createOccurrenceServiceMock();
        service.listMine.mockResolvedValue({
            data: [occurrenceFixture()],
            pagination: { page: 1, limit: 100, total: 1, totalPages: 1 },
        });
        service.remove.mockResolvedValue();
        const { result } = renderHook(() =>
            useOccurrenceListViewModel({ service }),
        );
        await act(async () => { await Promise.resolve(); });
        await waitFor(() => expect(result.current.occurrences).toHaveLength(1));

        await act(async () => {
            expect(await result.current.remove(1)).toBe(true);
        });

        expect(service.remove).toHaveBeenCalledWith(1);
        expect(result.current.occurrences).toEqual([]);
    });

    it('expõe a falha do serviço sem apagar os dados existentes', async () => {
        const service = createOccurrenceServiceMock();
        const occurrence = occurrenceFixture();
        service.listMine.mockResolvedValueOnce({
            data: [occurrence],
            pagination: { page: 1, limit: 100, total: 1, totalPages: 1 },
        }).mockRejectedValueOnce(new Error('API indisponível'));
        const { result } = renderHook(() =>
            useOccurrenceListViewModel({ service }),
        );
        await act(async () => { await Promise.resolve(); });

        await waitFor(() => expect(result.current.occurrences).toEqual([occurrence]));
        await act(async () => result.current.load(true));

        await waitFor(() => expect(result.current.error).toBe('API indisponível'));
        expect(service.listMine).toHaveBeenCalledTimes(2);
        expect(result.current.occurrences).toEqual([occurrence]);
        expect(result.current.filteredOccurrences).toEqual([occurrence]);
        expect(result.current.isLoading).toBe(false);
        expect(result.current.isRefreshing).toBe(false);
    });
});

describe('filterOccurrences', () => {
    const open = occurrenceFixture();
    const resolved = occurrenceFixture({
        id: 2,
        title: 'Coleta concluída',
        description: 'Resíduos removidos',
        address: 'Avenida Norte',
        status: 'RESOLVIDA',
    });

    it('pesquisa sem diferenciar maiúsculas e acentos já digitados', () => {
        expect(filterOccurrences([open, resolved], '  poste  ')).toEqual([open]);
    });

    it('combina pesquisa e status', () => {
        expect(filterOccurrences([open, resolved], 'norte', 'RESOLVIDA'))
            .toEqual([resolved]);
        expect(filterOccurrences([open, resolved], 'norte', 'ABERTA'))
            .toEqual([]);
    });
});
