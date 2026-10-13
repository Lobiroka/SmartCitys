import { useEffect, useState } from 'react';

import type { AuthSession } from
        '@/src/features/auth/models/AuthSession';
import type { AuthSessionService } from
        '@/src/features/auth/services/AuthSessionService';
import type { AuthSessionViewModel } from
        '@/src/features/auth/viewmodels/AuthSessionViewModel';

export function useAuthSessionViewModel(
    service: AuthSessionService,
): AuthSessionViewModel {
    const [session, setSession] = useState<AuthSession>({
        status: 'loading',
    });

    useEffect(() => {
        let isActive = true;

        service
            .restoreSession()
            .then((restoredSession) => {
                if (isActive) {
                    setSession(restoredSession);
                }
            })
            .catch(() => {
                if (isActive) {
                    setSession({
                        status: 'error',
                        message: 'Não foi possível restaurar a sessão.',
                    });
                }
            });

        return () => {
            isActive = false;
        };
    }, [service]);

    async function signIn() {
        setSession({ status: 'loading' });

        try {
            const authenticatedSession =
                await service.signIn();

            setSession(authenticatedSession);
        } catch {
            setSession({
                status: 'error',
                message: 'Não foi possível realizar o login.',
            });
        }
    }

    async function signOut() {
        await service.signOut();
        setSession({ status: 'anonymous' });
    }

    return { session, signIn, signOut };
}