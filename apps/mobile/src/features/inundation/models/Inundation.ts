export type Position = [number, number];
export type InundationClass = 'Baixa' | 'Média' | 'Alta';
export type InundationArea = {
    id: string;
    classe: InundationClass;
    ano: number | null;
    descricaoFonte: string | null;
    geometry: { type: 'Polygon'; coordinates: Position[][] }
        | { type: 'MultiPolygon'; coordinates: Position[][][] };
    bbox: [number, number, number, number];
    fonte: string;
    dataExtracao: string;
};
export type InundationLayer = { source: string; items: InundationArea[] };
