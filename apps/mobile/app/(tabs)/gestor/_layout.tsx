import { Stack } from 'expo-router';

export const unstable_settings = { initialRouteName: 'index' };

export default function ManagerLayout() {
    return (
        <Stack>
            <Stack.Screen name="index" options={{ title: 'Painel do gestor' }} />
            <Stack.Screen name="[id]" options={{ title: 'Detalhes da ocorrência' }} />
        </Stack>
    );
}
