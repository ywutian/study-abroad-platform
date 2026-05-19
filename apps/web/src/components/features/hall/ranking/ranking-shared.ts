'use client';

/**
 * Shared types + config for the RankingTab sub-components.
 *
 * 2026-05 Hall Plan C (C1): `CompetitivePosition` + `POSITION_CONFIG` were
 * REMOVED. The strong/moderate/challenging tier was a verdict computed off
 * a tiny self-selected peer pool and collided with prediction's
 * reach/match/safety (the sole tier authority per ai-system.md). The
 * ranking surface now shows only a relative percentile, framed as rough
 * peer context with an explicit small-sample caveat.
 */

export type SortMode = 'percentile' | 'score' | 'applicants';
