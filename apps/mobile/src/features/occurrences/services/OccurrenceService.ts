import type { OccurrencePage } from
    '@/src/features/occurrences/models/OccurrencePage';
import type {
    Occurrence,
    OccurrenceStatus,
    SaveOccurrenceInput,
} from '@/src/features/occurrences/models/Occurrence';

export type ListMyOccurrencesParams = {
    page?: number;
    limit?: number;
    search?: string;
    status?: OccurrenceStatus;
};

export interface OccurrenceService {
    listMine(
        params?: ListMyOccurrencesParams,
    ): Promise<OccurrencePage>;

    listFeed(
        params?: ListMyOccurrencesParams,
    ): Promise<OccurrencePage>;

    getById(id: number): Promise<Occurrence>;

    create(input: SaveOccurrenceInput): Promise<Occurrence>;

    update(
        id: number,
        input: SaveOccurrenceInput,
    ): Promise<Occurrence>;

    remove(id: number): Promise<void>;
}
