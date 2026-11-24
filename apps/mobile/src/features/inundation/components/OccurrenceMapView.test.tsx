import { fireEvent, render } from '@testing-library/react-native';
import { OccurrenceMapView } from './OccurrenceMapView';

jest.mock('react-native-maps', () => {
    const React = jest.requireActual<typeof import('react')>('react');
    const { View } = jest.requireActual<typeof import('react-native')>('react-native');
    return {
        __esModule: true,
        default: (props: import('react-native-maps').MapViewProps) => React.createElement(View, props),
        Marker: (props: import('react-native-maps').MapMarkerProps) => React.createElement(View, props),
    };
});
jest.mock('./InundationPolygons', () => ({ InundationPolygons: () => null }));

it('permite ver Recife sem alterar a posição registrada no marcador', async () => {
    const coordinates = { latitude: -8.1197, longitude: -34.9043 };
    const screen = await render(<OccurrenceMapView coordinates={coordinates}
        title="Problema registrado" layer={{ source: 'SGB', items: [] }} />);

    expect(screen.getByTestId('occurrence-map').props.region).toEqual(expect.objectContaining(coordinates));
    fireEvent.press(screen.getByText('Ver Recife'));
    expect(screen.getByTestId('occurrence-map').props.region).toEqual(expect.objectContaining({
        latitude: -8.0631, longitude: -34.8711, latitudeDelta: 0.15,
    }));
    expect(screen.getByTestId('occurrence-map-marker').props.coordinate).toEqual(coordinates);
});

it('mantém a localização registrada disponível quando a camada SGB está indisponível', async () => {
    const screen = await render(<OccurrenceMapView coordinates={{ latitude: -8.1, longitude: -34.9 }}
        layer={null} error="Camada SGB indisponível" />);

    expect(screen.getByTestId('occurrence-map-marker')).toBeTruthy();
    expect(screen.getByText('Camada SGB indisponível')).toBeTruthy();
});
