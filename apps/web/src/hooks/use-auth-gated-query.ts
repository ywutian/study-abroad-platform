/**
 * Auth-gated query — the single, enforced way to fetch authenticated data.
 *
 * The recurring "401 race" bug class (#145 prediction, #222 chat, + ~8 latent
 * sites): a `useQuery` fires on mount before `AuthInitializer` has restored the
 * in-memory access token, so the request goes out with no Authorization header
 * and 401s. The hand-copied fix was `enabled: isInitialized && !!accessToken`,
 * which drifted (`!!user` only, `!!accessToken` only, missing init gate).
 *
 * `useAuthReady()` is the ONE canonical readiness gate; `useAuthGatedQuery()`
 * bakes it in so callers can't forget. The `no-unguarded-auth-query` lint rule
 * enforces that authenticated queries go through this (or reference the gate),
 * so the loop stays closed.
 */

import {
  useQuery,
  type QueryKey,
  type UseQueryOptions,
  type UseQueryResult,
} from '@tanstack/react-query';
import { useAuthStore } from '@/stores/auth';

/**
 * Canonical "auth is ready to make authenticated requests" gate — boot finished
 * AND a token is in memory. Use this in any `enabled` that guards an authed query.
 */
export function useAuthReady(): boolean {
  return useAuthStore((s) => s.isInitialized && !!s.accessToken);
}

/**
 * `useQuery` that will not fire until auth is ready. Composes with a caller-
 * supplied boolean `enabled` (both must be true). For the rare function-style
 * `enabled`, use `useQuery` directly with `useAuthReady()` in the condition.
 */
export function useAuthGatedQuery<
  TQueryFnData = unknown,
  TError = Error,
  TData = TQueryFnData,
  TQueryKey extends QueryKey = QueryKey,
>(
  options: Omit<UseQueryOptions<TQueryFnData, TError, TData, TQueryKey>, 'enabled'> & {
    enabled?: boolean;
  }
): UseQueryResult<TData, TError> {
  const authReady = useAuthReady();
  return useQuery<TQueryFnData, TError, TData, TQueryKey>({
    ...options,
    enabled: authReady && (options.enabled ?? true),
  });
}
