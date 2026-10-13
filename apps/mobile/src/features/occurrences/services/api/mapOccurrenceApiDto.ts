import type { Occurrence } from
    '@/src/features/occurrences/models/Occurrence';
import type { OccurrenceApiDto } from
    '@/src/features/occurrences/services/api/OccurrenceApiDto';

export function mapOccurrenceApiDto(
    dto: OccurrenceApiDto,
): Occurrence {
    return {
        id: dto.id_denuncia,
        title: dto.titulo,
        category: dto.categoria,
        region: dto.regiao,
        description: dto.descricao,
        status: dto.status,
        priority: dto.prioridade,
        createdAt: dto.data_registro,
        address: dto.endereco,
        latitude: toCoordinate(dto.latitude),
        longitude: toCoordinate(dto.longitude),
        requesterEmail: dto.email_solicitante,
        images: dto.imagens.map((image) => ({
            id: image.id_imagem,
            path: image.caminho_file,
            uploadedAt: image.data_upload,
        })),
    };
}

function toCoordinate(
    value: number | string | null | undefined,
): number | null {
    if (value === null || value === undefined) {
        return null;
    }

    const coordinate = Number(value);
    return Number.isFinite(coordinate) ? coordinate : null;
}
