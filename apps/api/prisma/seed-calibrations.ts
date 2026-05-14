import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Seed SchoolCalibration rows.
 *
 * ──────────────────────────────────────────────────────────────────────────
 * POLICY (2026-05): No per-school multipliers are seeded by default.
 * ──────────────────────────────────────────────────────────────────────────
 *
 * Background:
 *   Earlier versions seeded multipliers for 5 schools (BU 1.18, NEU 1.10,
 *   UW-Madison 1.08, Penn State 1.12, Purdue 1.10) with the rationale
 *   "model consistently underestimates these schools".
 *
 * Why removed:
 *   1. No verified-sample backing. The "underestimates" claim was qualitative
 *      observation, not a measurement on calibration-eligible outcomes.
 *   2. Subgroup bias. Any signal that did exist was filtered through this
 *      platform's user base (heavy CN-applicant skew, self-selected
 *      survivorship). Applying that skew as a *global* multiplier corrupts
 *      predictions for non-overlapping subgroups (e.g. domestic applicants).
 *   3. Sample size & subgroup composition cannot fix #2 — even a 10k-sample
 *      pool from this platform reflects only its own population, not the
 *      full applicant pool that the school's official acceptance rate covers.
 *
 * When to add a calibration entry back:
 *   - It MUST be supported by a data source that covers the *full applicant
 *     pool* of that school (e.g. CDS Section C, IPEDS, NACAC research),
 *     not by inferences drawn from this platform's user data.
 *   - Per-platform-user calibration belongs in a *subgroup-conditioned* layer
 *     (e.g. "CN-applicant multiplier per school"), not in this global table.
 *   - See docs/PREDICTION_ACCURACY_STRATEGY.md for the decision record.
 *
 * Operational note:
 *   Production environments that previously had the 5 rows persisted need a
 *   one-time cleanup. Run:
 *     DELETE FROM "SchoolCalibration"
 *     WHERE "reason" LIKE 'Model %estimates%';
 *   (or use the admin UI at /admin/calibrations to clear them.)
 */
const calibrations: Array<{
  schoolName: string;
  multiplier: number;
  reason: string;
}> = [];

async function main() {
  if (calibrations.length === 0) {
    console.log(
      'No SchoolCalibration entries to seed (intentional — see file header).',
    );
    return;
  }

  console.log('Seeding SchoolCalibration data...');

  let upserted = 0;
  let skipped = 0;

  for (const cal of calibrations) {
    const school = await prisma.school.findFirst({
      where: { name: { contains: cal.schoolName, mode: 'insensitive' } },
      select: { id: true, name: true },
    });

    if (!school) {
      console.warn(`  ⚠ School not found: ${cal.schoolName} — skipping`);
      skipped++;
      continue;
    }

    await prisma.schoolCalibration.upsert({
      where: { schoolId: school.id },
      create: {
        schoolId: school.id,
        multiplier: cal.multiplier,
        reason: cal.reason,
      },
      update: {
        multiplier: cal.multiplier,
        reason: cal.reason,
      },
    });

    console.log(`  ✓ ${school.name} → multiplier=${cal.multiplier}`);
    upserted++;
  }

  console.log(`\nDone: ${upserted} upserted, ${skipped} skipped.`);
}

main()
  .catch((e) => {
    console.error('Seed calibration failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
