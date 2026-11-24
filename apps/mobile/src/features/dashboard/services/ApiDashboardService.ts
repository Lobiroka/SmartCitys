import type { HttpClient } from '@/src/shared/http/HttpClient';
import type { Dashboard } from '../models/Dashboard';
import type { DashboardService } from './DashboardService';

export class ApiDashboardService implements DashboardService {
    constructor(private readonly http: HttpClient) {}

    getSummary(signal?: AbortSignal): Promise<Dashboard> {
        return this.http.request<Dashboard>('/metrics/dashboard', { signal });
    }
}
