import {StyleSheet} from "react-native";

export const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    map: {
        width: '100%',
        height: '100%',
    },
    sessionBox: {
        position: 'absolute',
        top: 48,
        right: 16,
        maxWidth: 220,
        padding: 12,
        gap: 8,
        borderRadius: 8,
        alignItems: 'flex-end',
    },
    messageBox: {
        position: 'absolute',
        top: 48,
        left: 16,
        right: 16,
        backgroundColor: '#fff',
        padding: 12,
        borderRadius: 8,
    },
    occurrenceErrorBox: {
        position: 'absolute',
        bottom: 100,
        left: 16,
        right: 16,
        backgroundColor: '#fff',
        padding: 12,
        borderRadius: 8,
    },
    callout: {
        width: 220,
        gap: 4,
    },
    calloutTitle: {
        fontSize: 16,
        fontWeight: '700',
    },
});
