import { act, renderHook, waitFor } from '@testing-library/react-native';
import { inundationService } from '@/src/composition/appDependencies';
import { useInundationViewModel } from './useInundationViewModel';

jest.mock('@/src/composition/appDependencies',()=>({inundationService:{getAreas:jest.fn()}}));

it('permite repetir uma falha da camada',async()=>{
    const data={source:'SGB',items:[]};
    jest.mocked(inundationService.getAreas).mockRejectedValueOnce(new Error('indisponível')).mockResolvedValueOnce(data);
    const {result}=await renderHook(()=>useInundationViewModel());
    await waitFor(()=>expect(result.current.isLoading).toBe(false));
    expect(result.current.error).toMatch(/cadastro continua/);
    await act(async()=>result.current.reload());
    await waitFor(()=>expect(result.current.layer).toEqual(data));
    expect(result.current.error).toBeNull();
});

it('cancela a consulta ao sair da tela',async()=>{
    jest.mocked(inundationService.getAreas).mockImplementation(()=>new Promise(()=>{}));
    const screen=await renderHook(()=>useInundationViewModel());
    const signal=jest.mocked(inundationService.getAreas).mock.lastCall?.[0];
    expect(signal?.aborted).toBe(false);
    screen.unmount();
    expect(signal?.aborted).toBe(true);
});
