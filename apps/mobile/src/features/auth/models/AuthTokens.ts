export type AuthTokens = {
    accessToken: string;
    refreshToken: string;
    idToken?: string;
    expiresAtUnixSeconds: number;
};