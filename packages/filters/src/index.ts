import type {
  FacetValue,
  FilterPredicate,
  ItemRecord,
  NumericStats,
  RangeConstraint,
} from './types.js';

interface ActiveFilter {
  field: string;
  predicate: FilterPredicate;
}

export class FilterEngine {
  #source: ItemRecord[] = [];
  #filters: Map<string, ActiveFilter> = new Map();

  constructor(items: ItemRecord[] = []) {
    if (items.length > 0) {
      this.load(items);
    }
  }

  load(items: ItemRecord[]): void {
    this.#source = [...items];
  }

  clear(): void {
    this.#source = [];
    this.#filters.clear();
  }

  applyFilter(field: string, predicate: FilterPredicate): void {
    this.#filters.set(field, { field, predicate });
  }

  applyRangeFilter(field: string, range: RangeConstraint): void {
    const { min, max, inclusive = true } = range;
    this.applyFilter(field, (value) => {
      if (value == null) return false;
      const values = Array.isArray(value) ? value : [value];
      return values.some((entry) => {
        const numeric = this.#coerceNumber(entry);
        const temporal = entry instanceof Date ? entry.getTime() : undefined;
        const target = numeric ?? temporal;
        if (target == null) return false;
        if (min != null) {
          const minValue = min instanceof Date ? min.getTime() : (min as number);
          if (inclusive ? target < minValue : target <= minValue) {
            return false;
          }
        }
        if (max != null) {
          const maxValue = max instanceof Date ? max.getTime() : (max as number);
          if (inclusive ? target > maxValue : target >= maxValue) {
            return false;
          }
        }
        return true;
      });
    });
  }

  applyDiscreteFilter(field: string, allowedValues: readonly (string | number | boolean | Date)[]): void {
    const allowSet = new Set(allowedValues.map((value) => this.#normaliseDiscreteValue(value)));
    this.applyFilter(field, (value) => {
      if (value == null) return false;
      const values = Array.isArray(value) ? value : [value];
      return values.some((entry) => {
        return allowSet.has(this.#normaliseDiscreteValue(entry));
      });
    });
  }

  removeFilter(field: string): void {
    this.#filters.delete(field);
  }

  listActiveFilters(): string[] {
    return [...this.#filters.keys()];
  }

  getFilteredItems(): ItemRecord[] {
    return this.#applyFilters();
  }

  getFacetCounts(field: string): Array<{ key: string; count: number }> {
    const baseline = this.#applyFilters(field);
    const counts = new Map<string, number>();
    for (const item of baseline) {
      const raw = item.facets[field];
      if (raw == null) continue;
      const values = Array.isArray(raw) ? raw : [raw];
      for (const entry of values) {
        const label = this.#stringifyFacet(entry);
        counts.set(label, (counts.get(label) ?? 0) + 1);
      }
    }
    return [...counts.entries()]
      .map(([key, count]) => ({ key, count }))
      .sort((a, b) => (b.count === a.count ? a.key.localeCompare(b.key) : b.count - a.count));
  }

  getNumericStats(
    field: string,
    { includePercentiles = false, histogramBins = 24 }: { includePercentiles?: boolean; histogramBins?: number } = {}
  ): NumericStats | null {
    const values: number[] = [];
    for (const item of this.#applyFilters()) {
      const maybeNumeric = this.#readNumericField(item, field);
      if (maybeNumeric != null) {
        values.push(maybeNumeric);
      }
    }
    if (values.length === 0) return null;
    values.sort((a, b) => a - b);
    const min = values[0];
    const max = values[values.length - 1];
    const stats: NumericStats = {
      field,
      min,
      max,
      count: values.length,
      histogram: this.#buildHistogram(values, histogramBins),
    };
    if (includePercentiles && values.length > 3) {
      stats.p01 = this.#percentile(values, 0.01);
      stats.p99 = this.#percentile(values, 0.99);
    }
    return stats;
  }

  #applyFilters(skipField?: string): ItemRecord[] {
    if (this.#filters.size === 0) return [...this.#source];
    const filters = [...this.#filters.values()].filter((entry) => entry.field !== skipField);
    if (filters.length === 0) return [...this.#source];
    return this.#source.filter((item) => filters.every((filter) => filter.predicate(item.facets[filter.field], item)));
  }

  #stringifyFacet(value: FacetValue): string {
    if (value instanceof Date) {
      return value.toISOString();
    }
    return `${value}`;
  }

  #coerceNumber(value: FacetValue): number | null {
    if (typeof value === 'number') {
      if (Number.isNaN(value)) return null;
      return value;
    }
    if (value instanceof Date) {
      return value.getTime();
    }
    if (typeof value === 'string') {
      const parsed = Number(value);
      return Number.isNaN(parsed) ? null : parsed;
    }
    return null;
  }

  #normaliseDiscreteValue(value: FacetValue): string | number | boolean {
    if (value instanceof Date) {
      return value.toISOString();
    }
    if (typeof value === 'string') {
      return value.toLowerCase();
    }
    if (typeof value === 'number' || typeof value === 'boolean') {
      return value;
    }
    throw new TypeError('Unsupported facet value for discrete comparison');
  }

  #readNumericField(item: ItemRecord, field: string): number | null {
    const fromMetrics = item.metrics?.[field];
    if (typeof fromMetrics === 'number' && Number.isFinite(fromMetrics)) {
      return fromMetrics;
    }
    const fromFacet = item.facets[field];
    if (fromFacet == null) return null;
    const values = Array.isArray(fromFacet) ? fromFacet : [fromFacet];
    for (const value of values) {
      const numeric = this.#coerceNumber(value);
      if (numeric != null) {
        return numeric;
      }
    }
    return null;
  }

  #percentile(sortedValues: number[], percentile: number): number {
    if (sortedValues.length === 0) return Number.NaN;
    const rank = percentile * (sortedValues.length - 1);
    const lower = Math.floor(rank);
    const upper = Math.ceil(rank);
    if (lower === upper) return sortedValues[lower];
    const weight = rank - lower;
    return sortedValues[lower] * (1 - weight) + sortedValues[upper] * weight;
  }

  #buildHistogram(values: number[], binCount?: number) {
    const bins = Number.isFinite(binCount) ? Math.max(1, Math.floor(binCount as number)) : 0;
    if (bins <= 0) {
      return undefined;
    }
    const min = values[0];
    const max = values[values.length - 1];
    if (!Number.isFinite(min) || !Number.isFinite(max)) {
      return undefined;
    }
    if (min === max) {
      return [
        {
          start: min,
          end: max,
          count: values.length,
        },
      ];
    }
    const range = max - min;
    const width = range / bins;
    const histogram = new Array(bins).fill(0).map((_, index) => ({
      start: min + width * index,
      end: index === bins - 1 ? max : min + width * (index + 1),
      count: 0,
    }));
    for (const value of values) {
      const relative = (value - min) / range;
      const slot = Math.min(bins - 1, Math.max(0, Math.floor(relative * bins)));
      histogram[slot].count += 1;
    }
    return histogram;
  }
}

export type { ItemRecord, FacetValue, NumericStats, RangeConstraint, HistogramBin } from './types.js';
