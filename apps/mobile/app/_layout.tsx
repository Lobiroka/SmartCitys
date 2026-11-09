import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router/react-navigation';
import { RootNavigator } from
      '@/src/navigation/RootNavigator';
import { useEffect } from 'react';
import { configureForegroundNotifications } from '@/src/features/notifications/services/PushNotificationService';
import { StatusBar } from 'expo-status-bar';
import { AuthSessionProvider } from
        '@/src/features/auth/contexts/AuthSessionProvider';
import 'react-native-reanimated';
import '../global.css';

import { useColorScheme } from '@/hooks/use-color-scheme';

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  const colorScheme = useColorScheme();

  useEffect(() => {
    void configureForegroundNotifications().catch(() => {});
  }, []);

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
