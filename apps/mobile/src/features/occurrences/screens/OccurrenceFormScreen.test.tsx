import { fireEvent, render, waitFor } from '@testing-library/react-native';

import { OccurrenceFormScreen } from './OccurrenceFormScreen';
import { useOccurrenceFormViewModel } from
    '@/src/features/occurrences/viewmodels/useOccurrenceFormViewModel';

const mockBack = jest.fn();

jest.mock('expo-router', () => ({
    router: { back: (...args: unknown[]) => mockBack(...args) },
}));

jest.mock('expo-camera', () => ({
    CameraView: 'CameraView',
    useCameraPermissions: () => [
        { granted: true },
        jest.fn().mockResolvedValue({ granted: true }),
    ],
}));

jest.mock('@/src/features/occurrences/viewmodels/useOccurrenceFormViewModel', () => ({
    useOccurrenceFormViewModel: jest.fn(),
}));

const useViewModelMock = jest.mocked(useOccurrenceFormViewModel);

function viewModel(overrides: Record<string, unknown> = {}) {
    return {
        title: '', setTitle: jest.fn(),
        description: '', setDescription: jest.fn(),
        address: '', setAddress: jest.fn(),
        category: 'ILUMINACAO_PUBLICA', setCategory: jest.fn(),
        region: 'REGIAO_METROPOLITANA_DO_RECIFE', setRegion: jest.fn(),
        priority: 'MEDIA', setPriority: jest.fn(),
        latitude: null, longitude: null,
        photo: null, setPhoto: jest.fn(),
        isLoading: false, isSaving: false, error: null,
        useCurrentLocation: jest.fn(),
        save: jest.fn().mockResolvedValue(true),
        ...overrides,
    };
}

describe('OccurrenceFormScreen', () => {
    it('liga os campos da View aos comandos do ViewModel', async () => {
        const vm = viewModel();
        useViewModelMock.mockReturnValue(vm as never);
        const screen = await render(<OccurrenceFormScreen />);

        fireEvent.changeText(screen.getByTestId('occurrence-title-input'), 'Título');
        fireEvent.changeText(screen.getByTestId('occurrence-description-input'), 'Descrição');
        fireEvent.changeText(screen.getByTestId('occurrence-address-input'), 'Endereço');
        fireEvent.press(screen.getByTestId('occurrence-location-button'));

        expect(vm.setTitle).toHaveBeenCalledWith('Título');
        expect(vm.setDescription).toHaveBeenCalledWith('Descrição');
        expect(vm.setAddress).toHaveBeenCalledWith('Endereço');
        expect(vm.useCurrentLocation).toHaveBeenCalledTimes(1);
    });

    it('volta somente quando o ViewModel salva com sucesso', async () => {
        const vm = viewModel();
        useViewModelMock.mockReturnValue(vm as never);
        const screen = await render(<OccurrenceFormScreen />);

        fireEvent.press(screen.getByTestId('occurrence-save-button'));

        await waitFor(() => expect(vm.save).toHaveBeenCalledTimes(1));
        expect(mockBack).toHaveBeenCalledTimes(1);
    });

    it('permanece no formulário e apresenta o erro quando o save falha', async () => {
        const vm = viewModel({
            error: 'Confirme a localização da ocorrência.',
            save: jest.fn().mockResolvedValue(false),
        });
        useViewModelMock.mockReturnValue(vm as never);
        const screen = await render(<OccurrenceFormScreen />);

        fireEvent.press(screen.getByTestId('occurrence-save-button'));

        await waitFor(() => expect(vm.save).toHaveBeenCalledTimes(1));
        expect(mockBack).not.toHaveBeenCalled();
        expect(screen.getByText('Confirme a localização da ocorrência.'))
            .toBeTruthy();
    });

    it('diferencia visualmente criação de edição', async () => {
        useViewModelMock.mockReturnValue(viewModel() as never);
        expect((await render(<OccurrenceFormScreen />)).getByText('Nova ocorrência'))
            .toBeTruthy();
        expect((await render(<OccurrenceFormScreen id={8} />)).getByText('Editar ocorrência'))
            .toBeTruthy();
    });
});
