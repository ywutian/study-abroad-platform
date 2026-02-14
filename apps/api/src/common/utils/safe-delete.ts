import { Logger } from '@nestjs/common';

const logger = new Logger('SafeDelete');

interface SafeDeleteContext {
  entity: string;
  userId: string;
  operation: 'softDelete' | 'hardDelete';
}

/**
 * Execute a Prisma delete/update within a transaction with proper error handling.
 *
 * In `hardDelete` operations (critical=true by default), errors are re-thrown to
 * trigger a transaction rollback — data must be consistently removed.
 *
 * In `softDelete` operations (critical=false), errors are logged but the
 * transaction continues — partial cleanup is acceptable as the user record
 * will be marked as deleted regardless.
 *
 * @param promise - The Prisma operation to execute
 * @param context - Entity name, userId, and operation type for logging
 * @param critical - If true, re-throw errors to roll back the transaction (default: true for hardDelete)
 *
 * Finding: A4-008 — replaces 12 silent `.catch(() => {})` blocks in user.service.ts
 */
export async function safeDelete(
  promise: Promise<unknown>,
  context: SafeDeleteContext,
  critical = context.operation === 'hardDelete',
): Promise<void> {
  try {
    await promise;
  } catch (error) {
    logger.error(
      `SafeDelete failed: ${context.entity} for user ${context.userId} during ${context.operation}`,
      error instanceof Error ? error.stack : String(error),
    );
    if (critical) {
      throw error;
    }
  }
}
