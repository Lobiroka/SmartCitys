import type { Occurrence } from
    '@/src/features/occurrences/models/Occurrence';

export type OccurrencePage = {
    data: Occurrence[];
    pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
    };
};
