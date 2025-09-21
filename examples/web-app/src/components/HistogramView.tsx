import { useMemo } from 'react';
import type { CSSProperties } from 'react';
import type { TilePresenter } from '@facetzoom/viewer';
import type { TileData } from '../types';
import type { HistogramRange } from '../utils/histogram';
import { readMetricValue } from '../utils/metrics';

interface HistogramViewProps {
  items: TileData[];
  presenter: TilePresenter;
  metricField: string;
  metricFormatter: (value: number) => string;
  buckets: HistogramBucket[];
  bucketLabelFormatter: (range: HistogramRange) => string;
  groupField: string;
  groupKind: 'facet' | 'metric';
  chipSize?: number;
  columns?: number;
}

export interface HistogramBucket extends HistogramRange {}

interface BucketGroup {
  key: string;
  label: string;
  sortValue: number | string;
  items: Array<{ item: TileData; metricValue: number }>; // metricValue always numeric here
}

interface BucketWithGroups extends HistogramBucket {
  label: string;
  total: number;
  groups: BucketGroup[];
}

export function HistogramView({
  items,
  presenter,
  metricField,
  metricFormatter,
  buckets,
  bucketLabelFormatter,
  groupField,
  groupKind,
  chipSize = 36,
  columns = 5,
}: HistogramViewProps) {
  const bucketed = useMemo<BucketWithGroups[]>(() => {
    if (!buckets.length) return [];
    const result: BucketWithGroups[] = buckets.map((bucket, index) => ({
      ...bucket,
      label: bucketLabelFormatter(bucket),
      total: 0,
      groups: [],
    }));

    const groupMaps = result.map(() => new Map<string, BucketGroup>());

    for (const item of items) {
      const metricValue = readMetricValue(item, metricField);
      if (metricValue == null) continue;
      const bucketIndex = findBucketIndex(metricValue, buckets);
      if (bucketIndex == null) continue;
      const map = groupMaps[bucketIndex];
      const bucket = result[bucketIndex];
      bucket.total += 1;

      const { key, label, sortValue } = resolveGroup(item, groupField, groupKind, metricFormatter);
      const existing = map.get(key);
      if (existing) {
        existing.items.push({ item, metricValue });
      } else {
        const group: BucketGroup = {
          key,
          label,
          sortValue,
          items: [{ item, metricValue }],
        };
        map.set(key, group);
      }
    }

    for (let index = 0; index < result.length; index += 1) {
      const map = groupMaps[index];
      const bucket = result[index];
      const groups = [...map.values()];
      if (groupKind === 'metric') {
        groups.sort((a, b) => Number(a.sortValue) - Number(b.sortValue));
      } else {
        groups.sort((a, b) => String(a.sortValue).localeCompare(String(b.sortValue), undefined, { sensitivity: 'base' }));
      }
      for (const group of groups) {
        group.items.sort((a, b) => a.metricValue - b.metricValue);
      }
      bucket.groups = groups;
    }

    return result;
  }, [buckets, groupField, groupKind, items, metricField, metricFormatter]);

  if (bucketed.length === 0) {
    return <div className="histogram-view__empty">Histogram data unavailable for this metric.</div>;
  }

  return (
    <div className="histogram-view" role="list">
      {bucketed.map((bucket, bucketIndex) => {
        const bucketMinWidth = Math.max(chipSize * columns + 24, 240);
        const sectionStyle = {
          flex: `1 1 ${bucketMinWidth}px`,
          minWidth: `${bucketMinWidth}px`,
        } as CSSProperties;
        const gridStyle = {
          '--chip-size': `${chipSize}px`,
          gridTemplateColumns: `repeat(${columns}, minmax(${chipSize}px, 1fr))`,
          gridAutoRows: `${chipSize}px`,
        } as CSSProperties;
        return (
          <section
            className="histogram-bucket"
            key={`${bucket.start}-${bucketIndex}`}
            role="listitem"
            style={sectionStyle}
          >
            <header className="histogram-bucket__header">
              <span className="histogram-bucket__count">{bucket.total} items</span>
            </header>
            <div className="histogram-bucket__groups" data-empty={bucket.groups.length === 0}>
              {bucket.groups.length === 0 ? (
                <div className="histogram-bucket__placeholder">No items in range</div>
              ) : (
                bucket.groups.map((group) => (
                  <div className="histogram-group" key={group.key}>
                    <div className="histogram-group__header">
                      <span className="histogram-group__label">{group.label}</span>
                      <span className="histogram-group__count">{group.items.length}</span>
                    </div>
                    <div className="histogram-group__tiles" style={gridStyle}>
                      {group.items.map(({ item, metricValue }) => (
                        <HistogramChip
                          key={item.id}
                          item={item}
                          presenter={presenter}
                          metricValue={metricValue}
                          metricFormatter={metricFormatter}
                          chipSize={chipSize}
                        />
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
            <footer className="histogram-bucket__footer">{bucket.label}</footer>
          </section>
        );
      })}
    </div>
  );
}

interface HistogramChipProps {
  item: TileData;
  presenter: TilePresenter;
  metricValue: number;
  metricFormatter: (value: number) => string;
  chipSize: number;
}

function HistogramChip({ item, presenter, metricValue, metricFormatter, chipSize }: HistogramChipProps) {
  const summary = presenter.summariseTile(chipSize, {
    id: item.id,
    title: item.title,
    metrics: item.metrics,
  });
  const color = summary.color ?? 'rgba(148, 163, 184, 0.45)';
  const ticker = summary.title ?? item.title ?? item.id;
  const formattedMetric = metricFormatter(metricValue);

  const metrics = summary.metrics ?? item.metrics ?? {};
  const changePercent = metrics.changePercent ?? metrics.score ?? readMetricValue(item, 'changePercent');
  const style = {
    '--tile-accent': color,
    width: `${chipSize}px`,
    minWidth: `${chipSize}px`,
    height: `${chipSize}px`,
  } as CSSProperties;

  return (
    <article className="histogram-chip" title={`${ticker} • ${formattedMetric}`} style={style}>
      <div className="histogram-chip__swatch" style={{ background: color }} />
      <div className="histogram-chip__body">
        <span className="histogram-chip__ticker">{ticker}</span>
        <span className={changePercent != null && changePercent >= 0 ? 'histogram-chip__change histogram-chip__change--up' : 'histogram-chip__change histogram-chip__change--down'}>
          {formatPercent(changePercent)}
        </span>
      </div>
    </article>
  );
}

function readFacet(value: unknown): string | null {
  if (Array.isArray(value)) {
    const [first] = value;
    return first != null ? String(first) : null;
  }
  if (value == null) return null;
  return String(value);
}

function resolveGroup(
  item: TileData,
  field: string,
  kind: 'facet' | 'metric',
  metricFormatter: (value: number) => string
): { key: string; label: string; sortValue: number | string } {
  if (kind === 'metric') {
    const value = readMetricValue(item, field);
    if (value == null) {
      return { key: 'unknown', label: 'Unknown', sortValue: Number.POSITIVE_INFINITY };
    }
    const label = metricFormatter(value);
    return { key: `${value}`, label, sortValue: value };
  }
  const raw = readFacet(item.facets[field]);
  if (!raw) {
    return { key: 'unknown', label: 'Unknown', sortValue: 'Unknown' };
  }
  return { key: raw.toLowerCase(), label: raw, sortValue: raw.toLowerCase() };
}

function findBucketIndex(value: number, buckets: HistogramBucket[]): number | null {
  if (buckets.length === 0) return null;
  for (let index = 0; index < buckets.length; index += 1) {
    const bucket = buckets[index];
    const isLast = index === buckets.length - 1;
    if (value >= bucket.start && (isLast ? value <= bucket.end : value < bucket.end)) {
      return index;
    }
  }
  return null;
}

function formatPercent(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return '—';
  const magnitude = Math.abs(value);
  const precision = magnitude < 1 ? 2 : magnitude < 10 ? 1 : 0;
  const formatted = value.toFixed(precision);
  const sign = value > 0 ? '+' : '';
  return `${sign}${formatted}%`;
}
