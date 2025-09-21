import { FilterEngine } from '@facetzoom/filters';
import { loadDataset } from '@facetzoom/server';
import { SemanticZoomController, TilePresenter } from '@facetzoom/viewer';

const engine = new FilterEngine(loadDataset());
engine.applyDiscreteFilter('Category', ['Outdoor']);
engine.applyRangeFilter('Price', { max: 200 });

const filtered = engine.getFilteredItems();

const zoom = new SemanticZoomController();
const presenter = new TilePresenter(zoom, {
  colorScale: { domain: [0, 1] },
  colorField: 'score',
});

const summaries = filtered.slice(0, 5).map((item) => presenter.summariseTile(180, item));

console.log('FacetZoom demo summaries');
console.table(
  summaries.map((summary) => ({
    id: summary.id,
    grain: summary.grain,
    color: summary.color,
    metrics: summary.metrics?.score ?? 'n/a',
  }))
);
