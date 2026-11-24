import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import type { InundationLayer } from '../models/Inundation';
import { InundationLegend } from './InundationLegend';
import { InundationPolygons } from './InundationPolygons';

type Coordinates = { latitude: number; longitude: number };
type Props = { coordinates: Coordinates | null; title?: string; layer: InundationLayer | null;
    isLoading?: boolean; error?: string | null; reload?: () => void };
const recife = { latitude: -8.0631, longitude: -34.8711 };
const regionFor = (coordinates: Coordinates | null) => ({ ...(coordinates ?? recife),
    latitudeDelta: coordinates ? 0.008 : 0.15, longitudeDelta: coordinates ? 0.008 : 0.15 });

export function OccurrenceMapView({ coordinates, title = 'Local da ocorrência', ...inundation }: Props) {
    const [enabled, setEnabled] = useState(true);
    // Uma nova coordenada inicia outra janela sem interferir no ponto salvo da ocorrência.
    const coordinateKey = coordinates ? `${coordinates.latitude},${coordinates.longitude}` : 'recife';
    return <View style={styles.wrapper}>
        <MapViewport key={coordinateKey} coordinates={coordinates} title={title} layer={inundation.layer} enabled={enabled} />
        <InundationLegend {...inundation} enabled={enabled} onChange={setEnabled} />
    </View>;
}

function MapViewport({ coordinates, title, layer, enabled }: {
    coordinates: Coordinates | null; title: string; layer: InundationLayer | null; enabled: boolean;
}) {
    const [region, setRegion] = useState(() => regionFor(coordinates));
    return <View style={styles.container}>
        <MapView testID="occurrence-map" accessibilityLabel={`Mapa: ${title}`}
            style={styles.map} region={region} onRegionChangeComplete={setRegion}
            showsMyLocationButton={false} toolbarEnabled={false}>
            {enabled && <InundationPolygons layer={layer} region={region} />}
            {coordinates && <Marker testID="occurrence-map-marker"
                coordinate={{latitude:coordinates.latitude,longitude:coordinates.longitude}} title={title} />}
        </MapView>
        <Pressable accessibilityRole="button" style={styles.overview}
            onPress={() => setRegion(regionFor(null))}><Text style={styles.overviewText}>Ver Recife</Text></Pressable>
    </View>;
}

const styles = StyleSheet.create({
    wrapper:{gap:6},container:{height:230,width:'100%',borderRadius:12,overflow:'hidden'},
    map:{width:'100%',height:'100%'},
    overview:{position:'absolute',right:8,top:8,backgroundColor:'#fff',padding:8,borderRadius:8},
    overviewText:{color:'#155e75',fontWeight:'600',fontSize:12},
});
