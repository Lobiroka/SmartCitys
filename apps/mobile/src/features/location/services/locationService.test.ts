import * as Location from 'expo-location';

import {
    getCurrentCoordinates,
    LocationPermissionError,
    watchCoordinates,
} from './locationService';

jest.mock('expo-location', () => ({
    Accuracy: { High: 4 },
    PermissionStatus: jest.requireActual('expo').PermissionStatus,
    getForegroundPermissionsAsync: jest.fn(),
    requestForegroundPermissionsAsync: jest.fn(),
    watchPositionAsync: jest.fn(),
    getCurrentPositionAsync: jest.fn(),
}));

function createPermission(
    overrides: Partial<Location.LocationPermissionResponse> = {},
): Location.LocationPermissionResponse {
    return {
        status: Location.PermissionStatus.GRANTED,
        granted: true,
        canAskAgain: true,
        expires: 'never',
        ...overrides,
    };
}

function createLocationObject(
    latitude: number,
    longitude: number,
): Location.LocationObject {
    return {
        coords: {
            latitude,
            longitude,
            altitude: null,
            accuracy: 5,
            altitudeAccuracy: null,
            heading: null,
            speed: null,
        },
        timestamp: 1767268800000,
    };
}

describe('locationService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('inicia o monitoramento sem pedir permissão novamente quando já concedida', async () => {
        const subscription = { remove: jest.fn() };
        const onUpdate = jest.fn();
        const onError = jest.fn();

        jest.mocked(Location.getForegroundPermissionsAsync).mockResolvedValue(
            createPermission({ granted: true }),
        );
        jest.mocked(Location.watchPositionAsync).mockImplementation(
            async (_options, callback) => {
                callback(createLocationObject(-8.0578, -34.8829));
                return subscription;
            },
        );

        const result = await watchCoordinates(onUpdate, onError);

        expect(Location.requestForegroundPermissionsAsync).not.toHaveBeenCalled();
        expect(Location.watchPositionAsync).toHaveBeenCalledWith(
            {
                accuracy: Location.Accuracy.High,
                distanceInterval: 10,
                mayShowUserSettingsDialog: false,
            },
            expect.any(Function),
            onError,
        );
        expect(onUpdate).toHaveBeenCalledWith({
            latitude: -8.0578,
            longitude: -34.8829,
        });
        expect(result).toBe(subscription);
    });

    it('solicita permissão ao monitorar e lança LocationPermissionError se continuar negada', async () => {
        jest.mocked(Location.getForegroundPermissionsAsync).mockResolvedValue(
            createPermission({
                status: Location.PermissionStatus.DENIED,
                granted: false,
                canAskAgain: true,
            }),
        );
        jest.mocked(Location.requestForegroundPermissionsAsync).mockResolvedValue(
            createPermission({
                status: Location.PermissionStatus.DENIED,
                granted: false,
                canAskAgain: false,
            }),
        );

        const promise = watchCoordinates(jest.fn(), jest.fn());

        await expect(promise).rejects.toBeInstanceOf(LocationPermissionError);
        await expect(promise).rejects.toMatchObject({
            name: 'LocationPermissionError',
            canAskAgain: false,
        });
        expect(Location.requestForegroundPermissionsAsync).toHaveBeenCalledTimes(1);
        expect(Location.watchPositionAsync).not.toHaveBeenCalled();
    });

    it('retorna as coordenadas atuais quando a permissão é concedida', async () => {
        jest.mocked(Location.requestForegroundPermissionsAsync).mockResolvedValue(
            createPermission({ status: Location.PermissionStatus.GRANTED, granted: true }),
        );
        jest.mocked(Location.getCurrentPositionAsync).mockResolvedValue(
            createLocationObject(-8.119, -34.894),
        );

        const coords = await getCurrentCoordinates();

        expect(Location.getCurrentPositionAsync).toHaveBeenCalledWith({
            accuracy: Location.Accuracy.High,
        });
        expect(coords).toEqual({
            latitude: -8.119,
            longitude: -34.894,
        });
    });

    it('lança LocationPermissionError ao buscar posição atual sem permissão', async () => {
        jest.mocked(Location.requestForegroundPermissionsAsync).mockResolvedValue(
            createPermission({
                status: Location.PermissionStatus.DENIED,
                granted: false,
                canAskAgain: true,
            }),
        );

        const promise = getCurrentCoordinates();

        await expect(promise).rejects.toBeInstanceOf(LocationPermissionError);
        await expect(promise).rejects.toMatchObject({
            canAskAgain: true,
        });
        expect(Location.getCurrentPositionAsync).not.toHaveBeenCalled();
    });
});
