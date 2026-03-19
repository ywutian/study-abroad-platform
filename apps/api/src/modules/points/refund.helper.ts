import { Logger } from '@nestjs/common';
import { CaseIncentiveService } from './incentive.service';
import { PointAction } from './points-config.service';

/**
 * Unified refund helper with exponential backoff retry.
 *
 * Replaces ad-hoc `.refund().catch(e => logger.error(...))` patterns
 * scattered across essay-ai, recommendation, and case-gallery services.
 */
export async function safeRefund(
  incentiveService: CaseIncentiveService,
  userId: string,
  action: PointAction,
  logger: Logger,
  metadata?: Record<string, unknown>,
  maxRetries = 3,
): Promise<void> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await incentiveService.refund(userId, action, metadata);
      return;
    } catch (err) {
      if (attempt === maxRetries) {
        logger.error(
          `CRITICAL: Point refund failed after ${maxRetries} attempts`,
          { userId, action, error: err },
        );
        return;
      }
      const delayMs = 200 * Math.pow(2, attempt - 1); // 200, 400, 800ms
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
}
