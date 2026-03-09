import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Seed SchoolCalibration rows for schools where the prediction model
 * consistently over- or under-estimates admission probability.
 *
 * multiplier > 1.0 → boost probability (model is too pessimistic)
 * multiplier < 1.0 → reduce probability (model is too optimistic)
 */
const calibrations = [
  {
    schoolName: 'Boston University',
    multiplier: 1.18,
    reason:
      'Model consistently underestimates BU admission probability relative to peer schools',
  },
  {
    schoolName: 'Northeastern University',
    multiplier: 1.1,
    reason: 'Model slightly underestimates admission probability',
  },
  {
    schoolName: 'University of Wisconsin-Madison',
    multiplier: 1.08,
    reason:
      'Model slightly pessimistic for out-of-state international applicants',
  },
  {
    schoolName: 'Penn State University',
    multiplier: 1.12,
    reason: 'Model underestimates for main campus admission probability',
  },
  {
    schoolName: 'Purdue University',
    multiplier: 1.1,
    reason: 'Model slightly pessimistic for international CS applicants',
  },
];

async function main() {
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
