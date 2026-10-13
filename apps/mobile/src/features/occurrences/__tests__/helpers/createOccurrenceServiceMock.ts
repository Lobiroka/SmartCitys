import type { OccurrenceService } from
    '@/src/features/occurrences/services/OccurrenceService';

export function createOccurrenceServiceMock():
    jest.Mocked<OccurrenceService> {
    return {
        listMine: jest.fn(),
        listFeed: jest.fn(),
        getById: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        remove: jest.fn(),
    };
}
