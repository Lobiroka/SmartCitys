import { Tabs } from 'expo-router';
import React from 'react';

import { HapticTab } from '@/components/haptic-tab';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuthSession } from '@/src/features/auth/hooks/useAuthSession';

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const { session } = useAuthSession();
  const isManager = session.status === 'authenticated' && session.user.isManager === true;

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors[colorScheme ?? 'light'].tint,
        headerShown: false,
        tabBarButton: HapticTab,
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="house.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          title: 'Ocorrências',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="paperplane.fill" color={color} />,
        }}
      />
      <Tabs.Protected guard={isManager}>
        <Tabs.Screen
          name="gestor"
          options={{
            title: 'Gestão',
            tabBarIcon: ({ color }) => <IconSymbol size={28} name="briefcase.fill" color={color} />,
          }}
        />
      </Tabs.Protected>
      <Tabs.Screen
        name="create-occurrence"
        options={{ href: null, headerShown: true, title: 'Nova ocorrência' }}
      />
      <Tabs.Screen
        name="edit-occurrence"
        options={{ href: null, headerShown: true, title: 'Editar ocorrência' }}
      />
    </Tabs>
  );
}
