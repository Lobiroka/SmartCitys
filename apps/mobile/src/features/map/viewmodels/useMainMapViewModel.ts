import {useCallback, useState,useRef} from "react";
import { useFocusEffect } from "expo-router";
import {watchCoordinates, LocationPermissionError} from "@/src/features/location/services/locationService";
import {MapRegion} from "@/src/features/map/models/MapRegion";

import { AppState } from 'react-native';


const DEFAULT_REGION: MapRegion = {
    latitude: -8.047562,
    longitude: -34.877002,
    latitudeDelta: 0.05,
    longitudeDelta: 0.05,
};

export function useMainMapViewModel(){
    
    const [region, setRegion] = useState<MapRegion>(DEFAULT_REGION);
    const [isLoading, setIsLoading] = useState(true);
    const[locationError, setLocationError] = useState<string|null>(null);
    const [isPermissionBlocked, setIsPermissionBlocked] = useState(false);
    const locationSubscriptionRef = useRef<{
        remove: () => void; } | null>(null);
    const locationRequestIdRef = useRef(0);

    const stopLocationTracking = useCallback(() => {
        locationRequestIdRef.current += 1;

        locationSubscriptionRef.current?.remove();
        locationSubscriptionRef.current = null;
    }, []);

    const loadLocation = useCallback(async () => {
        stopLocationTracking();
        const requestId = locationRequestIdRef.current;
        setIsLoading(true);
        setLocationError(null);
        setIsPermissionBlocked(false);

        try {
            const subscription = await watchCoordinates(
                (coordinates) => {
                    if (requestId !== locationRequestIdRef.current) {
                        return;
                    }

                    setRegion({
                        latitude: coordinates.latitude,
                        longitude: coordinates.longitude,
                        latitudeDelta: 0.01,
                        longitudeDelta: 0.01,
                    });

                    setIsLoading(false);
                },
                () => {
                    if (requestId !== locationRequestIdRef.current) {
                        return;
                    }

                    setLocationError(
                        "Não foi possível acompanhar sua localização."
                    );
                    setIsLoading(false);
                    stopLocationTracking();
                }
            );

            if (requestId !== locationRequestIdRef.current) {
                subscription.remove();
                return;
            }

            locationSubscriptionRef.current = subscription;
        } catch (error) {
            if (requestId !== locationRequestIdRef.current) {
                return;
            }

            if (error instanceof LocationPermissionError) {
                const isBlocked = !error.canAskAgain;

                setIsPermissionBlocked(isBlocked);

                if (isBlocked) {
                    setLocationError(
                        "Permita o acesso à localização nas configurações do aplicativo."
                    );
                } else {
                    setLocationError(
                        "A permissão de localização não foi concedida."
                    );
                }
            } else {
                setLocationError(
                    "Não foi possível iniciar o acompanhamento da localização."
                );
            }

            setIsLoading(false);
            stopLocationTracking();
        }
    }, [stopLocationTracking]);


    useFocusEffect(
        useCallback(() => {
            let shouldStartOnActive =
                AppState.currentState !== 'active';

            if (AppState.currentState === 'active') {
                loadLocation();
            }

            const subscription = AppState.addEventListener(
                'change',
                (nextAppState) => {
                    if (nextAppState === 'background') {
                        shouldStartOnActive = true;
                        stopLocationTracking();
                    } else if (
                        nextAppState === 'active' &&
                        shouldStartOnActive
                    ) {
                        shouldStartOnActive = false;
                        loadLocation();
                    }
                }
            );

            return () => {
                subscription.remove();
                stopLocationTracking();
            };
        }, [loadLocation, stopLocationTracking])
    );

    return {
        region,
        isLoading,
        locationError,
        isPermissionBlocked,
        loadLocation,
    };
}
