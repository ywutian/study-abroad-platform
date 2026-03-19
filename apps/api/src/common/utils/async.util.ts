import { Logger } from '@nestjs/common';

/**
 * Execute a promise in fire-and-forget mode, logging failures without
 * affecting the caller. Used for non-critical side-effects like memory
 * recording and points awarding.
 */
export function fireAndForget(
  promise: Promise<unknown>,
  logger: Logger,
  context: string,
): void {
  promise.catch((err) =>
    logger.warn(`${context}: ${err instanceof Error ? err.message : err}`),
  );
}
