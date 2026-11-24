import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { pushNotificationService } from '@/src/composition/appDependencies';
import { Alert, AppState, Button, Linking, Pressable, Text, View } from 'react-native';
import MapView, { Callout, Marker } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useAuthSession } from
    '@/src/features/auth/hooks/useAuthSession';
import { useMainMapViewModel } from '../viewmodels/useMainMapViewModel';
import {styles} from "@/src/features/map/styles/MainMapScreen.styles";
import { useOccurrenceFeedViewModel } from
    '@/src/features/occurrences/viewmodels/useOccurrenceFeedViewModel';
import { useInundationViewModel } from '@/src/features/inundation/viewmodels/useInundationViewModel';
import { InundationPolygons } from '@/src/features/inundation/components/InundationPolygons';
import { InundationLegend } from '@/src/features/inundation/components/InundationLegend';
import type { MapRegion } from '../models/MapRegion';
import {
    occurrenceCategories,
    occurrenceLabel,
    occurrenceStatuses,
} from '@/src/features/occurrences/models/occurrenceOptions';

const RECIFE_REGION: MapRegion = {
    latitude: -8.0631,
    longitude: -34.8711,
    latitudeDelta: 0.15,
    longitudeDelta: 0.15,
};

export function MainMapScreen() {
    const { region,
        isLoading,
        locationError,
        loadLocation,
        isPermissionBlocked,
        isLocationPermissionResolved,
        isProfileMenuOpen,
        toggleProfileMenu
    } = useMainMapViewModel();

    const { session, signOut } = useAuthSession();
    const { occurrences, occurrenceError } = useOccurrenceFeedViewModel();
    const inundation = useInundationViewModel();
    const [showInundation, setShowInundation] = useState(true);
    const [overviewRegion, setOverviewRegion] = useState<MapRegion | null>(null);
    const [visibleRegion, setVisibleRegion] = useState<MapRegion | null>(null);
    const mapRef = useRef<MapView>(null);
    const [hasMapLoaded, setHasMapLoaded] = useState(false);
    const [hasMapSettled, setHasMapSettled] = useState(false);
    const controlsTop = Math.max(48, useSafeAreaInsets().top + 12);
    const isAuthenticated = session.status === 'authenticated';

    useFocusEffect(useCallback(() => {
        if (!isAuthenticated || !isLocationPermissionResolved) return;

        function syncNotifications() {
            void pushNotificationService.syncPermission().catch(() => {
                if (__DEV__) console.warn('Não foi possível sincronizar as notificações.');
            });
        }

        if (AppState.currentState === 'active') syncNotifications();

        const subscription = AppState.addEventListener('change', (state) => {
            if (state === 'active') syncNotifications();
        });
        return () => subscription.remove();
    }, [isAuthenticated, isLocationPermissionResolved]));

    async function handleOpenSettings() {
        try {
            await Linking.openSettings();
        } catch {
            Alert.alert(
                "Não foi possível abrir as configurações",
                "Abra as configurações do celular e permita o acesso à localização."
            );
        }
    }

    return (
        <View style={styles.container}
            testID={hasMapLoaded && hasMapSettled && !isLoading && !locationError
                ? 'main-map-loaded' : 'main-map-loading'}>
            <MapView
                ref={mapRef}
                style={styles.map}
                region={overviewRegion ?? region}
                showsUserLocation
                showsMyLocationButton={false}
                onMapLoaded={() => setHasMapLoaded(true)}
                onRegionChange={() => setHasMapSettled(false)}
                onRegionChangeComplete={(nextRegion) => {
                    setHasMapSettled(true);
                    setVisibleRegion(nextRegion);
                }}
                onPress={() => {
                    if (isProfileMenuOpen) {
                        toggleProfileMenu();
                    }
                }}
            >
                {showInundation && (
                    <InundationPolygons layer={inundation.layer}
                        region={visibleRegion ?? overviewRegion ?? region} />
                )}
                {occurrences.map((occurrence) => {
                    if (occurrence.latitude === null || occurrence.longitude === null) {
                        return null;
                    }

                    return (
                        <Marker
                            key={occurrence.id}
                            coordinate={{
                                latitude: occurrence.latitude,
                                longitude: occurrence.longitude,
                            }}
                            title={occurrence.title}
                            description={occurrence.address}>
                            <Callout>
                                <View style={styles.callout}>
                                    <Text style={styles.calloutTitle}>{occurrence.title}</Text>
                                    <Text>{occurrenceLabel(occurrenceCategories, occurrence.category)}</Text>
                                    <Text>{occurrenceLabel(occurrenceStatuses, occurrence.status)}</Text>
                                    <Text>{occurrence.address}</Text>
                                </View>
                            </Callout>
                        </Marker>
                    );
                })}
            </MapView>

            {session.status === 'authenticated' && (
                <ThemedView style={[styles.sessionBox, { top: controlsTop }]}>
                    <Pressable style={styles.avatarButton}
                        onPress={ toggleProfileMenu }
                        accessibilityRole="button"
                        accessibilityLabel="Menu do Perfil"
                        accessibilityState={{expanded:isProfileMenuOpen}}
                    >
                        <ThemedText
                            lightColor="#fff"
                            darkColor="#fff"
                            type="defaultSemiBold"
                        >
                            {(session.user.name?.trim() || session.user.email || '?')
                                .charAt(0)
                                .toUpperCase()}
                        </ThemedText>
                </Pressable>

                    {isProfileMenuOpen && (
                        <Pressable
                            style={({ pressed }) => [
                                styles.profileMenuItem,
                                { opacity: pressed ? 0.6 : 1 },
                            ]}
                            accessibilityRole="button"
                            onPress={signOut}
                        >
                            <ThemedText>Sair</ThemedText>
                        </Pressable>
                    )}
                </ThemedView>
            )}

            <Pressable
                style={({ pressed }) => [
                    styles.recenterButton,
                    { top: controlsTop, opacity: isLoading || pressed ? 0.6 : 1 },
                ]}
                accessibilityRole="button"
                accessibilityLabel="Centralizar na minha localização"
                accessibilityState={{ disabled: isLoading }}
                disabled={isLoading}
                onPress={() => {
                    setOverviewRegion(null);
                    if (locationError) {
                        void (isPermissionBlocked ? handleOpenSettings() : loadLocation());
                        return;
                    }
                    mapRef.current?.animateToRegion(region);
                }}
            >
                <MaterialIcons name="my-location" size={24} color="#2563eb" />
            </Pressable>

            <Pressable
                testID="main-map-recife-button"
                style={[styles.overviewButton, { top: controlsTop + 60 }]}
                accessibilityRole="button"
                onPress={() => {
                    setOverviewRegion(RECIFE_REGION);
                    setVisibleRegion(RECIFE_REGION);
                    mapRef.current?.animateToRegion(RECIFE_REGION);
                }}
            >
                <Text style={styles.overviewButtonText}>Ver Recife</Text>
            </Pressable>

            {isLoading && (
                <View style={styles.messageBox}>
                    <Text>Buscando localização...</Text>
                </View>
            )}

            {locationError && (
                <View style={styles.messageBox}>
                    <Text>{locationError}</Text>
                    <Button
                        title={
                        isPermissionBlocked
                        ?"Abrir configurações" :"Tentar novamente"
                    }
                            onPress={
                                isPermissionBlocked
                                    ? handleOpenSettings : loadLocation
                            }
                            disabled={isLoading}
                    />
                </View>
            )}

            <View pointerEvents="box-none" style={styles.layerControls}>
                {occurrenceError && !locationError && (
                    <View style={styles.layerOccurrenceError}>
                        <Text>{occurrenceError}</Text>
                    </View>
                )}
                <InundationLegend {...inundation}
                    enabled={showInundation} onChange={setShowInundation} />
            </View>
        </View>
    );
}


