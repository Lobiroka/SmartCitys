import type { PolygonGeometry } from '../utils/neighborhoodGeometry';

export interface NeighborhoodIndicatorRow {
  codigo_bairro: string;
  bairro: string | null;
  populacao: number | null;
  domicilios_total: number | null;
  domicilios_rede_geral: number | null;
  percentual_rede_esgoto: number | null;
  ano: number | null;
  data_extracao: Date | null;
}

export interface DashboardOccurrenceRow {
  categoria: string;
  status: string;
  latitude: number | null;
  longitude: number | null;
}
export interface DashboardNeighborhoodRow extends NeighborhoodIndicatorRow {
  geometria: PolygonGeometry | null;
  limites_data_extracao: Date | null;
}
