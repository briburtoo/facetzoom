import { describe, expect, it } from 'vitest';
import type { ItemRecord } from '@facetzoom/filters';
import { collectFacetKeys, sortItemsForResponse } from './index.js';

describe('server helpers', () => {
  const sampleItems: ItemRecord[] = [
    {
      id: 'BETA',
      title: 'Beta',
      facets: { Sector: 'Finance', Region: 'US' },
      metrics: { score: 2, price: 15 },
    },
    {
      id: 'ALPHA',
      title: 'Alpha',
      facets: { Sector: 'Health', Exchange: 'NASDAQ' },
      metrics: { score: 5, price: 10 },
    },
    {
      id: 'GAMMA',
      title: 'Gamma',
      facets: { Sector: 'Finance', Region: 'EU', Style: 'Value' },
      metrics: { score: -1, price: 20 },
    },
  ];

  it('collectFacetKeys unions facet names across all items', () => {
    const keys = collectFacetKeys(sampleItems);
    expect(keys).toEqual(['Exchange', 'Region', 'Sector', 'Style']);
  });

  it('sortItemsForResponse defaults to alphabetical by id', () => {
    const sorted = sortItemsForResponse(sampleItems, undefined).map((item) => item.id);
    expect(sorted).toEqual(['ALPHA', 'BETA', 'GAMMA']);
  });

  it('sortItemsForResponse respects field:desc for numeric metrics', () => {
    const sorted = sortItemsForResponse(sampleItems, 'score:desc').map((item) => item.id);
    expect(sorted).toEqual(['ALPHA', 'BETA', 'GAMMA']);
  });
});
