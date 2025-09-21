import express, { type Request } from 'express';
import { FilterEngine, type ItemRecord } from '@facetzoom/filters';
import { object, optional, string, type Infer, union, array, number, literal } from 'superstruct';
import { loadDataset } from './dataset.js';

const RangeStruct = object({
  min: optional(number()),
  max: optional(number()),
});

const FilterStruct = union([
  object({
    field: string(),
    type: literal('discrete'),
    values: array(union([string(), number()])),
  }),
  object({
    field: string(),
    type: literal('range'),
    range: RangeStruct,
  }),
]);

const FiltersStruct = array(FilterStruct);

export interface FacetZoomServerOptions {
  items?: ItemRecord[];
}

export function createServer(options: FacetZoomServerOptions = {}) {
  const items = options.items ?? loadDataset();
  const app = express();

  app.get('/healthz', (_req, res) => {
    res.json({ status: 'ok' });
  });

  app.get('/stats', (req, res) => {
    const field = req.query.field;
    if (typeof field !== 'string') {
      res.status(400).json({ error: 'field query parameter is required' });
      return;
    }
    const engine = prepareEngine(items, req);
    const parsedBins = typeof req.query.bins === 'string' ? Number.parseInt(req.query.bins, 10) : Number.NaN;
    const stats = engine.getNumericStats(field, {
      includePercentiles: true,
      histogramBins: Number.isFinite(parsedBins) && parsedBins > 0 ? parsedBins : 40,
    });
    if (!stats) {
      res.status(404).json({ error: `No numeric data for field ${field}` });
      return;
    }
    res.json(stats);
  });

  app.get('/facets', (req, res) => {
    const engine = prepareEngine(items, req);
    const filtered = engine.getFilteredItems();
    const facetKeys = collectFacetKeys(filtered.length > 0 ? filtered : items);
    const payload = Object.fromEntries(
      facetKeys.map((facet) => [facet, engine.getFacetCounts(facet)])
    );
    res.json(payload);
  });

  app.get('/items', (req, res) => {
    const engine = prepareEngine(items, req);
    const all = sortItemsForResponse(engine.getFilteredItems(), req.query.sort);
    const { pageItems, nextCursor } = paginate(all, req.query.cursor, req.query.limit);
    const fields = parseFields(req.query.fields);
    res.json({
      items: pageItems.map((item) => projectItem(item, fields)),
      next: nextCursor,
      total: all.length,
    });
  });

  return app;
}

function prepareEngine(items: ItemRecord[], req: Request): FilterEngine {
  const engine = new FilterEngine(items);
  const filters = parseFilters(req.query.filters);
  for (const filter of filters) {
    if (filter.type === 'range' && filter.range) {
      engine.applyRangeFilter(filter.field, {
        min: filter.range.min,
        max: filter.range.max,
      });
    } else if (filter.type === 'discrete' && filter.values) {
      engine.applyDiscreteFilter(filter.field, filter.values);
    }
  }
  return engine;
}

export { loadDataset } from './dataset.js';

export function collectFacetKeys(records: ItemRecord[]): string[] {
  const keys = new Set<string>();
  for (const item of records) {
    for (const key of Object.keys(item.facets ?? {})) {
      keys.add(key);
    }
  }
  return [...keys].sort((a, b) => a.localeCompare(b));
}

export function sortItemsForResponse(items: ItemRecord[], sortRaw: unknown): ItemRecord[] {
  const sorted = [...items];
  if (typeof sortRaw === 'string' && sortRaw.trim().length > 0) {
    const [field, dir = 'asc'] = sortRaw.split(':');
    const direction = dir.toLowerCase() === 'desc' ? -1 : 1;
    sorted.sort((a, b) => {
      const aValue = readSortableValue(a, field);
      const bValue = readSortableValue(b, field);
      if (aValue < bValue) return -1 * direction;
      if (aValue > bValue) return 1 * direction;
      return 0;
    });
    return sorted;
  }
  return sorted.sort((a, b) => a.id.localeCompare(b.id));
}

function readSortableValue(item: ItemRecord, field: string): number | string {
  const metric = item.metrics?.[field];
  if (typeof metric === 'number') {
    return metric;
  }
  const facet = item.facets[field];
  if (typeof facet === 'number') {
    return facet;
  }
  if (typeof facet === 'string') {
    return facet.toLowerCase();
  }
  return item.id.toLowerCase();
}

type FilterDescriptor = Infer<typeof FilterStruct>;

function parseFilters(raw: unknown): FilterDescriptor[] {
  if (typeof raw !== 'string') return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    const [error, value] = validate(FiltersStruct, parsed);
    if (error || !value) {
      console.warn('Invalid filter payload', error);
      return [];
    }
    return value as FilterDescriptor[];
  } catch (error) {
    console.warn('Failed to parse filters', error);
    return [];
  }
}

function parseFields(raw: unknown): Set<string> {
  if (typeof raw !== 'string' || raw.trim().length === 0) {
    return new Set(['G0']);
  }
  return new Set(raw.split('|'));
}

function projectItem(item: ItemRecord, fields: Set<string>) {
  const payload: Record<string, unknown> = { id: item.id, facets: item.facets };
  const grains: Record<string, unknown> = {};
  if (fields.has('G0')) {
    grains.G0 = {
      colorSeed: item.metrics?.score ?? null,
    };
  }
  if (fields.has('G1')) {
    grains.G1 = {
      label: item.title,
      colorSeed: item.metrics?.score ?? null,
    };
  }
  if (fields.has('G2')) {
    grains.G2 = {
      label: item.title,
      metrics: item.metrics,
      image: item.image,
    };
  }
  payload.fields = grains;
  return payload;
}

function paginate(items: ItemRecord[], cursorRaw: unknown, limitRaw: unknown) {
  const limit = Math.max(1, Math.min(100, typeof limitRaw === 'string' ? Number.parseInt(limitRaw, 10) : 40));
  const cursor = typeof cursorRaw === 'string' ? Number.parseInt(Buffer.from(cursorRaw, 'base64url').toString('utf8'), 10) : 0;
  const slice = items.slice(cursor, cursor + limit);
  const nextIndex = cursor + slice.length;
  const nextCursor = nextIndex < items.length ? Buffer.from(String(nextIndex)).toString('base64url') : null;
  return { pageItems: slice, nextCursor };
}

function validate<T>(schema: { create(value: unknown): T }, value: unknown): [Error | null, T | null] {
  try {
    return [null, schema.create(value)];
  } catch (error) {
    return [error as Error, null];
  }
}
