import { act, renderHook, waitFor } from '@testing-library/react-native';

import { managerOccurrenceService } from '@/src/composition/appDependencies';
import { occurrenceFixture } from '@/src/features/occurrences/__tests__/helpers/occurrenceFixture';
import { useManagerOccurrenceDetailViewModel } from './useManagerOccurrenceDetailViewModel';

jest.mock('@/src/composition/appDependencies', () => ({
    managerOccurrenceService: {
        get: jest.fn(),
        update: jest.fn(),
    },
}));

const serviceMock = jest.mocked(managerOccurrenceService);

describe('useManagerOccurrenceDetailViewModel', () => {
    beforeEach(() => {
        jest.resetAllMocks();
    });

    it('carrega a ocorrência pelo id', async () => {
        const occurrence = occurrenceFixture();
        serviceMock.get.mockResolvedValue(occurrence);

        const { result } = renderHook(() => useManagerOccurrenceDetailViewModel(1));

        await waitFor(() => expect(result.current.isLoading).toBe(false));
        expect(serviceMock.get).toHaveBeenCalledWith(1);
        expect(result.current.occurrence).toEqual(occurrence);
    });

    it('expõe o erro quando falha ao carregar', async () => {
        serviceMock.get.mockRejectedValue(new Error('API indisponível'));

        const { result } = renderHook(() => useManagerOccurrenceDetailViewModel(1));

        await waitFor(() => expect(result.current.isLoading).toBe(false));
        expect(result.current.loadError).toBe('API indisponível');
        expect(result.current.occurrence).toBeUndefined();
    });

    it('salva o novo status e atualiza a ocorrência', async () => {
        serviceMock.get.mockResolvedValue(occurrenceFixture());
        serviceMock.update.mockResolvedValue({ status: 'EM_ANALISE', priority: 'MEDIA' });
        const { result } = renderHook(() => useManagerOccurrenceDetailViewModel(1));
        await waitFor(() => expect(result.current.occurrence).toBeDefined());

        await act(async () => {
            await result.current.update({ status: 'EM_ANALISE' });
        });

        expect(serviceMock.update).toHaveBeenCalledWith(1, { status: 'EM_ANALISE' });
        expect(result.current.occurrence?.status).toBe('EM_ANALISE');
        expect(result.current.saved).toBe(true);
    });

    it('não chama o serviço quando o status escolhido já é o atual', async () => {
        serviceMock.get.mockResolvedValue(occurrenceFixture({ status: 'ABERTA' }));
        const { result } = renderHook(() => useManagerOccurrenceDetailViewModel(1));
        await waitFor(() => expect(result.current.occurrence).toBeDefined());

        await act(async () => {
            await result.current.update({ status: 'ABERTA' });
        });

        expect(serviceMock.update).not.toHaveBeenCalled();
        expect(result.current.saved).toBe(false);
    });

    it('mostra o erro ao falhar ao salvar e mantém a ocorrência', async () => {
        serviceMock.get.mockResolvedValue(occurrenceFixture());
        serviceMock.update.mockRejectedValue(new Error('Falha ao salvar'));
        const { result } = renderHook(() => useManagerOccurrenceDetailViewModel(1));
        await waitFor(() => expect(result.current.occurrence).toBeDefined());

        await act(async () => {
            await result.current.update({ priority: 'ALTA' });
        });

        expect(result.current.saveError).toBe('Falha ao salvar');
        expect(result.current.occurrence?.priority).toBe('MEDIA');
        expect(result.current.saved).toBe(false);
    });
});