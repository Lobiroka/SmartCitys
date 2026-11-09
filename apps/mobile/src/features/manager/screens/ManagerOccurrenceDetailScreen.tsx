import { useTheme } from 'expo-router/react-navigation';
import { ActivityIndicator, Alert, Button, Pressable, ScrollView, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { managerStyles as styles } from '@/src/features/manager/screens/managerStyles';
import { useManagerOccurrenceDetailViewModel } from
    '@/src/features/manager/viewmodels/useManagerOccurrenceDetailViewModel';
import {
    occurrenceCategories, occurrenceLabel, occurrencePriorities, occurrenceRegions, occurrenceStatuses,
} from '@/src/features/occurrences/models/occurrenceOptions';

export function ManagerOccurrenceDetailScreen({ id }: { id: number }) {
    const { colors } = useTheme();
    const { occurrence, isLoading, loadError, saveError, saved, isSaving, update, retry } =
        useManagerOccurrenceDetailViewModel(id);

    if (isLoading) {
        return <ActivityIndicator accessibilityLabel="Carregando ocorrência" />;
    }
    if (!occurrence || loadError) {
        return (
            <ThemedView style={styles.center}>
                <ThemedText accessibilityRole="alert">{loadError ?? 'Ocorrência indisponível.'}</ThemedText>
                <Button title="Tentar novamente" onPress={retry} />
            </ThemedView>
        );
    }

    return (
        <ThemedView style={styles.screen}>
            <ScrollView contentContainerStyle={styles.content}>
                <View style={styles.header}>
                    <ThemedText>Ocorrência #{occurrence.id}</ThemedText>
                    <ThemedText type="subtitle" accessibilityRole="header">{occurrence.title}</ThemedText>
                    <ThemedText>{occurrence.description}</ThemedText>
                </View>

                <View style={[styles.panel, { borderColor: colors.border, backgroundColor: colors.card }]}>
                    <ThemedText>Categoria: {occurrenceLabel(occurrenceCategories, occurrence.category)}</ThemedText>
                    <ThemedText>Região: {occurrenceLabel(occurrenceRegions, occurrence.region)}</ThemedText>
                    {occurrence.address ? <ThemedText>Endereço: {occurrence.address}</ThemedText> : null}
                    {occurrence.latitude !== null && occurrence.longitude !== null ? (
                        <ThemedText>GPS: {occurrence.latitude.toFixed(5)}, {occurrence.longitude.toFixed(5)}</ThemedText>
                    ) : null}
                </View>

                <ChangeOptions
                    title="Status"
                    options={occurrenceStatuses}
                    value={occurrence.status}
                    disabled={isSaving}
                    onChange={(status) => update({ status })}
                />
                <ChangeOptions
                    title="Prioridade"
                    options={occurrencePriorities}
                    value={occurrence.priority}
                    disabled={isSaving}
                    onChange={(priority) => update({ priority })}
                />

                {isSaving ? <ActivityIndicator accessibilityLabel="Salvando alteração" /> : null}
                {saveError ? <ThemedText accessibilityRole="alert">{saveError}</ThemedText> : null}
                {saved ? (
                    <ThemedText accessibilityLiveRegion="polite">Alteração salva.</ThemedText>
                ) : null}
            </ScrollView>
        </ThemedView>
    );
}

function ChangeOptions<T extends string>({
    title, options, value, disabled, onChange,
}: {
    title: string;
    options: { value: T; label: string }[];
    value: T;
    disabled: boolean;
    onChange: (value: T) => Promise<void>;
}) {
    const { colors } = useTheme();
    return (
        <View style={styles.section}>
            <ThemedText type="defaultSemiBold" accessibilityRole="header">{title}</ThemedText>
            <View style={styles.choices}>
                {options.map((option) => {
                    const selected = option.value === value;
                    const unavailable = disabled || selected;
                    return (
                        <Pressable
                            key={option.value}
                            accessibilityRole="button"
                            accessibilityLabel={`${title}: ${option.label}`}
                            accessibilityState={{ disabled: unavailable, selected }}
                            disabled={unavailable}
                            style={[
                                styles.button,
                                { borderColor: selected ? colors.primary : colors.border },
                                selected && { backgroundColor: colors.card },
                            ]}
                            onPress={() => Alert.alert(
                                `Alterar ${title.toLowerCase()}?`,
                                `Novo valor: ${option.label}`,
                                [
                                    { text: 'Cancelar', style: 'cancel' },
                                    { text: 'Salvar', onPress: () => void onChange(option.value) },
                                ],
                            )}
                        >
                            <ThemedText type={selected ? 'defaultSemiBold' : 'default'}>{option.label}</ThemedText>
                        </Pressable>
                    );
                })}
            </View>
        </View>
    );
}
