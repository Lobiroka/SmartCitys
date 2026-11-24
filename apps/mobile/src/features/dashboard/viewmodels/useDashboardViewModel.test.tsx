import { act, renderHook, waitFor } from '@testing-library/react-native';
import { dashboardFixture } from '../__tests__/dashboardFixture';
import { useDashboardViewModel } from './useDashboardViewModel';

jest.mock('expo-router', () => {
    const React = jest.requireActual<typeof import('react')>('react');
    return { useFocusEffect: (callback: () => void | (() => void)) => React.useEffect(callback, [callback]) };
});

describe('useDashboardViewModel', () => {
    it('carrega o resumo e filtra bairro sem depender de acentos', async () => {
        const service = { getSummary: jest.fn().mockResolvedValue(dashboardFixture()) };
        const { result } = renderHook(() => useDashboardViewModel({ service }));
        await waitFor(() => expect(result.current.isLoading).toBe(false));
        expect(result.current.dashboard?.occurrences.total).toBe(5);
        act(() => result.current.setSearch('varzea'));
        expect(result.current.neighborhoods).toHaveLength(1);
        act(() => result.current.setSearch('boa viagem'));
        expect(result.current.neighborhoods).toHaveLength(0);
    });

    it('preserva o último resumo se a atualização falhar e permite tentar novamente', async () => {
        const service = { getSummary: jest.fn().mockResolvedValueOnce(dashboardFixture()).mockRejectedValueOnce(new Error('secret')).mockResolvedValue(dashboardFixture()) };
        const { result } = renderHook(() => useDashboardViewModel({ service }));
        await waitFor(() => expect(result.current.dashboard).not.toBeNull());
        await act(() => result.current.reload());
        expect(result.current.dashboard?.occurrences.total).toBe(5);
        expect(result.current.error).toBe('Não foi possível atualizar o dashboard. Tente novamente.');
        await act(() => result.current.reload());
        expect(result.current.error).toBeNull();
    });

    it('cancela requisições ao sair da tela', async () => {
        const service = { getSummary: jest.fn().mockImplementation(() => new Promise(() => {})) };
        const { unmount } = renderHook(() => useDashboardViewModel({ service }));
        await waitFor(() => expect(service.getSummary).toHaveBeenCalled());
        const signal = service.getSummary.mock.calls[0][0] as AbortSignal;
        unmount();
        expect(signal.aborted).toBe(true);
    });
});
