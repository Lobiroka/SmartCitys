import type {AuthSession} from "@/src/features/auth/models/AuthSession";

import type { AuthIntent } from '@/src/features/auth/services/AuthSessionService';

export type AuthSessionViewModel = {
    session: AuthSession;
    signIn: (intent?: AuthIntent) => Promise<void>;
    signOut: () => Promise<void>;
};