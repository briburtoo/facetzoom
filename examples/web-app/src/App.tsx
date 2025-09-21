import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { SemanticZoomController, TilePresenter } from '@facetzoom/viewer';
import { FacetFilter } from './components/FacetFilter';
import { NumericRangeFilter } from './components/NumericRangeFilter';
import { HistogramView } from './components/HistogramView';
import { TileGrid } from './components/TileGrid';
import {
  buildHistogramRanges,
  formatBucketLabel,
  type HistogramRange,
} from './utils/histogram';
import { collectMetricValues } from './utils/metrics';
import type { FacetCounts, NumericStats, TileData } from './types';

type RangeSelection = { min?: number; max?: number };

interface NumericFilterConfig {
  field: string;
  title: string;
  helper?: string;
  formatter: (value: number) => string;
  bins?: number;
  inputStep?: number;
}

interface GroupOption {
  field: string;
  label: string;
  kind: 'facet' | 'metric';
}

type ColorStop = { position: number; color: string };

type FacetValueMap = Record<string, string[]>;

const NEGATIVE_COLOR = '#b91c1c';
const NEGATIVE_SOFT_COLOR = '#fee2e2';
const NEUTRAL_COLOR = '#f8fafc';
const POSITIVE_SOFT_COLOR = '#dcfce7';
const POSITIVE_COLOR = '#15803d';

const TILE_WIDTH_BOUNDS = { min: 80, max: 280, step: 20 } as const;
const ZOOM_PRESETS = [
  { label: 'Spark', width: 60, grain: 'G0' },
  { label: 'Compare', width: 140, grain: 'G1' },
  { label: 'Detail', width: 220, grain: 'G2' },
] as const;
const GRAIN_DESCRIPTIONS: Record<'G0' | 'G1' | 'G2', string> = {
  G0: 'Sparkline digest across the market.',
  G1: 'Category roll-up with price and volume badges.',
  G2: 'Detailed tile showing change, price, and liquidity.',
};

type FacetConfig = {
  field: string;
  helper: string;
  searchPlaceholder?: string;
  maxVisibleOptions?: number;
};

const FACET_CONFIG: ReadonlyArray<FacetConfig> = [
  { field: 'Change Direction', helper: 'Focus on daily gainers or decliners.' },
  { field: 'Change Band', helper: 'Group tickers by the magnitude of the percent move.' },
  { field: 'Price Bucket', helper: 'Cluster symbols into closing price buckets.' },
  { field: 'Volume Bucket', helper: 'Separate heavy trading activity from quieter tickers.' },
  { field: 'Ticker Initial', helper: 'Jump directly to tickers by their starting letter.', searchPlaceholder: 'Search initials' },
];

const RANGE_TOLERANCE = 1e-4;

const NUMERIC_FILTERS: ReadonlyArray<NumericFilterConfig> = [
  {
    field: 'Price',
    title: 'Price',
    helper: 'Adjust the price band to compare peers at similar cost levels.',
    formatter: formatCurrency,
    bins: 48,
    inputStep: 0.01,
  },
  {
    field: 'score',
    title: 'Daily change (%)',
    helper: 'Focus on the strongest gainers or largest decliners by percentage move.',
    formatter: formatPercent,
    bins: 48,
    inputStep: 0.1,
  },
];

const GROUP_OPTIONS: ReadonlyArray<GroupOption> = [
  { field: 'Ticker', label: 'Ticker', kind: 'facet' },
  { field: 'Ticker Initial', label: 'Ticker initial', kind: 'facet' },
  { field: 'Change Direction', label: 'Change direction', kind: 'facet' },
  { field: 'Change Band', label: 'Change band', kind: 'facet' },
  { field: 'Price Bucket', label: 'Price bucket', kind: 'facet' },
  { field: 'Volume Bucket', label: 'Volume bucket', kind: 'facet' },
  { field: 'Price', label: 'Price', kind: 'metric' },
  { field: 'score', label: 'Daily change (%)', kind: 'metric' },
];

const NUMERIC_FIELDS = NUMERIC_FILTERS.map((filter) => filter.field);
const DEFAULT_CHIP_SIZE = 32;
const HISTOGRAM_MAX_BINS = 10;
const PAGE_SIZE = 24;

export default function App() {
  const [allItems, setAllItems] = useState<TileData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedFacets, setSelectedFacets] = useState<Record<string, string[]>>({});
  const [rangeSelections, setRangeSelections] = useState<Record<string, RangeSelection>>({});
  const [tileWidth, setTileWidth] = useState(220);
  const [viewMode, setViewMode] = useState<'tiles' | 'histogram'>('histogram');
  const [histogramMetricField, setHistogramMetricField] = useState<string>(NUMERIC_FILTERS[0]?.field ?? 'Price');
  const [histogramGroupField, setHistogramGroupField] = useState<string>(GROUP_OPTIONS[0]?.field ?? 'Ticker');
  const [colorMetricField, setColorMetricField] = useState<string>('score');
  const [sortField, setSortField] = useState<string>('score');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const zoom = useMemo(() => new SemanticZoomController(), []);

  useEffect(() => {
    let cancelled = false;
   async function loadDataset() {
     setLoading(true);
     try {
        const response = await fetch('/data/items.json');
        if (!response.ok) {
          throw new Error(`Failed to load dataset (${response.status})`);
        }
        const raw = (await response.json()) as TileData[];
        if (cancelled) return;
        const normalised = raw.map(normaliseTileData);
        setAllItems(normalised);
        setVisibleCount(PAGE_SIZE);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load dataset');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }
    loadDataset();
    return () => {
      cancelled = true;
    };
  }, []);

  const facetMeta = useMemo(() => buildFacetMeta(allItems), [allItems]);

  const baselineNumericStats = useMemo(
    () => computeNumericStatsMap(allItems, NUMERIC_FIELDS),
    [allItems]
  );

  useEffect(() => {
    if (allItems.length === 0) return;
    setRangeSelections((prev) => {
      const next: Record<string, RangeSelection> = { ...prev };
      let changed = false;
      for (const filter of NUMERIC_FILTERS) {
        const stats = baselineNumericStats[filter.field];
        if (!stats) continue;
        const current = next[filter.field];
        if (
          !current ||
          typeof current.min !== 'number' ||
          typeof current.max !== 'number'
        ) {
          next[filter.field] = { min: stats.min, max: stats.max };
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [baselineNumericStats, allItems.length]);

  const filteredItems = useMemo(() => {
    const prepared = filterAndSortItems(
      allItems,
      selectedFacets,
      rangeSelections,
      sortField,
      sortDirection
    );
    return prepared;
  }, [allItems, rangeSelections, selectedFacets, sortDirection, sortField]);

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [filteredItems]);

  const itemsForTileView = useMemo(
    () => filteredItems.slice(0, visibleCount),
    [filteredItems, visibleCount]
  );

  const currentNumericStats = useMemo(
    () => computeNumericStatsMap(filteredItems, NUMERIC_FIELDS),
    [filteredItems]
  );

  const facetCounts = useMemo(
    () => computeFacetCounts(allItems, selectedFacets, rangeSelections, facetMeta),
    [allItems, selectedFacets, rangeSelections, facetMeta]
  );

  const histogramBuckets = useMemo<HistogramRange[]>(() => {
    const stats = baselineNumericStats[histogramMetricField] ?? null;
    return buildHistogramRanges({
      domainItems: allItems,
      countItems: filteredItems,
      field: histogramMetricField,
      stats,
      maxBins: HISTOGRAM_MAX_BINS,
    });
  }, [allItems, baselineNumericStats, filteredItems, histogramMetricField]);

  const totalItems = filteredItems.length;

  const colorStats =
    currentNumericStats[colorMetricField] ?? baselineNumericStats[colorMetricField];

  const colorDomain = useMemo<[number, number]>(() => {
    if (!colorStats) return [0, 1];
    let min = colorStats.p01 ?? colorStats.min;
    let max = colorStats.p99 ?? colorStats.max;
    if (!Number.isFinite(min) || !Number.isFinite(max)) {
      return [0, 1];
    }
    if (min === max) {
      const delta = Math.max(Math.abs(min) * 0.1, 0.5);
      min -= delta;
      max += delta;
    }
    return [min, max];
  }, [colorStats]);

  const colorStops = useMemo(() => buildColorStops(colorDomain), [colorDomain]);

  const presenter = useMemo(() => {
    const [min, max] = colorDomain;
    return new TilePresenter(zoom, {
      colorScale: { domain: [min, max], stops: colorStops },
      colorField: colorMetricField,
    });
  }, [colorDomain, colorStops, colorMetricField, zoom]);

  const colorRangeLabel = useMemo(() => {
    if (!colorStats) return '—';
    const [min, max] = colorDomain;
    const formatter = getFormatter(colorMetricField);
    return `${formatter(min)} – ${formatter(max)}`;
  }, [colorDomain, colorMetricField, colorStats]);

  const histogramChipSize = useMemo(
    () => Math.max(24, Math.round(tileWidth / 4)),
    [tileWidth]
  );

  const chipColumns = 5;

  const handleToggleFacet = useCallback((field: string, value: string) => {
    setSelectedFacets((prev) => {
      const current = new Set(prev[field] ?? []);
      if (current.has(value)) {
        current.delete(value);
      } else {
        current.add(value);
      }
      return { ...prev, [field]: [...current] };
    });
  }, []);

  const handleClearFacet = useCallback((field: string) => {
    setSelectedFacets((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }, []);

  const handleResetFilters = useCallback(() => {
    setSelectedFacets({});
    setRangeSelections((prev) => {
      const next: Record<string, RangeSelection> = {};
      for (const filter of NUMERIC_FILTERS) {
        const stats = baselineNumericStats[filter.field];
        if (stats) {
          next[filter.field] = { min: stats.min, max: stats.max };
        }
      }
      return next;
    });
  }, [baselineNumericStats]);

  const handleRangeSelectionChange = useCallback(
    (field: string, next: RangeSelection) => {
      setRangeSelections((prev) => ({ ...prev, [field]: next }));
    },
    []
  );

  const handleRangeReset = useCallback(
    (field: string) => {
      const stats = baselineNumericStats[field];
      if (!stats) return;
      setRangeSelections((prev) => ({ ...prev, [field]: { min: stats.min, max: stats.max } }));
    },
    [baselineNumericStats]
  );

  const handleLoadMore = useCallback(() => {
    setVisibleCount((prev) => Math.min(prev + PAGE_SIZE, filteredItems.length));
  }, [filteredItems.length]);

  const handleSortChange = useCallback((value: string) => {
    const [field, dir] = value.split(':');
    setSortField(field);
    setSortDirection(dir === 'asc' ? 'asc' : 'desc');
  }, []);

  return (
    <div className="app">
      <header className="app__header">
        <div>
          <h1 className="app__title">FacetZoom Explorer</h1>
          <p className="app__subtitle">Histogram view with PivotViewer semantics.</p>
        </div>
        <button className="sidebar__button" onClick={handleResetFilters} disabled={loading}>
          Clear all filters
        </button>
      </header>
      <div className="app__content">
        <aside className="sidebar">
          {FACET_CONFIG.map((facet) => (
            <FacetFilter
              key={facet.field}
              title={facet.field}
              helper={facet.helper}
              options={facetCounts[facet.field] ?? []}
              selected={new Set(selectedFacets[facet.field] ?? [])}
              onToggle={(value) => handleToggleFacet(facet.field, value)}
              onClear={() => handleClearFacet(facet.field)}
              searchPlaceholder={facet.searchPlaceholder}
            />
          ))}
          {NUMERIC_FILTERS.map((config) => (
            <NumericRangeFilter
              key={config.field}
              field={config.field}
              title={config.title}
              helper={config.helper}
              stats={currentNumericStats[config.field] ?? null}
              baseline={baselineNumericStats[config.field] ?? null}
              selection={rangeSelections[config.field] ?? {}}
              formatter={config.formatter}
              onSelectionChange={(next) => handleRangeSelectionChange(config.field, next)}
              onReset={() => handleRangeReset(config.field)}
              inputStep={config.inputStep}
              isActive={isRangeActive(rangeSelections[config.field], baselineNumericStats[config.field])}
              baselineItems={allItems}
              filteredItems={filteredItems}
              metricField={config.field}
              maxBins={config.bins ?? HISTOGRAM_MAX_BINS}
            />
          ))}
        </aside>
        <main className="main">
          <div className="metrics-strip">
           <MetricCard label="Items shown" value={`${totalItems}`} />
            <MetricCard
              label="Active filters"
              value={countActiveFilters(selectedFacets, rangeSelections, baselineNumericStats).toString()}
            />
            <MetricCard label={`Color: ${colorMetricField}`} value={colorRangeLabel} />
          </div>
          <div className="controls-bar">
            <div className="view-toggle" role="group" aria-label="Select result view">
              <button
                type="button"
                className={viewMode === 'tiles' ? 'view-toggle__option view-toggle__option--active' : 'view-toggle__option'}
                onClick={() => setViewMode('tiles')}
                aria-pressed={viewMode === 'tiles'}
              >
                Tiles
              </button>
              <button
                type="button"
                className={viewMode === 'histogram' ? 'view-toggle__option view-toggle__option--active' : 'view-toggle__option'}
                onClick={() => setViewMode('histogram')}
                aria-pressed={viewMode === 'histogram'}
              >
                Histogram
              </button>
            </div>
            <div className="color-controls">
              <label>
                Color
                <select value={colorMetricField} onChange={(event) => setColorMetricField(event.target.value)}>
                  {NUMERIC_FILTERS.map((option) => (
                    <option key={option.field} value={option.field}>
                      {option.title}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="color-controls">
              <label>
                Sort
                <select value={`${sortField}:${sortDirection}`} onChange={(event) => handleSortChange(event.target.value)}>
                  {NUMERIC_FILTERS.map((option) => (
                    <option key={`${option.field}:desc`} value={`${option.field}:desc`}>
                      {option.title} ↓
                    </option>
                  ))}
                  {NUMERIC_FILTERS.map((option) => (
                    <option key={`${option.field}:asc`} value={`${option.field}:asc`}>
                      {option.title} ↑
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="tile-width-control">
              <label htmlFor="tile-width">
                Card size <span className="tile-width-control__value">{tileWidth}px</span> · Grain {zoom.grainForWidth(tileWidth)}
              </label>
              <input
                id="tile-width"
                type="range"
                min={TILE_WIDTH_BOUNDS.min}
                max={TILE_WIDTH_BOUNDS.max}
                step={TILE_WIDTH_BOUNDS.step}
                value={tileWidth}
                onChange={(event) => setTileWidth(Number.parseInt(event.target.value, 10))}
              />
              <div className="tile-width-control__meta">
                <p className="tile-width-control__description">Grain {zoom.grainForWidth(tileWidth)}: {GRAIN_DESCRIPTIONS[zoom.grainForWidth(tileWidth)]}</p>
                <div className="tile-width-control__presets">
                  {ZOOM_PRESETS.map((preset) => {
                    const isActive = Math.abs(tileWidth - preset.width) < TILE_WIDTH_BOUNDS.step / 2;
                    return (
                      <button
                        key={preset.label}
                        type="button"
                        className={isActive ? 'tile-width-control__preset tile-width-control__preset--active' : 'tile-width-control__preset'}
                        onClick={() => setTileWidth(preset.width)}
                        aria-pressed={isActive}
                        aria-label={`Set zoom to ${preset.label} (${preset.grain})`}
                      >
                        {preset.label}
                        <span>{preset.grain}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
            <div className="legend" aria-live="polite">
              <div className="legend__gradient" style={{ background: `linear-gradient(90deg, ${colorStops.map((stop) => `${stop.color} ${Math.round(stop.position * 100)}%`).join(', ')})` }} />
              <div className="legend__ticks">
                {colorStops.map((stop, index) => (
                  <span key={index}>{getFormatter(colorMetricField)(colorDomain[0] + (colorDomain[1] - colorDomain[0]) * stop.position)}</span>
                ))}
              </div>
            </div>
          </div>
          {error ? <div className="status-banner status-banner--error">{error}</div> : null}
          {loading && allItems.length === 0 ? <div className="status-banner">Loading data…</div> : null}
          {viewMode === 'tiles' ? (
            <TileGrid items={itemsForTileView} presenter={presenter} tileWidth={tileWidth} />
          ) : (
            <HistogramView
              items={filteredItems}
              presenter={presenter}
              metricField={histogramMetricField}
              metricFormatter={getFormatter(histogramMetricField)}
              buckets={histogramBuckets}
              bucketLabelFormatter={(range) => formatBucketLabel(range, getFormatter(histogramMetricField))}
              groupField={histogramGroupField}
              groupKind={GROUP_OPTIONS.find((option) => option.field === histogramGroupField)?.kind ?? 'facet'}
              chipSize={histogramChipSize}
              columns={chipColumns}
            />
          )}
          {viewMode === 'tiles' && itemsForTileView.length < filteredItems.length ? (
            <button className="load-more" onClick={handleLoadMore}>
              Load more results
            </button>
          ) : null}
        </main>
      </div>
    </div>
  );
}

interface MetricCardProps {
  label: string;
  value: string;
}

function MetricCard({ label, value }: MetricCardProps) {
  return (
    <div className="metric-card">
      <div className="metric-card__label">{label}</div>
      <div className="metric-card__value">{value}</div>
    </div>
  );
}

function normaliseTileData(item: TileData): TileData {
  return {
    id: item.id,
    title: item.title ?? item.id,
    facets: item.facets ?? {},
    metrics: item.metrics ?? {},
  };
}

function buildFacetMeta(items: TileData[]): { keys: string[]; values: FacetValueMap } {
  const valueMap: FacetValueMap = {};
  for (const item of items) {
    for (const [field, rawValue] of Object.entries(item.facets ?? {})) {
      const values = toFacetValues(rawValue);
      if (!valueMap[field]) {
        valueMap[field] = [];
      }
      for (const value of values) {
        if (!valueMap[field].includes(value)) {
          valueMap[field].push(value);
        }
      }
    }
  }
  for (const field of Object.keys(valueMap)) {
    valueMap[field].sort((a, b) => a.localeCompare(b));
  }
  return { keys: Object.keys(valueMap).sort((a, b) => a.localeCompare(b)), values: valueMap };
}

function filterAndSortItems(
  items: TileData[],
  selectedFacets: Record<string, string[]>,
  rangeSelections: Record<string, RangeSelection>,
  sortField: string,
  sortDirection: 'asc' | 'desc'
): TileData[] {
  const filtered = items.filter((item) => {
    if (!passesFacetFilters(item, selectedFacets)) return false;
    if (!passesRangeFilters(item, rangeSelections)) return false;
    return true;
  });

  const direction = sortDirection === 'asc' ? 1 : -1;
  const sorted = [...filtered].sort((a, b) => {
    const aValue = getNumericValue(a, sortField);
    const bValue = getNumericValue(b, sortField);
    if (aValue == null && bValue == null) return a.id.localeCompare(b.id);
    if (aValue == null) return 1;
    if (bValue == null) return -1;
    if (aValue < bValue) return -1 * direction;
    if (aValue > bValue) return 1 * direction;
    return a.id.localeCompare(b.id);
  });

  return sorted;
}

function passesFacetFilters(item: TileData, selectedFacets: Record<string, string[]>): boolean {
  for (const [field, values] of Object.entries(selectedFacets)) {
    if (values.length === 0) continue;
    const facetValues = toFacetValues(item.facets[field]);
    if (!facetValues.some((value) => values.includes(value))) {
      return false;
    }
  }
  return true;
}

function passesRangeFilters(item: TileData, rangeSelections: Record<string, RangeSelection>): boolean {
  for (const [field, range] of Object.entries(rangeSelections)) {
    if (!range) continue;
    const value = getNumericValue(item, field);
    if (value == null) return false;
    if (typeof range.min === 'number' && value < range.min - RANGE_TOLERANCE) {
      return false;
    }
    if (typeof range.max === 'number' && value > range.max + RANGE_TOLERANCE) {
      return false;
    }
  }
  return true;
}

function computeNumericStatsMap(items: TileData[], fields: string[]): Record<string, NumericStats | null> {
  const result: Record<string, NumericStats | null> = {};
  for (const field of fields) {
    result[field] = computeNumericStatsForField(items, field);
  }
  return result;
}

function computeNumericStatsForField(items: TileData[], field: string): NumericStats | null {
  const values = collectMetricValues(items, field).sort((a, b) => a - b);
  if (values.length === 0) {
    return null;
  }
  const min = values[0];
  const max = values[values.length - 1];
  const p01 = percentile(values, 0.01);
  const p99 = percentile(values, 0.99);
  return {
    field,
    min,
    max,
    count: values.length,
    p01,
    p99,
  };
}

function percentile(sortedValues: number[], ratio: number): number {
  if (sortedValues.length === 0) return NaN;
  const rank = ratio * (sortedValues.length - 1);
  const lower = Math.floor(rank);
  const upper = Math.ceil(rank);
  if (lower === upper) return sortedValues[lower];
  const weight = rank - lower;
  return sortedValues[lower] * (1 - weight) + sortedValues[upper] * weight;
}

function computeFacetCounts(
  allItems: TileData[],
  selectedFacets: Record<string, string[]>,
  rangeSelections: Record<string, RangeSelection>,
  facetMeta: { keys: string[]; values: FacetValueMap }
): FacetCounts {
 const result: FacetCounts = {};
  for (const field of facetMeta.keys) {
    const relevantItems = allItems.filter((item) => {
      const facets = { ...selectedFacets };
      if (facets[field]) {
        delete facets[field];
      }
      if (!passesFacetFilters(item, facets)) return false;
      if (!passesRangeFilters(item, rangeSelections)) return false;
      return true;
    });

    const countsMap = new Map<string, number>();
    for (const base of facetMeta.values[field] ?? []) {
      countsMap.set(base, 0);
    }
    for (const item of relevantItems) {
      for (const value of toFacetValues(item.facets[field])) {
        countsMap.set(value, (countsMap.get(value) ?? 0) + 1);
      }
    }
    const selectedSet = new Set(selectedFacets[field] ?? []);
    for (const selected of selectedSet) {
      if (!countsMap.has(selected)) {
        countsMap.set(selected, 0);
      }
    }

    const entries = [...countsMap.entries()]
      .filter(([key, count]) => count > 0 || selectedSet.has(key))
      .map(([key, count]) => ({ key, count }))
      .sort((a, b) => (b.count - a.count) || a.key.localeCompare(b.key));

    result[field] = entries;
  }
  return result;
}

function toFacetValues(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((entry) => String(entry));
  }
  if (value == null) return [];
  return [String(value)];
}

function getNumericValue(item: TileData, field: string): number | null {
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

function buildColorStops([min, max]: [number, number]): ColorStop[] {
  if (!Number.isFinite(min) || !Number.isFinite(max)) {
    return [
      { position: 0, color: NEGATIVE_COLOR },
      { position: 0.5, color: NEUTRAL_COLOR },
      { position: 1, color: POSITIVE_COLOR },
    ];
  }
  if (min >= 0) {
    return [
      { position: 0, color: POSITIVE_SOFT_COLOR },
      { position: 1, color: POSITIVE_COLOR },
    ];
  }
  if (max <= 0) {
    return [
      { position: 0, color: NEGATIVE_COLOR },
      { position: 1, color: NEGATIVE_SOFT_COLOR },
    ];
  }
  const span = max - min;
  const zeroPosition = span === 0 ? 0.5 : (0 - min) / span;
  const clampedZero = Math.min(1, Math.max(0, zeroPosition));
  return [
    { position: 0, color: NEGATIVE_COLOR },
    { position: clampedZero, color: NEUTRAL_COLOR },
    { position: 1, color: POSITIVE_COLOR },
  ];
}

function getFormatter(field: string) {
  const config = NUMERIC_FILTERS.find((entry) => entry.field === field);
  return config?.formatter ?? formatNumber;
}

function formatPercent(value: number): string {
  if (!Number.isFinite(value)) {
    return '—';
  }
  const magnitude = Math.abs(value);
  const precision = magnitude < 1 ? 2 : magnitude < 10 ? 1 : 0;
  const formatted = value.toFixed(precision);
  const sign = value > 0 ? '+' : '';
  return `${sign}${formatted}%`;
}

function formatCurrency(value: number): string {
  const magnitude = Math.abs(value);
  const precision = magnitude < 100 ? 2 : magnitude < 1000 ? 1 : 0;
  return `$${value.toFixed(precision)}`;
}

function formatNumber(value: number): string {
  if (!Number.isFinite(value)) return '—';
  const magnitude = Math.abs(value);
  if (magnitude >= 1_000_000_000) {
    return `${(value / 1_000_000_000).toFixed(1)}B`;
  }
  if (magnitude >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}M`;
  }
  if (magnitude >= 1_000) {
    return `${(value / 1_000).toFixed(1)}K`;
  }
  return value.toFixed(2);
}

function isRangeActive(selection: RangeSelection | undefined, baseline: NumericStats | null | undefined): boolean {
  if (!selection || !baseline) return false;
  if (typeof selection.min !== 'number' || typeof selection.max !== 'number') return false;
  return (
    Math.abs(selection.min - baseline.min) > RANGE_TOLERANCE ||
    Math.abs(selection.max - baseline.max) > RANGE_TOLERANCE
  );
}

function countActiveFilters(
  selectedFacets: Record<string, string[]>,
  rangeSelections: Record<string, RangeSelection>,
  baselineStats: Record<string, NumericStats | null>
): number {
  let count = 0;
  for (const values of Object.values(selectedFacets)) {
    if (values.length > 0) count += 1;
  }
  for (const [field, range] of Object.entries(rangeSelections)) {
    if (!range) continue;
    if (isRangeActive(range, baselineStats[field])) {
      count += 1;
    }
  }
  return count;
}
