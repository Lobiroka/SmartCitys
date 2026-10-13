import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router/react-navigation';
import { RootNavigator } from
      '@/src/navigation/RootNavigator';
import { StatusBar } from 'expo-status-bar';
import { AuthSessionProvider } from
        '@/src/features/auth/contexts/AuthSessionProvider';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/use-color-scheme';

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
      <AuthSessionProvider>
        <ThemeProvider
            value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}
        >
          <RootNavigator />
          <StatusBar style="auto" />
        </ThemeProvider>
      </AuthSessionProvider>
  );
}
