import { useTheme } from 'expo-router/react-navigation';
import { useRouter } from 'expo-router';
import { ActivityIndicator, Button, FlatList, Pressable, View } from 'react-native';

import { ActionButton } from '@/components/ui/action-button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useAuthSession } from '@/src/features/auth/hooks/useAuthSession';
import { managerStyles as styles } from '@/src/features/manager/screens/managerStyles';
import { useManagerOccurrenceListViewModel } from
    '@/src/features/manager/viewmodels/useManagerOccurrenceListViewModel';
import { occurrenceLabel, occurrencePriorities, occurrenceStatuses } from
    '@/src/features/occurrences/models/occurrenceOptions';

export function ManagerOccurrenceListScreen() {
    const router = useRouter();
    const { colors } = useTheme();
    const { signOut } = useAuthSession();
    const { result, isLoading, error, reload, previousPage, nextPage } =
        useManagerOccurrenceListViewModel();
    const pagination = result?.pagination;

    return (
        <ThemedView style={styles.screen}>
            <View style={styles.content}>
                <View style={styles.spread}>
                    <ThemedText type="subtitle" accessibilityRole="header">Ocorrências</ThemedText>
                    <Button title="Sair" onPress={signOut} />
                </View>
                <ThemedText>Consulte os registros e acompanhe o atendimento.</ThemedText>
            </View>

            {isLoading ? (
                <ActivityIndicator accessibilityLabel="Carregando ocorrências" />
            ) : error ? (
                <View style={styles.center}>
                    <ThemedText accessibilityRole="alert">{error}</ThemedText>
                    <ActionButton label="Tentar novamente" onPress={reload} />
                </View>
            ) : (
                <FlatList
                    data={result?.data}
                    keyExtractor={(item) => String(item.id)}
                    contentContainerStyle={styles.content}
                    ListEmptyComponent={<ThemedText>Nenhuma ocorrência encontrada.</ThemedText>}
                    ListFooterComponent={pagination && pagination.totalPages > 1 ? (
                        <View style={styles.spread}>
                            <ActionButton label="Anterior" disabled={pagination.page <= 1} onPress={previousPage} />
                            <ThemedText>{pagination.page} / {pagination.totalPages}</ThemedText>
                            <ActionButton label="Próxima" disabled={pagination.page >= pagination.totalPages} onPress={nextPage} />
                        </View>
                    ) : null}
                    renderItem={({ item }) => (
                        <Pressable
                            accessibilityRole="button"
                            accessibilityHint="Abre os detalhes da ocorrência"
                            style={({ pressed }) => [
                                styles.panel, { borderColor: colors.border, backgroundColor: colors.card },
                                pressed && { opacity: 0.75 },
                            ]}
                            onPress={() => router.push({
                                pathname: '/gestor/[id]',
                                params: { id: String(item.id) },
                            })}
                        >
                            <ThemedText type="defaultSemiBold">#{item.id} · {item.title}</ThemedText>
                            <ThemedText>
                                {occurrenceLabel(occurrenceStatuses, item.status)} · Prioridade {occurrenceLabel(occurrencePriorities, item.priority).toLowerCase()}
                            </ThemedText>
                        </Pressable>
                    )}
                />
            )}
        </ThemedView>
    );
}
