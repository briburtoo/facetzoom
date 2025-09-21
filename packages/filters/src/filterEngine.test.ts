import { describe, expect, it } from 'vitest';
import { FilterEngine } from './index.js';
import type { ItemRecord } from './types.js';

const sample: ItemRecord[] = [
  {
    id: '1',
    title: 'Alpha',
    facets: {
      Category: ['Tool', 'Outdoor'],
      Year: 2021,
      Added: new Date('2024-01-05'),
    },
    metrics: { score: 0.73, value: 42.1 },
  },
  {
    id: '2',
    title: 'Beta',
    facets: {
      Category: ['Outdoor'],
      Year: 2022,
      Added: new Date('2024-02-11'),
    },
    metrics: { score: 0.9, value: 10 },
  },
  {
    id: '3',
    title: 'Gamma',
    facets: {
      Category: ['Tool'],
      Year: 2019,
      Added: new Date('2023-12-30'),
    },
    metrics: { score: 0.12, value: 88.2 },
  },
];

describe('FilterEngine', () => {
  it('filters items by discrete values', () => {
    const engine = new FilterEngine(sample);
    engine.applyDiscreteFilter('Category', ['Tool']);
    const ids = engine.getFilteredItems().map((item) => item.id);
    expect(ids).toEqual(['1', '3']);
  });

  it('filters items by numeric range', () => {
    const engine = new FilterEngine(sample);
    engine.applyRangeFilter('Year', { min: 2020, max: 2022 });
    const ids = engine.getFilteredItems().map((item) => item.id);
    expect(ids).toEqual(['1', '2']);
  });

  it('computes facet counts excluding self filter', () => {
    const engine = new FilterEngine(sample);
    engine.applyDiscreteFilter('Category', ['Tool']);
    const counts = engine.getFacetCounts('Category');
    expect(counts).toEqual([
      { key: 'Outdoor', count: 2 },
      { key: 'Tool', count: 2 },
    ]);
  });

  it('calculates numeric stats with percentiles', () => {
    const engine = new FilterEngine(sample);
    const stats = engine.getNumericStats('value', { includePercentiles: true });
    expect(stats).toMatchObject({
      min: 10,
      max: 88.2,
      count: 3,
    });
    expect(stats?.histogram?.reduce((total, bin) => total + bin.count, 0)).toBe(3);
    expect(stats?.p01).toBeUndefined();
    expect(stats?.p99).toBeUndefined();
  });
});
