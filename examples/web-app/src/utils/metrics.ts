import type { TileData } from '../types';

export function readMetricValue(item: TileData, field: string): number | null {
  const fromMetrics = item.metrics?.[field];
  if (typeof fromMetrics === 'number' && Number.isFinite(fromMetrics)) {
    return fromMetrics;
  }
  const facetValue = item.facets[field];
  if (typeof facetValue === 'number' && Number.isFinite(facetValue)) {
    return facetValue;
  }
  if (typeof facetValue === 'string') {
    const parsed = Number.parseFloat(facetValue);
    if (!Number.isNaN(parsed)) {
      return parsed;
    }
  }
  return null;
}

export function collectMetricValues(items: TileData[], field: string): number[] {
  const values: number[] = [];
  for (const item of items) {
    const value = readMetricValue(item, field);
    if (value != null) {
      values.push(value);
    }
  }
  return values;
}
