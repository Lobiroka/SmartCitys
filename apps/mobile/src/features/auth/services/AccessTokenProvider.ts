export interface AccessTokenProvider {
    getValidAccessToken(): Promise<string>;
}