/**
 * Fix testingPolicy classification for US schools.
 *
 * Audit revealed: 187/240 US schools have testingPolicy=UNKNOWN, but ALL of
 * them have testOptional=true in the DB. Cross-checked against CDS-verified
 * REQUIRED/BLIND lists (MIT/Georgetown/UF/Purdue/UGA/GT already REQUIRED;
 * UC system already BLIND), so the UNKNOWN+testOptional=true bucket is safe
 * to map to OPTIONAL.
 *
 * Why this matters for prediction:
 * - BLIND schools (UC system) MUST ignore SAT/ACT — already implemented in
 *   features.ts isTestBlindSchool guard, but only fires when testingPolicy
 *   is correctly set.
 * - OPTIONAL schools trigger the test-optional 0.85x modifier at <20% admit
 *   rates (PR-14), but only when testingPolicy != UNKNOWN.
 * - Leaving 187 schools as UNKNOWN means SAT-less applicants there get no
 *   test-optional boost, and SAT-submitting applicants don't get the policy
 *   context they should.
 *
 * Usage:
 *   pnpm exec tsx scripts/fix-testing-policy.ts --dry-run
 *   pnpm exec tsx scripts/fix-testing-policy.ts        (live)
 */

import 'dotenv/config';
import { PrismaClient, TestingPolicy } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  console.log(`\n🛡️  Fix testingPolicy | ${dryRun ? 'DRY-RUN' : 'LIVE'}\n`);

  // Snapshot current distribution
  const before = await prisma.school.groupBy({
    by: ['testingPolicy'],
    where: { country: 'US' },
    _count: true,
  });
  console.log('Before:');
  before
    .sort((a, b) => b._count - a._count)
    .forEach((g) => console.log(`  ${g.testingPolicy}: ${g._count}`));

  // Find candidates: UNKNOWN + testOptional=true
  const candidates = await prisma.school.findMany({
    where: {
      country: 'US',
      testingPolicy: TestingPolicy.UNKNOWN,
      testOptional: true,
    },
    select: { id: true, name: true, testOptional: true },
  });

  console.log(`\nCandidates to fix: ${candidates.length}`);

  // Defensive: also handle UNKNOWN + testOptional=false → REQUIRED
  // (shouldn't exist per audit but check)
  const requiredCandidates = await prisma.school.findMany({
    where: {
      country: 'US',
      testingPolicy: TestingPolicy.UNKNOWN,
      testOptional: false,
    },
    select: { id: true, name: true },
  });

  if (requiredCandidates.length > 0) {
    console.log(
      `\n⚠️  Found ${requiredCandidates.length} UNKNOWN+testOptional=false:`,
    );
    requiredCandidates.forEach((s) => console.log(`     - ${s.name}`));
  }

  if (dryRun) {
    console.log('\n[DRY-RUN] Sample (first 5):');
    candidates
      .slice(0, 5)
      .forEach((c) => console.log(`  - ${c.name} → OPTIONAL`));
    console.log('\n⚠️  No DB writes. Re-run without --dry-run to apply.');
    await prisma.$disconnect();
    return;
  }

  // Live update — UNKNOWN + testOptional=true → OPTIONAL
  const optionalResult = await prisma.school.updateMany({
    where: {
      country: 'US',
      testingPolicy: TestingPolicy.UNKNOWN,
      testOptional: true,
    },
    data: { testingPolicy: TestingPolicy.OPTIONAL },
  });
  console.log(`\n✅ Updated ${optionalResult.count} schools to OPTIONAL`);

  // Defensive: UNKNOWN + testOptional=false → REQUIRED
  if (requiredCandidates.length > 0) {
    const requiredResult = await prisma.school.updateMany({
      where: {
        country: 'US',
        testingPolicy: TestingPolicy.UNKNOWN,
        testOptional: false,
      },
      data: { testingPolicy: TestingPolicy.REQUIRED },
    });
    console.log(`✅ Updated ${requiredResult.count} schools to REQUIRED`);
  }

  // Final distribution
  const after = await prisma.school.groupBy({
    by: ['testingPolicy'],
    where: { country: 'US' },
    _count: true,
  });
  console.log('\nAfter:');
  after
    .sort((a, b) => b._count - a._count)
    .forEach((g) => console.log(`  ${g.testingPolicy}: ${g._count}`));

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
