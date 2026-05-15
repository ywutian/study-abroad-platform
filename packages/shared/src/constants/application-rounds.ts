export const APPLICATION_ROUND_VALUES = [
  'ED',
  'ED2',
  'EA',
  'REA',
  'SCEA',
  'RD',
  'ROLLING',
] as const;

export type ApplicationRound = (typeof APPLICATION_ROUND_VALUES)[number];

export function normalizeApplicationRound(round?: string | null): ApplicationRound | undefined {
  if (!round) return undefined;
  const normalized = round.trim().toUpperCase().replace(/\s+/g, '_');
  if (normalized === 'ROLLING_ADMISSION') return 'ROLLING';
  return APPLICATION_ROUND_VALUES.find((value) => value === normalized);
}
