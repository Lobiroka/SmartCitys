import { useCallback, useEffect, useState } from 'react';

import { occurrenceService } from '@/src/composition/appDependencies';
import { getCurrentCoordinates } from '@/src/features/location/services/locationService';
import type {
    OccurrenceCategory,
    OccurrencePriority,
    OccurrenceRegion,
    SaveOccurrenceInput,
} from '@/src/features/occurrences/models/Occurrence';
import type { OccurrenceService } from
    '@/src/features/occurrences/services/OccurrenceService';

type Coordinates = { latitude: number; longitude: number };

type OccurrenceFormDependencies = {
    service: OccurrenceService;
    getCoordinates: () => Promise<Coordinates>;
};

const defaultDependencies: OccurrenceFormDependencies = {
    service: occurrenceService,
    getCoordinates: getCurrentCoordinates,
};

export function useOccurrenceFormViewModel(
    id?: number,
    dependencies: OccurrenceFormDependencies = defaultDependencies,
) {
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [address, setAddress] = useState('');
    const [category, setCategory] =
        useState<OccurrenceCategory>('ILUMINACAO_PUBLICA');
    const [region, setRegion] =
        useState<OccurrenceRegion>('REGIAO_METROPOLITANA_DO_RECIFE');
    const [priority, setPriority] =
        useState<OccurrencePriority>('MEDIA');
    const [latitude, setLatitude] = useState<number | null>(null);
    const [longitude, setLongitude] = useState<number | null>(null);
    const [photo, setPhoto] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(Boolean(id));
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!id) return;

        let active = true;
        dependencies.service.getById(id)
            .then((occurrence) => {
                if (!active) return;
                setTitle(occurrence.title);
                setDescription(occurrence.description);
                setAddress(occurrence.address);
                setCategory(occurrence.category);
                setRegion(occurrence.region);
                setPriority(occurrence.priority);
                setLatitude(occurrence.latitude);
                setLongitude(occurrence.longitude);
                setPhoto(occurrence.images[0]?.path ?? null);
            })
            .catch((caught) => {
                if (active) {
                    setError(caught instanceof Error
                        ? caught.message
                        : 'Não foi possível carregar a ocorrência.');
                }
            })
            .finally(() => {
                if (active) setIsLoading(false);
            });

        return () => { active = false; };
    }, [dependencies.service, id]);

    const useCurrentLocation = useCallback(async () => {
        setError(null);
        try {
            const coordinates = await dependencies.getCoordinates();
            setLatitude(coordinates.latitude);
            setLongitude(coordinates.longitude);
        } catch (caught) {
            setError(caught instanceof Error
                ? caught.message
                : 'Não foi possível obter sua localização.');
        }
    }, [dependencies]);

    const save = useCallback(async () => {
        if (!title.trim() || !description.trim() || !address.trim()) {
            setError('Preencha título, descrição e endereço.');
            return false;
        }
        if (latitude === null || longitude === null) {
            setError('Confirme a localização da ocorrência.');
            return false;
        }

        const input: SaveOccurrenceInput = {
            title: title.trim(),
            description: description.trim(),
            address: address.trim(),
            category,
            region,
            priority,
            latitude,
            longitude,
            images: photo ? [photo] : [],
        };

        setIsSaving(true);
        setError(null);
        try {
            if (id) {
                await dependencies.service.update(id, input);
            } else {
                await dependencies.service.create(input);
            }
            return true;
        } catch (caught) {
            setError(caught instanceof Error
                ? caught.message
                : 'Não foi possível salvar a ocorrência.');
            return false;
        } finally {
            setIsSaving(false);
        }
    }, [
        address, category, dependencies.service, description, id, latitude, longitude,
        photo, priority, region, title,
    ]);

    return {
        title, setTitle,
        description, setDescription,
        address, setAddress,
        category, setCategory,
        region, setRegion,
        priority, setPriority,
        latitude, longitude,
        photo, setPhoto,
        isLoading, isSaving, error,
        useCurrentLocation,
        save,
    };
}
