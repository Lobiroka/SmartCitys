import jwksRsa from "jwks-rsa";
import {keycloakConfig} from "./keycloak";

export const jwksClient = jwksRsa({
    jwksUri: keycloakConfig.jwksUri,
    cache: true,
    cacheMaxAge: 600000,
    rateLimit: true,
    jwksRequestsPerMinute: 10,
    timeout: 5000,
});

export async function getPublicKey(kid: string): Promise<string> {
    if(!kid){
        throw new Error("Token sem identificador");
    }
    const key = await jwksClient.getSigningKey(kid);
    return key.getPublicKey();
}