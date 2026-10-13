import { mapOccurrenceApiDto } from './mapOccurrenceApiDto';
import type { OccurrenceApiDto } from './OccurrenceApiDto';

function dto(
    overrides: Partial<OccurrenceApiDto> = {},
): OccurrenceApiDto {
    return {
        id_denuncia: 12,
        titulo: 'Buraco na via',
        categoria: 'MANUTENCAO_DE_VIAS',
        regiao: 'AGRESTE',
        descricao: 'Buraco profundo próximo à esquina.',
        status: 'ABERTA',
        prioridade: 'ALTA',
        data_registro: '2026-09-23T12:00:00.000Z',
        endereco: 'Rua Central, 20',
        latitude: '-8.1234',
        longitude: -34.9876,
        email_solicitante: 'pessoa@example.com',
        cidadao_id: 7,
        imagens: [{
            id_imagem: 3,
            caminho_file: 'data:image/jpeg;base64,photo',
            data_upload: '2026-09-23T12:01:00.000Z',
            denuncia_id: 12,
        }],
        ...overrides,
    };
}

describe('mapOccurrenceApiDto', () => {
    it('converte o contrato da API para o model do aplicativo', () => {
        const result = mapOccurrenceApiDto(dto());

        expect(result).toMatchObject({
            id: 12,
            title: 'Buraco na via',
            latitude: -8.1234,
            longitude: -34.9876,
            requesterEmail: 'pessoa@example.com',
        });
        expect(result.images).toEqual([{
            id: 3,
            path: 'data:image/jpeg;base64,photo',
            uploadedAt: '2026-09-23T12:01:00.000Z',
        }]);
    });

    it.each([null, undefined, 'inválida'])(
        'normaliza a coordenada %p como ausente',
        (latitude) => {
            expect(mapOccurrenceApiDto(dto({ latitude })).latitude).toBeNull();
        },
    );
});
