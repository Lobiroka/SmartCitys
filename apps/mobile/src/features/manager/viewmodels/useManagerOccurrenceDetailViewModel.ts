import { useEffect, useRef, useState } from 'react';

import { managerOccurrenceService } from '@/src/composition/appDependencies';
import type { ManagerOccurrenceChange } from
    '@/src/features/manager/services/ManagerOccurrenceService';
import type { Occurrence } from '@/src/features/occurrences/models/Occurrence';

export function useManagerOccurrenceDetailViewModel(id: number) {
    const [occurrence, setOccurrence] = useState<Occurrence>();
    const [isLoading, setIsLoading] = useState(true);
    const [loadError, setLoadError] = useState<string>();
    const [saveError, setSaveError] = useState<string>();
    const [saved, setSaved] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [revision, setRevision] = useState(0);
    const saving = useRef(false);

    useEffect(() => {
        let active = true;

        managerOccurrenceService.get(id)
            .then((response) => {
                if (active) setOccurrence(response);
            })
            .catch((failure: unknown) => {
                if (!active) return;
                setLoadError(failure instanceof Error ? failure.message : 'Falha ao carregar a ocorrência.');
            })
            .finally(() => {
                if (active) setIsLoading(false);
            });

        return () => { active = false; };
    }, [id, revision]);

    async function update(change: ManagerOccurrenceChange) {
        if (!occurrence || saving.current) return;
        if ('status' in change ? change.status === occurrence.status : change.priority === occurrence.priority) {
            return;
        }

        saving.current = true;
        setIsSaving(true);
        setSaveError(undefined);
        setSaved(false);
        try {
            const values = await managerOccurrenceService.update(id, change);
            setOccurrence({ ...occurrence, ...values });
            setSaved(true);
        } catch (failure) {
            setSaveError(failure instanceof Error ? failure.message : 'Falha ao salvar a alteração.');
        } finally {
            saving.current = false;
            setIsSaving(false);
        }
    }

    return {
        occurrence, isLoading, loadError, saveError, saved, isSaving, update,
        retry: () => {
            setIsLoading(true);
            setLoadError(undefined);
            setRevision((value) => value + 1);
        },
    };
}
