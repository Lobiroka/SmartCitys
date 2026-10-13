import type { AuthTokens } from
        '@/src/features/auth/models/AuthTokens';

const EXPIRATION_MARGIN_SECONDS = 60;

export function isAccessTokenFresh(
    tokens: AuthTokens,
): boolean {
    const currentUnixSeconds = Math.floor(Date.now() / 1000);

    return (
        tokens.expiresAtUnixSeconds >
        currentUnixSeconds + EXPIRATION_MARGIN_SECONDS
    );
}