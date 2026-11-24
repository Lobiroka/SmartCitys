import { act, fireEvent, render } from '@testing-library/react-native';
import type { MapRegion } from '../models/MapRegion';
import { MainMapScreen } from './MainMapScreen';
import { useMainMapViewModel } from '../viewmodels/useMainMapViewModel';
import { useInundationViewModel } from '@/src/features/inundation/viewmodels/useInundationViewModel';

const mockAnimateToRegion = jest.fn();
const location: MapRegion = {
    latitude: -8.1197, longitude: -34.9043,
    latitudeDelta: 0.01, longitudeDelta: 0.01,
};

jest.mock('expo-router', () => {
    const React = jest.requireActual<typeof import('react')>('react');
    return { useFocusEffect: (callback: () => void | (() => void)) => React.useEffect(callback, [callback]) };
});
jest.mock('react-native-safe-area-context', () => ({
    useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('react-native-maps', () => {
    const React = jest.requireActual<typeof import('react')>('react');
    const { View } = jest.requireActual<typeof import('react-native')>('react-native');
    return {
        __esModule: true,
        default: React.forwardRef(function MockMap(props: import('react-native-maps').MapViewProps, ref) {
            React.useImperativeHandle(ref, () => ({ animateToRegion: mockAnimateToRegion }));
            return React.createElement(View, { ...props, testID: 'native-map' });
        }),
        Marker: View,
        Callout: View,
    };
});
jest.mock('@/src/composition/appDependencies', () => ({
    pushNotificationService: { syncPermission: jest.fn().mockResolvedValue(undefined) },
}));
jest.mock('@/src/features/auth/hooks/useAuthSession', () => ({
    useAuthSession: () => ({ session: { status: 'authenticated', user: { name: 'Pessoa Teste' } }, signOut: jest.fn() }),
}));
jest.mock('../viewmodels/useMainMapViewModel', () => ({
    useMainMapViewModel: jest.fn(),
}));
jest.mock('@/src/features/occurrences/viewmodels/useOccurrenceFeedViewModel', () => ({
    useOccurrenceFeedViewModel: () => ({ occurrences: [], occurrenceError: null }),
}));
jest.mock('@/src/features/inundation/viewmodels/useInundationViewModel', () => ({
    useInundationViewModel: jest.fn(),
}));
jest.mock('@/src/features/inundation/components/InundationPolygons', () => ({
    InundationPolygons: () => null,
}));

function mapViewModel(overrides: Partial<ReturnType<typeof useMainMapViewModel>> = {}) {
    return {
        region: location,
        isLoading: false, locationError: null, loadLocation: jest.fn(),
        isPermissionBlocked: false, isLocationPermissionResolved: true,
        isProfileMenuOpen: false, toggleProfileMenu: jest.fn(),
        ...overrides,
    };
}

beforeEach(() => {
    jest.mocked(useMainMapViewModel).mockReturnValue(mapViewModel());
    jest.mocked(useInundationViewModel).mockReturnValue({
        layer: { source: 'SGB', items: [] }, isLoading: false, error: null, reload: jest.fn(),
    });
});

it('centraliza no GPS recuperado após sair da visão Recife e tentar localizar novamente', async () => {
    const retryLocation = jest.fn();
    jest.mocked(useMainMapViewModel).mockReturnValue(mapViewModel({
        locationError: 'Não foi possível acompanhar sua localização.',
        loadLocation: retryLocation,
    }));
    const screen = await render(<MainMapScreen />);
    fireEvent.press(screen.getByText('Ver Recife'));
    expect(screen.getByTestId('native-map').props.region).toEqual(expect.objectContaining({
        latitude: -8.0631, longitude: -34.8711,
    }));

    fireEvent.press(screen.getByLabelText('Centralizar na minha localização'));
    expect(retryLocation).toHaveBeenCalledTimes(1);

    const recoveredLocation = { ...location, latitude: -8.05, longitude: -34.88 };
    jest.mocked(useMainMapViewModel).mockReturnValue(mapViewModel({ region: recoveredLocation }));
    await screen.rerender(<MainMapScreen />);

    expect(screen.getByTestId('native-map').props.region).toEqual(recoveredLocation);
});

it('mantém o sinal de mapa carregado para Maestro e permite Recife e recentralização', async () => {
    const screen = await render(<MainMapScreen />);
    expect(screen.getByTestId('main-map-loading')).toBeTruthy();
    act(() => {
        fireEvent(screen.getByTestId('native-map'), 'mapLoaded');
        fireEvent(screen.getByTestId('native-map'), 'regionChangeComplete', location);
    });
    expect(screen.getByTestId('main-map-loaded')).toBeTruthy();

    fireEvent.press(screen.getByText('Ver Recife'));
    expect(mockAnimateToRegion).toHaveBeenLastCalledWith(expect.objectContaining({
        latitude: -8.0631, longitude: -34.8711, latitudeDelta: 0.15,
    }));
    fireEvent.press(screen.getByLabelText('Centralizar na minha localização'));
    expect(mockAnimateToRegion).toHaveBeenLastCalledWith(location);
    expect(screen.getByLabelText('Menu do Perfil')).toBeTruthy();
});

it('mantém o mapa e os controles disponíveis se a consulta SGB falhar', async () => {
    jest.mocked(useInundationViewModel).mockReturnValue({
        layer: null, isLoading: false,
        error: 'Camada SGB indisponível. O cadastro continua disponível.', reload: jest.fn(),
    });
    const screen = await render(<MainMapScreen />);

    expect(screen.getByTestId('native-map')).toBeTruthy();
    expect(screen.getByText(/Camada SGB indisponível/)).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Centralizar na minha localização'));
    expect(mockAnimateToRegion).toHaveBeenLastCalledWith(location);
});
