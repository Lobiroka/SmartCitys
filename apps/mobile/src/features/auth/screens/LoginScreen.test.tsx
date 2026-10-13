import { fireEvent, render } from '@testing-library/react-native';

import { LoginScreen } from './LoginScreen';
import { useAuthSession } from '@/src/features/auth/hooks/useAuthSession';

jest.mock('@/src/features/auth/hooks/useAuthSession', () => ({
    useAuthSession: jest.fn(),
}));

const useAuthSessionMock = jest.mocked(useAuthSession);

describe('LoginScreen', () => {
    it('inicia o login pelo ViewModel de sessão', async () => {
        const signIn = jest.fn();
        useAuthSessionMock.mockReturnValue({
            session: { status: 'anonymous' },
            signIn,
            signOut: jest.fn(),
        });
        const screen = await render(<LoginScreen />);

        fireEvent.press(screen.getByTestId('login-button'));

        expect(signIn).toHaveBeenCalledTimes(1);
    });

    it('mostra a mensagem de erro recebida da camada de sessão', async () => {
        useAuthSessionMock.mockReturnValue({
            session: { status: 'error', message: 'Falha ao autenticar.' },
            signIn: jest.fn(),
            signOut: jest.fn(),
        });

        expect((await render(<LoginScreen />)).getByText('Falha ao autenticar.'))
            .toBeTruthy();
    });
});
