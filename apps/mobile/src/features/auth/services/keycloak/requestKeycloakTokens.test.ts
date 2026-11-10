import { AuthRequest, makeRedirectUri } from 'expo-auth-session';

import { requestKeycloakTokens } from './requestKeycloakTokens';

jest.mock('expo-auth-session', () => ({
    AuthRequest: jest.fn(),
    exchangeCodeAsync: jest.fn(),
    makeRedirectUri: jest.fn(),
    ResponseType: { Code: 'code' },
}));

const discovery = { authorizationEndpoint: 'https://auth.example.com/auth' };

beforeEach(() => {
    jest.mocked(makeRedirectUri).mockReturnValue('wb://auth/callback');
    jest.mocked(AuthRequest).mockImplementation(() => ({
        promptAsync: jest.fn().mockResolvedValue({ type: 'dismiss' }),
    }) as unknown as AuthRequest);
});

it('inicia cadastro com prompt=create e mantém o fluxo PKCE do app', async () => {
    await expect(requestKeycloakTokens('mobile', 'wb', discovery, 'register')).resolves.toBeNull();

    expect(AuthRequest).toHaveBeenCalledWith(expect.objectContaining({
        clientId: 'mobile',
        redirectUri: 'wb://auth/callback',
        usePKCE: true,
        extraParams: { prompt: 'create' },
    }));
});

it('preserva o login padrão sem o parâmetro de cadastro', async () => {
    await requestKeycloakTokens('mobile', 'wb', discovery);

    expect(jest.mocked(AuthRequest).mock.calls[0][0]).not.toHaveProperty('extraParams');
});
