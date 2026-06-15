/**
 * Unified query-key registry for the web app — the single source of truth for
 * React Query cache keys.
 *
 * Inline key arrays (`['cases', filters]`) are easy to typo and drift: one screen
 * caching under `['school-lists']` and another under `['school-list']` means a
 * mutation that invalidates one silently misses the other (data goes stale with no
 * error). Routing keys + invalidations through `qk` keeps them consistent and
 * refactor-safe.
 *
 * STRATEGY:
 *   - The 5 pre-existing domain factories (prediction, recommendation, hall,
 *     essayAi, chatHistory) are RE-EXPORTED here UNCHANGED — their key shapes are
 *     load-bearing across ~50 call sites, so we surface them rather than redefine.
 *   - Previously-inline domains (schools, cases, social, notifications, ranking,
 *     teams, forum, admin) get first-class builders here.
 *
 * Convention (matches the existing factories): `all` is the broad invalidation
 * prefix; specific builders append segments. Pass filter objects to `list(params)`
 * — but list pages should hand it a pre-flattened primitive map (see
 * `toStableParams` in hooks/use-list-query.ts) so keys stay stable + diff-able.
 */
import { predictionKeys } from '@/hooks/use-prediction';
import { recommendationKeys } from '@/hooks/use-recommendation';
import { hallKeys } from '@/hooks/use-hall-api';
import { essayAiKeys } from '@/hooks/use-essay-ai';
import { chatHistoryKeys } from '@/components/features/agent-chat/use-chat-history';

/**
 * The signed-in user's saved/target school list.
 * WEB CANONICAL = ['school-lists'] (PLURAL) — ~15 call sites already use it.
 * NOTE: this is the OPPOSITE of apps/mobile (singular ['school-list']). The two
 * apps hit different backends through the same routes, so the divergence is safe
 * as long as each app is internally consistent. Always use `qk.schoolList.*`.
 */
const schoolList = {
  all: ['school-lists'] as const,
  mine: ['school-lists', 'mine'] as const,
};

type Params = Record<string, unknown>;

export const qk = {
  // ── Re-exported existing factories (shapes preserved) ──────────────
  prediction: predictionKeys,
  recommendation: recommendationKeys,
  hall: hallKeys,
  essayAi: essayAiKeys,
  chatHistory: chatHistoryKeys,

  // ── Saved school list (canonical, plural) ──────────────────────────
  schoolList,

  // ── Profile (application analysis) ─────────────────────────────────
  // Shared so the /uncommon-app workspace (setQueryData / getQueryData /
  // invalidate) and the ProfileAIAnalysis component (useQuery) can never drift
  // to different string keys — the dual-fetch-ownership hazard.
  profile: {
    aiAnalysis: ['profile-ai-analysis'] as const,
  },

  // ── Schools catalog (browse) ───────────────────────────────────────
  schools: {
    all: ['schools'] as const,
    list: (params: Params = {}) => ['schools', 'list', params] as const,
    detail: (id: string) => ['schools', 'detail', id] as const,
    countries: () => ['schools', 'countries'] as const,
    rankingLists: (source: string) => ['schools', 'ranking-lists', source] as const,
    /** UC system school ids (prediction page). */
    ucIds: () => ['schools', 'uc-ids'] as const,
  },

  // ── Cases library ──────────────────────────────────────────────────
  cases: {
    all: ['cases'] as const,
    list: (params: Params = {}) => ['cases', 'list', params] as const,
    detail: (id: string) => ['cases', 'detail', id] as const,
    /** "Students like you" comparison for a school. */
    similar: (schoolId: string) => ['cases', 'similar', schoolId] as const,
  },

  // ── Social / followers ─────────────────────────────────────────────
  // Keys are hyphenated siblings (NOT nested under one `['social']` prefix) to match
  // the strings the followers feature already uses. Invalidate the whole paginated
  // relations list via `relationsAll` (bare prefix matches every page/filter).
  social: {
    overview: () => ['social-overview'] as const,
    relations: (params: Params = {}) => ['social-relations', params] as const,
    relationsAll: ['social-relations'] as const,
    recommended: () => ['recommended-users'] as const,
    followers: () => ['followers'] as const,
    following: () => ['following'] as const,
    blocked: () => ['blocked'] as const,
  },

  // ── Notifications ──────────────────────────────────────────────────
  notifications: {
    all: ['notifications'] as const,
    list: (params: Params = {}) => ['notifications', 'list', params] as const,
    unreadCount: () => ['notifications-unread-count'] as const,
  },

  // ── Saved custom rankings ──────────────────────────────────────────
  ranking: {
    all: ['ranking'] as const,
    calculate: (params: Params) => ['ranking', 'calculate', params] as const,
    saved: () => ['ranking', 'saved'] as const,
  },

  // ── Teams (rich sub-resource keys — builders mirror the existing strings exactly) ──
  teams: {
    all: ['teams'] as const,
    detail: (id: string) => ['teams', id] as const,
    matchPools: () => ['teams', 'match-pools'] as const,
    matchPool: (id: string) => ['teams', 'match-pools', id] as const,
    recruitmentContext: (scope: string, id: string | null | undefined) =>
      ['teams', 'recruitment-contexts', scope, id] as const,
    communityContexts: () => ['teams', 'community-contexts'] as const,
    recruitmentsMy: () => ['teams', 'recruitments', 'my'] as const,
    recruitmentsDeck: () => ['teams', 'recruitments', 'deck'] as const,
    recruitmentsDeckCard: (cardId: string | undefined) =>
      ['teams', 'recruitments', 'deck', cardId] as const,
    recruitmentsDeckPreview: (contextId: string | undefined) =>
      ['teams', 'recruitments', 'deck', 'preview', contextId] as const,
    matches: () => ['teams', 'matches'] as const,
  },

  // ── Forum (migrates off manual fetch in a later pass) ──────────────
  forum: {
    all: ['forum'] as const,
    posts: (params: Params = {}) => ['forum', 'posts', params] as const,
    communities: (scope: string) => ['forum', 'communities', scope] as const,
    categories: () => ['forum', 'categories'] as const,
  },

  // ── Admin (generic namespaced helper — not 90 hand-written builders) ─
  admin: {
    all: ['admin'] as const,
    list: (resource: string, params: Params = {}) => ['admin', resource, params] as const,
    detail: (resource: string, id: string) => ['admin', resource, id] as const,
    stats: (resource: string) => ['admin', resource, 'stats'] as const,
  },
} as const;
