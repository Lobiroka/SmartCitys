import { ApiInundationService } from './ApiInundationService';

it('consulta a camada pelo cliente HTTP autenticado e encaminha cancelamento', async () => {
    const layer = { source: 'SGB', items: [] };
    const request = jest.fn().mockResolvedValue(layer);
    const controller = new AbortController();
    const service = new ApiInundationService({ request });

    expect(await service.getAreas(controller.signal)).toEqual(layer);
    expect(request).toHaveBeenCalledWith('/metrics/inundation', { signal: controller.signal });
});
