import type { TokenResponse } from 'expo-auth-session';

import type { AuthTokens } from
        '@/src/features/auth/models/AuthTokens';

export function mapTokenResponseToAuthTokens(
    tokenResponse: TokenResponse,
    previousRefreshToken?: string,
): AuthTokens {
    const refreshToken =
        tokenResponse.refreshToken ?? previousRefreshToken;

    if (!refreshToken) {
        throw new Error(
            'O servidor de autenticação não retornou um refresh token.',
        );
    }

    if (tokenResponse.expiresIn === undefined) {
        throw new Error(
            'O servidor de autenticação não informou a expiração do token.',
        );
    }

    return {
        accessToken: tokenResponse.accessToken,
        refreshToken,
        idToken: tokenResponse.idToken,
        expiresAtUnixSeconds:
            tokenResponse.issuedAt + tokenResponse.expiresIn,
    };
}