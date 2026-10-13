export type AppRole = 'cidadao' | 'gestor';

export interface AuthenticatedUser {
    subject: string;
    roles: AppRole[];
    email?: string;
}