import {
    fetchDiscoveryAsync,
    revokeAsync,
    TokenTypeHint,
    type DiscoveryDocument,
} from 'expo-auth-session';

import { keycloakConfig } from
        '@/src/features/auth/config/keycloakConfig';
import type { AuthSession } from
        '@/src/features/auth/models/AuthSession';
import type { AuthTokens } from
        '@/src/features/auth/models/AuthTokens';
import type { AuthIntent, AuthSessionService } from
        '@/src/features/auth/services/AuthSessionService';
import { fetchAuthenticatedSession } from
        '@/src/features/auth/services/keycloak/fetchAuthenticatedSession';
import { isAccessTokenFresh } from
        '@/src/features/auth/services/keycloak/isAccessTokenFresh';
import { refreshStoredTokens } from
        '@/src/features/auth/services/keycloak/refreshStoredTokens';
import { requestKeycloakTokens } from
        '@/src/features/auth/services/keycloak/requestKeycloakTokens';
import type { AuthTokenStorage } from
        '@/src/features/auth/storage/AuthTokenStorage';
import type { AccessTokenProvider } from
        '@/src/features/auth/services/AccessTokenProvider';

export class KeycloakAuthSessionService
    implements AuthSessionService, AccessTokenProvider
{
    private discovery?: DiscoveryDocument;
    private currentTokensPromise?: Promise<AuthTokens | null>;
    private signOutPromise?: Promise<void>;

    constructor(
        private readonly storage: AuthTokenStorage,
    ) {}

    async getValidAccessToken(): Promise<string> {
        const currentTokens = await this.getCurrentTokens();

        if (!currentTokens) {
            throw new Error('Não existe uma sessão autenticada.');
        }

        return currentTokens.accessToken;
    }

    async restoreSession(): Promise<AuthSession> {
        const currentTokens = await this.getCurrentTokens();

        if (!currentTokens) {
            return { status: 'anonymous' };
        }

        const discovery = await this.getDiscovery();

        return fetchAuthenticatedSession(
            currentTokens.accessToken,
            discovery,
        );
    }

    private getCurrentTokens(): Promise<AuthTokens | null> {
        if (this.signOutPromise) {
            return Promise.resolve(null);
        }

        // Compartilhar também a leitura evita renovar um snapshot antigo.
        this.currentTokensPromise ??= this.loadCurrentTokens().finally(() => {
            this.currentTokensPromise = undefined;
        });

        return this.currentTokensPromise;
    }

    private async loadCurrentTokens(): Promise<AuthTokens | null> {
        const storedTokens = await this.storage.load();

        if (!storedTokens || isAccessTokenFresh(storedTokens)) {
            return storedTokens;
        }

        const discovery = await this.getDiscovery();

        return refreshStoredTokens(
            storedTokens,
            keycloakConfig.clientId,
            discovery,
            this.storage,
        );
    }

    async signIn(intent: AuthIntent = 'login'): Promise<AuthSession> {
        const discovery = await this.getDiscovery();

        const tokens = await requestKeycloakTokens(
            keycloakConfig.clientId,
            keycloakConfig.redirectScheme,
            discovery,
            intent,
        );

        if (!tokens) {
            return { status: 'anonymous' };
        }

        await this.storage.save(tokens);

        return fetchAuthenticatedSession(
            tokens.accessToken,
            discovery,
        );
    }

    signOut(): Promise<void> {
        this.signOutPromise ??= this.performSignOut().finally(() => {
            this.signOutPromise = undefined;
        });

        return this.signOutPromise;
    }

    private async performSignOut(): Promise<void> {
        // A renovação precisa terminar antes de limpar o armazenamento.
        await this.currentTokensPromise?.catch(() => undefined);
        const storedTokens = await this.storage.load();

        try {
            if (storedTokens) {
                const discovery = await this.getDiscovery();

                if (discovery.revocationEndpoint) {
                    await revokeAsync(
                        {
                            clientId: keycloakConfig.clientId,
                            token: storedTokens.refreshToken,
                            tokenTypeHint: TokenTypeHint.RefreshToken,
                        },
                        discovery,
                    );
                }
            }
        } catch {
            // A indisponibilidade do provedor não deve impedir o logout local.
        } finally {
            await this.storage.clear();
        }
    }

    private async getDiscovery(): Promise<DiscoveryDocument> {
        if (!this.discovery) {
            this.discovery = await fetchDiscoveryAsync(
                keycloakConfig.issuer,
            );
        }

        return this.discovery;
    }
}
