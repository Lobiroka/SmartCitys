import type { AccessTokenProvider } from
    '@/src/features/auth/services/AccessTokenProvider';
import { AuthenticatedFetchHttpClient } from
    '@/src/shared/http/AuthenticatedFetchHttpClient';
import { HttpRequestError } from '@/src/shared/http/HttpRequestError';

describe('AuthenticatedFetchHttpClient', () => {
    const originalFetch = global.fetch;
    const fetchMock = jest.fn() as jest.MockedFunction<typeof fetch>;
    const accessTokenProvider: AccessTokenProvider = {
        getValidAccessToken: jest.fn().mockResolvedValue('test-access-token'),
    };

    beforeEach(() => {
        global.fetch = fetchMock;
        fetchMock.mockReset();
        jest.mocked(accessTokenProvider.getValidAccessToken)
            .mockResolvedValue('test-access-token');
    });

    afterAll(() => {
        global.fetch = originalFetch;
    });

    it('envia token e serializa o corpo JSON em uma requisição POST', async () => {
        const responseBody = { id: 42 };
        const body = { title: 'Buraco na rua' };
        fetchMock.mockResolvedValue({
            ok: true,
            status: 201,
            json: async () => responseBody,
        } as Response);
        const client = new AuthenticatedFetchHttpClient(
            'https://api.example.test',
            accessTokenProvider,
        );

        await expect(client.request('/demands', {
            method: 'POST',
            body,
        })).resolves.toEqual(responseBody);

        expect(accessTokenProvider.getValidAccessToken).toHaveBeenCalledTimes(1);
        expect(fetchMock).toHaveBeenCalledWith(
            'https://api.example.test/demands',
            expect.objectContaining({
                method: 'POST',
                headers: {
                    Authorization: 'Bearer test-access-token',
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(body),
            }),
        );
    });

    it('retorna undefined para uma resposta 204 sem tentar ler JSON', async () => {
        const jsonMock = jest.fn();
        fetchMock.mockResolvedValue({
            ok: true,
            status: 204,
            json: jsonMock,
        } as unknown as Response);
        const client = new AuthenticatedFetchHttpClient(
            'https://api.example.test',
            accessTokenProvider,
        );

        await expect(client.request('/demands/42', {
            method: 'DELETE',
        })).resolves.toBeUndefined();
        expect(jsonMock).not.toHaveBeenCalled();
    });

    it('converte respostas 401 em erro de autenticação com a mensagem da API', async () => {
        fetchMock.mockResolvedValue({
            ok: false,
            status: 401,
            json: async () => ({ message: 'Sessão expirada.' }),
        } as Response);
        const client = new AuthenticatedFetchHttpClient(
            'https://api.example.test',
            accessTokenProvider,
        );

        await expect(client.request('/demands')).rejects.toMatchObject({
            name: 'HttpRequestError',
            message: 'Sessão expirada.',
            kind: 'unauthorized',
            status: 401,
        });
    });

    it('converte falhas do fetch em erro de rede', async () => {
        fetchMock.mockRejectedValue(new Error('connection refused'));
        const client = new AuthenticatedFetchHttpClient(
            'https://api.example.test',
            accessTokenProvider,
        );

        const request = client.request('/demands');
        await expect(request).rejects.toBeInstanceOf(HttpRequestError);
        await expect(request).rejects.toMatchObject({
            name: 'HttpRequestError',
            message: 'Não foi possível conectar ao servidor.',
            kind: 'network',
        });
    });
});
