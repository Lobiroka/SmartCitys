import { useEffect, useState } from 'react';
import { inundationService } from '@/src/composition/appDependencies';
import type { InundationLayer } from '../models/Inundation';

export function useInundationViewModel() {
    const [layer, setLayer] = useState<InundationLayer | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [attempt, setAttempt] = useState(0);
    useEffect(() => {
        const controller = new AbortController();
        void inundationService.getAreas(controller.signal).then((data) => {
            if (!controller.signal.aborted) setLayer(data);
        }).catch(() => {
            if (!controller.signal.aborted) setError('Camada SGB indisponível. O cadastro continua disponível.');
        }).finally(() => {
            if (!controller.signal.aborted) setIsLoading(false);
        });
        return () => controller.abort();
    }, [attempt]);
    function reload() {
        setIsLoading(true);
        setError(null);
        setAttempt(value => value + 1);
    }
    return { layer, isLoading, error, reload };
}
