import type { TokenResponse } from 'expo-auth-session';

import { mapTokenResponseToAuthTokens } from './mapTokenResponseToAuthTokens';

function createTokenResponse(
    overrides: Partial<TokenResponse> = {},
): TokenResponse {
    return {
        accessToken: 'access-token-123',
        refreshToken: 'refresh-token-123',
        idToken: 'id-token-123',
        expiresIn: 3600,
        issuedAt: 1767268800,
        ...overrides,
    } as unknown as TokenResponse;
}

describe('mapTokenResponseToAuthTokens', () => {
    it('mapeia os tokens e calcula o timestamp de expiração corretamente', () => {
        const tokenResponse = createTokenResponse({
            accessToken: 'novo-access',
            refreshToken: 'novo-refresh',
            idToken: 'novo-id',
            issuedAt: 1767268800,
            expiresIn: 300,
        });

        const resultado = mapTokenResponseToAuthTokens(tokenResponse);

        expect(resultado).toEqual({
            accessToken: 'novo-access',
            refreshToken: 'novo-refresh',
            idToken: 'novo-id',
            expiresAtUnixSeconds: 1767269100,
        });
    });

    it('reutiliza o refresh token anterior quando o servidor não envia um novo', () => {
        const tokenResponse = createTokenResponse({
            refreshToken: undefined,
        });

        const resultado = mapTokenResponseToAuthTokens(
            tokenResponse,
            'refresh-token-anterior',
        );

        expect(resultado.refreshToken).toBe('refresh-token-anterior');
    });

    it('lança erro quando nenhum refresh token está disponível', () => {
        const tokenResponse = createTokenResponse({
            refreshToken: undefined,
        });

        expect(() => mapTokenResponseToAuthTokens(tokenResponse)).toThrow(
            'O servidor de autenticação não retornou um refresh token.',
        );
    });

    it('lança erro quando o servidor não informa o tempo de expiração', () => {
        const tokenResponse = createTokenResponse({
            expiresIn: undefined,
        });

        expect(() => mapTokenResponseToAuthTokens(tokenResponse)).toThrow(
            'O servidor de autenticação não informou a expiração do token.',
        );
    });
});
