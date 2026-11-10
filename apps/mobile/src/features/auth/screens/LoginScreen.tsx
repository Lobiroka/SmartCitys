import {
    ActivityIndicator,
    StyleSheet,
    Pressable,
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

            <Pressable
                style={({ pressed }) => [
                    styles.button,
                    { opacity: pressed ? 0.7 : 1 },
                ]}
                disabled={isLoading}
                accessibilityState={{ disabled: isLoading, busy: isLoading }}
                testID="login-button"
                accessibilityRole="button"
                onPress={() => void signIn()}
            >
                {isLoading ? (
                    <ActivityIndicator color="#fff" />
                ) : (
                    <ThemedText lightColor="#fff" darkColor="#fff">
                        Entrar
                    </ThemedText>
                )}
            </Pressable>

            <Pressable
                style={({ pressed }) => [styles.registerButton, { opacity: pressed ? 0.7 : 1 }]}
                disabled={isLoading}
                accessibilityState={{ disabled: isLoading }}
                accessibilityRole="button"
                onPress={() => void signIn('register')}
            >
                <ThemedText type="defaultSemiBold" lightColor="#1d4ed8" darkColor="#93c5fd">
                    Criar conta
                </ThemedText>
            </Pressable>

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
        fontSize: 32,
        textAlign: 'center',
        fontWeight: 'bold',
        lineHeight: 40,
    },
    description: {
        fontSize: 16,
        textAlign: 'center',
    },
    error: {
        color: '#b00020',
    },
    registerButton: {
        minHeight: 48,
        alignItems: 'center',
        justifyContent: 'center',
    },
    button: {
        paddingVertical: 14,
        alignItems: 'center',
        borderRadius: 12,
        backgroundColor: '#2563eb',
        minHeight: 52,
        justifyContent: 'center',
    },
});
