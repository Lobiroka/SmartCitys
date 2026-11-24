import type { MapRegion } from '@/src/features/map/models/MapRegion';
import type { InundationArea, InundationClass, Position } from './Inundation';

export const inundationColors: Record<InundationClass, { fill: string; stroke: string }> = {
    Baixa: { fill: 'rgba(250,204,21,0.30)', stroke: '#a16207' },
    Média: { fill: 'rgba(249,115,22,0.38)', stroke: '#c2410c' },
    Alta: { fill: 'rgba(220,38,38,0.45)', stroke: '#b91c1c' },
};
const coordinates = (ring: Position[]) => ring.map(([longitude, latitude]) => ({ latitude, longitude }));

export function mapPolygons(areas: InundationArea[], region: MapRegion) {
    const minX = region.longitude - region.longitudeDelta / 2;
    const maxX = region.longitude + region.longitudeDelta / 2;
    const minY = region.latitude - region.latitudeDelta / 2;
    const maxY = region.latitude + region.latitudeDelta / 2;
    // Desenha somente as áreas que cruzam a janela do mapa; preserva todos os anéis.
    return areas.filter(({ bbox }) => bbox[0] <= maxX && bbox[2] >= minX && bbox[1] <= maxY && bbox[3] >= minY)
        .flatMap(area => {
            const polygons = area.geometry.type === 'Polygon' ? [area.geometry.coordinates] : area.geometry.coordinates;
            return polygons.map((rings, index) => ({
                key: `${area.id}-${index}`, classe: area.classe,
                coordinates: coordinates(rings[0]), holes: rings.slice(1).map(coordinates),
            }));
        });
}
