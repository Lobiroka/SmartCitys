import { vi } from 'vitest';
import { setup } from './setup';

setup();

vi.stubEnv(
    'KEYCLOAK_ISSUER',
    'https://keycloak.test/realms/SmartCitys'
);
vi.stubEnv('KEYCLOAK_AUDIENCE', 'smartcitys-api');

vi.mock('../config/jwksClient', async () => {
    const { testPublicKey } = await import('./helpers/authToken');

    return {
        getPublicKey: async (kid: string) => {
            if (kid !== 'test-key') {
                throw new Error('Chave de teste desconhecida.');
            }

            return testPublicKey;
        },
    };
});