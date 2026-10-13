import { useContext } from 'react';

import { AuthSessionContext } from
        '@/src/features/auth/contexts/AuthSessionContext';

export function useAuthSession() {
    const viewModel = useContext(AuthSessionContext);

    if (viewModel === undefined) {
        throw new Error(
            'useAuthSession deve ser usado dentro de AuthSessionProvider',
        );
    }

    return viewModel;
}