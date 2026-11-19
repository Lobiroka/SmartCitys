import { isAccessTokenFresh } from './isAccessTokenFresh';

describe('isAccessTokenFresh', () => {
    it('considera recente um token que vence daqui a 1 hora', () => {
        const agora = Math.floor(Date.now() / 1000);

        const resultado = isAccessTokenFresh({
            accessToken: 'access',
            refreshToken: 'refresh',
            expiresAtUnixSeconds: agora + 3600,
        });

        expect(resultado).toBe(true);
    });
});