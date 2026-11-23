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
        ActionButton: ({ label, onPress }: { label: string; onPress: () => void }) => (
            <Pressable accessibilityRole="button" onPress={onPress}>
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
});