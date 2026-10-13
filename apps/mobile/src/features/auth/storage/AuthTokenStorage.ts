import type { AuthTokens } from
        '@/src/features/auth/models/AuthTokens';

export interface AuthTokenStorage {
    load(): Promise<AuthTokens | null>;
    save(tokens: AuthTokens): Promise<void>;
    clear(): Promise<void>;
}