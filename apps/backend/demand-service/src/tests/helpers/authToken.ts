import { generateKeyPairSync } from 'node:crypto';
import jwt from 'jsonwebtoken';
import type { AppRole } from '../../types/authenticatedUser';

const { privateKey, publicKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
});

export const testPublicKey = publicKey.export({
    type: 'spki',
    format: 'pem',
}).toString();

export function createTestToken(subject: string, roles: AppRole[]) {
    return jwt.sign(
        { realm_access: { roles } },
        privateKey,
        {
            algorithm: 'RS256',
            keyid: 'test-key',
            subject,
            issuer: 'https://keycloak.test/realms/SmartCitys',
            audience: 'smartcitys-api',
            expiresIn: '5m',
        }
    );
}