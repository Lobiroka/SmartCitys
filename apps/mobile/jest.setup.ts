jest.setTimeout(10_000);

process.env.EXPO_PUBLIC_API_URL = 'http://localhost:8080';
process.env.EXPO_PUBLIC_KEYCLOAK_ISSUER =
    'https://identity.example.test/realms/smart-city';
process.env.EXPO_PUBLIC_KEYCLOAK_CLIENT_ID = 'mobile-test';
