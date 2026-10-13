import type { AuthSession } from
        '@/src/features/auth/models/AuthSession';

type KeycloakUserInfo = {
    sub?: unknown;
    name?: unknown;
    email?: unknown;
};

export function mapUserInfoToAuthSession(
    userInfo: KeycloakUserInfo,
): AuthSession {
    if (typeof userInfo.sub !== 'string') {
        throw new Error(
            'O Keycloak não retornou um identificador de usuário válido.',
        );
    }

    return {
        status: 'authenticated',
        user: {
            id: userInfo.sub,
            name:
                typeof userInfo.name === 'string'
                    ? userInfo.name
                    : undefined,
            email:
                typeof userInfo.email === 'string'
                    ? userInfo.email
                    : undefined,
        },
    };
}