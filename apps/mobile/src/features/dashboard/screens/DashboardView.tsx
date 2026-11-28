import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import type { NeighborhoodDashboard } from '../models/Dashboard';
import type { DashboardViewModel } from '../models/DashboardViewModel';
import type { ColorValue } from 'react-native';

export type DashboardColors = { card: ColorValue; border: ColorValue; text: ColorValue; primary: ColorValue };

const number = (value: number | null, decimals = 0) => value === null ? '—'
    : value.toLocaleString('pt-BR', { maximumFractionDigits: decimals });

// APRESENTAÇÃO ETL — este cartão exibe população e percentual recebidos da API.
// O ano é a referência do indicador (IBGE 2010); dataExtracao é a data da coleta.
function NeighborhoodCard({ item, colors }: { item: NeighborhoodDashboard; colors: DashboardColors }) {
    const coverage = item.percentualRedeEsgoto;
    return (
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.row}>
                <ThemedText style={styles.neighborhoodName} type="defaultSemiBold">{item.bairro}</ThemedText>
                <View style={styles.badge}>
                    <Text style={styles.badgeText}>{number(item.occurrences.total)} registros</Text>
                </View>
            </View>
            <View style={styles.metricsRow}>
                <View style={styles.metric}>
                    <ThemedText style={styles.caption}>População · {item.ano ?? 'ano não informado'}</ThemedText>
                    <ThemedText type="subtitle">{number(item.populacao)}</ThemedText>
                </View>
                <View style={styles.metric}>
                    <ThemedText style={styles.caption}>Rede de esgoto/pluvial</ThemedText>
                    <ThemedText type="subtitle">{coverage === null ? '—' : `${number(coverage, 2)}%`}</ThemedText>
                </View>
            </View>
            <View style={[styles.track, { backgroundColor: colors.border }]} accessibilityLabel={`Rede de esgoto/pluvial: ${coverage === null ? 'não informada' : `${number(coverage, 2)} por cento`}`}>
                <View style={[styles.fill, { width: `${Math.max(0, Math.min(100, coverage ?? 0))}%` }]} />
            </View>
            <ThemedText style={styles.detail}>
                {number(item.occurrences.saneamento)} ocorrências de saneamento
            </ThemedText>
            <ThemedText style={styles.caption}>
                {number(item.occurrencesPer10k, 2)} registros por 10 mil habitantes (base {item.ano ?? 'não informada'})
            </ThemedText>
            <ThemedText style={styles.caption}>
                Coleta dos indicadores: {item.dataExtracao === null ? 'data não informada'
                    : new Date(item.dataExtracao).toLocaleString('pt-BR')}
            </ThemedText>
        </View>
    );
}

export function DashboardView({ viewModel: vm, colors }: { viewModel: DashboardViewModel; colors: DashboardColors }) {
    const insets = useSafeAreaInsets();
    const data = vm.dashboard;
    const missing = data ? data.occurrences.total - data.matchedOccurrences : 0;

    const header = (
        <View style={styles.header}>
            <View style={styles.row}>
                <View style={styles.heading}>
                    <ThemedText type="title" accessibilityRole="header">Dashboard</ThemedText>
                    <ThemedText style={styles.caption}>Ocorrências e contexto dos bairros</ThemedText>
                </View>
                <Pressable accessibilityRole="button" accessibilityLabel="Atualizar dashboard"
                    disabled={vm.isLoading} onPress={() => void vm.reload()}
                    style={[styles.refresh, { borderColor: colors.border }]}>
                    <MaterialIcons name="refresh" size={25} color={colors.primary} />
                </Pressable>
            </View>

            {vm.isLoading && !data && <ActivityIndicator accessibilityLabel="Carregando dashboard" style={styles.loader} />}
            {vm.error && (
                <View style={[styles.notice, { borderColor: colors.border }]}>
                    <ThemedText accessibilityRole="alert">{vm.error}</ThemedText>
                    {data && <ThemedText style={styles.caption}>Exibindo a última atualização disponível.</ThemedText>}
                    <Pressable accessibilityRole="button" onPress={() => void vm.reload()}>
                        <ThemedText style={{ color: colors.primary }} type="defaultSemiBold">Tentar novamente</ThemedText>
                    </Pressable>
                </View>
            )}

            {data && <>
                <View style={styles.hero}>
                    <Text style={styles.heroLabel}>OCORRÊNCIAS NO APP</Text>
                    <Text style={styles.heroNumber}>{number(data.occurrences.total)}</Text>
                    <Text style={styles.heroCaption}>{number(data.matchedOccurrences)} localizadas nos bairros do Recife</Text>
                    <View style={styles.heroDivider} />
                    <View style={styles.metricsRow}>
                        <View style={styles.metric}>
                            <Text style={styles.heroValue}>{number(data.occurrences.saneamento)}</Text>
                            <Text style={styles.heroCaption}>de saneamento</Text>
                        </View>
                        <View style={styles.metric}>
                            <Text style={styles.heroValue}>{number(data.geography.mappedNeighborhoods)}</Text>
                            <Text style={styles.heroCaption}>bairros com indicadores</Text>
                        </View>
                    </View>
                </View>
                <View style={styles.metricsRow}>
                    {([
                        ['ABERTA', 'Abertas', '#dc8b25'], ['EM_ANALISE', 'Em análise', '#357ed4'],
                        ['RESOLVIDA', 'Resolvidas', '#23896f'],
                    ] as const).map(([status, label, color]) => (
                        <View key={status} style={[styles.statusCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                            <View style={[styles.dot, { backgroundColor: color }]} />
                            <ThemedText type="subtitle">{number(data.occurrences.byStatus[status] ?? 0)}</ThemedText>
                            <ThemedText style={styles.caption}>{label}</ThemedText>
                        </View>
                    ))}
                </View>
                <View style={[styles.notice, { borderColor: colors.border }]}>
                    <ThemedText type="defaultSemiBold">Como ler esta comparação</ThemedText>
                    <ThemedText style={styles.caption}>
                        Ocorrências de todo o período do app e indicadores do IBGE, com o ano de referência indicado em cada bairro. Os registros refletem o uso do aplicativo; não medem todos os problemas do bairro nem demonstram causa e efeito.
                    </ThemedText>
                    <ThemedText style={styles.caption}>Bairros identificados pelas coordenadas e pelos limites oficiais da Prefeitura do Recife.</ThemedText>
                    {missing > 0 && <ThemedText style={styles.caption}>
                        {number(missing)} sem vínculo com um bairro: {number(data.unmatched.withoutCoordinates)} sem coordenadas válidas, {number(data.unmatched.outsideCoverage)} fora da área coberta e {number(data.unmatched.ambiguous)} em limites compartilhados.
                    </ThemedText>}
                </View>
                <View style={styles.section}>
                    <ThemedText type="subtitle" accessibilityRole="header">Por bairro</ThemedText>
                    <ThemedText style={styles.caption}>Ordenado pelo número de ocorrências</ThemedText>
                    <TextInput accessibilityLabel="Buscar bairro" placeholder="Buscar bairro" value={vm.search}
                        onChangeText={vm.setSearch} placeholderTextColor={colors.text}
                        style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.card }]} />
                </View>
            </>}
        </View>
    );

    return (
        <ThemedView style={styles.screen}>
            <FlatList data={vm.neighborhoods} keyExtractor={(item) => item.codigoBairro}
                contentContainerStyle={[styles.content, { paddingTop: insets.top + 20 }]}
                ListHeaderComponent={header}
                renderItem={({ item }) => <NeighborhoodCard item={item} colors={colors} />}
                refreshControl={<RefreshControl refreshing={vm.isLoading && data !== null} onRefresh={() => void vm.reload()} />}
                ListEmptyComponent={data ? <ThemedText style={styles.empty}>
                    {vm.search ? 'Nenhum bairro encontrado.' : 'Ainda não há indicadores disponíveis.'}
                </ThemedText> : null}
                ListFooterComponent={data ? <ThemedText style={[styles.caption, styles.footer]}>
                    Fonte: {data.source}{'\n'}Resumo calculado em {new Date(data.updatedAt).toLocaleString('pt-BR')}
                </ThemedText> : null}
            />
        </ThemedView>
    );
}

const styles = StyleSheet.create({
    screen: { flex: 1 }, content: { paddingHorizontal: 20, paddingBottom: 32, gap: 14 },
    header: { gap: 20 }, heading: { flex: 1, gap: 6 }, row: { flexDirection: 'row', alignItems: 'center', gap: 12, justifyContent: 'space-between' },
    caption: { fontSize: 13, lineHeight: 19, opacity: 0.72 }, refresh: { borderWidth: 1, borderRadius: 16, padding: 12 },
    loader: { marginVertical: 32 }, hero: { borderRadius: 24, backgroundColor: '#173c45', padding: 24, gap: 8 },
    heroLabel: { color: '#b1d6cf', fontSize: 11, fontWeight: '700', letterSpacing: 1.5 },
    heroNumber: { color: '#fff', fontSize: 52, lineHeight: 60, fontWeight: '700' },
    heroCaption: { color: '#cae4de', fontSize: 13, lineHeight: 19 }, heroValue: { color: '#fff', fontSize: 24, fontWeight: '700' },
    heroDivider: { height: 1, backgroundColor: '#ffffff25', marginVertical: 12 },
    metricsRow: { flexDirection: 'row', gap: 12 }, metric: { flex: 1, gap: 4 },
    statusCard: { flex: 1, padding: 12, gap: 6, borderRadius: 18, borderWidth: 1 }, dot: { width: 7, height: 7, borderRadius: 4 },
    notice: { padding: 16, borderWidth: 1, borderRadius: 18, gap: 8 }, section: { gap: 8 },
    input: { borderWidth: 1, borderRadius: 14, padding: 14, fontSize: 16, marginTop: 6 },
    card: { borderWidth: 1, borderRadius: 20, padding: 18, gap: 14 },
    neighborhoodName: { flex: 1, fontSize: 18 }, badge: { borderRadius: 9, padding: 7, backgroundColor: '#dceee8' },
    badgeText: { color: '#22574b', fontWeight: '600', fontSize: 12 },
    track: { height: 6, borderRadius: 4, overflow: 'hidden' }, fill: { height: '100%', backgroundColor: '#388c76' },
    detail: { fontSize: 14, lineHeight: 20 }, empty: { paddingVertical: 24, textAlign: 'center' }, footer: { marginTop: 12 },
});
