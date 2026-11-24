import { useCallback, useMemo, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';

import { dashboardService } from '@/src/composition/appDependencies';
import type { Dashboard } from '../models/Dashboard';
import type { DashboardService } from '../services/DashboardService';

const defaults = { service: dashboardService };
const normalized = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

export function useDashboardViewModel(dependencies: { service: DashboardService } = defaults) {
    const [dashboard, setDashboard] = useState<Dashboard | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [search, setSearch] = useState('');
    const request = useRef<AbortController | null>(null);

    const reload = useCallback(async () => {
        request.current?.abort();
        const controller = new AbortController();
        request.current = controller;
        setIsLoading(true);
        setError(null);
        try {
            const result = await dependencies.service.getSummary(controller.signal);
            if (!controller.signal.aborted) setDashboard(result);
        } catch {
            if (!controller.signal.aborted) {
                setError('Não foi possível atualizar o dashboard. Tente novamente.');
            }
        } finally {
            if (!controller.signal.aborted) setIsLoading(false);
        }
    }, [dependencies.service]);

    useFocusEffect(useCallback(() => {
        void reload();
        return () => request.current?.abort();
    }, [reload]));

    const neighborhoods = useMemo(() => {
        const query = normalized(search.trim());
        return dashboard?.items.filter((item) => normalized(item.bairro).includes(query)) ?? [];
    }, [dashboard, search]);

    return { dashboard, neighborhoods, isLoading, error, search, setSearch, reload };
}
