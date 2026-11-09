import type { PropsWithChildren } from 'react';

import { AuthSessionContext } from
        '@/src/features/auth/contexts/AuthSessionContext';

import { useAuthSessionViewModel } from
        '@/src/features/auth/viewmodels/useAuthSessionViewModel';

import { authSessionService, pushNotificationService } from
        '@/src/composition/appDependencies';

export function AuthSessionProvider({
                                        children,
                                    }: PropsWithChildren) {
    const viewModel = useAuthSessionViewModel(
        authSessionService,
    );

    async function signOut() {
        try {
            await pushNotificationService.disable();
        } catch {
            // Uma falha de rede na remoção do dispositivo não bloqueia o logout.
        }
        await viewModel.signOut();
    }

    return (
        <AuthSessionContext.Provider value={{ ...viewModel, signOut }}>
            {children}
        </AuthSessionContext.Provider>
    );
}