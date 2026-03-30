import { ReportPriority } from '@prisma/client';

/**
 * Compute default priority based on report target type.
 * - USER reports → HIGH (user safety)
 * - MESSAGE reports → MEDIUM (potential harassment)
 * - Others → LOW
 */
export function computeReportPriority(targetType: string): ReportPriority {
  switch (targetType) {
    case 'USER':
      return ReportPriority.HIGH;
    case 'MESSAGE':
      return ReportPriority.MEDIUM;
    default:
      return ReportPriority.LOW;
  }
}
