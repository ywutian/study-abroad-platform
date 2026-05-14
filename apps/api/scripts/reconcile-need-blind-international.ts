/**
 * reconcile-need-blind-international.ts
 *
 * Idempotent reconciliation script for the needBlindInternational tri-state.
 *
 * ──────────────────────────────────────────────────────────────────────────
 * WHY THIS EXISTS
 * ──────────────────────────────────────────────────────────────────────────
 * The Phase B-C migration changed `School.needBlindInternational` from
 * `Boolean @default(false)` to `Boolean?`. The intent was:
 *   true  → verified need-blind
 *   false → verified need-aware
 *   null  → not yet reviewed
 *
 * In practice we discovered three concurrent gaps:
 *   1. The migration may not have been applied in every environment.
 *   2. The values that did get written predate the tri-state semantics, so
 *      the field can still hold `false` for un-reviewed schools.
 *   3. metadata.provenance for `needBlindInternational` was inherited from
 *      whatever source was last touched (often COLLEGE_SCORECARD / IPEDS),
 *      neither of which actually publishes need-blind-for-intl status.
 *
 * This script is the source of truth. Running it against any environment
 * (fresh, partially-migrated, fully-migrated, mixed-provenance) converges
 * to the same correct state:
 *
 *   STEP 1. Verify the column is nullable; emit a clear error if not.
 *   STEP 2. Apply the verified need-blind list (10 schools → true).
 *   STEP 3. Apply the verified need-aware list (16 schools → false).
 *   STEP 4. Reset every other row to null AND clear any stale provenance
 *           that claims a non-authoritative source.
 *   STEP 5. Write fresh MANUAL_REVIEW provenance for the verified rows so
 *           the data-health dashboard reflects the truth.
 *
 * ──────────────────────────────────────────────────────────────────────────
 * USAGE
 * ──────────────────────────────────────────────────────────────────────────
 *   # dry-run (default): show what would change, write nothing
 *   npx tsx apps/api/scripts/reconcile-need-blind-international.ts
 *
 *   # apply
 *   APPLY=1 npx tsx apps/api/scripts/reconcile-need-blind-international.ts
 *
 * The script is safe to re-run. It compares current state to target state
 * row by row and writes only the diff.
 *
 * Related:
 *   - apps/api/prisma/seed-intl-schools.ts (the source lists)
 *   - apps/api/prisma/migrations/20260514141500_need_blind_intl_nullable/
 *   - docs/PREDICTION_ACCURACY_STRATEGY.md §9
 *   - ADR-0020
 */

import { Prisma, PrismaClient } from '@prisma/client';
import {
  NEED_BLIND_INTL_SCHOOLS,
  VERIFIED_NEED_AWARE_INTL_SCHOOLS,
} from '../prisma/seed-intl-schools';

const prisma = new PrismaClient();
const APPLY = process.env.APPLY === '1';
const RECONCILIATION_SOURCE =
  'MANUAL_REVIEW:need-blind-intl-reconciler-2026-05';

// Sources we trust for need-blind-for-intl status. Anything else (Scorecard,
// IPEDS, heuristic fills) is treated as misattributed and stripped.
const TRUSTED_PROVENANCE_SUBSTRINGS = [
  'MANUAL_REVIEW',
  'CDS_',
  'OFFICIAL_PAGE',
];

interface Plan {
  setTrue: Array<{ schoolId: string; name: string; current: boolean | null }>;
  setFalse: Array<{ schoolId: string; name: string; current: boolean | null }>;
  setNull: Array<{ schoolId: string; name: string; current: boolean | null }>;
  provenanceUpdates: Array<{
    schoolId: string;
    name: string;
    action: 'WRITE_MANUAL_REVIEW' | 'STRIP_MISATTRIBUTED';
    currentSource: string | null;
  }>;
  skipped: number;
}

async function preflightSchemaCheck(): Promise<void> {
  // Use information_schema to confirm the column is nullable. If migration
  // didn't run, we abort loudly rather than silently writing the wrong shape.
  const result = await prisma.$queryRaw<
    Array<{ is_nullable: string; data_type: string }>
  >(Prisma.sql`
    SELECT is_nullable, data_type
    FROM information_schema.columns
    WHERE table_name = 'School' AND column_name = 'needBlindInternational';
  `);

  if (result.length === 0) {
    throw new Error(
      'School.needBlindInternational column does not exist. Did the migration run?',
    );
  }

  const col = result[0];
  if (col.is_nullable !== 'YES') {
    throw new Error(
      `School.needBlindInternational is still NOT NULL (data_type=${col.data_type}). ` +
        'Run `prisma migrate deploy` to apply 20260514141500_need_blind_intl_nullable, ' +
        'then re-run this script.',
    );
  }

  console.log(
    `✓ Schema check: School.needBlindInternational is nullable (${col.data_type})`,
  );
}

function isProvenanceTrusted(source: string | null | undefined): boolean {
  if (!source) return false;
  return TRUSTED_PROVENANCE_SUBSTRINGS.some((sig) => source.includes(sig));
}

function extractCurrentProvenanceSource(metadata: unknown): string | null {
  if (!metadata || typeof metadata !== 'object') return null;
  const provenance = (metadata as Record<string, unknown>).provenance;
  if (!provenance || typeof provenance !== 'object') return null;
  const entry = (provenance as Record<string, unknown>).needBlindInternational;
  if (!entry || typeof entry !== 'object') return null;
  const source = (entry as Record<string, unknown>).source;
  return typeof source === 'string' ? source : null;
}

async function buildPlan(): Promise<Plan> {
  const needBlindNorms = new Set(
    NEED_BLIND_INTL_SCHOOLS.map((s) => s.nameNorm),
  );
  const needAwareNorms = new Set(
    VERIFIED_NEED_AWARE_INTL_SCHOOLS.map((s) => s.nameNorm),
  );

  const schools = await prisma.school.findMany({
    select: {
      id: true,
      name: true,
      nameNorm: true,
      needBlindInternational: true,
      metadata: true,
    },
  });

  const plan: Plan = {
    setTrue: [],
    setFalse: [],
    setNull: [],
    provenanceUpdates: [],
    skipped: 0,
  };

  for (const school of schools) {
    const norm = school.nameNorm;
    const current = school.needBlindInternational;
    const currentSource = extractCurrentProvenanceSource(school.metadata);

    if (needBlindNorms.has(norm)) {
      if (current !== true) {
        plan.setTrue.push({
          schoolId: school.id,
          name: school.name,
          current,
        });
      }
      // Always (re)write provenance for verified entries to lock in the
      // reviewer + source.
      plan.provenanceUpdates.push({
        schoolId: school.id,
        name: school.name,
        action: 'WRITE_MANUAL_REVIEW',
        currentSource,
      });
    } else if (needAwareNorms.has(norm)) {
      if (current !== false) {
        plan.setFalse.push({
          schoolId: school.id,
          name: school.name,
          current,
        });
      }
      plan.provenanceUpdates.push({
        schoolId: school.id,
        name: school.name,
        action: 'WRITE_MANUAL_REVIEW',
        currentSource,
      });
    } else {
      // Unreviewed. Value should be null AND any inherited provenance from
      // a non-authoritative source must be stripped (Scorecard, IPEDS,
      // heuristic fills all lie about this field).
      if (current !== null) {
        plan.setNull.push({
          schoolId: school.id,
          name: school.name,
          current,
        });
      }
      if (currentSource && !isProvenanceTrusted(currentSource)) {
        plan.provenanceUpdates.push({
          schoolId: school.id,
          name: school.name,
          action: 'STRIP_MISATTRIBUTED',
          currentSource,
        });
      } else if (current === null && !currentSource) {
        plan.skipped++;
      }
    }
  }

  return plan;
}

function summarize(plan: Plan): void {
  console.log('');
  console.log('Plan summary:');
  console.log(
    `  - Set to TRUE  (verified need-blind):   ${plan.setTrue.length}`,
  );
  console.log(
    `  - Set to FALSE (verified need-aware):   ${plan.setFalse.length}`,
  );
  console.log(
    `  - Set to NULL  (back to unreviewed):    ${plan.setNull.length}`,
  );
  console.log(
    `  - Provenance writes (verified rows):    ${
      plan.provenanceUpdates.filter((p) => p.action === 'WRITE_MANUAL_REVIEW')
        .length
    }`,
  );
  console.log(
    `  - Provenance strips (misattributed):    ${
      plan.provenanceUpdates.filter((p) => p.action === 'STRIP_MISATTRIBUTED')
        .length
    }`,
  );
  console.log(`  - Already correct, no change:           ${plan.skipped}`);

  if (plan.setTrue.length > 0) {
    console.log('\n  TRUE candidates (currently mis-set):');
    plan.setTrue
      .slice(0, 20)
      .forEach((r) => console.log(`    · ${r.name} (current: ${r.current})`));
  }
  if (plan.setFalse.length > 0) {
    console.log('\n  FALSE candidates (currently mis-set):');
    plan.setFalse
      .slice(0, 20)
      .forEach((r) => console.log(`    · ${r.name} (current: ${r.current})`));
  }
}

async function apply(plan: Plan): Promise<void> {
  const now = new Date().toISOString();

  // Reset un-reviewed rows to null in a single bulk update for performance.
  const nullIds = plan.setNull.map((r) => r.schoolId);
  if (nullIds.length > 0) {
    await prisma.school.updateMany({
      where: { id: { in: nullIds } },
      data: { needBlindInternational: null },
    });
    console.log(`  ✓ Set ${nullIds.length} schools to null`);
  }

  // Verified need-blind / need-aware: per-row writes because we also need to
  // update metadata.provenance, which is a JSON merge.
  for (const row of plan.setTrue) {
    await writeWithProvenance(row.schoolId, true, now);
  }
  for (const row of plan.setFalse) {
    await writeWithProvenance(row.schoolId, false, now);
  }

  // Provenance updates for rows that already have the right value but need
  // their provenance refreshed.
  for (const row of plan.provenanceUpdates) {
    if (
      plan.setTrue.find((r) => r.schoolId === row.schoolId) ||
      plan.setFalse.find((r) => r.schoolId === row.schoolId)
    ) {
      continue; // already handled above
    }
    if (row.action === 'WRITE_MANUAL_REVIEW') {
      await refreshProvenance(row.schoolId, now);
    } else {
      await stripProvenance(row.schoolId);
    }
  }
}

async function writeWithProvenance(
  schoolId: string,
  value: boolean,
  isoNow: string,
): Promise<void> {
  const school = await prisma.school.findUnique({
    where: { id: schoolId },
    select: { metadata: true },
  });
  const metadata = mergeProvenance(school?.metadata, isoNow, value);
  await prisma.school.update({
    where: { id: schoolId },
    data: {
      needBlindInternational: value,
      metadata: metadata as Prisma.InputJsonValue,
    },
  });
}

async function refreshProvenance(
  schoolId: string,
  isoNow: string,
): Promise<void> {
  const school = await prisma.school.findUnique({
    where: { id: schoolId },
    select: { metadata: true, needBlindInternational: true },
  });
  if (!school) return;
  const metadata = mergeProvenance(
    school.metadata,
    isoNow,
    school.needBlindInternational,
  );
  await prisma.school.update({
    where: { id: schoolId },
    data: { metadata: metadata as Prisma.InputJsonValue },
  });
}

async function stripProvenance(schoolId: string): Promise<void> {
  const school = await prisma.school.findUnique({
    where: { id: schoolId },
    select: { metadata: true },
  });
  if (!school || !school.metadata) return;
  const metadata = JSON.parse(JSON.stringify(school.metadata));
  if (
    metadata?.provenance &&
    typeof metadata.provenance === 'object' &&
    'needBlindInternational' in metadata.provenance
  ) {
    delete metadata.provenance.needBlindInternational;
    await prisma.school.update({
      where: { id: schoolId },
      data: { metadata: metadata as Prisma.InputJsonValue },
    });
  }
}

function mergeProvenance(
  current: unknown,
  isoNow: string,
  value: boolean | null,
): Record<string, unknown> {
  const cloned =
    current && typeof current === 'object'
      ? JSON.parse(JSON.stringify(current))
      : {};
  cloned.provenance = cloned.provenance ?? {};
  cloned.provenance.needBlindInternational = {
    source: RECONCILIATION_SOURCE,
    fetchedAt: isoNow,
    verifiedAt: isoNow,
    verifiedBy: 'reconciler-script',
    notes: `Tri-state reconciliation: value=${value}. See seed-intl-schools.ts for the cited official URL per school.`,
  };
  return cloned;
}

async function main() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('needBlindInternational tri-state reconciliation');
  console.log(
    `Mode: ${APPLY ? '🔴 APPLY (will write to database)' : '🟢 DRY-RUN'}`,
  );
  console.log('═══════════════════════════════════════════════════════\n');

  await preflightSchemaCheck();

  const plan = await buildPlan();
  summarize(plan);

  if (!APPLY) {
    console.log('\nDry-run complete. Re-run with APPLY=1 to write changes.');
    return;
  }

  console.log('\nApplying...');
  await apply(plan);
  console.log('✓ Reconciliation complete.\n');
}

main()
  .catch((err) => {
    console.error('❌ Reconciliation failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
