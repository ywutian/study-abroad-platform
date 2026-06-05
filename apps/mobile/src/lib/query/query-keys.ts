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
 *
 * IMPORTANT: the prefixes below MIRROR the strings already used inline across the app
 * (e.g. `mobile-teams`, `hall-verified`, `chat`, `find-college-schools`). They are
 * intentionally NOT "cleaned up" — matching the existing prefix is what lets a screen
 * adopt `qk` without changing its cache identity or breaking sibling invalidations.
 * A previous stale duplicate (`src/lib/query-keys.ts`, export `queryKeys`) was deleted
 * in favour of this file — there is now exactly one key source.
 */
type Params = Record<string, unknown>;

export const qk = {
  // ════════════════════════════ Catalog / reference ════════════════════════════
  schools: {
    all: ['schools'] as const,
    /** Paginated/filtered list. `params` is the filter set (search, etc.). */
    list: (params: Params = {}) => ['schools', 'list', params] as const,
    detail: (id: string) => ['schools', 'detail', id] as const,
  },

  /**
   * The signed-in user's saved/target school list. ONE canonical key — historically
   * some screens used `['school-list']` and `uncommon-app` used `['school-lists']`,
   * so a save/remove invalidated one but not the other. Always use `qk.schoolList.all`.
   * NOTE: web canonical is the PLURAL `['school-lists']`; mobile stays singular. Each
   * app is internally consistent; they hit different backends through the same routes.
   */
  schoolList: {
    all: ['school-list'] as const,
  },

  /** Find-college browse. Keeps its own prefix; share `qk.schools.list` only if the
   *  filter shape is unified during migration (verify cache aliasing intentionally).
   *  `filters: object` so a typed filter interface (no index signature) passes without a cast. */
  findCollege: {
    all: ['find-college-schools'] as const,
    list: (search: string, filters: object = {}) =>
      ['find-college-schools', search, filters] as const,
  },

  cases: {
    all: ['cases'] as const,
    list: (params: Params = {}) => ['cases', 'list', params] as const,
    /** "Students like you" comparison for a school's prediction card. */
    similar: (schoolId: string) => ['cases', 'similar', schoolId] as const,
    detail: (id: string) => ['cases', 'detail', id] as const,
  },

  /** Hall of fame surfaces. Each sub-view is a flat, independent top-level key
   *  (there is no shared `['hall']` prefix to invalidate them together). */
  hall: {
    verified: (filter: unknown) => ['hall-verified', filter] as const,
    targetRanking: () => ['hall-target-ranking'] as const,
    difficultySignal: () => ['hall-difficulty-signal'] as const,
    chinaAdmitTrend: () => ['hall-china-admit-trend'] as const,
    challenge: () => ['hall-challenge'] as const,
  },

  ranking: {
    all: ['customRanking'] as const,
    calculate: (weights: Params) => ['customRanking', weights] as const,
  },

  // ════════════════════════════ Prediction / recommendation ════════════════════
  predictions: {
    all: ['predictions'] as const,
    dashboard: ['predictions', 'dashboard'] as const,
  },

  recommendation: {
    all: ['recommendation'] as const,
    preflight: () => ['recommendation', 'preflight'] as const,
    history: () => ['recommendation', 'history'] as const,
  },

  assessment: {
    all: ['assessment'] as const,
    byType: (type: string) => ['assessment', type] as const,
    history: () => ['assessment', 'history'] as const,
  },

  // ════════════════════════════ Essays ═════════════════════════════════════════
  essays: {
    all: ['essays'] as const,
    list: (params: Params = {}) => ['essays', 'list', params] as const,
    detail: (id: string) => ['essay-detail', id] as const,
  },
  essayGallery: {
    all: ['essay-gallery'] as const,
    list: (params: Params = {}) => ['essay-gallery', params] as const,
  },

  // ════════════════════════════ Community ══════════════════════════════════════
  forum: {
    all: ['forum'] as const,
    categories: () => ['forum', 'categories'] as const,
    stats: () => ['forum', 'stats'] as const,
    posts: (params: Params = {}) => ['forum', 'posts', params] as const,
    detail: (id: string) => ['forum', 'post', id] as const,
  },

  teams: {
    all: ['mobile-teams'] as const,
    contexts: () => ['mobile-teams', 'contexts'] as const,
    mine: () => ['mobile-teams', 'mine'] as const,
    resumes: () => ['mobile-teams', 'resumes'] as const,
    deck: (teamId: string | undefined) => ['mobile-teams', 'deck', teamId] as const,
    matches: () => ['mobile-teams', 'matches'] as const,
  },

  /** Social graph. On mobile these live under the `chat` prefix (followers screen). */
  social: {
    followers: () => ['chat', 'followers'] as const,
    following: () => ['chat', 'following'] as const,
    blocked: () => ['chat', 'blocked'] as const,
    recommendations: () => ['chat', 'recommendations'] as const,
  },

  chat: {
    all: ['chat'] as const,
    conversations: () => ['conversations'] as const,
    conversation: (id: string) => ['conversation', id] as const,
  },

  // ════════════════════════════ Realtime / live ════════════════════════════════
  notifications: {
    all: ['notifications'] as const,
    list: (userId: string | null) => ['notifications', userId ?? 'anonymous'] as const,
    unreadCount: (userId: string | null) =>
      ['notifications', userId ?? 'anonymous', 'unread-count'] as const,
  },

  swipe: {
    next: () => ['swipe', 'next'] as const,
    stats: () => ['swipe', 'stats'] as const,
  },

  // ════════════════════════════ Profile / dashboard ════════════════════════════
  profile: {
    all: ['profile'] as const,
    me: () => ['profile', 'me'] as const,
    completeness: () => ['profile', 'completeness'] as const,
    aiAnalysis: () => ['profile-ai-analysis'] as const,
  },

  dashboard: {
    all: ['dashboard'] as const,
  },

  // ════════════════════════════ Admin ══════════════════════════════════════════
  admin: {
    users: (search = '') => ['adminUsers', search] as const,
    reports: () => ['adminReports'] as const,
    stats: () => ['adminStats'] as const,
  },

  // ════════════════════════════ Billing / misc single-key ══════════════════════
  subscription: {
    all: ['subscription'] as const,
    plans: () => ['subscription', 'plans'] as const,
    current: () => ['subscription', 'current'] as const,
    billing: () => ['subscription', 'billing'] as const,
  },
  timeline: {
    all: ['timeline'] as const,
    list: () => ['timeline', 'list'] as const,
    overview: () => ['timeline', 'overview'] as const,
    personal: () => ['timeline', 'personalEvents'] as const,
    global: (year: number) => ['timeline', 'globalEvents', year] as const,
    tasks: (id: string) => ['timeline', 'tasks', id] as const,
  },
  verification: { all: ['verification'] as const },
  points: { all: ['points'] as const },
  referral: { all: ['referral'] as const },
  vault: { all: ['vault'] as const },
  resume: { all: ['resumes'] as const },
  peerReview: { all: ['peer-review'] as const },
  aiAgent: { all: ['ai-agent'] as const },
} as const;
