# PRD: FacetZoom Histogram View Parity with PivotViewer

**Author:** Codex (GPT-5)  
**Date:** 2025-09-21  
**Stakeholder:** Brian Burdick  
**Source Reference:** Screencast `Docs/d3PivotViewerBorchardt.mp4`

## 1. Problem Statement
The existing FacetZoom histogram view diverges substantially from the behaviour demonstrated in the PivotViewer screencast. Current gaps include:
- Partial data loading (only a subset of tickers visible, e.g., only “A/B”).
- Histogram buckets and sidebar filters fall out of sync when ranges are applied.
- Bars do not densely pack tiny tiles; viewport reveals oversized cards rather than the 5×N tile grids.
- Zoom semantics, sort, color mapping, and facet updates do not mirror the expected interactions.

We must deliver a feature-complete histogram experience that matches the PivotViewer video “frame-for-frame,” ensuring the UI can confidently replace the original workflow for real-world datasets (~300k records, ~11k tiles visible at once).

## 2. Goals & Non-Goals
### Goals
1. Display the entire dataset (≥11k cards) simultaneously in the histogram view without manual pagination.
2. Maintain visual fidelity to the PivotViewer screenshot: each bucket fills the viewport horizontally; tiles stack densely (five columns per row at base zoom) and expand smoothly with zoom.
3. Filters (categorical & numeric) immediately update both sidebar histograms and the main histogram with matching bins.
4. Support global color mapping, sort ordering, and view/zoom controls as seen in the video.
5. Provide smooth semantic zoom transitions showing richer tile content at higher zooms.

### Non-Goals
- Implement scatter view or interactive brushes beyond the histogram. (Documented for future work.)
- Expose shareable URLs/state persistence. (Out-of-scope for this milestone.)
- Full accessibility audit. (Will be handled after feature parity.)

## 3. User Stories & Acceptance Criteria

### US-1: Load All Tiles
**As** an analyst, **I want** all tickers visible in the histogram, **so that** I can understand distribution across the entire dataset.
- *Acceptance Criteria*
  - Histogram view shows all loaded items (11,753 tickers) immediately on initial load.
  - `Ticker Initial` facet lists A–Z counts even after applying other filters.
  - No “load more” button is necessary in histogram mode.

### US-2: Matching Histograms & Filters
**As** the same analyst, **I want** sidebar histogram bars to match the main histogram bins when I drag ranges, **so that** I trust the filtering feedback.
- *Acceptance Criteria*
  - `buildHistogramRanges` returns canonical bins per numeric field (≤10). Sidebar histograms use these bins; bar heights reflect filtered subset counts.
  - Selecting a range highlights corresponding bins in both sidebar and main histogram; bins outside range drop to zero height.
  - Clearing a range (double-click) reverts both histograms simultaneously.

### US-3: Dense Bucket Layout
**As** the analyst, **I need** each histogram bar to look like a thin column of tiny tiles, **so that** I can see sub-populations without scrolling.
- *Acceptance Criteria*
  - Each bucket uses CSS grid with `repeat(auto-fill, minmax(32px, 1fr))` and `grid-auto-rows: 32px` (configurable). Minimum 5 columns per row with gutter spacing ≤ 6px.
  - Buckets flex to fill viewport width; height equals available canvas minus header/footer (no vertical scroll).
  - Chips show ticker (uppercase) + percent change indicator; color swatch across the top uses global gradient.

### US-4: Semantic Zoom
**As** the analyst, **I want** zoom-in controls to increase chip size and reveal more detail, **so that** I can inspect items without switching to tile view.
- *Acceptance Criteria*
  - Zoom slider (or +/– buttons) increments chip size: 32 → 64 → 128 px. At each threshold, tile presenter switches the grain (G0/G1/G2) and reveals additional metrics.
  - Transitions animate (cross-fade) between grain states within 150 ms.
  - Zoom state is shared between tiles view and histogram view.

### US-5: Sort & Color Parity
**As** the analyst, **I want** the sort and color controls to behave exactly as PivotViewer, **so that** I can slice the data by any metric.
- *Acceptance Criteria*
  - Sort dropdown accepts `metric[:asc|desc]`. Changing it reorders bucket stacking or central ordering as in video (bin re-sorting). Server returns deterministic ordering.
  - Color dropdown selects numeric field; color scale updates instantly using linear gradient; legend updates (field label + min|mid|max values).

### US-6: Facet Rail Responsiveness
**As** the analyst, **I need** facet counts to update instantly and show active selections, **so that** I can iterate quickly.
- *Acceptance Criteria*
  - Left rail retrieving counts from canonical filter state (client crossfilter). `Reset` link clears facet & repaints histogram.
  - Search within facet filters (type-ahead) narrows options live.
  - Selection summary at top updates with filtered count (e.g., “26,932 selected from 310,787”).

### US-7: Performance & Stability
**As** an engineer supporting this feature, **I want** the histogram to remain responsive with 300k records, **so that** we can scale to real campaigns.
- *Acceptance Criteria*
  - Data is loaded once (from `data/items.json` or remote) and kept in memory (web worker optional). Building histogram bins & facet counts runs under 200 ms for 11k items.
  - Rendering uses virtualization/Canvas for chips when >15k visible elements (Canvas or instanced WebGL as necessary). 60 fps target when hovering and zooming.
  - Error states (network failure) fall back to “sample dataset loaded” message.

## 4. Functional Requirements

### 4.1 Data Loading
- Client fetches `data/items.json` (local static build) or remote dataset; dataset includes enriched metrics (open, close, volume, P/E, etc.).
- Items sorted lexicographically by ticker once loaded.
- Filter engine (client) maintains crossfilter-like state: `discreteSelections`, `rangeSelections`, `searchQuery`.

### 4.2 Filtering Pipeline
1. Apply discrete filters: `Set<facet, Set<value>>` - intersection semantics.
2. Apply numeric ranges: `Map<field, {min, max, inclusive:true}>`.
3. Apply search: simple substring match on ticker/title.
4. Resulting `filteredItems` drives all downstream computations.

### 4.3 Histogram Buckets
- Build canonical bins per numeric field from filtered data:
  - Determine `min`, `max`, `span`.
  - If `span <= 0`, create single bin at that point.
  - Else create `min(maxBins, ceil(span / targetWidth))` bins (target = Freedman–Diaconis or 10 bins default).
- Count items per bin; store `HistogramRange[]`.
- Sidebar histograms use same bins (bar height = count).
- Main histogram uses bins for bucket layout; bucket label = formatted `start–end` range (with currency/number formatting).

### 4.4 Layout & Rendering
- Canvas container height = viewport height minus header/footer (calc via ResizeObserver).
- Each bucket as `<section>` with `flex: 1 1 auto`, min-width computed from `columns * chipSize + gutter`.
- Chips rendered using Canvas/WebGL or CSS grid. MVP uses DOM grid; if perf degrades, fallback to Canvas with `drawImage` for color rectangles + text overlay.
- Chip content per grain: 
  - G0 (≤ 48 px): ticker (uppercase), change % (colored green/red), color swatch. Single-line text.
  - G1 (49–96 px): adds price, volume, open/close values (two-line layout similar to video’s mid zoom).
  - G2 (>96 px): adds additional metrics (P/E, market cap, 52w high/low). Layout uses 2×N grid.

### 4.5 Controls
- **Sort Dropdown**: `Sort: <metric>` list. Sorting algorithm: default ascending; SHIFT toggles desc.
- **Color Dropdown**: same metric list. On change, update gradient domain (auto = filtered min/max). Provide optional “Lock global domain” toggle.
- **Zoom**: slider (min=32, max=128). Buttons +/- adjust by 16 px.
- **View Dropdown**: `Histogram`, `Tiles`. Toggle transitions view while maintaining filters, sort, color, zoom states.
- **Legend**: updated label “Color: <field> (Auto)” showing min|mid|max.

### 4.6 Facet Rail
- Each facet component shows top 20 values with counts; search box filters options.
- Checkboxes allow multi-select; “Clear <Facet>” resets.
- Numeric facets show histogram (same bins) + slider + numeric inputs.
- Reset All clears filters, returns to default view.

### 4.7 Tooltips & Hover
- Hovering over chip highlights it, shows tooltip with ticker, price, change %, metric used for color.
- Tooltip anchored near cursor, hides on mouse leave.

### 4.8 Error Handling
- If dataset loading fails, show error banner with retry.
- If filter results empty, histogram shows “No items in range” message per bucket.

## 5. Non-Functional Requirements
- **Performance**: 60fps interactions; re-render filtered view ≤ 200 ms; memory footprint manageable for 300k items (if we scale to full dataset later, consider worker/off-main-thread filtering).
- **Accessibility**: Provide ARIA roles (`list`, `listitem`), keyboard navigation (arrow keys move highlight across chips), focus outlines.
- **Testing**: Add unit coverage for bucket builder, filter pipeline, sort/color interactions; integration tests for histogram density.

## 6. Milestones
1. **M1 – Data & Filters Backbone** (Owner: FE) – 1.5 weeks
   - Implement full dataset load, filter pipeline, canonical buckets.
   - Unit/integration tests (T2/T3 in `Docs/histogram_plan.md`).
2. **M2 – Dense Histogram Layout** (Owner: FE) – 1 week
   - CSS/Canvas grid, chip component, bucket flex.
   - Performance profiling & adjustments.
3. **M3 – Controls & Zoom** (Owner: FE) – 1 week
   - Integrate sort/color/zoom with new layout; implement grain transitions.
4. **M4 – Facet Rail & Tooltip Polish** – 1 week
   - Synchronize left rail counts; add tooltip; refine selection summary.
5. **M5 – QA & Perf Hardening** – 1 week
   - End-to-end tests, accessibility sweep, build pipeline.

Target: 5–6 week effort with rolling demos at the end of each milestone.

## 7. Risks & Mitigations
- **Performance risk**: DOM grid may lag at 11k tiles. Mitigation: fall back to Canvas drawing; precompute glyph atlas for text.
- **Dataset size**: Real campaigns approach 300k; may require virtualization/aggregation (display sample with drill-down). Plan for future worker-based filtering.
- **Parity gaps**: Scatter view, brush interactions not yet captured. A follow-up PRD should cover those once histogram parity is achieved.

## 8. Open Questions
- Do we need to support brush selection within histogram buckets (as in some PivotViewer versions)?
- Should color gradient include mid-point label (0, median) like PivotViewer or simply min/max?
- Are there contractual requirements for Export (e.g., “Export Airings”)? Out-of-scope for this histogram milestone but needs future planning.

---
This PRD should guide implementation toward a PivotViewer-equivalent histogram experience. Any changes to scope or priorities should update both this document and `Docs/histogram_plan.md` tasks.
