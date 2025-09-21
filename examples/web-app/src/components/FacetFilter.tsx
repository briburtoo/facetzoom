import { useMemo, useState } from 'react';
import type { FacetCount } from '../types';

interface FacetFilterProps {
  title: string;
  helper?: string;
  options: FacetCount[];
  selected: Set<string>;
  onToggle: (value: string) => void;
  onClear: () => void;
  searchPlaceholder?: string;
  maxVisibleOptions?: number;
}

export function FacetFilter({
  title,
  helper,
  options,
  selected,
  onToggle,
  onClear,
  searchPlaceholder = 'Search values',
  maxVisibleOptions = 40,
}: FacetFilterProps) {
  const [query, setQuery] = useState('');
  const normalisedQuery = query.trim().toLowerCase();

  const filteredOptions = useMemo(() => {
    if (!normalisedQuery) return options;
    return options.filter((option) => option.key.toLowerCase().includes(normalisedQuery));
  }, [normalisedQuery, options]);

  const limitedOptions = useMemo(() => {
    const limit = normalisedQuery ? Math.max(maxVisibleOptions, 200) : maxVisibleOptions;
    return filteredOptions.slice(0, limit);
  }, [filteredOptions, maxVisibleOptions, normalisedQuery]);

  const selectedOptions = useMemo(() => {
    if (selected.size === 0) return [] as FacetCount[];
    return options.filter((option) => selected.has(option.key));
  }, [options, selected]);

  const visibleOptions = useMemo(() => {
    const unique = new Map<string, FacetCount>();
    for (const option of selectedOptions) {
      unique.set(option.key, option);
    }
    for (const option of limitedOptions) {
      unique.set(option.key, option);
    }
    return [...unique.values()];
  }, [limitedOptions, selectedOptions]);

  const hiddenCount = filteredOptions.length - limitedOptions.length;

  return (
    <section className="sidebar__section">
      <div>
        <h3 className="sidebar__section-title">{title}</h3>
        {helper ? <p className="sidebar__section-helper">{helper}</p> : null}
      </div>
      <div className="filter-search">
        <input
          type="search"
          value={query}
          placeholder={searchPlaceholder}
          onChange={(event) => setQuery(event.target.value)}
        />
        {query ? (
          <button type="button" className="filter-search__clear" onClick={() => setQuery('')} aria-label={`Clear ${title} search`}>
            ×
          </button>
        ) : null}
      </div>
      <div className="filter-group" data-has-scroll={filteredOptions.length > limitedOptions.length}>
        {visibleOptions.length === 0 ? <span className="sidebar__section-helper">No values</span> : null}
        {visibleOptions.map((option) => {
          const id = `${title}-${option.key}`;
          return (
            <label key={option.key} className="filter-option" htmlFor={id}>
              <span className="filter-option__label">
                <input
                  id={id}
                  type="checkbox"
                  checked={selected.has(option.key)}
                  onChange={() => onToggle(option.key)}
                />
                <span>{option.key}</span>
              </span>
              <span className="filter-option__count">{option.count}</span>
            </label>
          );
        })}
      </div>
      {hiddenCount > 0 ? (
        <p className="sidebar__section-helper sidebar__section-helper--muted">
          Showing {visibleOptions.length} of {filteredOptions.length}. Refine search to see more.
        </p>
      ) : null}
      <div className="sidebar__actions">
        <button className="sidebar__button sidebar__button--ghost" onClick={onClear} disabled={selected.size === 0}>
          Clear {title}
        </button>
      </div>
    </section>
  );
}
