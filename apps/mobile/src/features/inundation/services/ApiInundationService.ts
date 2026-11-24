import type { HttpClient } from '@/src/shared/http/HttpClient';
import type { InundationLayer } from '../models/Inundation';

export class ApiInundationService {
    constructor(private readonly http: HttpClient) {}
    getAreas(signal?: AbortSignal): Promise<InundationLayer> {
        return this.http.request<InundationLayer>('/metrics/inundation', { signal });
    }
}
