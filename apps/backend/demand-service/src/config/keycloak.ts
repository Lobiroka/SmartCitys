const issuer= process.env.KEYCLOAK_ISSUER;
const audience = process.env.KEYCLOAK_AUDIENCE;

if(!issuer||!audience){
    throw new Error("Defina o KEYCLOAK_AUDIENCES E KEYCLOAK_ISSUER no ambiente");
}

export const keycloakConfig = {
    issuer,audience,jwksUri:`${issuer}/protocol/openid-connect/certs`,
};
