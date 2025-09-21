# FacetZoom Monorepo

This repository contains the first implementation slice of the FacetZoom project described in `Docs/facetzoom_PRDandPlan.md`. It delivers the Phase 0 scaffolding plus initial color, filtering, and API prototypes so additional phases can iterate quickly.

## Packages

- `@facetzoom/filters` – TypeScript filtering core with discrete/range filters, facet counts, and numeric stats (including percentile estimates). Tested with Vitest.
- `@facetzoom/viewer` – UI primitives for semantic zoom management, linear color gradients, and tile summarisation.
- `@facetzoom/server` – Express API that exposes `/items`, `/facets`, `/stats`, and `/healthz` using the shared filtering engine and sample data.
- `@facetzoom/example-basic` – Node demo showing how the filtering and viewer primitives fit together.
- `@facetzoom/web-app` – Vite + React showcase that renders the facet explorer UI and exercises the API + viewer packages together.

## Getting Started

```bash
npm install
npm run build   # builds every workspace package
npm test        # runs Vitest unit tests
```

To run the example script:

```bash
npm run build --workspace @facetzoom/example-basic
node examples/basic-app/dist/main.js
```

To launch the interactive web demo (requires the API server to be running):

```bash
npm run build --workspace @facetzoom/server
node packages/server/dist/server.js

# in another terminal
npm install
npm run dev --workspace @facetzoom/web-app
```

The Vite dev server proxies API requests to `http://localhost:4000`. Visit `http://localhost:5174` to interact with the FacetZoom explorer. Use the **Clear all filters** button to reset the view, adjust the tile width slider to move between semantic zoom grains, and tweak the price inputs to test range filtering.

To launch the API server:

```bash
npm run build --workspace @facetzoom/server
node packages/server/dist/server.js
```

Set `POLYGON_API_KEY` (or `REACT_APP_POLYGON_API_KEY`) in your environment before starting the server to hydrate the explorer with the full Polygon snapshot dataset (~11k US tickers). Without a key the server falls back to the bundled sample JSON. For example:

```bash
export POLYGON_API_KEY=your_polygon_key
node packages/server/dist/server.js
```

After starting the server you can test endpoints, for example:

```bash
curl "http://localhost:4000/items?fields=G0|G1|G2&limit=3"
```

## Project Alignment

- Semantic zoom thresholds default to the PRD values (≤64px → G0, ≤160px → G1, else G2).
- Color rules use a single numeric field mapped to a sequential gradient with an optional reverse toggle.
- REST endpoints return the facets and paginated items described in the PRD with cursor-based pagination.
- Filtering behaviour mirrors crossfilter semantics by excluding the facet under inspection.

### Explorer UX highlights

- Polygon snapshot data powers real-world scale testing with gainers/decliners, price, and volume facets.
- Facet rail now includes per-dimension search with support for thousands of ticker options and quick clear actions.
- Price filtering pairs dual range sliders with numeric inputs for precise control over currency bands.
- Zoom controls expose semantic grains via labeled presets and inline guidance so users understand how tile widths map to detail levels.

Future phases can extend these building blocks with GPU rendering, full graph view implementations, accessibility overlays, and integration with real backend services.
