import { act, renderHook, waitFor } from '@testing-library/react-native';

import { createOccurrenceServiceMock } from
    '@/src/features/occurrences/__tests__/helpers/createOccurrenceServiceMock';
import { occurrenceFixture } from
    '@/src/features/occurrences/__tests__/helpers/occurrenceFixture';
import { useOccurrenceFormViewModel } from './useOccurrenceFormViewModel';

describe('useOccurrenceFormViewModel', () => {
    const coordinates = { latitude: -8.0476, longitude: -34.877 };

    async function setup(id?: number) {
        const service = createOccurrenceServiceMock();
        const getCoordinates = jest.fn().mockResolvedValue(coordinates);
        service.create.mockResolvedValue(occurrenceFixture());
        service.update.mockResolvedValue(occurrenceFixture({ id: id ?? 1 }));
        service.getById.mockResolvedValue(occurrenceFixture({ id: id ?? 1 }));
        const dependencies = { service, getCoordinates };
        const hook = renderHook(() =>
            useOccurrenceFormViewModel(id, dependencies),
        );
        if (id) {
            await act(async () => { await Promise.resolve(); });
        }
        return { ...hook, service, getCoordinates };
    }

    it('impede salvar quando os campos obrigatórios estão vazios', async () => {
        const { result, service } = await setup();

        await act(async () => {
            expect(await result.current.save()).toBe(false);
        });

        expect(result.current.error)
            .toBe('Preencha título, descrição e endereço.');
        expect(service.create).not.toHaveBeenCalled();
    });

    it('exige coordenadas antes de criar a ocorrência', async () => {
        const { result, service } = await setup();
        act(() => {
            result.current.setTitle('Título');
            result.current.setDescription('Descrição');
            result.current.setAddress('Endereço');
        });

        await act(async () => {
            expect(await result.current.save()).toBe(false);
        });

        expect(result.current.error)
            .toBe('Confirme a localização da ocorrência.');
        expect(service.create).not.toHaveBeenCalled();
    });

    it('obtém o GPS e envia um input normalizado na criação', async () => {
        const { result, service, getCoordinates } = await setup();
        act(() => {
            result.current.setTitle('  Título  ');
            result.current.setDescription('  Descrição  ');
            result.current.setAddress('  Endereço  ');
            result.current.setPhoto('data:image/jpeg;base64,photo');
        });
        await act(async () => result.current.useCurrentLocation());
        await act(async () => {
            expect(await result.current.save()).toBe(true);
        });

        expect(getCoordinates).toHaveBeenCalledTimes(1);
        expect(service.create).toHaveBeenCalledWith(expect.objectContaining({
            title: 'Título',
            description: 'Descrição',
            address: 'Endereço',
            ...coordinates,
            images: ['data:image/jpeg;base64,photo'],
        }));
    });

    it('carrega a ocorrência e usa update no modo de edição', async () => {
        const { result, service } = await setup(9);
        await waitFor(() => expect(result.current.isLoading).toBe(false));

        await act(async () => {
            expect(await result.current.save()).toBe(true);
        });

        expect(service.getById).toHaveBeenCalledWith(9);
        expect(service.update).toHaveBeenCalledWith(
            9,
            expect.objectContaining({ title: 'Poste sem iluminação' }),
        );
        expect(service.create).not.toHaveBeenCalled();
    });
});
