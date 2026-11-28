import type { HttpClient } from '@/src/shared/http/HttpClient';
import type { Dashboard } from '../models/Dashboard';
import type { DashboardService } from './DashboardService';

export class ApiDashboardService implements DashboardService {
    constructor(private readonly http: HttpClient) {}

    getSummary(signal?: AbortSignal): Promise<Dashboard> {
        // APRESENTAÇÃO ETL — o app usa o cliente HTTP autenticado para consultar
        // o backend, que disponibiliza os dados tratados da camada prata.
        return this.http.request<Dashboard>('/metrics/dashboard', { signal });
    }
}
