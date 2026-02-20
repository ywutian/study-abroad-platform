import type { CaseResult } from '@/types';

/**
 * Returns the Badge variant for a given admission result.
 */
export function getResultBadgeVariant(result: CaseResult) {
  switch (result) {
    case 'ADMITTED':
      return 'success' as const;
    case 'REJECTED':
      return 'error' as const;
    case 'WAITLISTED':
    case 'DEFERRED':
      return 'warning' as const;
    default:
      return 'secondary' as const;
  }
}
