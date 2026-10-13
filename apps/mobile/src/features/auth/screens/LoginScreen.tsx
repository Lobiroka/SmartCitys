import {
    ActivityIndicator,
    Button,
    StyleSheet,
} from 'react-native';
import { ThemedText } from
        '@/components/themed-text';
import { ThemedView } from
        '@/components/themed-view';

import { useAuthSession } from
        '@/src/features/auth/hooks/useAuthSession';

export function LoginScreen() {
    const { session, signIn } = useAuthSession();

    const isLoading = session.status === 'loading';

    return (
        <ThemedView style={styles.container}>
            <ThemedText style={styles.title}>Smart City</ThemedText>

            <ThemedText style={styles.description}>
                Entre para registrar e acompanhar denúncias.
            </ThemedText>

            {isLoading ? (
                <ActivityIndicator />
            ) : (
                <Button
                    testID="login-button"
                    title="Entrar"
                    onPress={signIn}
                />
            )}

            {session.status === 'error' && (
                <ThemedText style={styles.error}>
                    {session.message}
                </ThemedText>
            )}
        </ThemedView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        padding: 24,
        gap: 16,
    },
    title: {
        fontSize: 28,
        fontWeight: 'bold',
    },
    description: {
        fontSize: 16,
    },
    error: {
        color: '#b00020',
    },
});
