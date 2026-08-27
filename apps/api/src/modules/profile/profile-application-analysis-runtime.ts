import type { Prisma } from '@prisma/client';

/** Preserve the deterministic evidence boundary and make mismatches observable. */
export function filterAllowedEvidenceIds(
  allowedEvidenceIds: string[],
  rawEvidenceIds: string[],
): { evidenceIds: string[]; validationErrors: string[] } {
  const allowed = new Set(allowedEvidenceIds);
  const evidenceIds = rawEvidenceIds.filter((item) => allowed.has(item));
  const validationErrors: string[] = [];
  if (
    rawEvidenceIds.length > 0 &&
    evidenceIds.length !== rawEvidenceIds.length
  ) {
    validationErrors.push('school-analysis-evidence-id-not-allowed');
  }
  if (evidenceIds.length === 0 && allowedEvidenceIds.length > 0) {
    validationErrors.push('school-analysis-missing-evidence-binding');
  }
  return { evidenceIds, validationErrors };
}

function readBoundedPositiveInteger(
  value: string | undefined,
  fallback: number,
  min: number,
  max: number,
): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= min && parsed <= max
    ? parsed
    : fallback;
}

// Five independent schools fit in one bounded wave, below the API deadline.
export const SCHOOL_ANALYST_CONCURRENCY = readBoundedPositiveInteger(
  process.env.APPLICATION_ANALYSIS_SCHOOL_CONCURRENCY,
  5,
  1,
  5,
);
export const SCHOOL_ANALYST_TIMEOUT_MS = readBoundedPositiveInteger(
  process.env.APPLICATION_ANALYSIS_SCHOOL_TIMEOUT_MS,
  12_000,
  1_000,
  60_000,
);
export const PORTFOLIO_SYNTHESIZER_TIMEOUT_MS = readBoundedPositiveInteger(
  process.env.APPLICATION_ANALYSIS_PORTFOLIO_TIMEOUT_MS,
  15_000,
  1_000,
  60_000,
);
// Briefly cache deterministic fallback to avoid a provider-outage retry storm.
export const APPLICATION_ANALYSIS_DEGRADED_CACHE_TTL_SECONDS =
  readBoundedPositiveInteger(
    process.env.APPLICATION_ANALYSIS_DEGRADED_CACHE_TTL_SECONDS,
    90,
    10,
    600,
  );

/** Independent calls share one concurrency bound and preserve input order. */
export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;
  const worker = async (): Promise<void> => {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await fn(items[index]);
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, () => worker()),
  );
  return results;
}

export function normalizeUsage(
  usage:
    | {
        promptTokens: number;
        completionTokens: number;
        totalTokens: number;
        model: string;
        estimatedCost?: number;
      }
    | undefined,
): Prisma.InputJsonValue | undefined {
  if (!usage) return undefined;
  return usage;
}
