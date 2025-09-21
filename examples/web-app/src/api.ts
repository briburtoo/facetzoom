import type { FacetCounts, FilterDescriptor, ItemsResponse, NumericStats } from './types';

const API_BASE = '/api';

type QueryValue = string | number | undefined | null;

type QueryRecord = Record<string, QueryValue>;

function buildQuery(params: QueryRecord): string {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value == null) return;
    search.set(key, String(value));
  });
  return search.toString();
}

async function request<T>(path: string, params: QueryRecord = {}): Promise<T> {
  const query = buildQuery(params);
  const url = `${API_BASE}${path}${query ? `?${query}` : ''}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Request to ${url} failed with status ${response.status}`);
  }
  return (await response.json()) as T;
}

export async function fetchItems(
  filters: FilterDescriptor[],
  cursor: string | null,
  limit = 24
): Promise<ItemsResponse> {
  const params: QueryRecord = {
    limit,
    fields: 'G0|G1|G2',
    cursor: cursor ?? undefined,
  };
  if (filters.length > 0) {
    params.filters = JSON.stringify(filters);
  }
  return await request<ItemsResponse>('/items', params);
}

export async function fetchFacets(filters: FilterDescriptor[]): Promise<FacetCounts> {
  const params: QueryRecord = {};
  if (filters.length > 0) {
    params.filters = JSON.stringify(filters);
  }
  return await request<FacetCounts>('/facets', params);
}

export async function fetchStats(
  field: string,
  filters: FilterDescriptor[],
  bins?: number
): Promise<NumericStats | null> {
  const params: QueryRecord = { field, bins: bins != null ? bins : undefined };
  if (filters.length > 0) {
    params.filters = JSON.stringify(filters);
  }
  const query = buildQuery(params);
  const url = `${API_BASE}/stats?${query}`;
  const response = await fetch(url);
  if (!response.ok) {
    if (response.status === 404) {
      return null;
    }
    throw new Error(`Request to ${url} failed with status ${response.status}`);
  }
  return (await response.json()) as NumericStats;
}
