import { fireEvent, render } from '@testing-library/react-native';

import { useManagerOccurrenceListViewModel } from '@/src/features/manager/viewmodels/useManagerOccurrenceListViewModel';
import { occurrenceFixture } from '@/src/features/occurrences/__tests__/helpers/occurrenceFixture';
import { ManagerOccurrenceListScreen } from './ManagerOccurrenceListScreen';

const mockPush = jest.fn();

jest.mock('expo-router', () => ({
    useRouter: () => ({ push: mockPush }),
}));

jest.mock('expo-router/react-navigation', () => ({
    useTheme: () => ({ colors: { border: '#ccc', card: '#fff' } }),
}));

jest.mock('@/components/ui/action-button', () => {
    const { Pressable, Text } = jest.requireActual('react-native');
    return {
        ActionButton: ({ label, onPress, disabled }: {
            label: string;
            onPress: () => void;
            disabled?: boolean;
        }) => (
            <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress}>
                <Text>{label}</Text>
            </Pressable>
        ),
    };
});

jest.mock('@/src/features/auth/hooks/useAuthSession', () => ({
    useAuthSession: () => ({ signOut: jest.fn() }),
}));

jest.mock('@/src/features/manager/viewmodels/useManagerOccurrenceListViewModel', () => ({
    useManagerOccurrenceListViewModel: jest.fn(),
}));

const useViewModelMock = jest.mocked(useManagerOccurrenceListViewModel);

function viewModel(overrides: Record<string, unknown> = {}) {
    return {
        result: undefined,
        isLoading: false,
        error: undefined,
        reload: jest.fn(),
        previousPage: jest.fn(),
        nextPage: jest.fn(),
        ...overrides,
    };
}

describe('ManagerOccurrenceListScreen', () => {
    it('mostra o indicador de carregamento enquanto busca as ocorrências', async () => {
        useViewModelMock.mockReturnValue(viewModel({ isLoading: true }) as never);
        const screen = await render(<ManagerOccurrenceListScreen />);

        expect(screen.getByLabelText('Carregando ocorrências')).toBeTruthy();
        expect(screen.queryByText('Nenhuma ocorrência encontrada.')).toBeNull();
    });

    it('mostra a mensagem de erro e tenta carregar de novo', async () => {
        const reload = jest.fn();
        useViewModelMock.mockReturnValue(viewModel({
            error: 'Falha ao carregar ocorrências.',
            reload,
        }) as never);
        const screen = await render(<ManagerOccurrenceListScreen />);

        expect(screen.getByText('Falha ao carregar ocorrências.')).toBeTruthy();
        fireEvent.press(screen.getByText('Tentar novamente'));

        expect(reload).toHaveBeenCalledTimes(1);
    });

    it('mostra aviso quando não há ocorrências', async () => {
        useViewModelMock.mockReturnValue(viewModel({
            result: {
                data: [],
                pagination: { page: 1, limit: 10, total: 0, totalPages: 1 },
            },
        }) as never);
        const screen = await render(<ManagerOccurrenceListScreen />);

        expect(screen.getByText('Nenhuma ocorrência encontrada.')).toBeTruthy();
    });

    it('lista a ocorrência e abre os detalhes ao tocar nela', async () => {
        useViewModelMock.mockReturnValue(viewModel({
            result: {
                data: [occurrenceFixture()],
                pagination: { page: 1, limit: 10, total: 1, totalPages: 1 },
            },
        }) as never);
        const screen = await render(<ManagerOccurrenceListScreen />);

        fireEvent.press(screen.getByText('#1 · Poste sem iluminação'));

        expect(mockPush).toHaveBeenCalledWith({
            pathname: '/gestor/[id]',
            params: { id: '1' },
        });
    });

    it('vai para a próxima página e não volta quando já está na primeira', async () => {
        const nextPage = jest.fn();
        const previousPage = jest.fn();
        useViewModelMock.mockReturnValue(viewModel({
            result: {
                data: [occurrenceFixture()],
                pagination: { page: 1, limit: 10, total: 15, totalPages: 2 },
            },
            nextPage,
            previousPage,
        }) as never);
        const screen = await render(<ManagerOccurrenceListScreen />);

        expect(screen.getByText('1 / 2')).toBeTruthy();
        fireEvent.press(screen.getByText('Anterior'));
        fireEvent.press(screen.getByText('Próxima'));

        expect(previousPage).not.toHaveBeenCalled();
        expect(nextPage).toHaveBeenCalledTimes(1);
    });

    it('não mostra a paginação quando existe só uma página', async () => {
        useViewModelMock.mockReturnValue(viewModel({
            result: {
                data: [occurrenceFixture()],
                pagination: { page: 1, limit: 10, total: 1, totalPages: 1 },
            },
        }) as never);
        const screen = await render(<ManagerOccurrenceListScreen />);

        expect(screen.queryByText('Anterior')).toBeNull();
        expect(screen.queryByText('Próxima')).toBeNull();
    });
});