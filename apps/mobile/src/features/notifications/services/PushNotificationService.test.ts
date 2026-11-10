import * as notifications from 'expo-notifications';
import * as SecureStore from 'expo-secure-store';

import { PushNotificationService } from './PushNotificationService';

jest.mock('expo-constants', () => ({
    expoConfig: { extra: { eas: { projectId: 'test-project' } } },
}));
jest.mock('expo-notifications', () => ({
    AndroidImportance: { DEFAULT: 3 },
    PermissionStatus: jest.requireActual('expo').PermissionStatus,
    getPermissionsAsync: jest.fn(),
    requestPermissionsAsync: jest.fn(),
    getExpoPushTokenAsync: jest.fn(),
    setNotificationChannelAsync: jest.fn(),
}));
jest.mock('expo-secure-store', () => ({
    getItemAsync: jest.fn(),
    setItemAsync: jest.fn(),
    deleteItemAsync: jest.fn(),
}));

const denied = {
    status: notifications.PermissionStatus.DENIED,
    granted: false,
    canAskAgain: true,
    expires: 'never',
} as const;
const granted = {
    ...denied,
    status: notifications.PermissionStatus.GRANTED,
    granted: true,
} as const;

describe('PushNotificationService', () => {
    const request = jest.fn();
    const storage = new Map<string, string>();
    const token = 'ExpoPushToken[test]';
    const loadNotifications = async () => notifications;

    beforeEach(() => {
        jest.clearAllMocks();
        storage.clear();
        jest.mocked(SecureStore.getItemAsync).mockImplementation(async (key) => storage.get(key) ?? null);
        jest.mocked(SecureStore.setItemAsync).mockImplementation(async (key, value) => {
            storage.set(key, value);
        });
        jest.mocked(SecureStore.deleteItemAsync).mockImplementation(async (key) => {
            storage.delete(key);
        });
        jest.mocked(notifications.getExpoPushTokenAsync).mockResolvedValue({ type: 'expo', data: token });
    });

    it('pede a permissão uma vez quando o Android retorna negado antes do primeiro aviso', async () => {
        jest.mocked(notifications.getPermissionsAsync).mockResolvedValue(denied);
        jest.mocked(notifications.requestPermissionsAsync).mockResolvedValue(denied);
        const service = new PushNotificationService({ request }, loadNotifications);

        await Promise.all([service.syncPermission(), service.syncPermission()]);
        await new PushNotificationService({ request }, loadNotifications).syncPermission();

        expect(notifications.requestPermissionsAsync).toHaveBeenCalledTimes(1);
        expect(request).not.toHaveBeenCalled();
    });

    it('sincroniza o dispositivo após ativar e desativar notificações no sistema', async () => {
        storage.set('smartcitys.push-permission-requested', 'true');
        jest.mocked(notifications.getPermissionsAsync)
            .mockResolvedValueOnce(granted)
            .mockResolvedValueOnce(denied);
        const service = new PushNotificationService({ request }, loadNotifications);

        await service.syncPermission();
        await service.syncPermission();

        expect(request).toHaveBeenNthCalledWith(1, '/demands/devices/push', expect.objectContaining({
            method: 'PUT',
            body: { token },
        }));
        expect(request).toHaveBeenNthCalledWith(2, '/demands/devices/push', expect.objectContaining({
            method: 'DELETE',
            body: { token },
        }));
        expect(notifications.requestPermissionsAsync).not.toHaveBeenCalled();
    });
});
