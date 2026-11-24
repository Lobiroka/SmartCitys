import type { Dashboard, NeighborhoodDashboard } from './Dashboard';

export type DashboardViewModel = {
    dashboard: Dashboard | null;
    neighborhoods: NeighborhoodDashboard[];
    isLoading: boolean;
    error: string | null;
    search: string;
    setSearch: (value: string) => void;
    reload: () => Promise<void>;
};
