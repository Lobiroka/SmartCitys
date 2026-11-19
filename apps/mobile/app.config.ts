import type {
    ConfigContext,
    ExpoConfig,
} from 'expo/config';

export default function defineExpoConfig({
    config,
}: ConfigContext): ExpoConfig {
    // Configuração executada no Node; não transformar variáveis em imports do cliente.
    const environment = process.env;
    const googleMapsApiKey =
        environment.GOOGLE_MAPS_ANDROID_API_KEY;
    const publicApiUrl = environment.EXPO_PUBLIC_API_URL;
    const isNativeBuild = environment.EAS_BUILD === 'true' || Boolean(environment.EAS_BUILD_PROFILE);
    const usesPrebuiltClient = environment.SMARTCITYS_PREBUILT_CLIENT === '1' && !isNativeBuild;

    if (!googleMapsApiKey && !usesPrebuiltClient) {
        throw new Error(
            'Configure GOOGLE_MAPS_ANDROID_API_KEY para compilar ou use npm run team:android com o cliente de desenvolvimento já instalado.',
        );
    }

    const projectId = environment.EXPO_PUBLIC_EAS_PROJECT_ID ?? config.extra?.eas?.projectId;
    const googleServicesFile = environment.GOOGLE_SERVICES_JSON ?? config.android?.googleServicesFile;

    if (['preview', 'development'].includes(environment.EAS_BUILD_PROFILE ?? '')) {
        if (!projectId || !googleServicesFile) {
            throw new Error('Configure o projeto Expo e o arquivo google-services.json antes do build.');
        }
        // Este arquivo é avaliado no Node; manter a leitura de ambiente dinâmica.
        if (!publicApiUrl?.startsWith('https://')) {
            throw new Error('O APK distribuído precisa da URL HTTPS pública da API.');
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
                ...(googleMapsApiKey ? { googleMaps: { apiKey: googleMapsApiKey } } : {}),
            },
        },
    };
}
