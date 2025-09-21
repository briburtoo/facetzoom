import { describe, expect, test } from 'vitest';
import { describeBucket, describeChangeBand, mapSnapshotTicker, type PolygonSnapshotTicker } from './polygonSnapshot.js';

describe('polygon snapshot helpers', () => {
  test('maps snapshot ticker into item record with metrics and facets', () => {
    const entry: PolygonSnapshotTicker = {
      ticker: 'TEST',
      todaysChangePerc: 1.23,
      todaysChange: 0.45,
      updated: Number('1758322800001547445'),
      day: { c: 12.34, v: 5678900, vw: 12.1 },
    };
    const record = mapSnapshotTicker(entry);
    expect(record).not.toBeNull();
    expect(record?.id).toBe('TEST');
    expect(record?.facets.Price).toBe(12.34);
    expect(record?.facets['Change Direction']).toBe('Gainer');
    expect(record?.facets['Change Band']).toBe('1% to 2.5%');
    expect(record?.metrics?.score).toBe(1.23);
    expect(record?.metrics?.Price).toBe(12.34);
    expect(record?.metrics?.volume).toBe(5_678_900);
  });

  test('handles missing numeric fields gracefully', () => {
    const entry: PolygonSnapshotTicker = {
      ticker: 'MISS',
    };
    const record = mapSnapshotTicker(entry);
    expect(record).not.toBeNull();
    expect(record?.metrics?.Price).toBeNull();
    expect(record?.facets.Price).toBeUndefined();
    expect(record?.facets['Change Direction']).toBe('No movement');
  });

  test('builds change band ranges', () => {
    expect(describeChangeBand(-0.4)).toBe('±0.5%');
    expect(describeChangeBand(0.75)).toBe('0.5% to 1%');
    expect(describeChangeBand(1.5)).toBe('1% to 2.5%');
    expect(describeChangeBand(-3.2)).toBe('2.5% to 5%');
    expect(describeChangeBand(6.1)).toBe('5% to 10%');
    expect(describeChangeBand(15)).toBe('10%+');
  });

  test('buckets values into labelled ranges', () => {
    expect(describeBucket(3, [5, 10], '$')).toBe('Under $5.00');
    expect(describeBucket(7, [5, 10], '$')).toBe('$5.00 – $10.00');
    expect(describeBucket(25_000, [10_000, 50_000])).toBe('10K – 50K');
    expect(describeBucket(120_000, [10_000, 50_000])).toBe('50K+');
  });
});
