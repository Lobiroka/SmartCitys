import { Text, View, Button,Linking,Alert,Pressable } from 'react-native';
import MapView, { Callout, Marker } from 'react-native-maps';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useAuthSession } from
    '@/src/features/auth/hooks/useAuthSession';
import { useMainMapViewModel } from '../viewmodels/useMainMapViewModel';
import {styles} from "@/src/features/map/styles/MainMapScreen.styles";
import { useOccurrenceFeedViewModel } from
    '@/src/features/occurrences/viewmodels/useOccurrenceFeedViewModel';
import {
    occurrenceCategories,
    occurrenceLabel,
    occurrenceStatuses,
} from '@/src/features/occurrences/models/occurrenceOptions';

export function MainMapScreen() {
    const { region,
        isLoading,
        locationError,
        loadLocation,
        isPermissionBlocked,
        isProfileMenuOpen,
        toggleProfileMenu
    } = useMainMapViewModel();

    const { session, signOut } = useAuthSession();
    const { occurrences, occurrenceError } = useOccurrenceFeedViewModel();

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
        <View style={styles.container}>
            <MapView
                style={styles.map}
                region={region}
                showsUserLocation
                onPress={() => {
                    if (isProfileMenuOpen) {
                        toggleProfileMenu();
                    }
                }}
            >
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
                <ThemedView style={styles.sessionBox}>
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
                        </Pressable>)}
                </ThemedView>
            )}

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

            {occurrenceError && !locationError && (
                <View style={styles.occurrenceErrorBox}>
                    <Text>{occurrenceError}</Text>
                </View>
            )}
        </View>
    );
}


