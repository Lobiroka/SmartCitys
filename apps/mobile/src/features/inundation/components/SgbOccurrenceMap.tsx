import { useInundationViewModel } from '../viewmodels/useInundationViewModel';
import { OccurrenceMapView } from './OccurrenceMapView';

export function SgbOccurrenceMap({ latitude, longitude }: { latitude: number | null; longitude: number | null }) {
    const inundation = useInundationViewModel();
    const coordinates = latitude !== null && longitude !== null ? {latitude,longitude} : null;
    return <OccurrenceMapView coordinates={coordinates} {...inundation} />;
}
