import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import type { InundationLayer } from '../models/Inundation';
import { inundationColors } from '../models/mapPolygons';

type Props = { layer: InundationLayer | null; enabled: boolean; onChange: (enabled: boolean) => void;
    isLoading?: boolean; error?: string | null; reload?: () => void };

export function InundationLegend({ layer, enabled, onChange, isLoading, error, reload }: Props) {
    const years = [...new Set(layer?.items.map(item => item.ano).filter((year): year is number => year !== null) ?? [])].sort((a,b)=>a-b);
    const reference = years.length ? (years.length === 1 ? String(years[0]) : `${years[0]}–${years[years.length-1]}`) : 'não informado';
    return <View style={styles.container}>
        <View style={styles.row}>
            <Text style={styles.title}>Suscetibilidade à inundação · SGB</Text>
            <Switch accessibilityLabel="Mostrar áreas de inundação do SGB" value={enabled} onValueChange={onChange} />
        </View>
        {isLoading ? <Text style={styles.text}>Carregando áreas…</Text> : error ? <View>
            <Text style={styles.text}>{error}</Text>
            {reload && <Pressable accessibilityRole="button" onPress={reload}><Text style={styles.retry}>Tentar carregar camada SGB</Text></Pressable>}
        </View> : enabled && layer ? <>
            <View style={styles.classes}>{(['Baixa','Média','Alta'] as const).map(classe => <View key={classe} style={styles.classItem}>
                <View style={[styles.dot,{backgroundColor:inundationColors[classe].stroke}]} /><Text style={styles.text}>{classe}</Text>
            </View>)}</View>
            <Text style={styles.text}>Fonte: SGB/CPRM · referência {reference}. Suscetibilidade mapeada; não indica alagamento em tempo real. Sem cor: área sem classificação nesta camada.</Text>
        </> : null}
    </View>;
}

const styles = StyleSheet.create({
    container:{backgroundColor:'#fff',padding:10,borderRadius:10,gap:5,borderWidth:1,borderColor:'#d1d5db'},
    row:{flexDirection:'row',alignItems:'center',gap:6},title:{flex:1,fontSize:13,fontWeight:'600',color:'#203d35'},
    text:{fontSize:11,color:'#374151',lineHeight:15},classes:{flexDirection:'row',gap:14},
    classItem:{flexDirection:'row',alignItems:'center',gap:4},dot:{width:10,height:10,borderRadius:5},
    retry:{color:'#155e75',paddingVertical:8,fontWeight:'600'},
});
