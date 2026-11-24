import { ApiDashboardService } from './ApiDashboardService';
import { dashboardFixture } from '../__tests__/dashboardFixture';

it('busca o resumo no backend autenticado, sem acessar APIs públicas', async () => {
    const response = dashboardFixture();
    const request = jest.fn().mockResolvedValue(response);
    const controller = new AbortController();
    const service = new ApiDashboardService({ request });
    expect(await service.getSummary(controller.signal)).toEqual(response);
    expect(request).toHaveBeenCalledWith('/metrics/dashboard', { signal: controller.signal });
});
