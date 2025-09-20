# FacetZoom Project Documentation
**Last Updated:** 2025-09-20

This single document consolidates three guiding narratives for the project:
1) Product Requirements Document (PRD)  
2) Phased Execution & Test Plan  
3) UX & Visual Design Reference  

---

## Part 1: Product Requirements Document (PRD)
**Project Codename:** FacetZoom  
**Version:** 1.0  
**Owner:** <you>  
**Date:** 2025-09-20

### 1. Executive Summary
FacetZoom is a modern, browser‑native reimagining of the Silverlight PivotViewer experience, built with WebGPU (with WebGL2/Canvas2D fallback), JSON/REST backends, and coordinated filtering. It retains the signature interactions—facet filtering, instant sort/group, semantic zoom (progressively richer “grains”), and grid/graph views—while scaling to much larger collections with GPU acceleration. Legacy concepts we preserve include multiple item templates that switch by on‑screen size and multi‑resolution deep‑zoom imagery, now implemented with modern equivalents (DZI/IIIF tiles).

### 2. Goals & Non‑Goals
**Goals**
- Fast, intuitive exploration of large item collections using facet filters, range brushing, and search.
- Two core views: **Tiles (grid)** and **Graph** (scatter, heatmap), with a **shared color mapping** (linear numeric gradient).
- **Semantic zoom** with 2–3 “grains” of detail per tile as zoom increases (smooth cross‑fade).
- Predictable **coloring**: a single numeric field maps linearly to a sequential gradient; option to reverse, and auto vs. global domain.
- Coordinated **facet counts** that update under current global filters.
- Clean **REST/JSON** API: `/items`, `/facets`, `/stats`, `/tiles` (DZI/IIIF compatible).
- Accessibility (WCAG AA), internationalization, and dark mode from day one.

**Non‑Goals (v1)**
- 3D rendering or ray tracing.
- Client‑side machine learning beyond simple transforms; backends may supply derived metrics.
- Direct Silverlight/CXML runtime compatibility (we import JSON that captures equivalent semantics).

### 3. Users & Personas
- **Explorer/Analyst** – filters & sorts to find patterns; exports slices.
- **Buyer/Decision‑maker** – scans at high level, drills to item detail, shares a frozen/locked view.
- **Integrator/Engineer** – embeds the component; configures facets/data sources.
- **Admin** – sets quotas, retention, and access policies.

### 4. Representative Use Cases
- Filter a 500k‑item collection by multiple categorical facets and a numeric range; tiles update smoothly; counts return in ≤200 ms.
- Switch to **Graph → Scatter**, map X/Y to two measures, color by a third (linear gradient), zoom/pan at 60 fps.
- Zoom the grid: at coarse zoom show only color chips; at medium add labels; at close show thumbnail and 1–2 key values (semantic zoom). 
- Share a stateful URL capturing filters, view, color field, and domain lock so colleagues see the same view.
- Use deep‑zoom imagery for items (where available) to keep bandwidth low while preserving detail on close zoom.

### 5. Functional Requirements

#### 5.1 Data Model (client‑facing JSON)
```json
{
  "id": "item_123",
  "title": "Item Name",
  "image": { "thumb": "/thumbs/123.webp", "dzi": "/dzi/123.dzi" },
  "facets": {
    "Category": ["Tool", "Outdoor"],
    "Brand": "Acme",
    "Price": 129.99,
    "Year": 2021,
    "Added": "2024-10-12"
  },
  "metrics": { "score": 0.73, "value": 42.1 }
}
```

- **Facets**: categorical (single/multi), numeric, datetime. 
- **Metrics**: arbitrary numeric values used for color/sort/graphs.

#### 5.2 REST Endpoints
- `GET /items?fields=G0|G1|G2&filters&sort&cursor` → paginated items; `fields` controls grain payload (semantic‑zoom stages).
- `GET /facets?filters` → counts per facet value under current global filters.
- `GET /stats?field=<id>&filters` → `{min,max,count}`; optionally `{p01,p99}` for robust domain clipping.
- `GET /tiles/{item}/{z}/{x}/{y}` or IIIF endpoints → multi‑resolution imagery (Deep‑Zoom equivalent).

#### 5.3 Views & Interactions
- **Tiles (grid)**: zoom/pan; click to select; hover tooltips. Content changes by screen‑width thresholds; cross‑fade on grain changes.
- **Graph**: 
  - **Scatter** (X, Y, color by a third field). 
  - **Heatmap** (bin statistic → color; e.g., mean or count).
- **Color rule** (shared): choose one numeric field; normalize linearly over domain; map to LUT; auto domain (current selection) or global lock; reverse option.
- **Facet rail**: categorical pills with counts; numeric/date sliders with histograms; free‑text search (optional).
- **State sharing**: URL encodes view, fields, filters, sort, and color domain settings.

#### 5.4 Filtering Engine
- **In‑browser** (default): Crossfilter‑style dimensions/groups for sub‑million rows; multi‑select categorical filters; range filters; groups feed facet counts.
- **Scale‑out** (optional): server pushdown returns item page + facet counts under current filters; identical UX with lower client memory.

#### 5.5 Semantic Zoom (Grains)
- **G0** ≤ 64 px: colored chip only.  
- **G1** 65–160 px: color + short label.  
- **G2** ≥ 161 px: color + label + small metric(s) + optional thumbnail.  
Grain selection is based on on‑screen tile width; transitions are cross‑faded ~150–200 ms.

#### 5.6 Accessibility
- Keyboard navigation (grid, rail, dialogs), ARIA roles/labels.  
- Color schemes are color‑vision‑deficiency‑safe; selection indicated with stroke/shape, not hue alone.  
- Maintain a hidden, live DOM list mirroring canvas content for screen readers.

#### 5.7 Internationalization
- LTR/RTL layouts, locale‑aware number/date formats, and externalized strings.

#### 5.8 Export/Share
- Export selected sets (.csv/.json), copy shareable URL.

### 6. Non‑Functional Requirements
- **Performance:** 60fps pan/zoom; facet updates ≤200 ms for ≤1M rows client‑side; TTFI ≤1.5 s with 1k visible tiles; typical memory ≤300 MB.
- **Compatibility:** WebGPU preferred; WebGL2/Canvas2D fallback; Chrome/Edge/Safari stable; Firefox supported where capabilities allow.
- **Reliability:** graceful degradation (failed tiles, partial data); retry/backoff; idempotent requests.
- **Security/Privacy:** HTTPS; CORS allowlist; auth (bearer/OIDC); PII‑safe; avoid secrets in URL; CSP headers.
- **Observability:** basic telemetry (interaction timings, error rates), sampling and opt‑out.

### 7. Success Metrics (MVP)
- Time‑to‑first‑interaction ≤ 1.5 s (p50).  
- Filter‑to‑paint ≤ 200 ms (p75) on 500k rows client‑side.  
- Task success: ≥90% of beta users complete a find‑and‑drill task in <2 minutes.  
- Lighthouse accessibility score ≥95.

### 8. Competitive/Legacy Context
- **Legacy PivotViewer**: item templates switching by MaxWidth; Grid and Graph views; Deep Zoom imagery. We emulate behaviors with web standards.
- **HTML5 PivotViewer** (jQuery) shows early web patterns; we modernize with GPU and typed APIs.

### 9. Risks & Mitigations
- **Browser GPU variance** → WebGL2 fallback; feature detection; test matrix across GPUs.  
- **Very large datasets** → server aggregation; streaming pages; optional Arrow/Parquet later.  
- **Color misuse** → one simple rule + legend + domain lock ensures consistency.  
- **A11y in canvas** → mirrored DOM list, focus management, ARIA annotations.

### 10. Open Questions
- Offline mode requirements?  
- Preferred deep‑zoom protocol (IIIF vs DZI)?  
- Auth model (per‑user vs public collections)?

### Appendix A — Minimal API Sketch
```http
GET /stats?field=score&filters=... → { "min": -2.3, "max": 9.1, "count": 128734 }
GET /facets?filters=...            → { "Category": [{"key":"Tool","count":1234}, ...], "Brand":[...] }
GET /items?fields=G1&filters=...&sort=score:desc&cursor=abc
→ { "items":[{ "id":"a1", "title":"Alpha", "metrics":{"score":3.2}, "image":{"thumb":"/t/a1.webp"} }], "next":"..." }
GET /tiles/123/10/512/768.webp     → tile image at z/x/y (or IIIF)
```

---

## Part 2: Phased Execution & Test Plan
**Project Codename:** FacetZoom

> Each phase has explicit gates; do not proceed until all gates are green.

### Phase 0 — Foundations (1–2 weeks)
**Objectives:** Repo scaffolding; CI; coding standards; TypeScript; lint/test toolchain.  
**Deliverables:** Monorepo (`packages/viewer`, `packages/filters`, `packages/server`, `examples`), Vitest/Jest, Playwright E2E, ESLint/Prettier, demo data generator.  
**Gates:** CI green; unit-test coverage ≥70% on `packages/filters`.

### Phase 1 — Color & Legend (≈1 week)
**Objectives:** Implement the single numeric → gradient mapper; LUT upload; legend.  
**Tests:** unit tests for `computeU` edge cases; visual golden‑image tests for LUT samples.  
**Gates:** legend renders with min/mid/max ticks; reverse toggle works.

### Phase 2 — Filtering Core (≈2 weeks)
**Objectives:** Crossfilter‑style engine; categorical multi‑select; numeric/date ranges; counts.  
**Tests:** unit tests for dimensions/groups incl. multi‑valued categories; property‑based tests for filter algebra; perf test on 1M rows (p75 ≤ 200 ms).  
**Gates:** facet rail returns correct counts under arbitrary filter combinations.

### Phase 3 — Tiles Renderer (WebGPU) (2–3 weeks)
**Objectives:** Instanced quads; color via LUT; camera (zoom/pan).  
**Tests:** render 10k tiles at 60fps; fallback path parity; memory checks.  
**Gates:** Meets performance target on target hardware.

### Phase 4 — Semantic Zoom (Grains) (≈2 weeks)
**Objectives:** Grain thresholds by on‑screen width; cross‑fade (150–200 ms); layer masks.  
**Tests:** boundary conditions for `pickGrain`; transition visuals; a11y text presence.  
**Gates:** QA sign‑off on smoothness; a11y acceptance.

### Phase 5 — Graph View (≈2 weeks)
**Objectives:** Scatter (X,Y,color) and Heatmap (CPU binning) using same LUT and camera.  
**Tests:** numerical correctness for binning; golden‑image snapshots; transform correctness with zoom/pan.  
**Gates:** shared color behaves identically across views; legends match.

### Phase 6 — REST Adapter & Server Pushdown (2–3 weeks)
**Objectives:** Implement `/stats`, `/facets`, `/items`; cursor paging; translate filters to query; error handling.  
**Tests:** contract tests with mock server; error injection (timeouts, 500s); consistency checks between local Crossfilter and server aggregates on fixtures.  
**Gates:** Seamless switch between local and server modes with identical UX.

### Phase 7 — Images & Deep Zoom (1–2 weeks)
**Objectives:** DZI/IIIF loader; tile cache; graceful fallback for missing tiles.  
**Tests:** viewport‑bounded fetch patterns; cache eviction; mip‑level selection; no blur at rest.  
**Gates:** Meets bandwidth & FPS targets under pan/zoom.

### Phase 8 — Accessibility & i18n Hardening (≈1 week)
**Objectives:** Keyboard model, ARIA roles, narration; number/date locale; RTL layout.  
**Tests:** screen reader scripts; contrast and CVD simulation; Lighthouse.  
**Gates:** a11y score ≥95; manual SR pass on Tiles & Graph.

### Phase 9 — Performance & Scale (1–2 weeks)
**Objectives:** Profiling; workerization; batch updates; backpressure and debouncing.  
**Tests:** soak test (30 min); p75 filter‑to‑paint ≤ 200 ms; no leaks.  
**Gates:** Perf SLO met; error rate <0.1%.

### Phase 10 — Beta → GA (≈2 weeks)
**Objectives:** Docs, examples, extension points, semantic versioning, release candidates.  
**Gates:** Beta feedback addressed; API frozen; migration notes published.

#### Component Test Matrix (excerpt)
- **filters**: multi‑value category, numeric/date ranges, text search predicate, sorting dim.  
- **color**: reverse, domain lock, degenerate ranges (min=max), NaN handling.  
- **tiles**: instance buffer growth/shrink; camera precision; LOD thresholds.  
- **graph**: bin edges, empty bins, zoomed precision.  
- **server**: pagination, race conditions on rapid filter changes, retry/backoff.  
- **a11y**: focus traps, keyboard for rail and legend, announcements on change.

#### Rollback Plan
Feature flags per view (Tiles/Graph), server mode toggle (local vs pushdown), color‑engine toggle.

---

## Part 3: UX & Visual Design Reference
**Project Codename:** FacetZoom

This is the guiding narrative for interaction patterns, layouts, and CSS tokens. It borrows concepts from the original Silverlight PivotViewer (semantic zoom via item templates; grid/graph views; deep zoom) and the DemandFinder example (zoom stages revealing more detail), generalized to non‑marketing domains.

### A. Layout & Navigation
- **Left rail**: Facets & filters (categorical pills with counts; numeric/date sliders with histograms; search).  
- **Top bar**: View switch (Tiles | Graph), color field selector, domain toggle (Auto | Global), reverse checkbox, zoom slider.  
- **Main pane**:  
  - **Tiles (Grid)** by default.  
  - **Graph** toggles to Scatter/Heatmap submodes with X/Y selectors.  
- **Right/Bottom panel**: “Details” (selected item), expandable.

### B. Core Interactions
- Facet filtering updates counts and view instantly (coordinated brushing).  
- Sort by any numeric or ordinal facet.  
- Zooming (wheel/trackpad/slider) animates smoothly; camera preserves focus.  
- **Semantic zoom (grains)** mirrors PivotViewer’s item‑template concept—content changes based on on‑screen width thresholds (e.g., 64/160 px) with cross‑fade; no content popping.  
- **Deep‑zoom imagery**: when thumbnails are present, load the appropriate resolution tiles only for the current viewport/zoom (multi‑resolution pyramid).  
- Zoom narrative (generalized):  
  - **Zoom‑1 (fully out)**: a heatmap‑like tile view—color encodes a measure.  
  - **Zoom‑2 (medium)**: reveal recognizable identifiers yet keep color semantics.  
  - **Zoom‑3 (close)**: show key metrics (2–3 numbers).  
  - **Zoom‑4 (very close)**: show a heads‑up panel with richer details.

### C. Color System (simplified)
- **Single rule**: choose one numeric field; map linearly to a sequential gradient (Auto or Global domain; Reverse option).  
- **Legend**: always visible; shows `min | mid | max` ticks; indicates Auto or Global domain.  
- **Accessibility**: CVD‑safe gradient; selection uses stroke/shape, not hue alone; opacity can encode confidence.

### D. Components (Design System)
- **Tile (3 grains):**  
  - **G0**: color chip only.  
  - **G1**: color + label; optional 1‑line sublabel; SDF text for crisp scaling.  
  - **G2**: color + label + small metric(s) + optional thumbnail.  
- **Facet controls:**  
  - Category pill list with counts; multi‑select; include “(none)” when applicable.  
  - Range slider with histogram; double‑click to clear.  
- **Graph:**  
  - Scatter with pan/zoom; brush to select subset; color uses shared gradient.  
  - Heatmap with dynamic binning and hover tooltips.  
- **Details panel:** summary at medium zoom; richer table at close zoom.  
- **View switcher:** Tiles ↔ Graph; preserves filters and color state.  
- **Zoom slider** & **Reset** button.  
- **URL state** pill (copy/share).

### E. Motion & Micro‑interactions
- Grain transitions: cross‑fade 150–200 ms; ease‑in‑out; staggered text fade to avoid blur.  
- Tile hover: subtle scale (≤1.02) and elevation; tooltips with delayed fade.  
- Facet changes: counts animate via tween; bars grow/shrink smoothly.  
- Graph brush: rubber‑band box with instant feedback.

### F. Accessibility Patterns
- Keyboard shortcuts for focus regions (rail/main/legend/details).  
- Tabs to navigate facet values; space/enter to toggle.  
- Announce selection counts and legend domain on change.  
- High‑contrast mode; RTL mirrored layout.

### G. CSS/Design Tokens (starter)
```css
:root {
  /* spacing & radius */
  --space-1: .25rem; --space-2: .5rem; --space-3: .75rem; --space-4: 1rem; --radius: 6px;

  /* typography */
  --font-sans: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial;
  --fs-0: 12px; --fs-1: 14px; --fs-2: 16px; --fs-3: 20px;

  /* neutral (dark theme example) */
  --bg: #0f0f10; --panel: #17181a; --text: #e8e9ea; --muted: #a0a4ab;
  --border: #2a2d33; --focus: #6ea8fe;

  /* selection & states */
  --sel: #ffffff; --sel-weak: rgba(255,255,255,.24); --warning: #ffdd57;

  /* gradient swatch for legend (real legend uses LUT) */
  --grad-start: #2b2c7c; --grad-mid: #4ea67a; --grad-end: #d2dc4a;
}
body { font-family: var(--font-sans); background: var(--bg); color: var(--text); }
.panel { background: var(--panel); border: 1px solid var(--border); border-radius: var(--radius); }
.tile { border-radius: var(--radius); transition: transform .16s ease, box-shadow .16s ease; }
.tile:focus-visible { outline: 2px solid var(--focus); outline-offset: 2px; }
.tile:hover { transform: translateZ(0) scale(1.02); box-shadow: 0 4px 16px rgba(0,0,0,.35); }
.legend { height: 10px; background: linear-gradient(90deg, var(--grad-start), var(--grad-mid), var(--grad-end)); border-radius: 999px; }
```

### H. Content Rules
- Labels ≤ 24 chars at G1; truncate with ellipsis + tooltip.  
- Metric formatters respect locale; show units succinctly (ms, %, $).  
- Avoid dense text at G0/G1; reserve explanations for the details panel.

### I. Reference Patterns (parity targets)
- Item templates switching by on‑screen width (semantic zoom).  
- Grid and Graph view affordances.  
- Deep‑Zoom image pyramid for efficient zoomed imagery.  
- Zoom stages (coarse heatmap → identifiers → metrics → heads‑up detail), generalized for any domain.

---

### Appendix: Suggested Repo Layout
```
facetzoom/
├── docs/
│   ├── PRD.md
│   ├── Plan.md
│   └── UX.md
├── packages/
│   ├── viewer/       # WebGPU/WebGL2 rendering core
│   ├── filters/      # Crossfilter-style filtering engine
│   └── server/       # Mock REST API + adapters
├── examples/
│   └── basic/        # Starter demo (tiles + legend + facet rail stub)
└── README.md
```
