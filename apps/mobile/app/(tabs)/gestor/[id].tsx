import { useLocalSearchParams } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { ManagerOccurrenceDetailScreen } from
    '@/src/features/manager/screens/ManagerOccurrenceDetailScreen';

export default function ManagerOccurrenceDetailRoute() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const occurrenceId = Number(id);

    if (!/^\d+$/.test(id) || !Number.isSafeInteger(occurrenceId) || occurrenceId <= 0) {
        return <ThemedText>Ocorrência inválida.</ThemedText>;
    }

    return <ManagerOccurrenceDetailScreen key={occurrenceId} id={occurrenceId} />;
}
