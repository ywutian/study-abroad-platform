/**
 * cleanup-amount-corruption.ts
 *
 * Detects and removes year-shaped corruption in financial-aid amount columns.
 *
 * ──────────────────────────────────────────────────────────────────────────
 * THE BUG
 * ──────────────────────────────────────────────────────────────────────────
 * A 2026-05 data audit found that 238 / 240 rows have
 * `averageAidPackage ∈ {2024, 2026}`, with similar pollution in
 * `averageNetPrice` and `roomAndBoard`. These look like a year value (data
 * year tag) was written into the amount column.
 *
 * Year-like ints in USD amount fields are obviously wrong:
 *   - A real `averageAidPackage` should be in the 5-figure range
 *     ($10,000–$80,000 per CDS Section H).
 *   - A real `averageNetPrice` should be 4–5 figures.
 *   - A real `roomAndBoard` should be 4–5 figures ($8,000–$20,000).
 *
 * ──────────────────────────────────────────────────────────────────────────
 * DETECTION RULE
 * ──────────────────────────────────────────────────────────────────────────
 * Treat a value as corruption if it satisfies BOTH:
 *   (a) value is in [1900, 2100] (year-like range)
 *   (b) value is below the field's realistic floor:
 *       - averageAidPackage:  floor 5000  → any value < 5000 is suspect
 *       - averageNetPrice:    floor 3000
 *       - roomAndBoard:       floor 3000
 *
 * Condition (b) catches the year masquerading as an amount without false-
 * positive flagging a small Berea-style $0 aid package.
 *
 * ──────────────────────────────────────────────────────────────────────────
 * ACTION
 * ──────────────────────────────────────────────────────────────────────────
 * 1. Set the corrupted value to null.
 * 2. Write metadata.provenance.<field> with
 *    source = 'CLEARED_BY_CORRUPTION_RECONCILER_2026-05'
 *    notes  = `prior value ${old}` so operators can re-fetch from CDS.
 *
 * The data-health dashboard then shows these as "missing — needs re-fetch"
 * which is the correct state. Re-running with `apply` is idempotent because
 * nulls are never re-cleaned.
 *
 * ──────────────────────────────────────────────────────────────────────────
 * USAGE
 * ──────────────────────────────────────────────────────────────────────────
 *   npx tsx apps/api/scripts/cleanup-amount-corruption.ts          # dry-run
 *   APPLY=1 npx tsx apps/api/scripts/cleanup-amount-corruption.ts  # write
 */

import { Prisma, PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const APPLY = process.env.APPLY === '1';
const RECONCILER_SOURCE = 'CLEARED_BY_CORRUPTION_RECONCILER_2026-05';

const FIELD_FLOORS = {
  averageAidPackage: 5000,
  averageNetPrice: 3000,
  roomAndBoard: 3000,
} as const;

type AmountField = keyof typeof FIELD_FLOORS;

const YEAR_LOW = 1900;
const YEAR_HIGH = 2100;

function looksLikeYear(value: number, field: AmountField): boolean {
  return value >= YEAR_LOW && value <= YEAR_HIGH && value < FIELD_FLOORS[field];
}

interface Suspect {
  schoolId: string;
  name: string;
  field: AmountField;
  value: number;
}

async function findSuspects(): Promise<Suspect[]> {
  const schools = await prisma.school.findMany({
    select: {
      id: true,
      name: true,
      averageAidPackage: true,
      averageNetPrice: true,
      roomAndBoard: true,
    },
  });

  const suspects: Suspect[] = [];

  for (const school of schools) {
    for (const field of Object.keys(FIELD_FLOORS) as AmountField[]) {
      const value = school[field];
      if (value != null && looksLikeYear(value, field)) {
        suspects.push({
          schoolId: school.id,
          name: school.name,
          field,
          value,
        });
      }
    }
  }

  return suspects;
}

async function apply(suspects: Suspect[]): Promise<void> {
  const now = new Date().toISOString();

  // Group by school so we do one update per school.
  const bySchool = new Map<string, Suspect[]>();
  for (const s of suspects) {
    const arr = bySchool.get(s.schoolId) ?? [];
    arr.push(s);
    bySchool.set(s.schoolId, arr);
  }

  for (const [schoolId, items] of bySchool) {
    const school = await prisma.school.findUnique({
      where: { id: schoolId },
      select: { metadata: true },
    });
    const metadata =
      school?.metadata && typeof school.metadata === 'object'
        ? JSON.parse(JSON.stringify(school.metadata))
        : {};
    metadata.provenance = metadata.provenance ?? {};

    const updates: Record<string, null> = {};
    for (const item of items) {
      updates[item.field] = null;
      metadata.provenance[item.field] = {
        source: RECONCILER_SOURCE,
        fetchedAt: now,
        notes:
          `Cleared corruption: prior value ${item.value} looked like a year. ` +
          `Re-fetch from CDS Section H and write via /admin/schools/rates/bulk-update.`,
      };
    }

    await prisma.school.update({
      where: { id: schoolId },
      data: {
        ...updates,
        metadata: metadata as Prisma.InputJsonValue,
      },
    });
  }
}

async function main() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('Financial-aid amount corruption cleanup');
  console.log(`Mode: ${APPLY ? '🔴 APPLY' : '🟢 DRY-RUN'}`);
  console.log('═══════════════════════════════════════════════════════\n');

  const suspects = await findSuspects();

  console.log(
    `Found ${suspects.length} suspect value(s) across ${
      new Set(suspects.map((s) => s.schoolId)).size
    } school(s).\n`,
  );

  // Per-field tally
  const byField = new Map<AmountField, number>();
  for (const s of suspects) {
    byField.set(s.field, (byField.get(s.field) ?? 0) + 1);
  }
  for (const [field, n] of byField) {
    console.log(`  - ${field}: ${n} corrupted value(s)`);
  }

  console.log('\nSample (first 15):');
  suspects
    .slice(0, 15)
    .forEach((s) => console.log(`    · ${s.name} | ${s.field} = ${s.value}`));

  if (!APPLY) {
    console.log('\nDry-run complete. Re-run with APPLY=1 to write changes.');
    return;
  }

  console.log('\nApplying...');
  await apply(suspects);
  console.log(`✓ Cleared ${suspects.length} corrupted value(s).\n`);
}

main()
  .catch((err) => {
    console.error('❌ Cleanup failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
