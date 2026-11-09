import {
    fetchUserInfoAsync,
    type DiscoveryDocument,
} from 'expo-auth-session';

import type { AuthSession } from
        '@/src/features/auth/models/AuthSession';
import { mapUserInfoToAuthSession } from
        '@/src/features/auth/services/keycloak/mapUserInfoToAuthSession';

import { hasManagerRole } from
    '@/src/features/auth/services/keycloak/hasManagerRole';

export async function fetchAuthenticatedSession(
    accessToken: string,
    discovery: DiscoveryDocument,
): Promise<AuthSession> {
    const userInfo = await fetchUserInfoAsync(
        { accessToken },
        discovery,
    );

    const session = mapUserInfoToAuthSession(userInfo);
    if (session.status === 'authenticated' && hasManagerRole(accessToken)) {
        return { ...session, user: { ...session.user, isManager: true } };
    }

    return session;
}