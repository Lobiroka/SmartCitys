import type {
    ConfigContext,
    ExpoConfig,
} from 'expo/config';

export default function defineExpoConfig({
    config,
}: ConfigContext): ExpoConfig {
    const googleMapsApiKey =
        process.env.GOOGLE_MAPS_ANDROID_API_KEY;

    if (!googleMapsApiKey) {
        throw new Error(
            'A variável GOOGLE_MAPS_ANDROID_API_KEY não foi configurada.',
        );
    }

    const projectId = process.env.EXPO_PUBLIC_EAS_PROJECT_ID ?? config.extra?.eas?.projectId;
    const googleServicesFile = process.env.GOOGLE_SERVICES_JSON ?? config.android?.googleServicesFile;

    if (process.env.EAS_BUILD_PROFILE === 'preview') {
        if (!projectId || !googleServicesFile) {
            throw new Error('Configure o projeto Expo e o arquivo google-services.json antes do build preview.');
        }
        if (!process.env.EXPO_PUBLIC_API_URL?.startsWith('https://')) {
            throw new Error('O APK preview precisa da URL HTTPS pública da API.');
        }
    }

    return {
        ...config,
        extra: {
            ...config.extra,
            ...(projectId ? { eas: { ...config.extra?.eas, projectId } } : {}),
        },
        runtimeVersion: { policy: 'appVersion' },
        updates: projectId
            ? { enabled: true, url: 'https://u.expo.dev/' + projectId }
            : { enabled: false },
        name: config.name ?? 'wb',
        slug: config.slug ?? 'wb',
        android: {
            ...config.android,
            googleServicesFile,
            config: {
                ...config.android?.config,
                googleMaps: {
                    apiKey: googleMapsApiKey,
                },
            },
        },
    };
}
