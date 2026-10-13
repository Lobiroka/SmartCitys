import { act, renderHook, waitFor } from '@testing-library/react-native';

import { createOccurrenceServiceMock } from
    '@/src/features/occurrences/__tests__/helpers/createOccurrenceServiceMock';
import { occurrenceFixture } from
    '@/src/features/occurrences/__tests__/helpers/occurrenceFixture';
import { useOccurrenceFeedViewModel } from './useOccurrenceFeedViewModel';

jest.mock('expo-router', () => {
    const React = jest.requireActual<typeof import('react')>('react');
    return {
        useFocusEffect: (callback: () => void | (() => void)) =>
            React.useEffect(callback, [callback]),
    };
});

describe('useOccurrenceFeedViewModel', () => {
    it('mantém no mapa apenas ocorrências com as duas coordenadas', async () => {
        const service = createOccurrenceServiceMock();
        const mapped = occurrenceFixture();
        service.listFeed.mockResolvedValue({
            data: [
                mapped,
                occurrenceFixture({ id: 2, latitude: null }),
                occurrenceFixture({ id: 3, longitude: null }),
            ],
            pagination: { page: 1, limit: 100, total: 3, totalPages: 1 },
        });

        const { result } = renderHook(() =>
            useOccurrenceFeedViewModel({ service }),
        );
        await act(async () => { await Promise.resolve(); });

        await waitFor(() => expect(result.current.occurrences).toEqual([mapped]));
    });

    it('traduz falhas desconhecidas em mensagem segura', async () => {
        const service = createOccurrenceServiceMock();
        service.listFeed.mockRejectedValue('falha');

        const { result } = renderHook(() =>
            useOccurrenceFeedViewModel({ service }),
        );
        await act(async () => { await Promise.resolve(); });

        await waitFor(() => expect(result.current.occurrenceError)
            .toBe('Não foi possível carregar o mapa de ocorrências.'));
    });
});
