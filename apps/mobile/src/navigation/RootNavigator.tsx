import { Stack } from 'expo-router';
import {
    ActivityIndicator,
    StyleSheet,
    View,
} from 'react-native';

import { useAuthSession } from
        '@/src/features/auth/hooks/useAuthSession';

export function RootNavigator() {
    const { session } = useAuthSession();

    if (session.status === 'loading') {
        return (
            <View style={styles.loading}>
                <ActivityIndicator />
            </View>
        );
    }

    const isAuthenticated =
        session.status === 'authenticated';

    return (
        <Stack>
            <Stack.Protected guard={!isAuthenticated}>
                <Stack.Screen
                    name="(auth)"
                    options={{ headerShown: false }}
                />
            </Stack.Protected>

            <Stack.Protected guard={isAuthenticated}>
                <Stack.Screen
                    name="(tabs)"
                    options={{ headerShown: false }}
                />
                <Stack.Screen
                    name="modal"
                    options={{
                        presentation: 'modal',
                        title: 'Modal',
                    }}
                />
            </Stack.Protected>
        </Stack>
    );
}

const styles = StyleSheet.create({
    loading: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
});