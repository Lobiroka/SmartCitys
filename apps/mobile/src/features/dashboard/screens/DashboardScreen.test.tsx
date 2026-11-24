import { fireEvent, render } from '@testing-library/react-native';
import { DashboardScreen } from './DashboardScreen';
import { useDashboardViewModel } from '../viewmodels/useDashboardViewModel';
import { dashboardFixture } from '../__tests__/dashboardFixture';

jest.mock('expo-router/react-navigation', () => ({ useTheme: () => ({ colors: { card:'#fff',border:'#ddd',text:'#123',primary:'#276' } }) }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({top:0,bottom:0,left:0,right:0}) }));
jest.mock('../viewmodels/useDashboardViewModel', () => ({ useDashboardViewModel: jest.fn() }));
const viewModel = jest.mocked(useDashboardViewModel);

function model(overrides: Record<string, unknown> = {}) {
    const dashboard = dashboardFixture();
    return { dashboard, neighborhoods: dashboard.items, isLoading:false,error:null,search:'',setSearch:jest.fn(),reload:jest.fn(), ...overrides };
}

it('mostra comparação, fonte, ano histórico e casos sem vínculo; delega busca e atualização', async () => {
    const vm = model();
    viewModel.mockReturnValue(vm as never);
    const screen = await render(<DashboardScreen />);
    expect(screen.getByText('Várzea')).toBeTruthy();
    expect(screen.getByText('População · 2010')).toBeTruthy();
    expect(screen.getByText('50%')).toBeTruthy();
    expect(screen.getByText(/sem vínculo com um bairro/)).toBeTruthy();
    fireEvent.changeText(screen.getByLabelText('Buscar bairro'),'varzea');
    expect(vm.setSearch).toHaveBeenCalledWith('varzea');
    fireEvent.press(screen.getByLabelText('Atualizar dashboard'));
    expect(vm.reload).toHaveBeenCalled();
});

it('oferece nova tentativa quando os dados não estão disponíveis', async () => {
    const vm = model({dashboard:null,neighborhoods:[],error:'Não foi possível atualizar o dashboard. Tente novamente.'});
    viewModel.mockReturnValue(vm as never);
    const screen = await render(<DashboardScreen />);
    fireEvent.press(screen.getByText('Tentar novamente'));
    expect(vm.reload).toHaveBeenCalled();
    expect(screen.queryByText('Por bairro')).toBeNull();
});
