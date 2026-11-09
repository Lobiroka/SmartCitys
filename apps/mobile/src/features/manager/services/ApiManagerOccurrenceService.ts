import type { ManagerOccurrenceChange, ManagerOccurrenceService } from
    '@/src/features/manager/services/ManagerOccurrenceService';
import type { OccurrenceApiDto, OccurrencePageApiDto } from
    '@/src/features/occurrences/services/api/OccurrenceApiDto';
import { mapOccurrenceApiDto } from
    '@/src/features/occurrences/services/api/mapOccurrenceApiDto';
import type { HttpClient } from '@/src/shared/http/HttpClient';

export class ApiManagerOccurrenceService implements ManagerOccurrenceService {
    constructor(private readonly httpClient: HttpClient) {}

    async list(page: number) {
        const response = await this.httpClient.request<OccurrencePageApiDto>(
            `/demands/gestor?page=${page}`,
        );
        return {
            data: response.data.map(mapOccurrenceApiDto),
            pagination: response.pagination,
        };
    }

    async get(id: number) {
        const response = await this.httpClient.request<OccurrenceApiDto>(
            `/demands/gestor/${id}`,
        );
        return mapOccurrenceApiDto(response);
    }

    async update(id: number, change: ManagerOccurrenceChange) {
        const body = 'status' in change ? change : { prioridade: change.priority };
        const field = 'status' in body ? 'status' : 'prioridade';
        const { denuncia } = await this.httpClient.request<{
            denuncia: Pick<OccurrenceApiDto, 'status' | 'prioridade'>;
        }>(`/demands/gestor/${id}/${field}`, {
            method: 'PATCH',
            body,
        });

        return { status: denuncia.status, priority: denuncia.prioridade };
    }
}
