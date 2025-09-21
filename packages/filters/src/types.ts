export type FacetPrimitive = string | number | boolean | Date;
export type FacetValue = FacetPrimitive | FacetPrimitive[];

export interface ItemMetrics {
  [key: string]: number | null | undefined;
}

export interface ItemRecord {
  id: string;
  title?: string;
  image?: {
    thumb?: string;
    dzi?: string;
  };
  facets: Record<string, FacetValue | null | undefined>;
  metrics?: ItemMetrics;
  [key: string]: unknown;
}

export type FilterPredicate = (value: FacetValue | null | undefined, item: ItemRecord) => boolean;

export interface RangeConstraint {
  min?: number | Date;
  max?: number | Date;
  inclusive?: boolean;
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
