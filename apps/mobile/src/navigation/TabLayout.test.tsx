import { render } from '@testing-library/react-native';
import TabLayout from '../../app/(tabs)/_layout';
import { useAuthSession } from '@/src/features/auth/hooks/useAuthSession';

jest.mock('expo-router', () => {
    const React = jest.requireActual<typeof import('react')>('react');
    const { View, Text } = jest.requireActual<typeof import('react-native')>('react-native');
    const Tabs = Object.assign(
        ({ children }: { children: import('react').ReactNode }) => React.createElement(View, null, children),
        {
            Screen: ({ options }: { options: { title: string; tabBarButtonTestID?: string; href?: null } }) =>
                options.href === null ? null : React.createElement(Text, { testID: options.tabBarButtonTestID }, options.title),
            Protected: ({ guard, children }: { guard: boolean; children: import('react').ReactNode }) => guard ? children : null,
        },
    );
    return { Tabs };
});
jest.mock('@/components/haptic-tab', () => ({ HapticTab: () => null }));
jest.mock('@/components/ui/icon-symbol', () => ({ IconSymbol: () => null }));
jest.mock('@/src/features/auth/hooks/useAuthSession', () => ({ useAuthSession: jest.fn() }));

it.each([false, true])('inclui Dashboard entre Home e Ocorrências preservando acesso de gestor: %s', async (isManager) => {
    jest.mocked(useAuthSession).mockReturnValue({
        session: { status: 'authenticated', user: { id: 'pessoa-teste', isManager } },
    } as ReturnType<typeof useAuthSession>);
    const screen = await render(<TabLayout />);

    const tabs = screen.getAllByTestId(/^tab-/).map(tab => tab.props.testID);
    expect(tabs).toEqual(isManager
        ? ['tab-home', 'tab-dashboard', 'tab-occurrences', 'tab-manager']
        : ['tab-home', 'tab-dashboard', 'tab-occurrences']);
    expect(screen.queryByText('Nova ocorrência')).toBeNull();
    expect(screen.queryByText('Editar ocorrência')).toBeNull();
});
