/// <reference types="node" />

import { Buffer } from 'node:buffer';
import { hasManagerRole } from './hasManagerRole';

function tokenWith(claims: unknown) {
    const payload = Buffer.from(JSON.stringify(claims), 'utf8').toString('base64url');
    return `header.${payload}.signature`;
}

describe('hasManagerRole', () => {
    it('lê a role de realm mesmo quando o JWT contém nomes com acentos', () => {
        expect(hasManagerRole(tokenWith({
            name: 'João 👋',
            realm_access: { roles: ['cidadao', 'gestor'] },
        }))).toBe(true);
    });

    it('mantém o fluxo do cidadão sem a role de realm', () => {
        expect(hasManagerRole(tokenWith({
            realm_access: { roles: ['cidadao'] },
            resource_access: { app: { roles: ['gestor'] } },
        }))).toBe(false);
        expect(hasManagerRole(tokenWith({ realm_access: { roles: 'gestor' } }))).toBe(false);
        expect(hasManagerRole('header.!.signature')).toBe(false);
    });
});
