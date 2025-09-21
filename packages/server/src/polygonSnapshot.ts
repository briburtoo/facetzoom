import type { FacetValue, ItemRecord } from '@facetzoom/filters';
import { ProxyAgent } from 'undici';

const SNAPSHOT_URL = 'https://api.polygon.io/v2/snapshot/locale/us/markets/stocks/tickers';

interface SnapshotResponse {
  tickers?: PolygonSnapshotTicker[];
  status?: string;
  error?: string;
}

export interface PolygonSnapshotTicker {
  ticker: string;
  todaysChangePerc?: number | null;
  todaysChange?: number | null;
  updated?: number | null;
  day?: PolygonAggregate;
  prevDay?: PolygonAggregate;
}

interface PolygonAggregate {
  o?: number | null;
  h?: number | null;
  l?: number | null;
  c?: number | null;
  v?: number | null;
  vw?: number | null;
}

const PRICE_BUCKETS = [5, 10, 20, 50, 100, 200, 500, 1000];
const VOLUME_BUCKETS = [50_000, 100_000, 500_000, 1_000_000, 5_000_000, 10_000_000, 50_000_000];

const proxyAgent = resolveProxyAgent();

export async function fetchPolygonSnapshot(apiKey: string, timeoutMs = 15_000): Promise<ItemRecord[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const url = new URL(SNAPSHOT_URL);
    url.searchParams.set('apiKey', apiKey);
    const init: RequestInit = { signal: controller.signal };
    if (proxyAgent) {
      (init as RequestInit & { dispatcher: ProxyAgent }).dispatcher = proxyAgent;
    }
    const response = await fetch(url, init);
    if (!response.ok) {
      throw new Error(`Polygon snapshot request failed with status ${response.status}`);
    }
    const payload = (await response.json()) as SnapshotResponse;
    if (!Array.isArray(payload.tickers) || payload.tickers.length === 0) {
      throw new Error('Polygon snapshot did not return any tickers');
    }
    return payload.tickers
      .map((entry) => mapSnapshotTicker(entry))
      .filter((item): item is ItemRecord => item != null);
  } finally {
    clearTimeout(timeout);
  }
}

function resolveProxyAgent(): ProxyAgent | null {
  const proxyUrl =
    process.env.HTTPS_PROXY ??
    process.env.https_proxy ??
    process.env.HTTP_PROXY ??
    process.env.http_proxy ??
    null;
  if (!proxyUrl) {
    return null;
  }
  try {
    return new ProxyAgent(proxyUrl);
  } catch (error) {
    console.warn('Failed to configure proxy agent for Polygon snapshot requests', error);
    return null;
  }
}

export function mapSnapshotTicker(entry: PolygonSnapshotTicker): ItemRecord | null {
  if (!entry.ticker) {
    return null;
  }
  const day = entry.day ?? {};
  const price = normaliseNumber(day.c);
  const volume = normaliseNumber(day.v);
  const vwPrice = normaliseNumber(day.vw);
  const changeAbs = normaliseNumber(entry.todaysChange);
  const changePerc = normaliseNumber(entry.todaysChangePerc);
  const updatedDate = normaliseUpdated(entry.updated);

  const facets: Record<string, FacetValue | null | undefined> = {
    Ticker: entry.ticker,
    'Ticker Initial': entry.ticker.slice(0, 1),
    'Change Direction': changePerc == null ? 'No movement' : changePerc >= 0 ? 'Gainer' : 'Decliner',
    'Change Band': changePerc == null ? 'No movement' : describeChangeBand(changePerc),
    'Price Bucket': price == null ? 'Unknown' : describeBucket(price, PRICE_BUCKETS, '$'),
    'Volume Bucket': volume == null ? 'Unknown' : describeBucket(volume, VOLUME_BUCKETS),
  };

  if (price != null) {
    facets.Price = price;
  }
  if (updatedDate) {
    facets['Updated (UTC)'] = updatedDate;
  }

  const metrics: Record<string, number | null | undefined> = {
    score: changePerc ?? null,
    Price: price ?? null,
    price: price ?? null,
    change: changeAbs ?? null,
    changePercent: changePerc ?? null,
    volume: volume ?? null,
    Volume: volume ?? null,
    vwap: vwPrice ?? null,
  };

  return {
    id: entry.ticker,
    title: entry.ticker,
    facets,
    metrics,
  };
}

export function describeBucket(value: number, buckets: number[], prefix = ''): string {
  if (buckets.length === 0) {
    return formatBucketValue(value, prefix);
  }
  if (value < buckets[0]) {
    return `Under ${formatBucketValue(buckets[0], prefix)}`;
  }
  for (let index = 1; index < buckets.length; index += 1) {
    const lower = buckets[index - 1];
    const upper = buckets[index];
    if (value < upper) {
      return `${formatBucketValue(lower, prefix)} – ${formatBucketValue(upper, prefix)}`;
    }
  }
  return `${formatBucketValue(buckets[buckets.length - 1], prefix)}+`;
}

export function describeChangeBand(changePerc: number): string {
  const magnitude = Math.abs(changePerc);
  if (magnitude < 0.5) return '±0.5%';
  if (magnitude < 1) return '0.5% to 1%';
  if (magnitude < 2.5) return '1% to 2.5%';
  if (magnitude < 5) return '2.5% to 5%';
  if (magnitude < 10) return '5% to 10%';
  return '10%+';
}

function normaliseNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  return null;
}

function normaliseUpdated(value: unknown): Date | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return null;
  }
  return new Date(value / 1_000_000);
}

function formatNumber(value: number): string {
  if (value >= 1_000_000_000) {
    return `${(value / 1_000_000_000).toFixed(1)}B`;
  }
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}M`;
  }
  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(0)}K`;
  }
  return value.toString();
}

function formatBucketValue(value: number, prefix: string): string {
  if (prefix === '$') {
    const decimals = value < 100 ? 2 : 0;
    return `${prefix}${value.toFixed(decimals)}`;
  }
  const formatted = formatNumber(value);
  return prefix ? `${prefix}${formatted}` : formatted;
}
