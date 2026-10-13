import type { AccessTokenProvider } from
        '@/src/features/auth/services/AccessTokenProvider';
import type {
    HttpClient,
    HttpRequest,
} from '@/src/shared/http/HttpClient';
import {
    HttpRequestError,
    type HttpRequestErrorKind,
} from '@/src/shared/http/HttpRequestError';

export class AuthenticatedFetchHttpClient
    implements HttpClient
{
    constructor(
        private readonly baseUrl: string,
        private readonly accessTokenProvider:
        AccessTokenProvider,
    ) {}

    async request<ResponseBody>(
        path: string,
        options: HttpRequest = {},
    ): Promise<ResponseBody> {
        const accessToken =
            await this.accessTokenProvider.getValidAccessToken();

        const hasBody = options.body !== undefined;

        let response: Response;

        try {
            response = await fetch(
                `${this.baseUrl}${path}`,
                {
                    method: options.method ?? 'GET',
                    headers: {
                        Authorization: `Bearer ${accessToken}`,
                        ...(hasBody
                            ? { 'Content-Type': 'application/json' }
                            : {}),
                    },
                    body: hasBody
                        ? JSON.stringify(options.body)
                        : undefined,
                },
            );
        } catch (error) {
            throw new HttpRequestError(
                'Não foi possível conectar ao servidor.',
                'network',
                undefined,
                { cause: error },
            );
        }

        if (!response.ok) {
            const serverMessage =
                await this.readErrorMessage(response);

            throw new HttpRequestError(
                serverMessage ?? this.defaultErrorMessage(response.status),
                this.errorKind(response.status),
                response.status,
            );
        }

        if (response.status === 204) {
            return undefined as ResponseBody;
        }

        return await response.json() as ResponseBody;
    }

    private async readErrorMessage(
        response: Response,
    ): Promise<string | undefined> {
        try {
            const body = await response.json() as unknown;

            if (typeof body !== 'object' || body === null) {
                return undefined;
            }

            if ('message' in body &&
                typeof body.message === 'string') {
                return body.message;
            }

            if ('error' in body &&
                typeof body.error === 'string') {
                return body.error;
            }
        } catch {
            return undefined;
        }

        return undefined;
    }

    private errorKind(status: number): HttpRequestErrorKind {
        if (status === 400) return 'bad-request';
        if (status === 401) return 'unauthorized';
        if (status === 403) return 'forbidden';
        if (status === 404) return 'not-found';
        if (status >= 500) return 'server';
        return 'unexpected';
    }

    private defaultErrorMessage(status: number): string {
        if (status === 401) {
            return 'Sua sessão não é mais válida.';
        }

        if (status === 403) {
            return 'Você não possui permissão para esta operação.';
        }

        if (status >= 500) {
            return 'O servidor está temporariamente indisponível.';
        }

        return `A requisição falhou com status ${status}.`;
    }
}
