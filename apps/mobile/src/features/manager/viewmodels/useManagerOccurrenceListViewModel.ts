import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import { managerOccurrenceService } from '@/src/composition/appDependencies';
import type { OccurrencePage } from '@/src/features/occurrences/models/OccurrencePage';

export function useManagerOccurrenceListViewModel() {
    const [query, setQuery] = useState({ page: 1 });
    const [result, setResult] = useState<OccurrencePage>();
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string>();

    useFocusEffect(useCallback(() => {
        const { page } = query;
        let active = true;
        setIsLoading(true);
        setError(undefined);

        managerOccurrenceService.list(page)
            .then((response) => {
                if (!active) return;
                if (page > response.pagination.totalPages) {
                    setQuery({ page: response.pagination.totalPages });
                    return;
                }
                setResult(response);
                setIsLoading(false);
            })
            .catch((failure: unknown) => {
                if (!active) return;
                setError(failure instanceof Error ? failure.message : 'Falha ao carregar ocorrências.');
                setIsLoading(false);
            });

        return () => { active = false; };
    }, [query]));

    return {
        result,
        isLoading,
        error,
        reload: () => setQuery({ page: query.page }),
        previousPage: () => setQuery({ page: Math.max(1, query.page - 1) }),
        nextPage: () => setQuery({ page: Math.min(result?.pagination.totalPages ?? 1, query.page + 1) }),
    };
}
