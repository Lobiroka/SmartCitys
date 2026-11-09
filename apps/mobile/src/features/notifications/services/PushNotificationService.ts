import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

import type { HttpClient } from '@/src/shared/http/HttpClient';

const tokenKey = 'smartcitys.push-token';
const channelId = 'occurrence-status';
const devicePath = '/demands/devices/push';

export async function configureForegroundNotifications() {
    if (!Constants.expoConfig?.extra?.eas?.projectId) return;

    const notifications = await import('expo-notifications');
    notifications.setNotificationHandler({
        handleNotification: async () => ({
            shouldShowBanner: true,
            shouldShowList: true,
            shouldPlaySound: false,
            shouldSetBadge: false,
        }),
    });
}

export class PushNotificationService {
    constructor(private readonly httpClient: HttpClient) {}

    async enable(): Promise<void> {
        const projectId = Constants.expoConfig?.extra?.eas?.projectId;
        if (typeof projectId !== 'string' || !projectId) {
            throw new Error('Este build ainda não está conectado ao projeto de notificações.');
        }

        const notifications = await import('expo-notifications');
        if (Platform.OS === 'android') {
            await notifications.setNotificationChannelAsync(channelId, {
                name: 'Atualizações de ocorrências',
                importance: notifications.AndroidImportance.DEFAULT,
            });
        }

        const current = await notifications.getPermissionsAsync();
        const permission = current.granted ? current : await notifications.requestPermissionsAsync();
        if (!permission.granted) {
            throw new Error('Permita notificações nas configurações do celular para continuar.');
        }

        const { data: token } = await notifications.getExpoPushTokenAsync({ projectId });
        const previousToken = await SecureStore.getItemAsync(tokenKey);
        if (previousToken && previousToken !== token) {
            await this.request('DELETE', previousToken);
        }

        await SecureStore.setItemAsync(tokenKey, token);
        await this.request('PUT', token);
    }

    async disable(): Promise<void> {
        const token = await SecureStore.getItemAsync(tokenKey);
        if (token) {
            await this.request('DELETE', token);
            await SecureStore.deleteItemAsync(tokenKey);
        }
    }

    private async request(method: 'PUT' | 'DELETE', token: string) {
        const abort = new AbortController();
        const timeout = setTimeout(() => abort.abort(), 4000);
        try {
            await this.httpClient.request<void>(devicePath, {
                method,
                body: { token },
                signal: abort.signal,
            });
        } finally {
            clearTimeout(timeout);
        }
    }
}
