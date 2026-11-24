export type Position = [number, number];
export type PolygonGeometry =
  | { type: 'Polygon'; coordinates: Position[][] }
  | { type: 'MultiPolygon'; coordinates: Position[][][] };

function ringLocation(point: Position, ring: Position[]): 'inside' | 'outside' | 'border' {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [x, y] = point;
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    const dx = xj - xi;
    const dy = yj - yi;
    if (dx === 0 && dy === 0) continue;
    const cross = (x - xi) * dy - (y - yi) * dx;
    if (Math.abs(cross) < 1e-12 && x >= Math.min(xi, xj) && x <= Math.max(xi, xj)
      && y >= Math.min(yi, yj) && y <= Math.max(yi, yj)) return 'border';
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside ? 'inside' : 'outside';
}

export function containsPoint(geometry: PolygonGeometry, point: Position): boolean {
  const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;
  return polygons.some((rings) => {
    if (ringLocation(point, rings[0]) === 'outside') return false;
    // Buracos não pertencem ao bairro, incluindo suas bordas.
    return !rings.slice(1).some((ring) => ringLocation(point, ring) !== 'outside');
  });
}

export function geometryBounds(geometry: PolygonGeometry): [number, number, number, number] {
  const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const rings of polygons) for (const [x, y] of rings[0]) {
    minX = Math.min(minX, x); minY = Math.min(minY, y);
    maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
  }
  return [minX, minY, maxX, maxY];
}
