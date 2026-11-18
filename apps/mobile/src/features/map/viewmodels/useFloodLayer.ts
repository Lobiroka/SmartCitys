import { useEffect, useMemo, useState } from 'react';

import { httpClient } from '@/src/composition/appDependencies';

type FloodPoint = {
    neighborhood: string | null;
    neighborhoodKey: string | null;
    latitude: number;
    longitude: number;
};

type FloodLayerResult =
    | { status: 'loading' }
    | { status: 'error' }
    | { status: 'ready'; points: FloodPoint[] };

const LOADING: FloodLayerResult = { status: 'loading' };
const EMPTY_POINTS: FloodPoint[] = [];

export function useFloodLayer(enabled: boolean) {
    const [result, setResult] = useState<FloodLayerResult>(LOADING);
    const [attempt, setAttempt] = useState(0);
    const [neighborhoodKey, setNeighborhoodKey] = useState<string | null>(null);

    useEffect(() => {
        if (!enabled) {
            setResult(LOADING);
            setNeighborhoodKey(null);
            return;
        }

        const controller = new AbortController();
        const timeout = setTimeout(() => {
            controller.abort();
            setResult({ status: 'error' });
        }, 12000);

        void httpClient.request<{ points: FloodPoint[] }>('/demands/analytics/flood-points', {
            signal: controller.signal,
        }).then(({ points }) => {
            if (!Array.isArray(points) || points.some((point) =>
                !point || !Number.isFinite(point.latitude) || !Number.isFinite(point.longitude) ||
                Math.abs(point.latitude) > 90 || Math.abs(point.longitude) > 180 ||
                (point.neighborhoodKey !== null && typeof point.neighborhoodKey !== 'string') ||
                (point.neighborhood !== null && typeof point.neighborhood !== 'string'))) {
                throw new Error('Dados da camada inválidos');
            }
            if (!controller.signal.aborted) setResult({ status: 'ready', points });
        }).catch(() => {
            if (!controller.signal.aborted) setResult({ status: 'error' });
        }).finally(() => clearTimeout(timeout));

        return () => {
            clearTimeout(timeout);
            controller.abort();
        };
    }, [enabled, attempt]);

    const allPoints = enabled && result.status === 'ready' ? result.points : EMPTY_POINTS;
    const neighborhoods = useMemo(() => {
        const labels = new Map<string, string>();
        for (const point of allPoints) {
            if (point.neighborhoodKey && point.neighborhood && !labels.has(point.neighborhoodKey)) {
                labels.set(point.neighborhoodKey, point.neighborhood);
            }
        }
        return [...labels].sort(([, left], [, right]) => left.localeCompare(right, 'pt-BR'));
    }, [allPoints]);

    const points = useMemo(() => {
        const selected = neighborhoodKey === null ? allPoints :
            allPoints.filter((point) => point.neighborhoodKey === neighborhoodKey);
        return selected.map(({ latitude, longitude }) => ({ latitude, longitude }));
    }, [allPoints, neighborhoodKey]);

    return {
        status: result.status,
        points,
        neighborhoods,
        neighborhoodKey,
        setNeighborhoodKey,
        retry() {
            setResult(LOADING);
            setAttempt((current) => current + 1);
        },
    };
}
