import {
    fetchDiscoveryAsync,
    fetchUserInfoAsync,
    refreshAsync,
    revokeAsync,
    type TokenResponse,
} from 'expo-auth-session';

import type { AuthTokens } from '@/src/features/auth/models/AuthTokens';
import type { AuthTokenStorage } from '@/src/features/auth/storage/AuthTokenStorage';
import { KeycloakAuthSessionService } from './KeycloakAuthSessionService';

jest.mock('expo-auth-session', () => ({
    fetchDiscoveryAsync: jest.fn(),
    fetchUserInfoAsync: jest.fn(),
    refreshAsync: jest.fn(),
    revokeAsync: jest.fn(),
    TokenTypeHint: { RefreshToken: 'refresh_token' },
}));

jest.mock('@/src/features/auth/config/keycloakConfig', () => ({
    keycloakConfig: {
        issuer: 'https://auth.example.com/realms/test',
        clientId: 'public-mobile',
        redirectScheme: 'wb',
    },
}));

const discovery = {
    tokenEndpoint: 'https://auth.example.com/token',
    userInfoEndpoint: 'https://auth.example.com/userinfo',
    revocationEndpoint: 'https://auth.example.com/revoke',
};

function deferred<T>() {
    let resolve!: (value: T | PromiseLike<T>) => void;
    let reject!: (reason?: unknown) => void;
    const promise = new Promise<T>((resolvePromise, rejectPromise) => {
        resolve = resolvePromise;
        reject = rejectPromise;
    });
    return { promise, resolve, reject };
}

function expiredTokens(): AuthTokens {
    return {
        accessToken: 'expired-access',
        refreshToken: 'previous-refresh',
        expiresAtUnixSeconds: 1,
    };
}

function refreshedResponse(): TokenResponse {
    return {
        accessToken: 'renewed-access',
        refreshToken: 'rotated-refresh',
        issuedAt: Math.floor(Date.now() / 1000),
        expiresIn: 3600,
    } as TokenResponse;
}

function createStorage(initialTokens: AuthTokens | null) {
    let tokens = initialTokens;
    const storage: jest.Mocked<AuthTokenStorage> = {
        load: jest.fn(async () => tokens),
        save: jest.fn(async (nextTokens) => { tokens = nextTokens; }),
        clear: jest.fn(async () => { tokens = null; }),
    };
    return storage;
}

beforeEach(() => {
    jest.mocked(fetchDiscoveryAsync).mockResolvedValue(discovery);
    jest.mocked(fetchUserInfoAsync).mockResolvedValue({ sub: 'citizen-id' });
    jest.mocked(revokeAsync).mockResolvedValue(true);
});

it('usa o token recente sem consultar o provedor nem renovar', async () => {
    const storage = createStorage({
        ...expiredTokens(),
        accessToken: 'current-access',
        expiresAtUnixSeconds: Math.floor(Date.now() / 1000) + 3600,
    });
    const service = new KeycloakAuthSessionService(storage);

    await expect(service.getValidAccessToken()).resolves.toBe('current-access');

    expect(fetchDiscoveryAsync).not.toHaveBeenCalled();
    expect(refreshAsync).not.toHaveBeenCalled();
    expect(storage.save).not.toHaveBeenCalled();
});

it('compartilha a renovação entre chamadas HTTP e restauração simultâneas', async () => {
    const pending = deferred<TokenResponse>();
    const started = deferred<void>();
    jest.mocked(refreshAsync).mockImplementation(() => {
        started.resolve();
        return pending.promise;
    });
    const storage = createStorage(expiredTokens());
    const service = new KeycloakAuthSessionService(storage);

    const requests = Promise.all([
        service.getValidAccessToken(),
        service.getValidAccessToken(),
        service.restoreSession(),
    ]);
    await started.promise;
    expect(refreshAsync).toHaveBeenCalledTimes(1);
    pending.resolve(refreshedResponse());

    await expect(requests).resolves.toEqual([
        'renewed-access',
        'renewed-access',
        { status: 'authenticated', user: { id: 'citizen-id' } },
    ]);
    expect(storage.save).toHaveBeenCalledTimes(1);
    expect(refreshAsync).toHaveBeenCalledTimes(1);
    await expect(service.getValidAccessToken()).resolves.toBe('renewed-access');
    expect(refreshAsync).toHaveBeenCalledTimes(1);
});

it('propaga uma falha comum e permite nova tentativa de renovação', async () => {
    const pending = deferred<TokenResponse>();
    const started = deferred<void>();
    jest.mocked(refreshAsync).mockImplementation(() => {
        started.resolve();
        return pending.promise;
    });
    const storage = createStorage(expiredTokens());
    const service = new KeycloakAuthSessionService(storage);

    const requests = Promise.allSettled([
        service.getValidAccessToken(),
        service.getValidAccessToken(),
    ]);
    await started.promise;
    const failure = new Error('Provedor indisponível');
    pending.reject(failure);

    await expect(requests).resolves.toEqual([
        { status: 'rejected', reason: failure },
        { status: 'rejected', reason: failure },
    ]);
    expect(storage.save).not.toHaveBeenCalled();
    jest.mocked(refreshAsync).mockResolvedValue(refreshedResponse());
    await expect(service.getValidAccessToken()).resolves.toBe('renewed-access');
    expect(refreshAsync).toHaveBeenCalledTimes(2);
    expect(storage.save).toHaveBeenCalledTimes(1);
});

it('renova novamente depois que o novo token expira', async () => {
    const response = refreshedResponse();
    jest.mocked(refreshAsync).mockResolvedValue(response);
    const storage = createStorage(expiredTokens());
    const service = new KeycloakAuthSessionService(storage);
    await service.getValidAccessToken();

    await storage.save({
        accessToken: response.accessToken,
        refreshToken: 'rotated-refresh',
        expiresAtUnixSeconds: 1,
    });
    await service.getValidAccessToken();

    expect(refreshAsync).toHaveBeenCalledTimes(2);
    expect(jest.mocked(refreshAsync).mock.calls[1][0].refreshToken)
        .toBe('rotated-refresh');
});

it('aguarda a renovação antes de revogar e limpar a sessão no logout', async () => {
    const pending = deferred<TokenResponse>();
    const started = deferred<void>();
    jest.mocked(refreshAsync).mockImplementation(() => {
        started.resolve();
        return pending.promise;
    });
    const storage = createStorage(expiredTokens());
    const service = new KeycloakAuthSessionService(storage);
    const request = service.getValidAccessToken();
    await started.promise;

    const logout = service.signOut();
    expect(storage.clear).not.toHaveBeenCalled();
    await expect(service.getValidAccessToken()).rejects.toThrow('Não existe uma sessão autenticada.');
    pending.resolve(refreshedResponse());
    await Promise.all([request, logout]);

    expect(revokeAsync).toHaveBeenCalledWith(expect.objectContaining({
        token: 'rotated-refresh',
        tokenTypeHint: 'refresh_token',
    }), discovery);
    expect(storage.save.mock.invocationCallOrder[0])
        .toBeLessThan(storage.clear.mock.invocationCallOrder[0]);
    expect(storage.clear).toHaveBeenCalledTimes(1);
    await expect(service.getValidAccessToken()).rejects.toThrow('Não existe uma sessão autenticada.');
    await expect(service.restoreSession()).resolves.toEqual({ status: 'anonymous' });
    expect(refreshAsync).toHaveBeenCalledTimes(1);
});

it('conclui logout mesmo quando a renovação em andamento falha', async () => {
    const pending = deferred<TokenResponse>();
    const started = deferred<void>();
    jest.mocked(refreshAsync).mockImplementation(() => {
        started.resolve();
        return pending.promise;
    });
    const storage = createStorage(expiredTokens());
    const service = new KeycloakAuthSessionService(storage);
    const requestResult = service.getValidAccessToken().catch(() => undefined);
    await started.promise;

    const logout = service.signOut();
    pending.reject(new Error('Refresh rejeitado'));
    await Promise.all([requestResult, logout]);

    expect(storage.clear).toHaveBeenCalledTimes(1);
    await expect(storage.load()).resolves.toBeNull();
});

it('limpa localmente a sessão se a revogação remota falhar', async () => {
    jest.mocked(revokeAsync).mockRejectedValue(new Error('Sem conexão'));
    const storage = createStorage(expiredTokens());
    const service = new KeycloakAuthSessionService(storage);

    await expect(service.signOut()).resolves.toBeUndefined();

    expect(storage.clear).toHaveBeenCalledTimes(1);
    await expect(service.restoreSession()).resolves.toEqual({ status: 'anonymous' });
});
