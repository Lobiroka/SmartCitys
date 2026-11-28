import { act, fireEvent, render, waitFor } from '@testing-library/react-native';

import { OccurrenceFormScreen } from './OccurrenceFormScreen';
import { useOccurrenceFormViewModel } from
    '@/src/features/occurrences/viewmodels/useOccurrenceFormViewModel';
import { SgbOccurrenceMap } from '@/src/features/inundation/components/SgbOccurrenceMap';

const mockBack = jest.fn();
const mockTakePicture = jest.fn();

jest.mock('expo-router', () => ({
    router: { back: (...args: unknown[]) => mockBack(...args) },
}));

jest.mock('expo-camera', () => ({
    CameraView: jest.requireActual<typeof import('react')>('react').forwardRef(
        function MockCamera(props: { onCameraReady?: () => void }, ref) {
            jest.requireActual<typeof import('react')>('react').useEffect(() => {
                props.onCameraReady?.();
            }, [props.onCameraReady]);
            jest.requireActual<typeof import('react')>('react').useImperativeHandle(ref, () => ({
                takePictureAsync: (...args: unknown[]) => mockTakePicture(...args),
            }));
            return null;
        },
    ),
    useCameraPermissions: () => [
        { granted: true },
        jest.fn().mockResolvedValue({ granted: true }),
    ],
}));

jest.mock('@/src/features/occurrences/viewmodels/useOccurrenceFormViewModel', () => ({
    useOccurrenceFormViewModel: jest.fn(),
}));

jest.mock('@/src/features/inundation/components/SgbOccurrenceMap', () => ({
    SgbOccurrenceMap: jest.fn(() => null),
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
        useShoppingRecifeAddress: jest.fn(),
        save: jest.fn().mockResolvedValue(true),
        ...overrides,
    };
}

describe('OccurrenceFormScreen', () => {
    it('apresenta no mapa as coordenadas do formulário e mantém o GPS disponível', async () => {
        useViewModelMock.mockReturnValue(viewModel({ latitude: -8.1197, longitude: -34.9043 }) as never);
        const screen = await render(<OccurrenceFormScreen />);

        expect(jest.mocked(SgbOccurrenceMap).mock.calls[0][0])
            .toEqual({ latitude: -8.1197, longitude: -34.9043 });
        expect(screen.getByText('-8.119700, -34.904300')).toBeTruthy();
        expect(screen.getByTestId('occurrence-coordinates')).toBeTruthy();
        expect(screen.getByTestId('occurrence-location-button')).toBeTruthy();
    });

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

    it('TC-16: na edição, aguarda sucesso antes de voltar', async () => {
        let finishSave!: (success: boolean) => void;
        const pendingSave = new Promise<boolean>((resolve) => {
            finishSave = resolve;
        });
        const vm = viewModel({ save: jest.fn(() => pendingSave) });
        useViewModelMock.mockReturnValue(vm as never);
        const screen = await render(<OccurrenceFormScreen id={9} />);

        fireEvent.press(screen.getByTestId('occurrence-save-button'));

        await waitFor(() => expect(vm.save).toHaveBeenCalledTimes(1));
        expect(mockBack).not.toHaveBeenCalled();
        await act(async () => finishSave(true));
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

    it('captura a foto e entrega o base64 ao formulário', async () => {
        mockTakePicture.mockResolvedValueOnce({ base64: 'imagem' });
        const vm = viewModel();
        useViewModelMock.mockReturnValue(vm as never);
        const screen = await render(<OccurrenceFormScreen />);
        fireEvent.press(screen.getByTestId('occurrence-camera-button'));
        await waitFor(() => expect(screen.getByTestId('occurrence-capture-button')).toBeTruthy());
        fireEvent.press(screen.getByTestId('occurrence-capture-button'));

        await waitFor(() => expect(vm.setPhoto).toHaveBeenCalledWith('data:image/jpeg;base64,imagem'));
        expect(screen.queryByTestId('occurrence-capture-button')).toBeNull();
    });

    it('permite tentar novamente depois de falha na captura', async () => {
        mockTakePicture.mockRejectedValueOnce(new Error('Camera indisponível'))
            .mockResolvedValueOnce({ base64: 'nova-imagem' });
        const vm = viewModel();
        useViewModelMock.mockReturnValue(vm as never);
        const screen = await render(<OccurrenceFormScreen />);
        fireEvent.press(screen.getByTestId('occurrence-camera-button'));
        await waitFor(() => expect(screen.getByTestId('occurrence-capture-button')).toBeTruthy());
        fireEvent.press(screen.getByTestId('occurrence-capture-button'));

        await waitFor(() => expect(screen.getByText('Não foi possível capturar a foto. Tente novamente.')).toBeTruthy());
        expect(vm.setPhoto).not.toHaveBeenCalled();
        fireEvent.press(screen.getByTestId('occurrence-capture-button'));
        await waitFor(() => expect(vm.setPhoto).toHaveBeenCalledWith('data:image/jpeg;base64,nova-imagem'));
    });

    it('diferencia visualmente criação de edição', async () => {
        useViewModelMock.mockReturnValue(viewModel() as never);
        expect((await render(<OccurrenceFormScreen />)).getByText('Nova ocorrência'))
            .toBeTruthy();
        expect((await render(<OccurrenceFormScreen id={8} />)).getByText('Editar ocorrência'))
            .toBeTruthy();
    });
});
