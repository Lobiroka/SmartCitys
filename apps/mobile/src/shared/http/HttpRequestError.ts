export type HttpRequestErrorKind =
    | 'bad-request'
    | 'unauthorized'
    | 'forbidden'
    | 'not-found'
    | 'server'
    | 'network'
    | 'unexpected';

export class HttpRequestError extends Error {
    constructor(
        message: string,
        readonly kind: HttpRequestErrorKind,
        readonly status?: number,
        options?: ErrorOptions,
    ) {
        super(message, options);
        this.name = 'HttpRequestError';
    }
}
