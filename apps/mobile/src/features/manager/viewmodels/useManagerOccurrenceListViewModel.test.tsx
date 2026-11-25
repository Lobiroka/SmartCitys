import { act, renderHook, waitFor } from '@testing-library/react-native';

import { managerOccurrenceService } from '@/src/composition/appDependencies';
import { occurrenceFixture } from '@/src/features/occurrences/__tests__/helpers/occurrenceFixture';
import { useManagerOccurrenceListViewModel } from './useManagerOccurrenceListViewModel';

jest.mock('expo-router', () => {
    const React = jest.requireActual<typeof import('react')>('react');
    return {
        useFocusEffect: (callback: () => void | (() => void)) =>
            React.useEffect(callback, [callback]),
    };
});

jest.mock('@/src/composition/appDependencies', () => ({
    managerOccurrenceService: {
        list: jest.fn(),
    },
}));

const serviceMock = jest.mocked(managerOccurrenceService);

describe('useManagerOccurrenceListViewModel', () => {
    beforeEach(() => {
        jest.resetAllMocks();
    });

    it('carrega a primeira página e avança para a próxima', async () => {
        const firstPage = {
            data: [occurrenceFixture()],
            pagination: { page: 1, limit: 10, total: 15, totalPages: 2 },
        };
        const secondPage = {
            data: [occurrenceFixture({ id: 2, title: 'Buraco na calçada' })],
            pagination: { page: 2, limit: 10, total: 15, totalPages: 2 },
        };
        serviceMock.list
            .mockResolvedValueOnce(firstPage)
            .mockResolvedValueOnce(secondPage);

        const { result } = renderHook(() => useManagerOccurrenceListViewModel());

        await waitFor(() => expect(result.current.isLoading).toBe(false));
        expect(serviceMock.list).toHaveBeenCalledWith(1);
        expect(result.current.result).toEqual(firstPage);

        act(() => {
            result.current.nextPage();
        });

        await waitFor(() => expect(result.current.result).toEqual(secondPage));
        expect(serviceMock.list).toHaveBeenLastCalledWith(2);
        expect(result.current.error).toBeUndefined();
    });
});
