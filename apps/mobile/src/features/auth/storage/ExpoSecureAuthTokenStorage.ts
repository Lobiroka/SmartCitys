import * as SecureStore from 'expo-secure-store';

import type { AuthTokens } from
        '@/src/features/auth/models/AuthTokens';
import type { AuthTokenStorage } from
        '@/src/features/auth/storage/AuthTokenStorage';

const STORAGE_KEY = 'auth.tokens';

export class ExpoSecureAuthTokenStorage implements AuthTokenStorage {
    async load(): Promise<AuthTokens | null> {
        const storedTokens = await SecureStore.getItemAsync(STORAGE_KEY);

        if (!storedTokens) {
            return null;
        }

        return JSON.parse(storedTokens) as AuthTokens;
    }

    async save(tokens: AuthTokens): Promise<void> {
        await SecureStore.setItemAsync(
            STORAGE_KEY,
            JSON.stringify(tokens),
        );
    }

    async clear(): Promise<void> {
        await SecureStore.deleteItemAsync(STORAGE_KEY);
    }
}