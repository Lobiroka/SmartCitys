import { Alert } from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';

import { occurrenceFixture } from
    '@/src/features/occurrences/__tests__/helpers/occurrenceFixture';
import { OccurrenceListScreen } from './OccurrenceListScreen';
import { useOccurrenceListViewModel } from
    '@/src/features/occurrences/viewmodels/useOccurrenceListViewModel';
import { OccurrenceMapView } from '@/src/features/inundation/components/OccurrenceMapView';

const mockPush = jest.fn();

jest.mock('expo-router', () => ({
    router: { push: (...args: unknown[]) => mockPush(...args) },
}));

jest.mock('@/src/features/occurrences/viewmodels/useOccurrenceListViewModel', () => ({
    useOccurrenceListViewModel: jest.fn(),
}));

jest.mock('@/src/features/inundation/viewmodels/useInundationViewModel', () => ({
    useInundationViewModel: () => ({ layer: null, isLoading: false,
        error: 'Camada indisponível', reload: jest.fn() }),
}));

jest.mock('@/src/features/inundation/components/OccurrenceMapView', () => ({
    OccurrenceMapView: jest.fn(() => null),
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
        expect(screen.getByLabelText('Nova ocorrência')).toBeTruthy();
        fireEvent.press(screen.getByTestId('occurrence-create-button'));
        expect(mockPush).toHaveBeenCalledWith('/(tabs)/create-occurrence');

        fireEvent.press(screen.getByTestId('occurrence-edit-1'));
        expect(mockPush).toHaveBeenCalledWith('/(tabs)/edit-occurrence?id=1');
    });

    it('mostra mapa apenas nos registros com coordenadas, sem impedir edição se a camada falhar', async () => {
        const located = occurrenceFixture({ latitude: -8.1197, longitude: -34.9043 });
        const addressOnly = occurrenceFixture({ id: 2, latitude: null, longitude: null });
        useViewModelMock.mockReturnValue(viewModel({
            occurrences: [located, addressOnly],
            filteredOccurrences: [located, addressOnly],
        }) as never);
        const screen = await render(<OccurrenceListScreen />);

        expect(jest.mocked(OccurrenceMapView)).toHaveBeenCalled();
        expect(jest.mocked(OccurrenceMapView).mock.calls.every(([props]) =>
            props.coordinates !== null && props.coordinates.latitude === located.latitude
            && props.coordinates.longitude === located.longitude)).toBe(true);
        expect(jest.mocked(OccurrenceMapView).mock.calls[0][0]).toEqual(expect.objectContaining({
            title: located.title,
            coordinates: { latitude: -8.1197, longitude: -34.9043 },
            error: 'Camada indisponível',
        }));
        fireEvent.press(screen.getByTestId('occurrence-edit-1'));
        expect(mockPush).toHaveBeenCalledWith('/(tabs)/edit-occurrence?id=1');
        expect(screen.getByTestId('occurrence-filter-ALL')).toBeTruthy();
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

    it.each(['EM_ANALISE', 'RESOLVIDA'] as const)(
        'TC-17: não permite editar nem excluir ocorrência %s', async (status) => {
        const resolved = occurrenceFixture({ id: 2, status });
        useViewModelMock.mockReturnValue(viewModel({
            occurrences: [resolved],
            filteredOccurrences: [resolved],
        }) as never);
        const screen = await render(<OccurrenceListScreen />);

        expect(screen.queryByTestId('occurrence-edit-2')).toBeNull();
        expect(screen.queryByTestId('occurrence-delete-2')).toBeNull();
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
