/**
 * Restricted gradient tokens.
 *
 * Page chrome should not depend on gradients. These remain available only for
 * explicit allowlisted cases such as loading shimmer, chart fills, and
 * illustration assets.
 */

export const gradients = {
  loadingShimmer: ['rgba(255,255,255,0)', 'rgba(255,255,255,0.45)', 'rgba(255,255,255,0)'] as const,
  illustrationCool: ['rgba(91,102,246,0.08)', 'rgba(53,111,157,0.04)'] as const,
  illustrationWarm: ['rgba(180,123,23,0.08)', 'rgba(77,155,110,0.04)'] as const,
  chartInfo: ['rgba(53,111,157,0.18)', 'rgba(53,111,157,0.02)'] as const,
} as const;

export const gradientDirections = {
  toBottom: { start: { x: 0.5, y: 0 }, end: { x: 0.5, y: 1 } },
  toRight: { start: { x: 0, y: 0.5 }, end: { x: 1, y: 0.5 } },
  diagonal: { start: { x: 0, y: 0 }, end: { x: 1, y: 1 } },
} as const;

export const gradientAllowlist = new Set<GradientKey>([
  'loadingShimmer',
  'illustrationCool',
  'illustrationWarm',
  'chartInfo',
]);

export function isAllowedGradientKey(key: string): key is GradientKey {
  return gradientAllowlist.has(key as GradientKey);
}

export type GradientKey = keyof typeof gradients;
export type GradientDirection = keyof typeof gradientDirections;
