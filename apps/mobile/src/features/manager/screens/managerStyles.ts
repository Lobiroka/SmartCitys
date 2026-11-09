import { StyleSheet } from 'react-native';

export const managerStyles = StyleSheet.create({
    screen: { flex: 1 },
    content: { padding: 20, gap: 16 },
    header: { gap: 6 },
    spread: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
    choices: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    panel: { padding: 16, gap: 8, borderWidth: 1, borderRadius: 12 },
    section: { gap: 8 },
    button: { paddingHorizontal: 12, paddingVertical: 10, minHeight: 44, borderRadius: 8, borderWidth: 1 },
    center: { alignItems: 'center', gap: 12, paddingVertical: 24 },
});
