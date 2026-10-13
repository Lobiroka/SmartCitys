import { apiConfig } from '@/src/config/apiConfig';
import { KeycloakAuthSessionService } from
        '@/src/features/auth/services/keycloak/KeycloakAuthSessionService';
import { ExpoSecureAuthTokenStorage } from
        '@/src/features/auth/storage/ExpoSecureAuthTokenStorage';
import { ApiOccurrenceService } from
        '@/src/features/occurrences/services/api/ApiOccurrenceService';
import { AuthenticatedFetchHttpClient } from
        '@/src/shared/http/AuthenticatedFetchHttpClient';

const authTokenStorage =
    new ExpoSecureAuthTokenStorage();

export const authSessionService =
    new KeycloakAuthSessionService(authTokenStorage);

export const httpClient =
    new AuthenticatedFetchHttpClient(
        apiConfig.baseUrl,
        authSessionService,
    );

export const occurrenceService =
    new ApiOccurrenceService(httpClient);
