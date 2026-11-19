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

    it('considera expirado um token que vence daqui a 1 minuto', () => {
        const agora = Math.floor(Date.now() / 1000);

        const resultado = isAccessTokenFresh({
            accessToken: 'access',
            refreshToken: 'refresh',
            expiresAtUnixSeconds: agora + 60,
        });

        expect(resultado).toBe(false);
    });

    it('considera recente um token que vence daqui a 1 minuto e 1 segundo', () => {
        const agora = Math.floor(Date.now() / 1000);

        const resultado = isAccessTokenFresh({
            accessToken: 'access',
            refreshToken: 'refresh',
            expiresAtUnixSeconds: agora + 61,
        });

        expect(resultado).toBe(true);
    });

    it('considera expirado um token vencido', () => {
        const agora = Math.floor(Date.now() / 1000);

        const resultado = isAccessTokenFresh({
            accessToken: 'access',
            refreshToken: 'refresh',
            expiresAtUnixSeconds: agora - 10,
        });

        expect(resultado).toBe(false);
    });
});
