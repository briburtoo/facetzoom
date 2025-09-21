import { useCallback, useMemo } from 'react';
import type { CSSProperties } from 'react';
import type { NumericStats, TileData } from '../types';
import { buildHistogramRanges, type HistogramRange } from '../utils/histogram';

type RangeSelection = { min?: number; max?: number };

interface NumericRangeFilterProps {
  field: string;
  title: string;
  helper?: string;
  stats: NumericStats | null;
  baseline: NumericStats | null;
  selection: RangeSelection;
  formatter: (value: number) => string;
  onSelectionChange: (selection: RangeSelection) => void;
  onReset: () => void;
  inputStep?: number;
  isActive: boolean;
  baselineItems: TileData[];
  filteredItems: TileData[];
  metricField: string;
  maxBins: number;
}

export function NumericRangeFilter({
  field,
  title,
  helper,
  stats,
  baseline,
  selection,
  formatter,
  onSelectionChange,
  onReset,
  inputStep,
  isActive,
  baselineItems,
  filteredItems,
  metricField,
  maxBins,
}: NumericRangeFilterProps) {
  const sliderSource = baseline ?? stats;
  const sliderBounds = useMemo(() => computeSliderBounds(sliderSource, inputStep), [sliderSource, inputStep]);

  const sliderSelection = useMemo(() => {
    if (!sliderBounds) {
      return {
        min: typeof selection.min === 'number' ? selection.min : 0,
        max: typeof selection.max === 'number' ? selection.max : 0,
      };
    }
    const { min, max } = sliderBounds;
    const currentMin = clamp(typeof selection.min === 'number' ? selection.min : min, min, max);
    const currentMax = clamp(typeof selection.max === 'number' ? selection.max : max, min, max);
    if (currentMin > currentMax) {
      return { min: currentMax, max: currentMax };
    }
    return { min: currentMin, max: currentMax };
  }, [selection, sliderBounds]);

  const sliderStyle = useMemo(() => {
    if (!sliderBounds) return undefined;
    const { min, max } = sliderBounds;
    const range = max - min;
    if (range <= 0) return undefined;
    const start = ((sliderSelection.min - min) / range) * 100;
    const end = ((sliderSelection.max - min) / range) * 100;
    return {
      '--range-start': `${start}%`,
      '--range-end': `${end}%`,
    } as CSSProperties;
  }, [sliderBounds, sliderSelection]);

  const histogram = useMemo<HistogramRange[]>(() => {
    const ranges = buildHistogramRanges({
      domainItems: baselineItems,
      countItems: filteredItems,
      field: metricField,
      stats: baseline,
      maxBins,
    });
    return ranges;
  }, [baseline, baselineItems, filteredItems, maxBins, metricField]);

  const histogramMax = useMemo(() => {
    return histogram.reduce((max, bin) => (bin.count > max ? bin.count : max), 0);
  }, [histogram]);

  const handleInputChange = useCallback(
    (key: 'min' | 'max', raw: string) => {
      const value = raw.trim();
      if (value.length === 0) {
        const next = { ...selection };
        delete next[key];
        onSelectionChange(next);
        return;
      }
      const parsed = Number.parseFloat(value);
      if (Number.isNaN(parsed)) {
        return;
      }
      const next = { ...selection, [key]: parsed } as RangeSelection;
      onSelectionChange(next);
    },
    [onSelectionChange, selection]
  );

  const handleSliderChange = useCallback(
    (key: 'min' | 'max', raw: string) => {
      if (!sliderBounds) return;
      const parsed = Number.parseFloat(raw);
      if (Number.isNaN(parsed)) return;
      const clampedValue = clamp(parsed, sliderBounds.min, sliderBounds.max);
      let nextMin = key === 'min' ? clampedValue : sliderSelection.min;
      let nextMax = key === 'max' ? clampedValue : sliderSelection.max;
      if (nextMin > nextMax) {
        if (key === 'min') {
          nextMax = nextMin;
        } else {
          nextMin = nextMax;
        }
      }
      onSelectionChange({ min: nextMin, max: nextMax });
    },
    [onSelectionChange, selection, sliderBounds, sliderSelection]
  );

  const decimals = determineDecimals(inputStep);
  const minPlaceholder = baseline ? baseline.min.toFixed(decimals) : undefined;
  const maxPlaceholder = baseline ? baseline.max.toFixed(decimals) : undefined;

  const summaryMin = Number.isFinite(sliderSelection.min) ? formatter(sliderSelection.min) : '—';
  const summaryMax = Number.isFinite(sliderSelection.max) ? formatter(sliderSelection.max) : '—';

  return (
    <section className="sidebar__section numeric-filter">
      <div>
        <h3 className="sidebar__section-title">{title}</h3>
        {helper ? <p className="sidebar__section-helper">{helper}</p> : null}
      </div>
      {histogram.length > 0 ? (
        <div className="numeric-filter__histogram" aria-hidden="true">
          {histogram.map((bin, index) => {
            const height = histogramMax === 0 ? 0 : (bin.count / histogramMax) * 100;
            const active = sliderBounds
              ? bin.end >= sliderSelection.min && bin.start <= sliderSelection.max
              : false;
            const style = { '--bar-height': `${height}%` } as CSSProperties;
            const className = active
              ? 'numeric-filter__bar numeric-filter__bar--active'
              : 'numeric-filter__bar';
            return <div key={`${bin.start}-${index}`} className={className} style={style} />;
          })}
        </div>
      ) : (
        <p className="sidebar__section-helper">Histogram unavailable for {title.toLowerCase()}.</p>
      )}
      {sliderBounds ? (
        <>
          <div className="range-slider" style={sliderStyle}>
            <div className="range-slider__track">
              <input
                type="range"
                min={sliderBounds.min}
                max={sliderBounds.max}
                step={sliderBounds.step}
                value={sliderSelection.min}
                onChange={(event) => handleSliderChange('min', event.target.value)}
                aria-label={`Minimum ${title} slider`}
              />
              <input
                type="range"
                min={sliderBounds.min}
                max={sliderBounds.max}
                step={sliderBounds.step}
                value={sliderSelection.max}
                onChange={(event) => handleSliderChange('max', event.target.value)}
                aria-label={`Maximum ${title} slider`}
              />
            </div>
            <div className="range-slider__values">
              <span>{summaryMin}</span>
              <span>{summaryMax}</span>
            </div>
          </div>
          <div className="numeric-filter__inputs">
            <label className="sidebar__section-helper" htmlFor={`${field}-min`}>
              Minimum
            </label>
            <input
              id={`${field}-min`}
              type="number"
              inputMode="decimal"
              value={selection.min ?? ''}
              step={inputStep}
              placeholder={minPlaceholder}
              onChange={(event) => handleInputChange('min', event.target.value)}
            />
            <label className="sidebar__section-helper" htmlFor={`${field}-max`}>
              Maximum
            </label>
            <input
              id={`${field}-max`}
              type="number"
              inputMode="decimal"
              value={selection.max ?? ''}
              step={inputStep}
              placeholder={maxPlaceholder}
              onChange={(event) => handleInputChange('max', event.target.value)}
            />
          </div>
        </>
      ) : null}
      <div className="sidebar__actions">
        <button className="sidebar__button sidebar__button--ghost" onClick={onReset}>
          Reset {title}
        </button>
        {isActive ? <span className="badge">Filter active</span> : null}
      </div>
    </section>
  );
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function computeSliderBounds(stats: NumericStats | null, overrideStep?: number) {
  if (!stats) return null;
  const { min, max } = stats;
  if (!Number.isFinite(min) || !Number.isFinite(max)) {
    return null;
  }
  const span = Math.max(max - min, 0.01);
  const padding = span * 0.05;
  const sliderMin = min - padding;
  const sliderMax = max + padding;
  const rawStep = span / 200;
  const computedStep = Math.max(0.001, Number(rawStep.toFixed(3)));
  const step = overrideStep ? Math.max(overrideStep, computedStep) : computedStep;
  return { min: sliderMin, max: sliderMax, step } as const;
}

function determineDecimals(step?: number): number {
  if (!step || step <= 0) return 2;
  const parts = step.toString().split('.');
  if (parts.length === 1) return 0;
  return parts[1].length;
}
