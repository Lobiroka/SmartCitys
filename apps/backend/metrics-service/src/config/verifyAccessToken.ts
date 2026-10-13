import jwt from 'jsonwebtoken';
import {keycloakConfig} from "./keycloak";
import {getPublicKey} from "./jwksClient";
import type { AppRole, AuthenticatedUser } from '../types/authenticatedUser';

export async function verifyAccessToken(token: string): Promise<AuthenticatedUser> {
    const decoded = jwt.decode(token, {complete: true});

    if (!decoded ||
        decoded.header.alg !== 'RS256' ||
        typeof decoded.header.kid !== 'string') {

        throw new Error('Header do token ivalido')

    }

    const publicKey = await getPublicKey(decoded.header.kid);

    const payload = jwt.verify(token, publicKey, {
        algorithms: ['RS256'],
        issuer: keycloakConfig.issuer,
        audience: keycloakConfig.audience,
    });

    if (
        typeof payload === 'string' ||
        typeof payload.sub !== 'string' ||
        !payload.sub ||
        typeof payload.exp !== 'number'
    ) {
        throw new Error('Token sem identidade ou expiração válida.');
    }



    const realmAccess: unknown = payload.realm_access;
    let roles: AppRole[] = [];

    if (
        typeof realmAccess === 'object' &&
        realmAccess !== null &&
        'roles' in realmAccess &&
        Array.isArray(realmAccess.roles)
    ) {
        roles = realmAccess.roles.filter(
            (role: unknown): role is AppRole =>
                role === 'cidadao' || role === 'gestor'
        );
    }

    const email =
        payload.email_verified === true &&
        typeof payload.email === 'string' &&
        payload.email.trim() !== ''
            ? payload.email
            : undefined;



    return {
        subject: payload.sub,
        roles,
        email,
    };


}