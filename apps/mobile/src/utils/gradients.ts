/**
 * Gradient System
 *
 * Predefined gradient color arrays and direction presets
 * for use with expo-linear-gradient.
 */

/** Gradient color presets (arrays of hex/rgba colors) */
export const gradients = {
  // Brand gradients
  primary: ['#6366f1', '#4f46e5'] as const,
  primarySoft: ['rgba(99,102,241,0.12)', 'rgba(79,70,229,0.06)'] as const,
  primaryDark: ['#818cf8', '#6366f1'] as const,

  // Hero gradients (multi-color)
  hero: ['#6366f1', '#8b5cf6', '#ec4899'] as const,
  heroDark: ['#818cf8', '#a78bfa', '#f472b6'] as const,

  // Semantic gradients
  success: ['#10b981', '#059669'] as const,
  warning: ['#f59e0b', '#d97706'] as const,
  error: ['#ef4444', '#dc2626'] as const,
  info: ['#3b82f6', '#2563eb'] as const,

  // Decorative gradients
  rose: ['#f43f5e', '#e11d48'] as const,
  violet: ['#8b5cf6', '#7c3aed'] as const,
  amber: ['#f59e0b', '#d97706'] as const,
  emerald: ['#10b981', '#059669'] as const,

  // Background mesh gradients (very low opacity, atmosphere)
  meshPrimary: ['rgba(99,102,241,0.06)', 'transparent'] as const,
  meshSuccess: ['rgba(16,185,129,0.04)', 'transparent'] as const,
  meshWarm: ['rgba(245,158,11,0.04)', 'transparent'] as const,
} as const;

/** Gradient direction presets for LinearGradient start/end */
export const gradientDirections = {
  toBottom: { start: { x: 0.5, y: 0 }, end: { x: 0.5, y: 1 } },
  toRight: { start: { x: 0, y: 0.5 }, end: { x: 1, y: 0.5 } },
  diagonal: { start: { x: 0, y: 0 }, end: { x: 1, y: 1 } },
  diagonalReverse: { start: { x: 1, y: 0 }, end: { x: 0, y: 1 } },
} as const;

export type GradientKey = keyof typeof gradients;
export type GradientDirection = keyof typeof gradientDirections;
