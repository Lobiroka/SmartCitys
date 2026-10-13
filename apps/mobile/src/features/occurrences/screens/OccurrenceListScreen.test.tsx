import { Alert } from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';

import { occurrenceFixture } from
    '@/src/features/occurrences/__tests__/helpers/occurrenceFixture';
import { OccurrenceListScreen } from './OccurrenceListScreen';
import { useOccurrenceListViewModel } from
    '@/src/features/occurrences/viewmodels/useOccurrenceListViewModel';

const mockPush = jest.fn();

jest.mock('expo-router', () => ({
    router: { push: (...args: unknown[]) => mockPush(...args) },
}));

jest.mock('@/src/features/occurrences/viewmodels/useOccurrenceListViewModel', () => ({
    useOccurrenceListViewModel: jest.fn(),
}));

const useViewModelMock = jest.mocked(useOccurrenceListViewModel);

function viewModel(overrides: Record<string, unknown> = {}) {
    const open = occurrenceFixture();
    return {
        occurrences: [open],
        filteredOccurrences: [open],
        search: '',
        setSearch: jest.fn(),
        status: undefined,
        setStatus: jest.fn(),
        isLoading: false,
        isRefreshing: false,
        error: null,
        load: jest.fn(),
        remove: jest.fn().mockResolvedValue(true),
        ...overrides,
    };
}

describe('OccurrenceListScreen', () => {
    it('apresenta os dados e encaminha para criação e edição', async () => {
        useViewModelMock.mockReturnValue(viewModel() as never);
        const screen = await render(<OccurrenceListScreen />);

        expect(screen.getByText('Poste sem iluminação')).toBeTruthy();
        fireEvent.press(screen.getByTestId('occurrence-create-button'));
        expect(mockPush).toHaveBeenCalledWith('/(tabs)/create-occurrence');

        fireEvent.press(screen.getByTestId('occurrence-edit-1'));
        expect(mockPush).toHaveBeenCalledWith('/(tabs)/edit-occurrence?id=1');
    });

    it('delega pesquisa e confirmação de exclusão ao ViewModel', async () => {
        const vm = viewModel();
        useViewModelMock.mockReturnValue(vm as never);
        jest.spyOn(Alert, 'alert').mockImplementation(
            (_title, _message, buttons) => buttons?.[1]?.onPress?.(),
        );
        const screen = await render(<OccurrenceListScreen />);

        fireEvent.changeText(
            screen.getByTestId('occurrence-search-input'),
            'iluminação',
        );
        fireEvent.press(screen.getByTestId('occurrence-delete-1'));

        expect(vm.setSearch).toHaveBeenCalledWith('iluminação');
        expect(vm.remove).toHaveBeenCalledWith(1);
    });

    it('não permite editar nem excluir uma ocorrência finalizada', async () => {
        const resolved = occurrenceFixture({ id: 2, status: 'RESOLVIDA' });
        useViewModelMock.mockReturnValue(viewModel({
            occurrences: [resolved],
            filteredOccurrences: [resolved],
        }) as never);
        const screen = await render(<OccurrenceListScreen />);

        expect(screen.queryByTestId('occurrence-edit-2')).toBeNull();
        expect(screen.queryByTestId('occurrence-delete-2')).toBeNull();
        expect(screen.getAllByText('Resolvida')).toHaveLength(2);
    });

    it('mostra estado vazio e falha de carregamento', async () => {
        useViewModelMock.mockReturnValue(viewModel({
            occurrences: [],
            filteredOccurrences: [],
            error: 'API indisponível',
        }) as never);
        const screen = await render(<OccurrenceListScreen />);

        expect(screen.getByText('API indisponível')).toBeTruthy();
        expect(screen.getByText('Nenhuma ocorrência encontrada.')).toBeTruthy();
    });
});
