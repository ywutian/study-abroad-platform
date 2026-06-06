# Caching Architecture

Single reference for the platform's three-layer cache stack. The goal of this
doc is to stop the recurring "fix the cache again" cycle: each layer now has a
single source of truth and lint enforcement so new code can't reintroduce the
old failure modes (invisible Redis quota burn, scattered TTLs, list-page lag).

---

## Three layers at a glance

| Layer              | Where                        | Source of truth                                                    | Enforcement                               |
| ------------------ | ---------------------------- | ------------------------------------------------------------------ | ----------------------------------------- |
| Backend Redis      | `apps/api/src/common/redis/` | `redis-ttl.constants.ts` (TTLs) + `RedisService` (the only client) | 3 lint rules in `check-api-quality.ts`    |
| Web query cache    | `apps/web/src/lib/query/`    | `cache-policy.ts` tiers + `keys.ts` (`qk`)                         | 3 lint rules in `check-code-quality.ts`   |
| Mobile query cache | `apps/mobile/src/lib/query/` | shared `QUERY_CACHE_TIERS` + `qk`                                  | 3 lint rules in `check-mobile-quality.ts` |

Cross-platform staleTime lives in `packages/shared/src/constants/query-cache.ts`
(`QUERY_CACHE_TIERS`) so web and mobile can't silently diverge.

---

## Layer 1 — Backend Redis (`apps/api/src/common/redis/`)

### One client, always metered

`RedisService` is the **only** ioredis client in the backend (`@Global`). Every
operation flows through `record()` / `safeRecord()` so it shows up in the
cache-health dashboard.

- **Wrapper methods** — `get/set/setJSON/del/delByPrefix`, list (`lpush/lrange/…`),
  set (`sadd/…`), atomic (`incr/incrby/setNX/setNXStrict`), hash
  (`hget/hset/hgetall/hincrby/hincrbyfloat/hdel`), sorted-set
  (`zadd/zrange/zrangebyscore/zrem/zremrangebyscore/zcard`), TTL (`expire/pexpire/pttl`).
  These **fail soft**: when Redis is down they return a safe fallback (null / [] /
  {} / 0 / no-op) instead of throwing.
- **`withClient(op, keyLabel, fn)`** — metered escape hatch for advanced ops with
  no dedicated wrapper (Lua `eval`, pipelines, multi-step atomic sequences). It
  **re-throws** on error / when Redis is down, so callers that keep their own
  in-memory fallback hit their existing `try/catch` degradation path. Used by
  rate-limiter, brute-force, token-tracker, task-queue, ai-agent memory, etc.
- **`getClient()`** still exists but is **lint-forbidden** outside `common/redis/`
  (see rules below). Reach for `withClient()` instead.

### Multi-endpoint failover + circuit breaker

Configured via `REDIS_CACHE_URLS` (or `REDIS_STATE_URLS` / `REDIS_URLS` /
`REDIS_URL`). Endpoints are tried in order; on a `quota_exceeded` / `auth` /
`timeout` / `connection` error the endpoint's circuit opens (60m for permanent,
30s for transient) and traffic fails over to the next URL immediately. The
subsystem only reports `circuitOpen: true` when **every** endpoint has tripped.
A background loop reconnects every 30s. (History: PR #168.)

### TTLs — single source of truth

All TTLs live in `redis-ttl.constants.ts` as `REDIS_TTL.*` (seconds), grouped by
tier (90d → 1m). Never pass a bare number as a TTL; the `no-hardcoded-redis-ttl`
rule blocks it. Representative tiers:

| Tier | Examples                                                                                         |
| ---- | ------------------------------------------------------------------------------------------------ |
| 24h  | `PREDICTION_RESULT`, `SCHOOL_METRICS`, `MEMORY_CACHE`, `EMBEDDING_CACHE`, `RECOMMENDATION_CACHE` |
| 1h   | `SCHOOL_DETAIL`, `SCHOOL_LIST`, `ANALYSIS_CACHE`, `SCHOOL_CALIBRATION`                           |
| 5m   | `PERMISSION`, `SETTINGS`, `CIRCUIT_BREAKER`, `PROFILE`                                           |
| 1m   | `FEATURE_FLAG`, `CONVERSATION_LOCK`, `LOCAL_CACHE`                                               |

### Invalidation

`CacheInvalidationService` clears derived caches on profile / school / high-school
mutations (prefix deletes via `delByPrefix`). TTL is the eventual-consistency
fallback. Errors are logged, never thrown.

### Monitoring

`GET /admin/cache-health` (ADMIN) → per-pod snapshot: connection, hit ratio,
error rate, p50/p95/p99 latency, hot-key prefixes, recent errors, quota banner.
Frontend at `apps/web/src/app/[locale]/(main)/admin/cache-health/`. Because every
op is metered (no raw `getClient()`), a runaway poll like #274 is now visible
here instead of silently exhausting quota.

### Lint rules (`check-api-quality.ts`, all **error**)

| Rule                            | Catches                                             | Suppress                 |
| ------------------------------- | --------------------------------------------------- | ------------------------ |
| `no-raw-redis-getclient`        | `redis.getClient()` outside `common/redis/`         | `// @redis-raw-allowed`  |
| `no-hardcoded-redis-ttl`        | numeric TTL literal on a Redis write                | `// @redis-ttl-allowed`  |
| `no-redis-poll-without-backoff` | `setInterval` polling Redis on a fixed <30s cadence | `// @redis-poll-allowed` |

---

## Layer 2 — Web query cache (`apps/web/src/lib/query/`)

- **`cache-policy.ts`** — 5 named tiers (`static / reference / standard / fresh /
realtime`). Spread one into a query: `useQuery({ ...cachePolicy.reference })`.
  Values derive from `STALE_TIME` / `GC_TIME` in `lib/constants.ts`, which in turn
  derive from the shared `QUERY_CACHE_TIERS`.
- **`keys.ts` (`qk`)** — query-key factory; single source of truth for keys.
  `qk.schools.list(toStableParams(filters))`. `toStableParams()` normalises nested
  filters (sorted keys, blanks dropped) so deep-equal filter sets share one entry.
- **`use-list-query.ts`** — canonical paginated/searchable list hook that bakes in
  the four things list pages kept getting wrong: debounced search, `keepPreviousData`
  (no blank skeleton), declared cache tier, stable deduped keys.
- **Global default** (`query-provider.tsx`): `standard` tier, `refetchOnWindowFocus:
false`, `retry: 1`. Override per-query only when more static or more volatile.

Lint (`check-code-quality.ts`, `no-inline-list-query-key` = **error**):
`no-inline-list-query-key`, `no-dynamic-staletime-on-list`,
`list-query-needs-keep-previous` (suppress `// @cache-policy-ignore-next-line`).

---

## Layer 3 — Mobile query cache (`apps/mobile/src/lib/query/`)

Mirrors web's `cachePolicy` + `qk` structure, plus:

- **Offline persistence** — `PersistQueryClientProvider` + AsyncStorage persister
  (`query-persister.ts`, 24h max age); reference data prefetched on cold start.
- **`cache-metrics.ts`** — per-key-prefix hit-rate tracking, attached at boot.
- **`usePaginatedQuery`** — infinite-scroll list hook with `keepPreviousData`.

Same 3 cache lint rules as web (`check-mobile-quality.ts`).

### web ↔ mobile: shared vs intentional differences

`staleTime` is shared via `QUERY_CACHE_TIERS`. Two differences are **intentional**
(documented in `query-cache.ts`), not drift:

1. Mobile `gcTime` is longer (offline-first; AsyncStorage 24h) — explicit overrides
   in mobile `cache-policy.ts`.
2. Mobile `fresh.staleTime` is `0` (instant revalidation) vs `1m` on web.
3. Query-key naming: web `['school-lists']` (plural) vs mobile `['school-list']`.

---

## When you touch caching

- **New Redis op type** → add a metered wrapper to `RedisService` (don't reach for
  `getClient()`); map it to an existing `RedisOpKind` to keep the dashboard working.
- **New cached value** → add a `REDIS_TTL.*` entry; never inline a number.
- **New list page** → use `useListQuery` (web) / `usePaginatedQuery` (mobile) and a
  `qk` key; never inline a query key.
- **Tune cache freshness for both apps** → edit `QUERY_CACHE_TIERS`.

History: web list-lag root-caused + abstracted in PRs #336→#337→#338; backend
metering + TTL SSOT + lint added in the "enterprise cache hardening" pass.
