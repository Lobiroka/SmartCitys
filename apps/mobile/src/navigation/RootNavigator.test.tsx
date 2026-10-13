import type { PropsWithChildren } from 'react';
import { act, render, waitFor } from '@testing-library/react-native';

import { RootNavigator } from './RootNavigator';
import { LoginScreen } from '@/src/features/auth/screens/LoginScreen';
import { AuthSessionContext } from '@/src/features/auth/contexts/AuthSessionContext';
import type { AuthSession } from '@/src/features/auth/models/AuthSession';
import type { AuthSessionService } from '@/src/features/auth/services/AuthSessionService';
import { useAuthSessionViewModel } from '@/src/features/auth/viewmodels/useAuthSessionViewModel';

// Simula somente o roteador; restauração e decisão de acesso usam código real.
jest.mock('expo-router', () => {
    const React = jest.requireActual<typeof import('react')>('react');
    const { Text } = jest.requireActual<typeof import('react-native')>('react-native');
    const { LoginScreen: Login } = jest.requireActual<{
        LoginScreen: typeof LoginScreen;
    }>('@/src/features/auth/screens/LoginScreen');
    function Stack({ children }: PropsWithChildren) { return children; }
    Stack.Protected = ({ guard, children }: PropsWithChildren<{ guard: boolean }>) =>
        guard ? children : null;
    Stack.Screen = ({ name }: { name: string }) => name === '(auth)'
        ? React.createElement(Login)
        : React.createElement(Text, { testID: name }, name);
    return { Stack };
});

function Harness({ service }: { service: AuthSessionService }) {
    const viewModel = useAuthSessionViewModel(service);
    return (
        <AuthSessionContext.Provider value={viewModel}>
            <RootNavigator />
        </AuthSessionContext.Provider>
    );
}

describe('RootNavigator e restauração da sessão', () => {
    it('TC-01: aguarda restauração e mostra login sem liberar o mapa', async () => {
        let finishRestore!: (session: AuthSession) => void;
        const pendingSession = new Promise<AuthSession>((resolve) => {
            finishRestore = resolve;
        });
        const service: AuthSessionService = {
            restoreSession: jest.fn(() => pendingSession),
            signIn: jest.fn(),
            signOut: jest.fn(),
        };
        const screen = await render(<Harness service={service} />);
        expect(screen.queryByTestId('login-button')).toBeNull();
        expect(screen.queryByTestId('(tabs)')).toBeNull();

        await act(async () => finishRestore({ status: 'anonymous' }));

        await waitFor(() => expect(screen.getByTestId('login-button')).toBeTruthy());
        expect(screen.getByText('Smart City')).toBeTruthy();
        expect(screen.queryByTestId('(tabs)')).toBeNull();
        expect(screen.queryByTestId('modal')).toBeNull();
        expect(service.restoreSession).toHaveBeenCalledTimes(1);
        expect(service.signIn).not.toHaveBeenCalled();
    });

    it('libera as rotas protegidas quando a sessão restaurada é autenticada', async () => {
        let finishRestore!: (session: AuthSession) => void;
        const pendingSession = new Promise<AuthSession>((resolve) => {
            finishRestore = resolve;
        });
        const service: AuthSessionService = {
            restoreSession: jest.fn(() => pendingSession),
            signIn: jest.fn(),
            signOut: jest.fn(),
        };
        const screen = await render(<Harness service={service} />);
        await act(async () => finishRestore({
            status: 'authenticated', user: { id: 'citizen-test' },
        }));
        await waitFor(() => expect(screen.getByTestId('(tabs)')).toBeTruthy());
        expect(screen.queryByTestId('login-button')).toBeNull();
    });
});
