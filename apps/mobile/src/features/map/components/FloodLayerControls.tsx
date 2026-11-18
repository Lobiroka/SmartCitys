import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import type { useFloodLayer } from '../viewmodels/useFloodLayer';

type Props = {
    enabled: boolean;
    toggle: () => void;
    layer: ReturnType<typeof useFloodLayer>;
};

export function FloodLayerControls({ enabled, toggle, layer }: Props) {
    const [selecting, setSelecting] = useState(false);
    const currentLabel = layer.neighborhoods.find(([key]) => key === layer.neighborhoodKey)?.[1]
        ?? 'Todos os bairros';

    function select(key: string | null) {
        layer.setNeighborhoodKey(key);
        setSelecting(false);
    }

    return (
        <View style={styles.container} pointerEvents="box-none">
            <Pressable
                accessibilityRole="switch"
                accessibilityState={{ checked: enabled }}
                onPress={toggle}
                style={[styles.button, enabled && styles.active]}
            >
                <Text style={enabled ? styles.activeText : styles.text}>Alagamentos</Text>
            </Pressable>
            {enabled && (
                <View style={styles.panel}>
                    {layer.status === 'loading' && <Text>Carregando pontos…</Text>}
                    {layer.status === 'error' && (
                        <>
                            <Text>Camada de alagamentos indisponível.</Text>
                            <Pressable accessibilityRole="button" onPress={layer.retry} style={styles.option}>
                                <Text style={styles.text}>Tentar novamente</Text>
                            </Pressable>
                        </>
                    )}
                    {layer.status === 'ready' && (
                        <>
                            <Pressable accessibilityRole="button" onPress={() => setSelecting(true)} style={styles.option}>
                                <Text style={styles.text}>Bairro: {currentLabel}</Text>
                            </Pressable>
                            <Text accessibilityLiveRegion="polite">
                                Pontos cadastrados: {layer.points.length}
                            </Text>
                            <Text style={styles.source}>Fonte: Prefeitura do Recife · ESIG</Text>
                        </>
                    )}
                </View>
            )}
            {enabled && selecting && (
                <Modal transparent visible onRequestClose={() => setSelecting(false)}>
                    <View style={styles.backdrop}>
                        <View style={styles.dialog}>
                            <Pressable accessibilityRole="button" onPress={() => setSelecting(false)} style={styles.option}>
                                <Text style={styles.text}>Fechar filtro</Text>
                            </Pressable>
                            <ScrollView>
                                <Pressable accessibilityRole="button" onPress={() => select(null)} style={styles.option}>
                                    <Text>Todos os bairros</Text>
                                </Pressable>
                                {layer.neighborhoods.map(([key, label]) => (
                                    <Pressable key={key} accessibilityRole="button" onPress={() => select(key)} style={styles.option}>
                                        <Text>{label}</Text>
                                    </Pressable>
                                ))}
                            </ScrollView>
                        </View>
                    </View>
                </Modal>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: { position: 'absolute', bottom: 124, right: 16, alignItems: 'flex-end', gap: 6 },
    button: { backgroundColor: '#fff', borderRadius: 12, padding: 12, elevation: 2 },
    active: { backgroundColor: '#15578f' },
    activeText: { color: '#fff', fontWeight: '700' },
    text: { color: '#15578f', fontWeight: '700' },
    panel: { backgroundColor: '#fff', borderRadius: 12, padding: 10, elevation: 2 },
    source: { color: '#475569', fontSize: 12, marginTop: 4 },
    option: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 8 },
    backdrop: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: '#0008' },
    dialog: { maxHeight: '75%', padding: 12, backgroundColor: '#fff', borderRadius: 12 },
});
