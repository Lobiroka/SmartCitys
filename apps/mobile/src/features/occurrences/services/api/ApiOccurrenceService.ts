import type { OccurrencePage } from
    '@/src/features/occurrences/models/OccurrencePage';
import type {
    Occurrence,
    SaveOccurrenceInput,
} from '@/src/features/occurrences/models/Occurrence';
import type {
    ListMyOccurrencesParams,
    OccurrenceService,
} from '@/src/features/occurrences/services/OccurrenceService';
import type {
    OccurrenceApiDto,
    OccurrencePageApiDto,
    SaveOccurrenceApiDto,
} from '@/src/features/occurrences/services/api/OccurrenceApiDto';
import { mapOccurrenceApiDto } from
    '@/src/features/occurrences/services/api/mapOccurrenceApiDto';
import type { HttpClient } from
    '@/src/shared/http/HttpClient';

export class ApiOccurrenceService
    implements OccurrenceService
{
    constructor(
        private readonly httpClient: HttpClient,
    ) {}

    async listMine(
        params: ListMyOccurrencesParams = {},
    ): Promise<OccurrencePage> {
        const page = params.page ?? 1;
        const limit = params.limit ?? 20;

        const response =
            await this.httpClient.request<OccurrencePageApiDto>(
                this.listPath('/demands/my-demands', page, limit, params),
            );

        return {
            data: response.data.map(mapOccurrenceApiDto),
            pagination: response.pagination,
        };
    }

    async listFeed(
        params: ListMyOccurrencesParams = {},
    ): Promise<OccurrencePage> {
        const page = params.page ?? 1;
        const limit = params.limit ?? 100;
        const response =
            await this.httpClient.request<OccurrencePageApiDto>(
                this.listPath('/demands/feed', page, limit, params),
            );

        return {
            data: response.data.map(mapOccurrenceApiDto),
            pagination: response.pagination,
        };
    }

    async create(input: SaveOccurrenceInput): Promise<Occurrence> {
        const response = await this.httpClient.request<OccurrenceApiDto>(
            '/demands',
            { method: 'POST', body: this.toApiDto(input) },
        );
        return mapOccurrenceApiDto(response);
    }

    async getById(id: number): Promise<Occurrence> {
        const response = await this.httpClient.request<OccurrenceApiDto>(
            `/demands/${id}`,
        );
        return mapOccurrenceApiDto(response);
    }

    async update(
        id: number,
        input: SaveOccurrenceInput,
    ): Promise<Occurrence> {
        const response = await this.httpClient.request<OccurrenceApiDto>(
            `/demands/${id}`,
            { method: 'PATCH', body: this.toApiDto(input) },
        );
        return mapOccurrenceApiDto(response);
    }

    async remove(id: number): Promise<void> {
        await this.httpClient.request<void>(
            `/demands/${id}`,
            { method: 'DELETE' },
        );
    }

    private listPath(
        path: string,
        page: number,
        limit: number,
        params: ListMyOccurrencesParams,
    ): string {
        const query = new URLSearchParams({
            page: String(page),
            limit: String(limit),
        });

        if (params.search?.trim()) {
            query.set('search', params.search.trim());
        }
        if (params.status) {
            query.set('status', params.status);
        }

        return `${path}?${query.toString()}`;
    }

    private toApiDto(input: SaveOccurrenceInput): SaveOccurrenceApiDto {
        return {
            titulo: input.title,
            categoria: input.category,
            regiao: input.region,
            descricao: input.description,
            endereco: input.address,
            prioridade: input.priority,
            latitude: input.latitude,
            longitude: input.longitude,
            imagens: input.images,
        };
    }
}
