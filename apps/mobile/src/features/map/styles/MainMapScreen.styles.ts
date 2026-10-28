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
        left: 16,
        gap: 8,
        borderRadius: 12,
        alignItems: 'flex-start',

    },
    avatarButton: {
        width: 48,
        height: 48,
        borderRadius: 12,
        backgroundColor: '#2563eb',
        alignItems: 'center',
        justifyContent: 'center',
    },
    messageBox: {
        position: 'absolute',
        top: 168,
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
    profileMenuItem: {
        minWidth: 120,
        minHeight: 48,
        paddingHorizontal: 16,
        justifyContent: 'center',
        borderRadius: 8,
    },
});
