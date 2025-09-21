# Histogram & Filtering Stabilization Plan

## Goals
- Ensure every filter interaction (discrete, numeric, search) uses a single, consistent data set so sidebar histograms and the main histogram always agree.
- Resize histogram buckets/cards so the graph view fills the viewport with tiny, semantic-zoom-aware tiles.
- Keep the full Polygon snapshot locally so tile/index ordering is deterministic for 11k+ symbols.

## Tasks

- [x] **T1 – Server Facet/Items Consistency**
  - Update `/facets` to union keys across all filtered items so empty facet rails disappear.
  - Ensure `/items` returns deterministic ordering (alphabetical) when `sort` is omitted.
  - *Validation:* add a Vitest unit test that feeds synthetic items through the server helpers and asserts facet counts cover all keys; run `npm run build`.

- [x] **T2 – Client Filter State & Full Fetch**
  - Replace page-wise fetching with `fetchAllItems()` that loops cursors until exhausted; store `allItems` for downstream views.
  - Centralise filters (`discrete`, `range`, `search`) and memoise `filteredItems`.
  - *Validation:* add a Vitest test for `fetchAllItems` mocking paged responses; console-log filtered item counts during development (removed before commit).

- [x] **T3 – Canonical Bucket Builder**
  - Implement `buildHistogramRanges(items, field, stats, maxBins)` to produce ≤10 ordered ranges with counts from `filteredItems`.
  - Rewire `NumericRangeFilter` and `HistogramView` to consume the shared ranges.
  - *Validation:* Vitest tests covering corner cases (empty data, single value, skewed data) to confirm bucket count/ordering; lint + build.

- [ ] **T4 – Sidebar Histogram Behaviour**
  - Highlight bins intersecting the current range selection; ensure counts drop to zero when outside range.
  - Double-click clears the range (if not already implemented).
  - *Validation:* Vitest component test (Mount with @testing-library/react) to simulate range updates and assert highlighted bars.

- [ ] **T5 – Histogram Layout & Tiny Tiles**
  - Make buckets flex to fill viewport; add bucket labels to footer; use ResizeObserver to size square tiles (5 per row minimum).
  - Default histogram view to “tiny” grain; allow slider to enlarge (keeping smooth grain transitions).
  - *Validation:* add a Jest DOM test to stub ResizeObserver and assert computed style matches expected min width; manual visual check in browser.

- [ ] **T6 – Semantic Tile Content**
  - Map grains (G0/G1/G2) to stock metrics (G0 = ticker+price+%Δ, G1 adds volume/open/close, G2 adds market cap, 52w high/low, etc.).
  - Apply same template in both tiles and histogram views for consistency.
  - *Validation:* Snapshot tests for tile rendering per grain with sample data; manual verify for random tickers.

- [ ] **T7 – Regression Suite & Docs**
  - Run `npm run build`, `npm run test -- --run`, and document outcomes in PR.
  - Update README with histogram interaction notes.

## Validation Matrix
| Task | Automated Check |
| ---- | --------------- |
| T1 | `vitest run server` (new helper test) |
| T2 | `vitest run fetchAllItems.test.ts` |
| T3 | `vitest run histogram.test.ts` |
| T4 | `vitest run numericRangeFilter.test.tsx` |
| T5 | `jest-dom`/`@testing-library/react` resize test |
| T6 | `vitest run tilePresenterContent.test.tsx` |
| T7 | `npm run build && npm run test -- --run` |

*Checked boxes should reflect completed tasks and passing automated validation.*
