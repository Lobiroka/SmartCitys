import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';

import { occurrenceService } from '@/src/composition/appDependencies';
import type { Occurrence } from '@/src/features/occurrences/models/Occurrence';
import type { OccurrenceService } from
    '@/src/features/occurrences/services/OccurrenceService';

type OccurrenceFeedDependencies = {
    service: OccurrenceService;
};

const defaultDependencies: OccurrenceFeedDependencies = {
    service: occurrenceService,
};

export function useOccurrenceFeedViewModel(
    dependencies: OccurrenceFeedDependencies = defaultDependencies,
) {
    const [occurrences, setOccurrences] = useState<Occurrence[]>([]);
    const [error, setError] = useState<string | null>(null);

    const loadOccurrences = useCallback(async () => {
        setError(null);
        try {
            const page = await dependencies.service.listFeed({ limit: 100 });
            setOccurrences(
                page.data.filter((item) =>
                    item.latitude !== null && item.longitude !== null,
                ),
            );
        } catch (caught) {
            setError(
                caught instanceof Error
                    ? caught.message
                    : 'Não foi possível carregar o mapa de ocorrências.',
            );
        }
    }, [dependencies.service]);

    useFocusEffect(
        useCallback(() => {
            void loadOccurrences();
        }, [loadOccurrences]),
    );

    return { occurrences, occurrenceError: error, loadOccurrences };
}
