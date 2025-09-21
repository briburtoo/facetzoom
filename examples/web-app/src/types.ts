export interface FacetCount {
  key: string;
  count: number;
}

export type FacetCounts = Record<string, FacetCount[]>;

export interface ApiItemFields {
  G0?: { colorSeed: number | null };
  G1?: { label?: string; colorSeed?: number | null };
  G2?: { label?: string; metrics?: Record<string, number | null | undefined>; image?: { thumb?: string } };
}

export interface ApiItem {
  id: string;
  facets: Record<string, unknown>;
  fields: ApiItemFields;
}

export interface ItemsResponse {
  items: ApiItem[];
  next: string | null;
  total: number;
}

export interface NumericStats {
  field: string;
  min: number;
  max: number;
  count: number;
  p01?: number;
  p99?: number;
  histogram?: HistogramBin[];
}

export interface HistogramBin {
  start: number;
  end: number;
  count: number;
}

export interface DiscreteFilterDescriptor {
  field: string;
  type: 'discrete';
  values: Array<string | number | boolean>;
}

export interface RangeFilterDescriptor {
  field: string;
  type: 'range';
  range: {
    min?: number;
    max?: number;
  };
}

export type FilterDescriptor = DiscreteFilterDescriptor | RangeFilterDescriptor;

export interface TileData {
  id: string;
  title?: string;
  metrics?: Record<string, number | null | undefined>;
  facets: Record<string, unknown>;
}
