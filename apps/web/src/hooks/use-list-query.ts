'use client';

/**
 * useListQuery — the canonical offset-paginated, searchable list hook for the web app.
 *
 * It bakes in the four things every list page kept getting wrong (and that we fixed
 * by hand twice this session — mobile schools, then web school library):
 *   1. Debounced search   — one network call ~300ms after the user stops typing,
 *      not one per keystroke.
 *   2. keepPreviousData    — the list never blanks to a skeleton on page/filter
 *      change; the old rows stay until the new ones arrive.
 *   3. A declared cache tier — `staleTime`/`gcTime` come from `cachePolicy`, so a
 *      static catalog isn't refetched every focus.
 *   4. Stable, deduped keys — `toStableParams` drops blank filters and serialises
 *      nested objects so deep-equal filter sets share one cache entry, and the
 *      key is built from the shared `qk` factory (no inline literals to drift).
 *
 * SCOPE: flat-scalar filter lists (cases, followers, notifications, teams, admin).
 * Object/array-heavy manual queries (ranking weights, schools advancedFilters) keep
 * their own `useQuery` but should still build keys with `toStableParams` + `qk`.
 */
import { useRef, useState } from 'react';
import {
  keepPreviousData,
  useQuery,
  type UseQueryOptions,
  type QueryKey,
} from '@tanstack/react-query';
import type { PaginatedResponse } from '@study-abroad/shared';
import { apiClient } from '@/lib/api/client';
import { useDebounce } from '@/hooks/useDebounce';
import { UI_TIMERS } from '@/lib/constants';
import { cachePolicy, type CacheTier } from '@/lib/query';

type Filters = Record<string, unknown>;

/** Scalar param map suitable for both a query key and a query string. */
export type StableParams = Record<string, string | number | boolean>;

/**
 * Deterministically stringify any value with object keys sorted and blanks pruned,
 * so two deep-equal filter sets always produce the same string regardless of key
 * order or insertion order. Used for change-detection and as a key-safe encoding of
 * nested filter objects.
 */
function stableStringify(value: unknown): string {
  if (value === null || value === undefined) return 'null';
  if (typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const obj = value as Record<string, unknown>;
  const parts: string[] = [];
  for (const k of Object.keys(obj).sort()) {
    const v = obj[k];
    if (v === undefined || v === null || v === '') continue;
    if (Array.isArray(v) && v.length === 0) continue;
    parts.push(`${JSON.stringify(k)}:${stableStringify(v)}`);
  }
  return `{${parts.join(',')}}`;
}

/**
 * Flatten a filter object into a stable scalar map for use in a query key (and, for
 * all-scalar filters, the query string). Blank values (`undefined`/`null`/`''`/empty
 * array) are dropped so the "no filters" state collapses to a single cache entry;
 * nested objects/arrays are stable-serialised so key order can't cause a cache miss.
 */
// `object` (not `Record<string, unknown>`) so typed filter *interfaces* —
// which lack an implicit index signature — are accepted without a cast at call sites.
export function toStableParams(filters: object | undefined): StableParams {
  const out: StableParams = {};
  if (!filters) return out;
  const entries = filters as Record<string, unknown>;
  for (const key of Object.keys(entries).sort()) {
    const value = entries[key];
    if (value === undefined || value === null || value === '') continue;
    if (Array.isArray(value)) {
      if (value.length === 0) continue;
      out[key] = stableStringify(value);
    } else if (typeof value === 'object') {
      const encoded = stableStringify(value);
      if (encoded === '{}') continue;
      out[key] = encoded;
    } else {
      out[key] = value as string | number | boolean;
    }
  }
  return out;
}

export interface UseListQueryOptions<TItem, TResponse = PaginatedResponse<TItem>> {
  /** Key prefix from the `qk` factory, e.g. `qk.cases.all`. The hook appends `'list'` + the stable param map. */
  keyBase: readonly unknown[];
  /** REST endpoint relative to the API base, e.g. `'/cases'`. */
  endpoint: string;
  /** Raw filter object (search + facets). The `searchField` entry is debounced internally. */
  filters?: Filters;
  /** Which filter field holds the raw search text. Default `'search'`. */
  searchField?: string;
  /** Debounce window (ms) for the search field. Default `UI_TIMERS.SEARCH_DEBOUNCE` (300). */
  debounceMs?: number;
  /** 1-based initial page. Default `1`. */
  initialPage?: number;
  /** Page size sent as `pageSize`. Default `20`. */
  pageSize?: number;
  /** Cache tier from `cachePolicy`. Default `'reference'`. */
  cacheTier?: CacheTier;
  /**
   * Map the raw API payload to `{ items, total, totalPages? }`. Default assumes a
   * `PaginatedResponse` (`{ items, total, totalPages }`). Use this for the admin
   * `{ data, total }` envelope or bare arrays.
   */
  extract?: (raw: TResponse) => { items: TItem[]; total: number; totalPages?: number };
  /** Disable the query (e.g. while a prerequisite id is missing). Default `true`. */
  enabled?: boolean;
  /** Extra passthrough to `useQuery` (e.g. `select`, `refetchInterval`). Cache tier + key + queryFn are managed. */
  queryOptions?: Omit<
    UseQueryOptions<TResponse, Error, TResponse, QueryKey>,
    'queryKey' | 'queryFn' | 'placeholderData' | 'staleTime' | 'gcTime' | 'enabled'
  >;
}

export interface UseListQueryResult<TItem> {
  items: TItem[];
  total: number;
  totalPages: number;
  page: number;
  setPage: (page: number) => void;
  pageSize: number;
  /** Debounced search value actually sent to the server (for "showing results for …" UI). */
  debouncedSearch: string;
  isLoading: boolean;
  isFetching: boolean;
  /** True while showing the previous page's rows during a refetch (keepPreviousData). */
  isPlaceholderData: boolean;
  isError: boolean;
  error: Error | null;
  refetch: () => void;
  queryKey: QueryKey;
}

function defaultExtract<TItem, TResponse>(
  raw: TResponse
): { items: TItem[]; total: number; totalPages?: number } {
  const r = raw as unknown as Partial<PaginatedResponse<TItem>>;
  return { items: r.items ?? [], total: r.total ?? 0, totalPages: r.totalPages };
}

export function useListQuery<TItem, TResponse = PaginatedResponse<TItem>>(
  opts: UseListQueryOptions<TItem, TResponse>
): UseListQueryResult<TItem> {
  const {
    keyBase,
    endpoint,
    filters,
    searchField = 'search',
    debounceMs = UI_TIMERS.SEARCH_DEBOUNCE,
    initialPage = 1,
    pageSize = 20,
    cacheTier = 'reference',
    extract,
    enabled = true,
    queryOptions,
  } = opts;

  // Debounce only the search field; other filters apply immediately.
  const rawSearch = filters && searchField in filters ? filters[searchField] : undefined;
  const debouncedSearch = useDebounce(typeof rawSearch === 'string' ? rawSearch : '', debounceMs);

  const effectiveFilters: Filters = { ...(filters ?? {}) };
  if (searchField in effectiveFilters) {
    if (debouncedSearch) effectiveFilters[searchField] = debouncedSearch;
    else delete effectiveFilters[searchField];
  }

  // One scalar map serves as both the cache key and the query string. apiClient
  // only serialises scalar params, so array/object filters (rare on list pages —
  // they belong on a custom queryFn) are JSON-encoded here for key safety.
  const stableParams = toStableParams(effectiveFilters);

  // Auto-reset to page 1 whenever the (debounced) filter set changes — adjusting
  // state during render (React-recommended) so even the discarded render keys on
  // the reset page and never fires a wasted fetch of {newFilters, oldPage}.
  const paramsSignature = stableStringify(stableParams);
  const prevSignatureRef = useRef(paramsSignature);
  const [page, setPage] = useState(initialPage);
  const paramsChanged = prevSignatureRef.current !== paramsSignature;
  if (paramsChanged) {
    prevSignatureRef.current = paramsSignature;
    if (page !== initialPage) setPage(initialPage);
  }
  const effectivePage = paramsChanged ? initialPage : page;

  const queryKey: QueryKey = [
    ...keyBase,
    'list',
    { ...stableParams, page: effectivePage, pageSize },
  ];

  const query = useQuery<TResponse, Error, TResponse, QueryKey>({
    queryKey,
    queryFn: () =>
      apiClient.get<TResponse>(endpoint, {
        // @route-lint-ignore generic list hook; callers supply shared routes
        params: { ...stableParams, page: effectivePage, pageSize },
        suppressErrorToast: true,
      }),
    placeholderData: keepPreviousData,
    enabled,
    ...cachePolicy[cacheTier],
    ...queryOptions,
  });

  const mapped = query.data
    ? (extract ?? defaultExtract)(query.data)
    : { items: [] as TItem[], total: 0, totalPages: undefined as number | undefined };

  const total = mapped.total ?? 0;
  const totalPages = mapped.totalPages ?? Math.max(1, Math.ceil(total / pageSize));

  return {
    items: mapped.items,
    total,
    totalPages,
    page: effectivePage,
    setPage,
    pageSize,
    debouncedSearch,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isPlaceholderData: query.isPlaceholderData,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
    queryKey,
  };
}
