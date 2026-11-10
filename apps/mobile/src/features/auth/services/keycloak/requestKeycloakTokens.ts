import {
    AuthRequest,
    exchangeCodeAsync,
    makeRedirectUri,
    ResponseType,
    type DiscoveryDocument,
} from 'expo-auth-session';

import type { AuthIntent } from '@/src/features/auth/services/AuthSessionService';
import type { AuthTokens } from
        '@/src/features/auth/models/AuthTokens';
import { mapTokenResponseToAuthTokens } from
        '@/src/features/auth/services/keycloak/mapTokenResponseToAuthTokens';

export async function requestKeycloakTokens(
    clientId: string,
    redirectScheme: string,
    discovery: DiscoveryDocument,
    intent: AuthIntent = 'login',
): Promise<AuthTokens | null> {
    const redirectUri = makeRedirectUri({
        scheme: redirectScheme,
        path:'auth/callback',
    });

    const request = new AuthRequest({
        clientId,
        redirectUri,
        responseType: ResponseType.Code,
        scopes: ['openid', 'profile', 'email'],
        usePKCE: true,
        ...(intent === 'register' ? { extraParams: { prompt: 'create' } } : {}),
    });

    const result = await request.promptAsync(discovery);

    if (result.type !== 'success') {
        return null;
    }

    const code = result.params.code;
    const codeVerifier = request.codeVerifier;

    if (!code || !codeVerifier) {
        throw new Error(
            'O fluxo de autenticação não retornou os dados esperados.',
        );
    }

    const tokenResponse = await exchangeCodeAsync(
        {
            clientId,
            code,
            redirectUri,
            extraParams: {
                code_verifier: codeVerifier,
            },
        },
        discovery,
    );

    return mapTokenResponseToAuthTokens(tokenResponse);
}