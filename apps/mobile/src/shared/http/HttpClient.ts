export type HttpRequest = {
    method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
    body?: unknown;
};

export interface HttpClient {
    request<Response>(
        path: string,
        options?: HttpRequest,
    ): Promise<Response>;
}