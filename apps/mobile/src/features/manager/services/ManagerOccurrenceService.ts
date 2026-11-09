import type { Occurrence, OccurrencePriority, OccurrenceStatus } from
    '@/src/features/occurrences/models/Occurrence';
import type { OccurrencePage } from '@/src/features/occurrences/models/OccurrencePage';

export type ManagerOccurrenceChange =
    | { status: OccurrenceStatus }
    | { priority: OccurrencePriority };

export interface ManagerOccurrenceService {
    list(page: number): Promise<OccurrencePage>;
    get(id: number): Promise<Occurrence>;
    update(
        id: number,
        change: ManagerOccurrenceChange,
    ): Promise<Pick<Occurrence, 'status' | 'priority'>>;
}
