#!/usr/bin/env tsx
/**
 * Backfill SchoolCohortRoundPrior from approved AdmissionCase rows.
 *
 * Motivation
 * ----------
 * The `CohortPriorTeacher` (about to be added to the distillation stack)
 * needs per-school, per-cohort, per-round admission priors with sample
 * counts and confidence intervals. The SchoolCohortRoundPrior table has
 * existed in the schema since the distillation framework was introduced
 * but was never populated — so CohortPriorTeacher has no input.
 *
 * We have 1,235 approved AdmissionCase rows (see the
 * /admin/prediction-workflow/data-inventory endpoint). This script:
 *
 *   1. Reads all approved cases with ADMITTED | REJECTED results.
 *   2. Derives a `cohortKey` per case using the same decision tree as
 *      `PredictionPolicyService.resolveCohortKey`, with sensible
 *      fallbacks for fields that live on Profile but not on
 *      AdmissionCase (highSchoolLocation comes from the HighSchool
 *      relation, isInternational is inferred from nationality + tags).
 *   3. Groups by (schoolId, cohortKey, round).
 *   4. Computes priorRate = admits / (admits + rejects) and a Wilson
 *      score 95% CI. Cells with fewer than MIN_SAMPLES samples are
 *      dropped — a prior built on 2 cases is more misleading than
 *      falling back to the raw admit rate.
 *   5. Upserts into SchoolCohortRoundPrior.
 *
 * Idempotent: re-running overwrites existing priors for the same
 * (schoolId, cohortKey, round, policyVersionId, setVersion) key, so it's
 * safe to run on a schedule as new cases land.
 *
 * Dry-run flag: `--dry-run` prints what would be written without
 * touching the DB.
 */

import { PrismaClient, Prisma } from '@prisma/client';
import {
  deriveCohortKeyFromCase,
  wilsonInterval,
  confidenceTier,
} from '../src/modules/prediction/utils/cohort-key';

const prisma = new PrismaClient();

/**
 * Minimum cases per (school, cohort, round) cell before we emit a prior.
 * Below this threshold the CI is too wide to be useful — better to let
 * the downstream teacher return null and fall back to school-level admit
 * rate than to serve a confidently-wrong prior.
 */
const MIN_SAMPLES = 5;

/** Source tag written into sourceSummary so operators can trace origins. */
const SET_VERSION = `backfill-admission-cases-${new Date().toISOString().slice(0, 10)}`;

// ---------------------------------------------------------------------------

type AggregateKey = string; // `${schoolId}|${cohortKey}|${round}`
type AggregateValue = {
  schoolId: string;
  cohortKey: string;
  round: string;
  admits: number;
  rejects: number;
  caseIds: string[];
};

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const verbose = process.argv.includes('--verbose');

  console.log(
    `[backfill-cohort-priors] Starting ${dryRun ? '(DRY RUN)' : '(LIVE)'}...`,
  );

  // Pull all approved cases in one query. 1,235 rows is well under the
  // Prisma large-result threshold so no streaming needed.
  const cases = await prisma.admissionCase.findMany({
    where: {
      reviewStatus: { in: ['AUTO_APPROVED', 'APPROVED'] },
      result: { in: ['ADMITTED', 'REJECTED'] },
      round: { not: null },
    },
    select: {
      id: true,
      schoolId: true,
      round: true,
      result: true,
      nationality: true,
      curriculumType: true,
      highSchoolType: true,
      demographicTags: true,
      highSchool: { select: { country: true } },
    },
  });

  console.log(
    `[backfill-cohort-priors] Loaded ${cases.length} approved cases with ADMITTED/REJECTED result`,
  );

  // Aggregate.
  const buckets = new Map<AggregateKey, AggregateValue>();
  let skippedNoCohort = 0;
  let skippedNoRound = 0;

  for (const c of cases) {
    const cohortKey = deriveCohortKeyFromCase({
      nationality: c.nationality,
      curriculumType: c.curriculumType,
      highSchoolType: c.highSchoolType,
      demographicTags: c.demographicTags,
      highSchool: c.highSchool,
    });
    if (!cohortKey) {
      skippedNoCohort++;
      continue;
    }
    if (!c.round) {
      skippedNoRound++;
      continue;
    }

    const round = c.round.toUpperCase();
    const key: AggregateKey = `${c.schoolId}|${cohortKey}|${round}`;
    const bucket = buckets.get(key) ?? {
      schoolId: c.schoolId,
      cohortKey,
      round,
      admits: 0,
      rejects: 0,
      caseIds: [],
    };
    if (c.result === 'ADMITTED') bucket.admits++;
    else if (c.result === 'REJECTED') bucket.rejects++;
    bucket.caseIds.push(c.id);
    buckets.set(key, bucket);
  }

  console.log(
    `[backfill-cohort-priors] Aggregated into ${buckets.size} (school, cohort, round) buckets. Skipped ${skippedNoCohort} cases with no derivable cohortKey, ${skippedNoRound} with no round.`,
  );

  // Filter under-populated cells before writing.
  const eligible = Array.from(buckets.values()).filter(
    (b) => b.admits + b.rejects >= MIN_SAMPLES,
  );
  const skippedLowSample = buckets.size - eligible.length;
  console.log(
    `[backfill-cohort-priors] ${eligible.length} buckets meet MIN_SAMPLES=${MIN_SAMPLES}; ${skippedLowSample} under-populated buckets dropped.`,
  );

  if (verbose) {
    console.log('[backfill-cohort-priors] Sample preview (first 10):');
    for (const b of eligible.slice(0, 10)) {
      const total = b.admits + b.rejects;
      const rate = b.admits / total;
      const { lower, upper } = wilsonInterval(b.admits, total);
      console.log(
        `  ${b.schoolId} | ${b.cohortKey} | ${b.round} | n=${total} | admit_rate=${(rate * 100).toFixed(1)}% | 95% CI [${(lower * 100).toFixed(1)}%, ${(upper * 100).toFixed(1)}%]`,
      );
    }
  }

  if (dryRun) {
    console.log('[backfill-cohort-priors] DRY RUN — not writing to DB.');
    await prisma.$disconnect();
    return;
  }

  // find-first + branch, NOT upsert. The table's unique constraint is
  // (schoolId, cohortKey, round, policyVersionId, setVersion). We store
  // these priors as policy-agnostic (policyVersionId = NULL) because
  // they describe historical reality rather than a policy-tied signal.
  // Postgres treats NULLs as distinct in unique constraints, so a
  // compound-key upsert with a NULL field always CREATES duplicates
  // (it can never "find" the existing row to trigger update). The
  // find-first + branch pattern sidesteps that entirely.
  let written = 0;
  let updated = 0;
  for (const b of eligible) {
    const total = b.admits + b.rejects;
    const rate = b.admits / total;
    const { lower, upper } = wilsonInterval(b.admits, total);

    const payload = {
      priorRate: new Prisma.Decimal(rate),
      lowerBound: new Prisma.Decimal(lower),
      upperBound: new Prisma.Decimal(upper),
      sampleCount: total,
      smoothingMethod: 'wilson-95',
      confidence: confidenceTier(total),
      sourceSummary: {
        origin: 'admission_case_aggregate',
        admits: b.admits,
        rejects: b.rejects,
        // Cap the caseIds list to keep the JSON bounded — the full list
        // is not intended as queryable data, just a reference for audits.
        caseIds: b.caseIds.slice(0, 50),
        caseIdsTruncatedAt: b.caseIds.length > 50 ? 50 : null,
      } as Prisma.InputJsonValue,
      sourceObservationIds: [] as string[],
      notes: `Derived from ${total} verified AdmissionCase rows; see sourceSummary.caseIds.`,
    };

    const existing = await prisma.schoolCohortRoundPrior.findFirst({
      where: {
        schoolId: b.schoolId,
        cohortKey: b.cohortKey,
        round: b.round,
        policyVersionId: null,
        setVersion: SET_VERSION,
      },
      select: { id: true },
    });

    if (existing) {
      await prisma.schoolCohortRoundPrior.update({
        where: { id: existing.id },
        data: payload,
      });
      updated++;
    } else {
      await prisma.schoolCohortRoundPrior.create({
        data: {
          schoolId: b.schoolId,
          cohortKey: b.cohortKey,
          round: b.round,
          policyVersionId: null,
          setVersion: SET_VERSION,
          ...payload,
        },
      });
      written++;
    }
  }

  console.log(
    `[backfill-cohort-priors] Wrote ${written} new + updated ${updated} existing SchoolCohortRoundPrior rows.`,
  );
  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error('[backfill-cohort-priors] Failed:', err);
  await prisma.$disconnect();
  process.exit(1);
});
