import type {AuthSession} from "@/src/features/auth/models/AuthSession";

export interface AuthSessionService {
    restoreSession():Promise<AuthSession>;
    signOut():Promise<void>;
    signIn():Promise<AuthSession>;
}