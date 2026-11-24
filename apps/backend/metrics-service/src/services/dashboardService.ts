import { findDashboardOccurrences, findDashboardNeighborhoods } from '../repositories/dashboardRepository';
import { buildDashboard } from '../domain/dashboardAggregation';
export { buildDashboard } from '../domain/dashboardAggregation';

export async function getDashboard() {
  try {
    const [occurrences, neighborhoods] = await Promise.all([
      findDashboardOccurrences(), findDashboardNeighborhoods(),
    ]);
    if (neighborhoods.length === 0 || neighborhoods.some((row) => !row.geometria)) {
      throw new Error('Carga geográfica incompleta');
    }
    return buildDashboard(occurrences, neighborhoods);
  } catch {
    throw Object.assign(new Error('Dashboard temporariamente indisponível. Tente novamente mais tarde.'), { status: 503 });
  }
}
