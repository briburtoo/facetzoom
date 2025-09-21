import type { HistogramBin, NumericStats, TileData } from '../types';
import { collectMetricValues } from './metrics';

export interface HistogramRange {
  start: number;
  end: number;
  count: number;
}

interface BuildHistogramArgs {
  domainItems: TileData[];
  countItems?: TileData[];
  field: string;
  stats?: NumericStats | null;
  maxBins?: number;
}

export function collapseHistogram(bins: HistogramBin[], maxBins: number): Array<Omit<HistogramRange, 'count'>> {
  if (!Array.isArray(bins) || bins.length === 0) {
    return [];
  }
  if (bins.length <= maxBins) {
    return bins.map(({ start, end }) => ({ start, end }));
  }
  const factor = Math.ceil(bins.length / maxBins);
  const merged: Array<Omit<HistogramRange, 'count'>> = [];
  for (let index = 0; index < bins.length; index += factor) {
    const slice = bins.slice(index, index + factor);
    if (slice.length === 0) continue;
    merged.push({ start: slice[0]!.start, end: slice[slice.length - 1]!.end });
  }
  return merged;
}

export function formatBucketLabel(range: { start: number; end: number }, formatter: (value: number) => string): string {
  return `${formatter(range.start)} – ${formatter(range.end)}`;
}

export function buildHistogramRanges({
  domainItems,
  countItems = domainItems,
  field,
  stats,
  maxBins = 10,
}: BuildHistogramArgs): HistogramRange[] {
  const domainValues = collectMetricValues(domainItems, field).sort((a, b) => a - b);
  if (domainValues.length === 0) {
    return [];
  }

  const min = stats?.min ?? domainValues[0];
  const max = stats?.max ?? domainValues[domainValues.length - 1];
  if (!Number.isFinite(min) || !Number.isFinite(max)) {
    return [];
  }
  if (min === max) {
    const total = countItems.length;
    return [{ start: min, end: max, count: total }];
  }

  const baseRanges = initialiseQuantileRanges(domainValues, maxBins, min, max);
  const ranges: HistogramRange[] = baseRanges.map((range) => ({
    ...range,
    count: 0,
  }));

  const countValues = collectMetricValues(countItems, field);
  for (const value of countValues) {
    const bucketIndex = findBucketIndex(value, ranges);
    if (bucketIndex != null) {
      ranges[bucketIndex]!.count += 1;
    }
  }

  return ranges;
}

function initialiseQuantileRanges(
  sortedValues: number[],
  desiredBins: number,
  min: number,
  max: number
): Array<Omit<HistogramRange, 'count'>> {
  const total = sortedValues.length;
  if (total === 0) {
    return [{ start: min, end: max }];
  }

  const breakpoints: number[] = [min];
  for (let i = 1; i < desiredBins; i += 1) {
    const q = i / desiredBins;
    const index = Math.min(total - 1, Math.round(q * (total - 1)));
    let value = sortedValues[index];
    const last = breakpoints[breakpoints.length - 1];
    if (value <= last) {
      value = nextAfter(last);
    }
    breakpoints.push(value);
  }
  breakpoints.push(max);

  const ranges: Array<Omit<HistogramRange, 'count'>> = [];
  for (let i = 0; i < breakpoints.length - 1; i += 1) {
    ranges.push({ start: breakpoints[i]!, end: breakpoints[i + 1]! });
  }
  return ranges;
}

function findBucketIndex(value: number, buckets: Array<Omit<HistogramRange, 'count'>>): number | null {
  for (let index = 0; index < buckets.length; index += 1) {
    const bucket = buckets[index];
    const isLast = index === buckets.length - 1;
    if (value >= bucket.start && (isLast ? value <= bucket.end : value < bucket.end)) {
      return index;
    }
  }
  return null;
}

function nextAfter(value: number): number {
  const EPSILON = Number.EPSILON * Math.max(1, Math.abs(value));
  return value + EPSILON;
}
