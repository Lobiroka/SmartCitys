import { createButton } from '@gluestack-ui/core/button/creator';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';

const Button = createButton({
    Root: Pressable,
    Text,
    Group: View,
    Spinner: ActivityIndicator,
    Icon: View,
});

export function ActionButton({
    label, onPress, disabled = false,
}: {
    label: string;
    onPress: () => void;
    disabled?: boolean;
}) {
    return (
        <Button
            accessibilityRole="button"
            className="min-h-11 items-center justify-center rounded-lg bg-blue-700 px-4 py-2 disabled:opacity-50"
            isDisabled={disabled}
            onPress={onPress}
        >
            <Button.Text className="font-semibold text-white">{label}</Button.Text>
        </Button>
    );
}
