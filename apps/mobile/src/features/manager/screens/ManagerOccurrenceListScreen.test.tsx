import { fireEvent, render } from '@testing-library/react-native';

import { occurrenceFixture } from
    '@/src/features/occurrences/__tests__/helpers/occurrenceFixture';
import { ManagerOccurrenceListScreen } from './ManagerOccurrenceListScreen';
import { useManagerOccurrenceListViewModel } from
    '@/src/features/manager/viewmodels/useManagerOccurrenceListViewModel';

const mockPush = jest.fn();
const mockSignOut = jest.fn();

jest.mock('expo-router', () => ({
    useRouter: () => ({ push: (...args: unknown[]) => mockPush(...args) }),
}));

jest.mock('expo-router/react-navigation', () => ({
    useTheme: () => ({ colors: { border: '#ccc', card: '#fff' } }),
}));

jest.mock('@/src/features/auth/hooks/useAuthSession', () => ({
    useAuthSession: () => ({ signOut: mockSignOut }),
}));

jest.mock('@/src/features/manager/viewmodels/useManagerOccurrenceListViewModel', () => ({
    useManagerOccurrenceListViewModel: jest.fn(),
}));

// ActionButton usa gluestack/NativeWind e tem teste próprio; aqui é isolado
// para que o teste valide apenas o comportamento da tela.
jest.mock('@/components/ui/action-button', () => {
    const { Pressable: MockPressable, Text: MockText } = jest.requireActual('react-native');
    return {
        ActionButton: ({ label, onPress, disabled = false }: {
            label: string; onPress: () => void; disabled?: boolean;
        }) => (
            <MockPressable
                accessibilityRole="button"
                accessibilityState={{ disabled }}
                disabled={disabled}
                onPress={onPress}
            >
                <MockText>{label}</MockText>
            </MockPressable>
        ),
    };
});

const useViewModelMock = jest.mocked(useManagerOccurrenceListViewModel);

function pagination(overrides: Record<string, number> = {}) {
    return { page: 1, limit: 10, total: 1, totalPages: 1, ...overrides };
}

function viewModel(overrides: Record<string, unknown> = {}) {
    return {
        result: { data: [occurrenceFixture()], pagination: pagination() },
        isLoading: false,
        error: undefined,
        reload: jest.fn(),
        previousPage: jest.fn(),
        nextPage: jest.fn(),
        ...overrides,
    };
}

describe('ManagerOccurrenceListScreen', () => {
    it('exibe o título, o botão de sair e a ocorrência com status e prioridade', async () => {
        useViewModelMock.mockReturnValue(viewModel() as never);
        const screen = await render(<ManagerOccurrenceListScreen />);

        expect(screen.getByText('Ocorrências')).toBeTruthy();
        expect(screen.getByText('#1 · Poste sem iluminação')).toBeTruthy();
        expect(screen.getByText('Aberta · Prioridade média')).toBeTruthy();
    });

    it('encerra a sessão ao pressionar "Sair"', async () => {
        useViewModelMock.mockReturnValue(viewModel() as never);
        const screen = await render(<ManagerOccurrenceListScreen />);

        fireEvent.press(screen.getByText('Sair'));

        expect(mockSignOut).toHaveBeenCalledTimes(1);
    });

    it('navega para o detalhe da ocorrência selecionada', async () => {
        useViewModelMock.mockReturnValue(viewModel() as never);
        const screen = await render(<ManagerOccurrenceListScreen />);

        fireEvent.press(screen.getByTestId('manager-occurrence-1'));

        expect(mockPush).toHaveBeenCalledWith({
            pathname: '/gestor/[id]',
            params: { id: '1' },
        });
    });

    it('mostra o indicador de carregamento e oculta a lista', async () => {
        useViewModelMock.mockReturnValue(
            viewModel({ isLoading: true, result: undefined }) as never,
        );
        const screen = await render(<ManagerOccurrenceListScreen />);

        expect(screen.getByLabelText('Carregando ocorrências')).toBeTruthy();
        expect(screen.queryByText('Nenhuma ocorrência encontrada.')).toBeNull();
    });

    it('exibe a mensagem de erro e permite tentar novamente', async () => {
        const vm = viewModel({ error: 'Falha ao carregar ocorrências.', result: undefined });
        useViewModelMock.mockReturnValue(vm as never);
        const screen = await render(<ManagerOccurrenceListScreen />);

        expect(screen.getByText('Falha ao carregar ocorrências.')).toBeTruthy();
        fireEvent.press(screen.getByText('Tentar novamente'));

        expect(vm.reload).toHaveBeenCalledTimes(1);
    });

    it('informa quando não há ocorrências', async () => {
        useViewModelMock.mockReturnValue(viewModel({
            result: { data: [], pagination: pagination({ total: 0 }) },
        }) as never);
        const screen = await render(<ManagerOccurrenceListScreen />);

        expect(screen.getByText('Nenhuma ocorrência encontrada.')).toBeTruthy();
    });

    it('não mostra a paginação quando há apenas uma página', async () => {
        useViewModelMock.mockReturnValue(viewModel() as never);
        const screen = await render(<ManagerOccurrenceListScreen />);

        expect(screen.queryByText('Anterior')).toBeNull();
        expect(screen.queryByText('Próxima')).toBeNull();
    });

    it('desabilita "Anterior" na primeira página e avança com "Próxima"', async () => {
        const vm = viewModel({
            result: {
                data: [occurrenceFixture()],
                pagination: pagination({ page: 1, totalPages: 3, total: 25 }),
            },
        });
        useViewModelMock.mockReturnValue(vm as never);
        const screen = await render(<ManagerOccurrenceListScreen />);

        expect(screen.getByText('1 / 3')).toBeTruthy();
        expect(screen.getByRole('button', { name: 'Anterior' })).toBeDisabled();

        fireEvent.press(screen.getByText('Próxima'));
        expect(vm.nextPage).toHaveBeenCalledTimes(1);
    });

    it('desabilita "Próxima" na última página e volta com "Anterior"', async () => {
        const vm = viewModel({
            result: {
                data: [occurrenceFixture()],
                pagination: pagination({ page: 3, totalPages: 3, total: 25 }),
            },
        });
        useViewModelMock.mockReturnValue(vm as never);
        const screen = await render(<ManagerOccurrenceListScreen />);

        expect(screen.getByText('3 / 3')).toBeTruthy();
        expect(screen.getByRole('button', { name: 'Próxima' })).toBeDisabled();

        fireEvent.press(screen.getByText('Anterior'));
        expect(vm.previousPage).toHaveBeenCalledTimes(1);
    });
});
