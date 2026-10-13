import type {AuthSession} from "@/src/features/auth/models/AuthSession";

export type AuthSessionViewModel = {
    session: AuthSession;
    signIn: () => Promise<void>;
    signOut: () => Promise<void>;
};