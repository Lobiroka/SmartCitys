import type {AuthSession} from "@/src/features/auth/models/AuthSession";

export type AuthIntent = 'login' | 'register';

export interface AuthSessionService {
    restoreSession():Promise<AuthSession>;
    signOut():Promise<void>;
    signIn(intent?: AuthIntent):Promise<AuthSession>;
}