import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

import type { HttpClient } from '@/src/shared/http/HttpClient';

const tokenKey = 'smartcitys.push-token';
const permissionPromptKey = 'smartcitys.push-permission-requested';
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
    private permissionSync: Promise<void> | null = null;
    private isDisabling = false;

    constructor(
        private readonly httpClient: HttpClient,
        private readonly loadNotifications: () => Promise<typeof import('expo-notifications')> =
            () => import('expo-notifications'),
    ) {}

    syncPermission(): Promise<void> {
        if (this.isDisabling) return Promise.resolve();

        this.permissionSync ??= this.syncDevice().finally(() => {
            this.permissionSync = null;
        });
        return this.permissionSync;
    }

    private async syncDevice(): Promise<void> {
        const projectId = Constants.expoConfig?.extra?.eas?.projectId;
        if (typeof projectId !== 'string' || !projectId) return;

        const notifications = await this.loadNotifications();
        if (Platform.OS === 'android') {
            await notifications.setNotificationChannelAsync(channelId, {
                name: 'Atualizações de ocorrências',
                importance: notifications.AndroidImportance.DEFAULT,
            });
        }

        let permission = await notifications.getPermissionsAsync();
        if (
            !permission.granted &&
            permission.canAskAgain &&
            !(await SecureStore.getItemAsync(permissionPromptKey)) &&
            !this.isDisabling
        ) {
            // No Android, a primeira consulta já pode retornar "denied".
            permission = await notifications.requestPermissionsAsync();
            await SecureStore.setItemAsync(permissionPromptKey, 'true');
        }

        if (this.isDisabling) return;
        if (!permission.granted) {
            await this.unregisterDevice();
            return;
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
        this.isDisabling = true;
        try {
            await this.permissionSync?.catch(() => undefined);
            await this.unregisterDevice();
        } finally {
            this.isDisabling = false;
        }
    }

    private async unregisterDevice(): Promise<void> {
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
