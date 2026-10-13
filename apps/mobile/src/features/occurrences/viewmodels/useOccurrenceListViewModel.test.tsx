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
        expect(service.listMine).toHaveBeenCalledWith({ limit: 100 });
        expect(result.current.occurrences).toEqual([occurrence]);
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
        service.listMine.mockRejectedValue(new Error('API indisponível'));
        const { result } = renderHook(() =>
            useOccurrenceListViewModel({ service }),
        );
        await act(async () => { await Promise.resolve(); });

        await waitFor(() => expect(result.current.error).toBe('API indisponível'));
        expect(result.current.isLoading).toBe(false);
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
