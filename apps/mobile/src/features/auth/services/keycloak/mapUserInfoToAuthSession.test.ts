import { mapUserInfoToAuthSession } from './mapUserInfoToAuthSession';

describe('mapUserInfoToAuthSession', () => {
    it('cria uma sessão autenticada com os dados do userinfo do Keycloak', () => {
        expect(mapUserInfoToAuthSession({
            sub: 'f3a1c2d4-0000-4000-8000-000000000001',
            name: 'Maria Silva',
            email: 'maria@example.com',
        })).toEqual({
            status: 'authenticated',
            user: {
                id: 'f3a1c2d4-0000-4000-8000-000000000001',
                name: 'Maria Silva',
                email: 'maria@example.com',
            },
        });
    });

    it('descarta nome e e-mail que não sejam texto', () => {
        const session = mapUserInfoToAuthSession({
            sub: 'usuario-1',
            name: 42,
            email: { value: 'maria@example.com' },
        });

        expect(session).toEqual({
            status: 'authenticated',
            user: { id: 'usuario-1', name: undefined, email: undefined },
        });
    });

    it.each([undefined, null, 123, { id: 'x' }])(
        'rejeita o identificador %p como inválido',
        (sub) => {
            expect(() => mapUserInfoToAuthSession({ sub })).toThrow(
                'O Keycloak não retornou um identificador de usuário válido.',
            );
        },
    );
});
