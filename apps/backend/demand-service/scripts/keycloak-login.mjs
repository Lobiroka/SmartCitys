import { randomBytes, createHash } from 'node:crypto';
import { createServer } from 'node:http';

const issuer = 'https://auth.darkartsbm.com/realms/SmartCitys';
const clientId = 'smartcitys-mobile';
const redirectUri = 'http://127.0.0.1:8765/callback';

const verifier = randomBytes(32).toString('base64url');
const challenge = createHash('sha256')
    .update(verifier)
    .digest('base64url');

const state = randomBytes(32).toString('base64url');

const loginUrl = new URL(
    `${issuer}/protocol/openid-connect/auth`
);

loginUrl.search = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid profile email',
    code_challenge: challenge,
    code_challenge_method: 'S256',
    state,
}).toString();

let loginRecebido = false;

const server = createServer(async (req, res) => {
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');

    const callback = new URL(req.url ?? '/', redirectUri);

    if (callback.pathname !== '/callback') {
        res.writeHead(404);
        return res.end('Página não encontrada.');
    }

    if (callback.searchParams.get('state') !== state) {
        res.writeHead(400);
        return res.end('Retorno de login inválido.');
    }

    if (loginRecebido) {
        res.writeHead(409);
        return res.end('Este login já foi recebido.');
    }

    loginRecebido = true;

    try {
        const code = callback.searchParams.get('code');

        if (callback.searchParams.has('error') || !code) {
            throw new Error('Login cancelado ou código não recebido.');
        }

        const tokenResponse = await fetch(
            `${issuer}/protocol/openid-connect/token`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: new URLSearchParams({
                    grant_type: 'authorization_code',
                    client_id: clientId,
                    redirect_uri: redirectUri,
                    code,
                    code_verifier: verifier,
                }),
                signal: AbortSignal.timeout(15000),
            }
        );

        if (!tokenResponse.ok) {
            throw new Error(`Troca do código falhou: HTTP ${tokenResponse.status}`);
        }

        const tokens = await tokenResponse.json();

        if (typeof tokens.access_token !== 'string') {
            throw new Error('Keycloak não retornou um access token.');
        }

        const apiResponse = await fetch(
            'http://localhost:8080/demands/my-demands',
            {
                headers: {
                    Authorization: `Bearer ${tokens.access_token}`,
                },
                signal: AbortSignal.timeout(15000),
            }
        );

        console.log(`Resposta da API: HTTP ${apiResponse.status}`);
        res.end(`Teste concluído. Resposta da API: HTTP ${apiResponse.status}`);
    } catch (error) {
        console.error(error.message);
        res.writeHead(500);
        res.end('O teste falhou. Consulte o terminal.');
    } finally {
        server.close();
    }
});

server.listen(8765, '127.0.0.1', () => {
    console.log('Abra este endereço no navegador:');
    console.log(loginUrl.toString());
});