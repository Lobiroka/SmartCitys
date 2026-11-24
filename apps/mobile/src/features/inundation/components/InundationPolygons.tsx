import { useMemo } from 'react';
import { Polygon } from 'react-native-maps';
import type { MapRegion } from '@/src/features/map/models/MapRegion';
import type { InundationLayer } from '../models/Inundation';
import { inundationColors, mapPolygons } from '../models/mapPolygons';

export function InundationPolygons({ layer, region }: { layer: InundationLayer | null; region: MapRegion }) {
    const polygons = useMemo(() => mapPolygons(layer?.items ?? [], region), [layer, region]);
    return <>{polygons.map(item => <Polygon key={item.key}
        testID={`sgb-area-${item.key}`} coordinates={item.coordinates} holes={item.holes}
        fillColor={inundationColors[item.classe].fill} strokeColor={inundationColors[item.classe].stroke}
        strokeWidth={1} zIndex={1} />)}</>;
}
