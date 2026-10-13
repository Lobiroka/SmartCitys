import {
    fetchUserInfoAsync,
    type DiscoveryDocument,
} from 'expo-auth-session';

import type { AuthSession } from
        '@/src/features/auth/models/AuthSession';
import { mapUserInfoToAuthSession } from
        '@/src/features/auth/services/keycloak/mapUserInfoToAuthSession';

export async function fetchAuthenticatedSession(
    accessToken: string,
    discovery: DiscoveryDocument,
): Promise<AuthSession> {
    const userInfo = await fetchUserInfoAsync(
        { accessToken },
        discovery,
    );

    return mapUserInfoToAuthSession(userInfo);
}