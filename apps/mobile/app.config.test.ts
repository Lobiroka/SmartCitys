import defineExpoConfig from './app.config';
import type { ConfigContext } from 'expo/config';

describe('configuração do cliente de desenvolvimento da equipe', () => {
    const originalEnv = process.env;
    const context = {
        config: {
            name: 'wb', slug: 'wb', version: '1.0.1',
            extra: { eas: { projectId: 'public-project-id' } },
            android: { package: 'com.darkartsbm.smartcitys' },
        },
    } as ConfigContext;

    beforeEach(() => {
        process.env = { ...originalEnv };
        for (const name of ['GOOGLE_MAPS_ANDROID_API_KEY', 'GOOGLE_SERVICES_JSON', 'EAS_BUILD', 'EAS_BUILD_PROFILE', 'SMARTCITYS_PREBUILT_CLIENT']) {
            delete process.env[name];
        }
    });
    afterEach(() => { process.env = originalEnv; });

    it('permite servir JavaScript sem chave do Maps para um cliente já compilado', () => {
        process.env.SMARTCITYS_PREBUILT_CLIENT = '1';
        const config = defineExpoConfig(context);
        expect(config.android?.config?.googleMaps).toBeUndefined();
        expect(config.android?.package).toBe('com.darkartsbm.smartcitys');
    });

    it('continua exigindo a chave fora do modo de cliente pré-compilado', () => {
        expect(() => defineExpoConfig(context)).toThrow('GOOGLE_MAPS_ANDROID_API_KEY');
    });

    it.each(['preview', 'development'])('não permite que o modo pré-compilado dispense a chave no build %s', profile => {
        process.env.SMARTCITYS_PREBUILT_CLIENT = '1';
        process.env.EAS_BUILD_PROFILE = profile;
        expect(() => defineExpoConfig(context)).toThrow('GOOGLE_MAPS_ANDROID_API_KEY');
    });

    it('exige configuração Firebase e API HTTPS nos builds distribuídos', () => {
        process.env.EAS_BUILD_PROFILE = 'development';
        process.env.GOOGLE_MAPS_ANDROID_API_KEY = 'native-build-key-for-test';
        expect(() => defineExpoConfig(context)).toThrow('google-services.json');
        process.env.GOOGLE_SERVICES_JSON = '/tmp/google-services.json';
        process.env.EXPO_PUBLIC_API_URL = 'http://localhost:8080';
        expect(() => defineExpoConfig(context)).toThrow('HTTPS');
        process.env.EXPO_PUBLIC_API_URL = 'https://api.example.test';
        expect(defineExpoConfig(context).android?.config?.googleMaps?.apiKey).toBe('native-build-key-for-test');
    });
});
