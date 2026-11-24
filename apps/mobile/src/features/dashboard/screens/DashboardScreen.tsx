import { useTheme } from 'expo-router/react-navigation';
import { useDashboardViewModel } from '../viewmodels/useDashboardViewModel';
import { DashboardView } from './DashboardView';

export function DashboardScreen() {
    const { colors } = useTheme();
    return <DashboardView viewModel={useDashboardViewModel()} colors={colors} />;
}
