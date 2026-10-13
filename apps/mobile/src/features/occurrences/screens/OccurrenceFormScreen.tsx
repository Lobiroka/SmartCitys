import { useRef, useState, type ReactNode } from 'react';
import {
    ActivityIndicator,
    Image,
    Pressable,
    ScrollView,
    StyleSheet,
    TextInput,
    View,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { router } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import {
    occurrenceCategories,
    occurrencePriorities,
    occurrenceRegions,
} from '@/src/features/occurrences/models/occurrenceOptions';
import { useOccurrenceFormViewModel } from
    '@/src/features/occurrences/viewmodels/useOccurrenceFormViewModel';

type Props = { id?: number };

export function OccurrenceFormScreen({ id }: Props) {
    const vm = useOccurrenceFormViewModel(id);
    const scheme = useColorScheme() ?? 'light';
    const colors = Colors[scheme];
    const cameraRef = useRef<CameraView>(null);
    const [permission, requestPermission] = useCameraPermissions();
    const [cameraOpen, setCameraOpen] = useState(false);
    const [cameraError, setCameraError] = useState<string | null>(null);

    async function openCamera() {
        setCameraError(null);
        if (!permission?.granted) {
            const result = await requestPermission();
            if (!result.granted) {
                setCameraError('A permissão da câmera não foi concedida.');
                return;
            }
        }
        setCameraOpen(true);
    }

    async function capturePhoto() {
        const result = await cameraRef.current?.takePictureAsync({ base64: true, quality: 0.35 });
        if (result?.base64) {
            vm.setPhoto(`data:image/jpeg;base64,${result.base64}`);
            setCameraOpen(false);
        }
    }

    async function submit() {
        if (await vm.save()) router.back();
    }

    if (vm.isLoading) {
        return <ThemedView style={styles.center}><ActivityIndicator /></ThemedView>;
    }

    if (cameraOpen) {
        return (
            <View style={styles.cameraContainer}>
                <CameraView ref={cameraRef} style={styles.camera} facing="back" />
                <View style={styles.cameraActions}>
                    <Pressable style={styles.cameraButton} onPress={() => setCameraOpen(false)}>
                        <ThemedText lightColor="#fff" darkColor="#fff">Cancelar</ThemedText>
                    </Pressable>
                    <Pressable accessibilityLabel="Capturar foto" style={styles.captureButton}
                        onPress={() => { void capturePhoto(); }} />
                </View>
            </View>
        );
    }

    const inputStyle = [styles.input, { color: colors.text, borderColor: colors.icon }];

    return (
        <ThemedView style={styles.container}>
            <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
                <ThemedText type="title">{id ? 'Editar ocorrência' : 'Nova ocorrência'}</ThemedText>
                <Field label="Título">
                    <TextInput value={vm.title} onChangeText={vm.setTitle} maxLength={50}
                        testID="occurrence-title-input"
                        style={inputStyle} placeholder="Ex.: Poste sem iluminação"
                        placeholderTextColor={colors.icon} />
                </Field>
                <Field label="Descrição">
                    <TextInput value={vm.description} onChangeText={vm.setDescription} multiline
                        testID="occurrence-description-input"
                        style={[inputStyle, styles.multiline]} placeholder="Descreva o problema"
                        placeholderTextColor={colors.icon} />
                </Field>
                <Field label="Endereço">
                    <TextInput value={vm.address} onChangeText={vm.setAddress} style={inputStyle}
                        testID="occurrence-address-input"
                        placeholder="Rua, número e referência" placeholderTextColor={colors.icon} />
                </Field>
                <OptionGroup label="Categoria" options={occurrenceCategories}
                    value={vm.category} onChange={vm.setCategory} />
                <OptionGroup label="Região" options={occurrenceRegions}
                    value={vm.region} onChange={vm.setRegion} />
                <OptionGroup label="Prioridade" options={occurrencePriorities}
                    value={vm.priority} onChange={vm.setPriority} />
                <Field label="Localização">
                    <ThemedText>
                        {vm.latitude === null || vm.longitude === null
                            ? 'Localização ainda não confirmada.'
                            : `${vm.latitude.toFixed(6)}, ${vm.longitude.toFixed(6)}`}
                    </ThemedText>
                    <Pressable style={styles.secondaryButton}
                        testID="occurrence-location-button"
                        onPress={() => { void vm.useCurrentLocation(); }}>
                        <ThemedText>Usar localização atual</ThemedText>
                    </Pressable>
                </Field>
                <Field label="Foto">
                    {vm.photo && <Image source={{ uri: vm.photo }} style={styles.preview} />}
                    <View style={styles.row}>
                        <Pressable testID="occurrence-camera-button"
                            style={styles.secondaryButton} onPress={() => { void openCamera(); }}>
                            <ThemedText>{vm.photo ? 'Tirar outra foto' : 'Abrir câmera'}</ThemedText>
                        </Pressable>
                        {vm.photo && (
                            <Pressable style={styles.secondaryButton} onPress={() => vm.setPhoto(null)}>
                                <ThemedText>Remover foto</ThemedText>
                            </Pressable>
                        )}
                    </View>
                    {cameraError && <ThemedText style={styles.error}>{cameraError}</ThemedText>}
                </Field>
                {vm.error && <ThemedText style={styles.error}>{vm.error}</ThemedText>}
                <Pressable style={[styles.saveButton, vm.isSaving && styles.disabled]}
                    testID="occurrence-save-button"
                    disabled={vm.isSaving} onPress={() => { void submit(); }}>
                    {vm.isSaving
                        ? <ActivityIndicator color="#fff" />
                        : <ThemedText lightColor="#fff" darkColor="#fff">Salvar ocorrência</ThemedText>}
                </Pressable>
            </ScrollView>
        </ThemedView>
    );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
    return <View style={styles.field}><ThemedText type="defaultSemiBold">{label}</ThemedText>{children}</View>;
}

function OptionGroup<T extends string>({ label, options, value, onChange }: {
    label: string;
    options: { value: T; label: string }[];
    value: T;
    onChange: (value: T) => void;
}) {
    return (
        <Field label={label}>
            <View style={styles.options}>
                {options.map((option) => {
                    const selected = option.value === value;
                    return (
                        <Pressable key={option.value}
                            style={[styles.chip, selected && styles.chipSelected]}
                            onPress={() => onChange(option.value)}>
                            <ThemedText lightColor={selected ? '#fff' : undefined}
                                darkColor={selected ? '#fff' : undefined}>{option.label}</ThemedText>
                        </Pressable>
                    );
                })}
            </View>
        </Field>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    content: { padding: 20, paddingBottom: 48, gap: 20 },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    field: { gap: 8 },
    input: { borderWidth: 1, borderRadius: 12, padding: 12, fontSize: 16 },
    multiline: { minHeight: 110, textAlignVertical: 'top' },
    options: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    chip: { borderWidth: 1, borderColor: '#8a8a8a', borderRadius: 999, paddingHorizontal: 13, paddingVertical: 7 },
    chipSelected: { backgroundColor: '#0a7ea4', borderColor: '#0a7ea4' },
    secondaryButton: { alignSelf: 'flex-start', borderWidth: 1, borderColor: '#0a7ea4', borderRadius: 999, paddingHorizontal: 16, paddingVertical: 9 },
    saveButton: { backgroundColor: '#0a7ea4', minHeight: 48, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
    disabled: { opacity: 0.6 },
    row: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    preview: { width: '100%', height: 220, borderRadius: 14 },
    error: { color: '#b3261e' },
    cameraContainer: { flex: 1, backgroundColor: '#000' },
    camera: { flex: 1 },
    cameraActions: { position: 'absolute', left: 0, right: 0, bottom: 40, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around' },
    cameraButton: { backgroundColor: '#000a', borderRadius: 999, paddingHorizontal: 18, paddingVertical: 12 },
    captureButton: { width: 72, height: 72, borderRadius: 36, backgroundColor: '#fff', borderWidth: 6, borderColor: '#bbb' },
});
