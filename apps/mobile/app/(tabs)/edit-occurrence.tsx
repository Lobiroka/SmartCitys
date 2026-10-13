import { useLocalSearchParams } from 'expo-router';

import { OccurrenceFormScreen } from
    '@/src/features/occurrences/screens/OccurrenceFormScreen';

export default function EditOccurrenceRoute() {
    const { id } = useLocalSearchParams<{ id?: string }>();
    const occurrenceId = Number(id);

    return (
        <OccurrenceFormScreen
            id={Number.isInteger(occurrenceId) ? occurrenceId : undefined}
        />
    );
}
