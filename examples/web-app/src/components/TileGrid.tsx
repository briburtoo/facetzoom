import { useMemo } from 'react';
import type { CSSProperties } from 'react';
import type { TilePresenter } from '@facetzoom/viewer';
import type { TileData } from '../types';

interface TileGridProps {
  items: TileData[];
  presenter: TilePresenter;
  tileWidth: number;
}

export function TileGrid({ items, presenter, tileWidth }: TileGridProps) {
  const style = useMemo(() => ({ '--tile-width': `${tileWidth}px` }) as CSSProperties, [tileWidth]);
  return (
    <div className="tile-grid" style={style}>
      {items.map((item) => (
        <TileCard key={item.id} item={item} presenter={presenter} tileWidth={tileWidth} />
      ))}
      {items.length === 0 ? <div className="status-banner">No items match the current filters.</div> : null}
    </div>
  );
}

interface TileCardProps {
  item: TileData;
  presenter: TilePresenter;
  tileWidth: number;
}

function TileCard({ item, presenter, tileWidth }: TileCardProps) {
  const summary = presenter.summariseTile(tileWidth, {
    id: item.id,
    title: item.title,
    metrics: item.metrics,
  });
  const grainClass = `tile-card tile-card--${summary.grain.toLowerCase()}`;
  const accent = summary.color ?? 'rgba(148, 163, 184, 0.65)';
  const ticker = summary.title ?? item.title ?? item.id;

  const changeDirection = readSingleValue(item.facets['Change Direction']) ?? 'No movement';
  const changeBand = readSingleValue(item.facets['Change Band']);
  const priceBucket = readSingleValue(item.facets['Price Bucket']);
  const volumeBucket = readSingleValue(item.facets['Volume Bucket']);
  const updatedAt = formatUpdated(readDate(item.facets['Updated (UTC)']));

  const metrics = summary.metrics ?? item.metrics;
  const changePercent = readMetric(metrics, 'changePercent') ?? readMetric(metrics, 'score');
  const changeAbs = readMetric(metrics, 'change');
  const price = readMetric(metrics, 'Price') ?? readMetric(metrics, 'price');
  const volume = readMetric(metrics, 'volume') ?? readMetric(metrics, 'Volume');
  const vwap = readMetric(metrics, 'vwap');

  return (
    <article className={grainClass} style={{ '--tile-accent': accent } as CSSProperties}>
      <span className="tile-card__grain">Grain {summary.grain}</span>
      {summary.grain === 'G0' ? (
        <>
          <div className="tile-card__glyph tile-card__glyph--direction" data-direction={changeDirection}>
            {getDirectionGlyph(changeDirection)}
          </div>
          <div className="tile-card__footer tile-card__footer--wrap">
            <span className="badge">{ticker}</span>
            <span>{formatPercent(changePercent)}</span>
          </div>
        </>
      ) : summary.grain === 'G1' ? (
        <>
          <div className="tile-card__glyph tile-card__glyph--ticker">{ticker.slice(0, 2).toUpperCase()}</div>
          <p className="tile-card__subtitle">
            {changeBand ?? 'No band'} · {formatPercent(changePercent)}
          </p>
          <div className="tile-card__footer tile-card__footer--wrap">
            {priceBucket ? <span className="badge">{priceBucket}</span> : null}
            {volumeBucket ? <span className="badge badge--ghost">{volumeBucket}</span> : null}
          </div>
        </>
      ) : (
        <>
          <h4 className="tile-card__title">{ticker}</h4>
          <p className="tile-card__subtitle">
            {changeBand ?? '—'} · {priceBucket ?? '—'}
          </p>
          <div className="tile-card__metrics tile-card__metrics--wide">
            <MetricPill label="Close" value={formatPriceValue(price)} />
            <MetricPill label="Change" value={formatDelta(changeAbs, changePercent)} />
            <MetricPill label="Volume" value={formatVolume(volume)} />
            <MetricPill label="VWAP" value={formatPriceValue(vwap)} />
          </div>
          <div className="tile-card__footer tile-card__footer--wrap">
            {volumeBucket ? <span>{volumeBucket}</span> : null}
            {updatedAt ? <span>Updated {updatedAt}</span> : null}
          </div>
        </>
      )}
    </article>
  );
}

interface MetricPillProps {
  label: string;
  value: string;
}

function MetricPill({ label, value }: MetricPillProps) {
  return (
    <div className="metric-pill">
      <span className="metric-pill__label">{label}</span>
      <span className="metric-pill__value">{value}</span>
    </div>
  );
}

const compactNumberFormatter = new Intl.NumberFormat('en-US', {
  notation: 'compact',
  maximumFractionDigits: 1,
});

function readSingleValue(value: unknown): string | null {
  if (Array.isArray(value)) {
    const [first] = value;
    return first != null ? String(first) : null;
  }
  if (value == null) return null;
  return String(value);
}

function readMetric(metrics: TileData['metrics'], key: string): number | null {
  const value = metrics?.[key];
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  return null;
}

function readDate(value: unknown): Date | null {
  if (value instanceof Date) {
    return value;
  }
  if (typeof value === 'string' || typeof value === 'number') {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }
  return null;
}

function formatPercent(value: number | null): string {
  if (value == null) return '—';
  const magnitude = Math.abs(value);
  const precision = magnitude < 1 ? 2 : magnitude < 10 ? 1 : 0;
  const formatted = value.toFixed(precision);
  const sign = value > 0 ? '+' : '';
  return `${sign}${formatted}%`;
}

function formatPriceValue(value: number | null): string {
  if (value == null) return '—';
  const magnitude = Math.abs(value);
  const precision = magnitude < 100 ? 2 : magnitude < 1000 ? 1 : 0;
  return `$${value.toFixed(precision)}`;
}

function formatDelta(change: number | null, percent: number | null): string {
  const parts: string[] = [];
  if (change != null) {
    const formatted = change.toFixed(2);
    const sign = change > 0 ? '+' : '';
    parts.push(`${sign}${formatted}`);
  }
  if (percent != null) {
    parts.push(formatPercent(percent));
  }
  if (parts.length === 0) {
    return '—';
  }
  return parts.join(' · ');
}

function formatVolume(value: number | null): string {
  if (value == null) return '—';
  return `${compactNumberFormatter.format(value)} sh`;
}

function formatUpdated(value: Date | null): string | null {
  if (!value) return null;
  return `${value.toISOString().replace('T', ' ').slice(0, 16)}Z`;
}

function getDirectionGlyph(direction: string): string {
  if (direction === 'Gainer') return '▲';
  if (direction === 'Decliner') return '▼';
  return '·';
}
