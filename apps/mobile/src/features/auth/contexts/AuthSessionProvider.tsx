import type { PropsWithChildren } from 'react';

import { AuthSessionContext } from
        '@/src/features/auth/contexts/AuthSessionContext';

import { useAuthSessionViewModel } from
        '@/src/features/auth/viewmodels/useAuthSessionViewModel';

import { authSessionService } from
        '@/src/composition/appDependencies';

export function AuthSessionProvider({
                                        children,
                                    }: PropsWithChildren) {
    const viewModel = useAuthSessionViewModel(
        authSessionService,
    );

    return (
        <AuthSessionContext.Provider value={viewModel}>
            {children}
        </AuthSessionContext.Provider>
    );
}