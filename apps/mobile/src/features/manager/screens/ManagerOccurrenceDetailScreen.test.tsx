import { fireEvent, render } from '@testing-library/react-native';
import { Alert } from 'react-native';

import { useManagerOccurrenceDetailViewModel } from '@/src/features/manager/viewmodels/useManagerOccurrenceDetailViewModel';
import { occurrenceFixture } from '@/src/features/occurrences/__tests__/helpers/occurrenceFixture';
import { ManagerOccurrenceDetailScreen } from './ManagerOccurrenceDetailScreen';

jest.mock('expo-router/react-navigation', () => ({
    useTheme: () => ({ colors: { border: '#ccc', card: '#fff', primary: '#00f' } }),
}));

jest.mock('@/src/features/manager/viewmodels/useManagerOccurrenceDetailViewModel', () => ({
    useManagerOccurrenceDetailViewModel: jest.fn(),
}));

const useViewModelMock = jest.mocked(useManagerOccurrenceDetailViewModel);

function viewModel(overrides: Record<string, unknown> = {}) {
    return {
        occurrence: occurrenceFixture(),
        isLoading: false,
        loadError: undefined,
        saveError: undefined,
        saved: false,
        isSaving: false,
        update: jest.fn().mockResolvedValue(undefined),
        retry: jest.fn(),
        ...overrides,
    };
}

describe('ManagerOccurrenceDetailScreen', () => {
    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('mostra o indicador de carregamento enquanto busca a ocorrência', async () => {
        useViewModelMock.mockReturnValue(viewModel({
            occurrence: undefined,
            isLoading: true,
        }) as never);
        const screen = await render(<ManagerOccurrenceDetailScreen id={1} />);

        expect(screen.getByLabelText('Carregando ocorrência')).toBeTruthy();
    });

    it('mostra o erro ao carregar e tenta de novo', async () => {
        const retry = jest.fn();
        useViewModelMock.mockReturnValue(viewModel({
            occurrence: undefined,
            loadError: 'Falha ao carregar a ocorrência.',
            retry,
        }) as never);
        const screen = await render(<ManagerOccurrenceDetailScreen id={1} />);

        expect(screen.getByText('Falha ao carregar a ocorrência.')).toBeTruthy();
        fireEvent.press(screen.getByText('Tentar novamente'));

        expect(retry).toHaveBeenCalledTimes(1);
    });

    it('mostra os dados da ocorrência', async () => {
        useViewModelMock.mockReturnValue(viewModel() as never);
        const screen = await render(<ManagerOccurrenceDetailScreen id={1} />);

        expect(screen.getByText('Ocorrência #1')).toBeTruthy();
        expect(screen.getByText('Poste sem iluminação')).toBeTruthy();
        expect(screen.getByText('Categoria: Iluminação pública')).toBeTruthy();
        expect(screen.getByText('Endereço: Rua do Sol, 100')).toBeTruthy();
    });

    it('altera o status depois de confirmar no alerta', async () => {
        const update = jest.fn().mockResolvedValue(undefined);
        useViewModelMock.mockReturnValue(viewModel({ update }) as never);
        jest.spyOn(Alert, 'alert').mockImplementation(
            (_title, _message, buttons) => buttons?.[1]?.onPress?.(),
        );
        const screen = await render(<ManagerOccurrenceDetailScreen id={1} />);

        fireEvent.press(screen.getByLabelText('Status: Em análise'));

        expect(update).toHaveBeenCalledWith({ status: 'EM_ANALISE' });
    });

    it('não abre o alerta ao tocar no status que já está selecionado', async () => {
        const alertSpy = jest.spyOn(Alert, 'alert');
        useViewModelMock.mockReturnValue(viewModel() as never);
        const screen = await render(<ManagerOccurrenceDetailScreen id={1} />);

        fireEvent.press(screen.getByLabelText('Status: Aberta'));

        expect(alertSpy).not.toHaveBeenCalled();
    });

    it('mostra a confirmação depois de salvar', async () => {
        useViewModelMock.mockReturnValue(viewModel({ saved: true }) as never);
        const screen = await render(<ManagerOccurrenceDetailScreen id={1} />);

        expect(screen.getByText('Alteração salva.')).toBeTruthy();
    });
});