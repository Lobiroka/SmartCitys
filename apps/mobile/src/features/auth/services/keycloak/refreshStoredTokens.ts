import {
    refreshAsync,
    type DiscoveryDocument,
} from 'expo-auth-session';

import type { AuthTokens } from
        '@/src/features/auth/models/AuthTokens';
import type { AuthTokenStorage } from
        '@/src/features/auth/storage/AuthTokenStorage';
import { mapTokenResponseToAuthTokens } from
        '@/src/features/auth/services/keycloak/mapTokenResponseToAuthTokens';

export async function refreshStoredTokens(
    currentTokens: AuthTokens,
    clientId: string,
    discovery: DiscoveryDocument,
    storage: AuthTokenStorage,
): Promise<AuthTokens> {
    const tokenResponse = await refreshAsync(
        {
            clientId,
            refreshToken: currentTokens.refreshToken,
        },
        discovery,
    );

    const refreshedTokens = mapTokenResponseToAuthTokens(
        tokenResponse,
        currentTokens.refreshToken,
    );

    await storage.save(refreshedTokens);

    return refreshedTokens;
}