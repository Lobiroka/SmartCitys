type KeycloakConfig = {
    issuer: string;
    clientId: string;
    redirectScheme: string;
};

function requireEnvironmentValue(
    value: string | undefined,
    variableName: string,
): string {
    if (!value) {
        throw new Error(
            `A variável de ambiente ${variableName} não foi configurada.`,
        );
    }

    return value;
}

export const keycloakConfig: KeycloakConfig = {
    redirectScheme: 'wb',
    issuer: requireEnvironmentValue(
        process.env.EXPO_PUBLIC_KEYCLOAK_ISSUER,
        'EXPO_PUBLIC_KEYCLOAK_ISSUER',
    ),
    clientId: requireEnvironmentValue(
        process.env.EXPO_PUBLIC_KEYCLOAK_CLIENT_ID,
        'EXPO_PUBLIC_KEYCLOAK_CLIENT_ID',
    ),
};