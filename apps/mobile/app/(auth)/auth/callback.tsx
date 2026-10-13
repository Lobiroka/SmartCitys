import {
    ActivityIndicator,
    StyleSheet,
    Text,
    View,
} from 'react-native';

export default function AuthCallbackRoute() {
    return (
        <View style={styles.container}>
            <ActivityIndicator />
            <Text>Concluindo login...</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
    },
});