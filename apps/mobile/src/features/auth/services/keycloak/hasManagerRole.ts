const base64UrlAlphabet =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

export function hasManagerRole(accessToken: string): boolean {
    const parts = accessToken.split('.');
    const payload = parts[1];
    if (parts.length !== 3 || !payload || !/^[\w-]+$/.test(payload)) {
        return false;
    }

    try {
        let buffer = 0;
        let bits = 0;
        let encoded = '';
        for (const character of payload) {
            buffer = (buffer << 6) | base64UrlAlphabet.indexOf(character);
            bits += 6;
            if (bits >= 8) {
                bits -= 8;
                const byte = (buffer >> bits) & 0xff;
                encoded += '%' + byte.toString(16).padStart(2, '0');
            }
        }

        // Esta leitura serve apenas para navegação. A API valida o JWT.
        const claims = JSON.parse(decodeURIComponent(encoded));
        const roles: unknown = claims?.realm_access?.roles;
        return Array.isArray(roles) && roles.includes('gestor');
    } catch {
        return false;
    }
}
