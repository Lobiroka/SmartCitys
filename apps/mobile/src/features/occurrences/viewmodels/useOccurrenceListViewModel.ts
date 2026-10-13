import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';

import { occurrenceService } from '@/src/composition/appDependencies';
import type {
    Occurrence,
    OccurrenceStatus,
} from '@/src/features/occurrences/models/Occurrence';
import type { OccurrenceService } from
    '@/src/features/occurrences/services/OccurrenceService';

type OccurrenceListDependencies = {
    service: OccurrenceService;
};

const defaultDependencies: OccurrenceListDependencies = {
    service: occurrenceService,
};

function errorMessage(error: unknown): string {
    return error instanceof Error
        ? error.message
        : 'Não foi possível carregar as ocorrências.';
}

export function filterOccurrences(
    occurrences: Occurrence[],
    search: string,
    status?: OccurrenceStatus,
): Occurrence[] {
    const normalizedSearch = search.trim().toLocaleLowerCase('pt-BR');

    return occurrences.filter((item) => {
        const matchesStatus = !status || item.status === status;
        const matchesSearch = !normalizedSearch || [
            item.title,
            item.description,
            item.address,
        ].some((value) =>
            value.toLocaleLowerCase('pt-BR').includes(normalizedSearch),
        );

        return matchesStatus && matchesSearch;
    });
}

export function useOccurrenceListViewModel(
    dependencies: OccurrenceListDependencies = defaultDependencies,
) {
    const [occurrences, setOccurrences] = useState<Occurrence[]>([]);
    const [search, setSearch] = useState('');
    const [status, setStatus] = useState<OccurrenceStatus | undefined>();
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(async (refreshing = false) => {
        if (refreshing) {
            setIsRefreshing(true);
        } else {
            setIsLoading(true);
        }
        setError(null);

        try {
            const result = await dependencies.service.listMine({ limit: 100 });
            setOccurrences(result.data);
        } catch (caught) {
            setError(errorMessage(caught));
        } finally {
            setIsLoading(false);
            setIsRefreshing(false);
        }
    }, [dependencies.service]);

    useFocusEffect(
        useCallback(() => {
            void load();
        }, [load]),
    );

    const remove = useCallback(async (id: number) => {
        setError(null);
        try {
            await dependencies.service.remove(id);
            setOccurrences((current) =>
                current.filter((occurrence) => occurrence.id !== id),
            );
            return true;
        } catch (caught) {
            setError(errorMessage(caught));
            return false;
        }
    }, [dependencies.service]);

    const filteredOccurrences = filterOccurrences(
        occurrences,
        search,
        status,
    );

    return {
        occurrences,
        filteredOccurrences,
        search,
        setSearch,
        status,
        setStatus,
        isLoading,
        isRefreshing,
        error,
        load,
        remove,
    };
}
