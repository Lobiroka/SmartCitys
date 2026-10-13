import * as Location from 'expo-location';

export class LocationPermissionError extends Error {
    readonly  canAskAgain: boolean;
    constructor(canAskAgain: boolean) {
        super('Location permission not granted');
        this.name = 'LocationPermissionError';
        this.canAskAgain = canAskAgain;
    }
}

export async function watchCoordinates(
    onUpdate: (coordinates: {
        latitude: number;
        longitude: number;
    }) => void,
    onError: (message: string) => void
) {
    const permission =
        await Location.requestForegroundPermissionsAsync();

    if (permission.status !== 'granted') {
        throw new LocationPermissionError(permission.canAskAgain);
    }

    return Location.watchPositionAsync(
        {
            accuracy: Location.Accuracy.High,
            distanceInterval: 10,
        },
        (location) => {
            onUpdate({
                latitude: location.coords.latitude,
                longitude: location.coords.longitude,
            });
        },
        onError
    );
}

export async function getCurrentCoordinates(): Promise<{
    latitude: number;
    longitude: number;
}> {
    const permission =
        await Location.requestForegroundPermissionsAsync();

    if (permission.status !== 'granted') {
        throw new LocationPermissionError(permission.canAskAgain);
    }

    const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
    });

    return {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
    };
}
