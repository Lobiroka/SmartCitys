import { useCallback, useRef, useState } from 'react';
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
    const requestId = useRef(0);

    const load = useCallback(async (refreshing = false) => {
        const currentRequest = ++requestId.current;
        if (refreshing) {
            setIsRefreshing(true);
        } else {
            setIsLoading(true);
        }
        setError(null);

        try {
            const collected = new Map<number, Occurrence>();
            let page = 1;
            let totalPages = 1;
            do {
                const result = await dependencies.service.listMine({ page, limit: 100 });
                if (currentRequest !== requestId.current) return;
                for (const occurrence of result.data) collected.set(occurrence.id, occurrence);
                totalPages = result.pagination.totalPages;
                page += 1;
            } while (page <= totalPages);
            setOccurrences([...collected.values()]);
        } catch (caught) {
            if (currentRequest === requestId.current) setError(errorMessage(caught));
        } finally {
            if (currentRequest === requestId.current) {
                setIsLoading(false);
                setIsRefreshing(false);
            }
        }
    }, [dependencies.service]);

    useFocusEffect(
        useCallback(() => {
            void load();
            return () => { requestId.current += 1; };
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
