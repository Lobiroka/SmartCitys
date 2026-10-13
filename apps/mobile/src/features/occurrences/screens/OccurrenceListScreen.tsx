import {
    ActivityIndicator,
    Alert,
    FlatList,
    Pressable,
    StyleSheet,
    TextInput,
    View,
} from 'react-native';
import { router, type Href } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import {
    occurrenceCategories,
    occurrenceLabel,
    occurrenceStatuses,
} from '@/src/features/occurrences/models/occurrenceOptions';
import type { Occurrence } from '@/src/features/occurrences/models/Occurrence';
import { useOccurrenceListViewModel } from
    '@/src/features/occurrences/viewmodels/useOccurrenceListViewModel';

export function OccurrenceListScreen() {
    const colorScheme = useColorScheme() ?? 'light';
    const colors = Colors[colorScheme];
    const vm = useOccurrenceListViewModel();

    function confirmRemove(item: Occurrence) {
        Alert.alert(
            'Excluir ocorrência?',
            `“${item.title}” será removida permanentemente.`,
            [
                { text: 'Cancelar', style: 'cancel' },
                {
                    text: 'Excluir', style: 'destructive',
                    onPress: () => { void vm.remove(item.id); },
                },
            ],
        );
    }

    return (
        <ThemedView style={styles.container}>
            <FlatList
                data={vm.filteredOccurrences}
                keyExtractor={(item) => String(item.id)}
                refreshing={vm.isRefreshing}
                onRefresh={() => { void vm.load(true); }}
                contentContainerStyle={styles.content}
                ListHeaderComponent={(
                    <View style={styles.header}>
                        <View style={styles.titleRow}>
                            <ThemedText type="title">Ocorrências</ThemedText>
                            <Pressable style={styles.primaryButton}
                                testID="occurrence-create-button"
                                onPress={() => router.push('/(tabs)/create-occurrence' as Href)}>
                                <ThemedText lightColor="#fff" darkColor="#fff">Nova</ThemedText>
                            </Pressable>
                        </View>
                        <TextInput
                            testID="occurrence-search-input"
                            value={vm.search}
                            onChangeText={vm.setSearch}
                            placeholder="Pesquisar título, descrição ou endereço"
                            placeholderTextColor={colors.icon}
                            style={[styles.input, { color: colors.text, borderColor: colors.icon }]}
                        />
                        <FlatList
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            data={[undefined, ...occurrenceStatuses]}
                            keyExtractor={(item, index) => item?.value ?? `all-${index}`}
                            contentContainerStyle={styles.filters}
                            renderItem={({ item }) => {
                                const value = item?.value;
                                const selected = vm.status === value;
                                return (
                                    <Pressable
                                        style={[styles.chip, { borderColor: colors.icon }, selected && styles.chipSelected]}
                                        onPress={() => vm.setStatus(value)}>
                                        <ThemedText lightColor={selected ? '#fff' : undefined}
                                            darkColor={selected ? '#fff' : undefined}>
                                            {item?.label ?? 'Todas'}
                                        </ThemedText>
                                    </Pressable>
                                );
                            }}
                        />
                        {vm.error && <ThemedText style={styles.error}>{vm.error}</ThemedText>}
                    </View>
                )}
                ListEmptyComponent={vm.isLoading
                    ? <ActivityIndicator style={styles.loading} />
                    : <ThemedText style={styles.empty}>Nenhuma ocorrência encontrada.</ThemedText>}
                renderItem={({ item }) => (
                    <ThemedView style={[styles.card, { borderColor: colors.icon }]}>
                        <View style={styles.cardHeader}>
                            <ThemedText type="subtitle" style={styles.cardTitle}>{item.title}</ThemedText>
                            <ThemedText type="defaultSemiBold">
                                {occurrenceLabel(occurrenceStatuses, item.status)}
                            </ThemedText>
                        </View>
                        <ThemedText>{occurrenceLabel(occurrenceCategories, item.category)}</ThemedText>
                        <ThemedText numberOfLines={2}>{item.description}</ThemedText>
                        <ThemedText style={styles.muted}>{item.address}</ThemedText>
                        {item.status === 'ABERTA' && (
                            <View style={styles.actions}>
                                <Pressable style={styles.secondaryButton}
                                    testID={`occurrence-edit-${item.id}`}
                                    onPress={() => router.push(
                                        `/(tabs)/edit-occurrence?id=${item.id}` as Href,
                                    )}>
                                    <ThemedText>Editar</ThemedText>
                                </Pressable>
                                <Pressable testID={`occurrence-delete-${item.id}`}
                                    style={styles.deleteButton} onPress={() => confirmRemove(item)}>
                                    <ThemedText lightColor="#fff" darkColor="#fff">Excluir</ThemedText>
                                </Pressable>
                            </View>
                        )}
                    </ThemedView>
                )}
            />
        </ThemedView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    content: { padding: 16, paddingBottom: 32 },
    header: { gap: 14, marginBottom: 16 },
    titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 },
    input: { borderWidth: 1, borderRadius: 12, padding: 12, fontSize: 16 },
    filters: { gap: 8 },
    chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 7 },
    chipSelected: { backgroundColor: '#0a7ea4', borderColor: '#0a7ea4' },
    primaryButton: { backgroundColor: '#0a7ea4', borderRadius: 999, paddingHorizontal: 18, paddingVertical: 10 },
    card: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 14, padding: 14, gap: 7, marginBottom: 12 },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
    cardTitle: { flex: 1 },
    muted: { opacity: 0.7 },
    actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 6 },
    secondaryButton: { borderWidth: 1, borderColor: '#0a7ea4', borderRadius: 999, paddingHorizontal: 16, paddingVertical: 8 },
    deleteButton: { backgroundColor: '#b3261e', borderRadius: 999, paddingHorizontal: 16, paddingVertical: 8 },
    error: { color: '#b3261e' },
    loading: { marginTop: 40 },
    empty: { textAlign: 'center', marginTop: 40, opacity: 0.7 },
});
