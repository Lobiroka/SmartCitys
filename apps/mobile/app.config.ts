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

    return {
        ...config,
        name: config.name ?? 'wb',
        slug: config.slug ?? 'wb',
        android: {
            ...config.android,
            config: {
                ...config.android?.config,
                googleMaps: {
                    apiKey: googleMapsApiKey,
                },
            },
        },
    };
}
