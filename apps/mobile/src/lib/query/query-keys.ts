/**
 * Type-safe query-key factory — the single source of truth for React Query cache keys.
 *
 * Inline key arrays (`['schools', search, sort]`) are easy to typo and drift: one screen
 * caching under `['school-list']` and another under `['school-lists']` means a mutation
 * that invalidates one silently misses the other (the data goes stale with no error).
 * Routing every key + invalidation through this factory makes keys consistent,
 * refactor-safe, and impossible to misspell.
 *
 * Convention: `all` is the broad prefix for `invalidateQueries`; specific builders
 * append segments. Keys are `as const` so they're structurally typed.
 *
 *   useQuery({ queryKey: qk.schools.detail(id), ... })
 *   queryClient.invalidateQueries({ queryKey: qk.schoolList.all })   // matches every list query
 */
export const qk = {
  schools: {
    all: ['schools'] as const,
    /** Paginated/filtered list. `params` is the filter set (search, etc.). */
    list: (params: Record<string, unknown> = {}) => ['schools', 'list', params] as const,
    detail: (id: string) => ['schools', 'detail', id] as const,
  },

  /**
   * The signed-in user's saved/target school list. ONE canonical key — historically
   * some screens used `['school-list']` and `uncommon-app` used `['school-lists']`,
   * so a save/remove invalidated one but not the other. Always use `qk.schoolList.all`.
   */
  schoolList: {
    all: ['school-list'] as const,
  },

  predictions: {
    all: ['predictions'] as const,
    dashboard: ['predictions', 'dashboard'] as const,
  },

  cases: {
    all: ['cases'] as const,
    list: (params: Record<string, unknown> = {}) => ['cases', 'list', params] as const,
    /** "Students like you" comparison for a school's prediction card. */
    similar: (schoolId: string) => ['cases', 'similar', schoolId] as const,
    detail: (id: string) => ['cases', 'detail', id] as const,
  },
} as const;
