# PivotViewer Interaction Walkthrough (d3PivotViewerBorchardt.mp4)

This document captures the observed behaviour of the PivotViewer demo video frame‑by‑frame to guide the PRD rewrite.

## 0:00 – Landing state
- **Viewport**: Full-bleed canvas with large histogram bars (≈ 10 bins). Each bin uses a stacked color gradient. White borders separate bins.
- **Facet rail** (left): 14+ facets listed vertically (iRatio, Imps, tlmps, Cost, …). Each facet displays pills with counts; first facet is expanded.
- **Top bar**: Sort dropdown (default `iRatio`), Color dropdown (`iRatio`), Zoom controls (+/- buttons) and View dropdown (`Program Pivot`).
- **Selection summary** (top-left under brand): “310,787 selected”, with links `Reset all | Export Airings`.

## 0:02 – Facet hover/select
- Cursor enters the `Network Genre` facet, toggles multiple categories (Cooking, Family, Children & Teen). Selected pills turn dark, counts update immediately.
- Selection summary changes from 310k to 26,932, showing filters are applied instantly.
- Histogram reflows to reflect filtered population while staying in place; bars shrink proportionally.

## 0:05 – Sorting by metric
- `Sort` dropdown opened → list of metrics (Imps per Air, Cost per Air, CPM, etc.).
- Selecting `Imps per Air` restacks each bin into multi-colored sub-segments (facets) indicating perhaps a grouping (the bars reorganise vertically by value).
- Bins re-order to new positions, but bucket edges remain constant; transition appears immediate (no animation). Each bin still shows stacked color segments.

## 0:10 – Color mapping change
- `Color` dropdown opened → same metric list. Selecting a new metric (`Imps per Air`) immediately recolors each tile segment within bars.
- The color mapping appears linear; legend not visible but assumption: sequential palette with white border.
- No UI message; color change is instant.

## 0:12 – Resetting filters
- `Network Genre` facet’s reset button clicked. Selection summary returns to 310,787, facet pills clear. Histogram returns to large bars.

## 0:14 – View mode toggle (Tiles)
- `View` dropdown changed from “Program Pivot” to “Tile” (approx). The main panel transitions to a dense grid of tiny cards (similar mosaic). This demonstrates dual-view behaviour.
- Not directly relevant if we focus on histogram view, but indicates there’s a grid view accessible via `View` control.

## 0:18 – View mode: Program Pivot (Histogram) reselected
- Grid returns to histogram. Bars retain previous configuration.

## 0:24 – Sort by `Imps per Air`, color by `Imps per Air` (again)
- Resorted histogram now shows bars sorted descending, with color gradient applied.

## 0:30 – Interaction with Zoom
- Zoom `+` button clicked multiple times. Bars grow taller/wider (in canvas units) and the internal cards (tiny rectangles) become larger, exposing more detail (tile semantics).
- At max zoom, cards become rectangles with text labels (program names). This is the semantic zoom behaviour we reference.

## 0:38 – Pan and Selection
- Mouse pans via click-drag horizontal axis; view re-centres on middle bins.
- Individual card hovered: highlight outline appears (white border overlay). Tooltip not shown but there appears to be a subtle highlight.

## 0:45 – Sorting by `Cost per Air`
- Bars reorder again, heights/stacking change. The vertical axis shows numeric labels along base (0, 32.6k, etc.); bins correspond to cost ranges.

## Key Observations Summary
1. **Histograms** support up to ~10 bins (auto-calculated ranges). Within each bin tiles are stacked vertically, five across per row when zoomed out, morphing to larger rectangles as you zoom in.
2. **Color** is a single global linear gradient (selected from dropdown). Changing it recolors all tiles instantly.
3. **Facets** in the left rail filter the dataset in real time; counts update and selection summary reflects new total.
4. **Zoom** transitions are smooth, showing more tile detail at higher scales. The histogram view transitions to the same tile component used in grid view.
5. **Top controls** include: Sort (metric), Color (metric), Zoom (+/-), View (Tile vs Program Pivot), Graph/Tile icons.

This walkthrough will be used to align our PRD with the real PivotViewer behaviour.
