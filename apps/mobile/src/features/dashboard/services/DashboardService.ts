import type { Dashboard } from '../models/Dashboard';

export interface DashboardService {
    getSummary(signal?: AbortSignal): Promise<Dashboard>;
}
