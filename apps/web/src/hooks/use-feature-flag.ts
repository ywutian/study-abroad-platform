'use client';

import { featureFlagRoutes } from '@study-abroad/shared';
import { useQuery } from '@tanstack/react-query';

import { apiClient } from '@/lib/api';

interface EvaluateResponse {
  flags: Record<string, boolean>;
}

interface UseFeatureFlagResult {
  /** True when the flag is enabled for the current user. */
  enabled: boolean;
  /** True while the very first fetch is in flight. */
  isLoading: boolean;
  /** True on a transport error — the hook safely falls back to `enabled: false`. */
  isError: boolean;
}

/**
 * 2026-05 Phase 4 #35: User-facing feature-flag hook.
 *
 * Before this hook, the codebase had **zero frontend feature-flag
 * usage** even though the backend has been flag-aware since 2026-01.
 * The result was that every experiment had to be deployed as a hard
 * code-path branch + manual rollback — exactly the friction
 * feature-flag systems exist to remove.
 *
 * Usage:
 * \`\`\`tsx
 * const { enabled, isLoading } = useFeatureFlag('dashboard-decision-panel-v2');
 * if (isLoading) return <Skeleton />;
 * return enabled ? <DecisionPanelV2 /> : <DecisionPanel />;
 * \`\`\`
 *
 * ## Implementation
 *
 * - Each `key` becomes its own React Query — keyed by \`['feature-flag', key]\`
 *   so multiple components asking for the same flag share one cache entry
 * - 60s staleTime matches the Redis cache TTL on the backend (same window)
 * - Errors silently fall back to \`enabled: false\` — failing closed is safer
 *   than enabling an untested code path on a transport blip
 * - Empty / null flag keys short-circuit to disabled without firing a request
 */
export function useFeatureFlag(key: string | null | undefined): UseFeatureFlagResult {
  const enabled = Boolean(key && key.length > 0);
  const query = useQuery({
    queryKey: ['feature-flag', key ?? ''],
    queryFn: async () => {
      const result = await apiClient.get<EvaluateResponse>(featureFlagRoutes.evaluate(), {
        params: { keys: key! },
      });
      return result.flags[key!] === true;
    },
    enabled,
    // Backend Redis TTL is 60s; staleTime mirrors that so we re-fetch in
    // sync with cache expiry rather than thrashing.
    staleTime: 60_000,
    // Fail closed: any transport error treats the flag as off.
    retry: false,
  });

  return {
    enabled: enabled && query.data === true,
    isLoading: enabled && query.isLoading,
    isError: query.isError,
  };
}
