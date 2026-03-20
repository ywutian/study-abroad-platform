/**
 * Backfill script for data enrichment system
 *
 * - Existing AdmissionCase → reviewStatus = AUTO_APPROVED, source = 'legacy', compute qualityScore
 * - Existing School → dataReviewStatus = AUTO_APPROVED
 * - Current ADMIN accounts → upgrade to SUPER_ADMIN
 * - Initialize RolePermission table with default permissions
 *
 * Usage:
 *   pnpm exec ts-node --transpile-only scripts/backfill-review-fields.ts --dry-run
 *   pnpm exec ts-node --transpile-only scripts/backfill-review-fields.ts --apply
 */

import { PrismaClient, Role, DataReviewStatus } from '@prisma/client';

const prisma = new PrismaClient();
const isDryRun = !process.argv.includes('--apply');

// Default permissions per role
const DEFAULT_PERMISSIONS: Record<
  string,
  { OPERATOR: boolean; ADMIN: boolean }
> = {
  'case:create': { OPERATOR: true, ADMIN: true },
  'case:review': { OPERATOR: true, ADMIN: true },
  'case:delete': { OPERATOR: false, ADMIN: true },
  'school:edit': { OPERATOR: true, ADMIN: true },
  'school:review': { OPERATOR: false, ADMIN: true },
  'essay:manage': { OPERATOR: true, ADMIN: true },
  'scraper:trigger': { OPERATOR: false, ADMIN: true },
  'user:manage': { OPERATOR: false, ADMIN: true },
  'user:view': { OPERATOR: true, ADMIN: true },
  'content:moderate': { OPERATOR: false, ADMIN: true },
  'system:settings': { OPERATOR: false, ADMIN: false },
  'system:roles': { OPERATOR: false, ADMIN: false },
  'data:health': { OPERATOR: true, ADMIN: true },
  'data:export': { OPERATOR: false, ADMIN: true },
  'ai:config': { OPERATOR: false, ADMIN: true },
  'audit:view': { OPERATOR: false, ADMIN: true },
};

/**
 * Compute a simple quality score for a case based on filled fields
 */
function computeQualityScore(c: {
  schoolId: string | null;
  year: number | null;
  result: string | null;
  gpaRange: string | null;
  gpa9: number | null;
  gpa10: number | null;
  gpa11: number | null;
  satRange: string | null;
  actRange: string | null;
  round: string | null;
  major: string | null;
  tags: string[];
  essayContent: string | null;
  isVerified: boolean;
}): number {
  let score = 0;
  if (c.schoolId) score += 20;
  if (c.year) score += 10;
  if (c.result) score += 10;
  if (c.gpaRange || c.gpa9 || c.gpa10 || c.gpa11) score += 15;
  if (c.satRange || c.actRange) score += 15;
  if (c.round) score += 10;
  if (c.major) score += 10;
  if (c.tags && c.tags.length > 0) score += 5;
  if (c.essayContent) score += 5;
  // verified bonus
  if (c.isVerified) score = Math.min(100, Math.round(score * 1.2));
  return score;
}

async function main() {
  console.log(
    `\n🔄 Backfill data enrichment fields (${isDryRun ? 'DRY RUN' : 'APPLYING'})\n`,
  );

  // 1. Backfill AdmissionCase
  const cases = await prisma.admissionCase.findMany({
    select: {
      id: true,
      schoolId: true,
      year: true,
      result: true,
      gpaRange: true,
      gpa9: true,
      gpa10: true,
      gpa11: true,
      satRange: true,
      actRange: true,
      round: true,
      major: true,
      tags: true,
      essayContent: true,
      isVerified: true,
    },
  });
  console.log(`📋 Found ${cases.length} AdmissionCase records to backfill`);

  if (!isDryRun) {
    let updated = 0;
    for (const c of cases) {
      const qualityScore = computeQualityScore(c);
      await prisma.admissionCase.update({
        where: { id: c.id },
        data: {
          reviewStatus: DataReviewStatus.AUTO_APPROVED,
          source: 'legacy',
          qualityScore,
        },
      });
      updated++;
    }
    console.log(`  ✅ Updated ${updated} cases`);
  } else {
    const sample = cases.slice(0, 3).map((c) => ({
      id: c.id,
      qualityScore: computeQualityScore(c),
    }));
    console.log(`  Sample scores:`, sample);
  }

  // 2. Backfill School
  const schoolCount = await prisma.school.count();
  console.log(`\n🏫 Found ${schoolCount} School records to backfill`);
  if (!isDryRun) {
    await prisma.school.updateMany({
      data: { dataReviewStatus: DataReviewStatus.AUTO_APPROVED },
    });
    console.log(`  ✅ Updated ${schoolCount} schools`);
  }

  // 3. Upgrade ADMIN → SUPER_ADMIN
  const admins = await prisma.user.findMany({
    where: { role: Role.ADMIN },
    select: { id: true, email: true },
  });
  console.log(
    `\n👑 Found ${admins.length} ADMIN accounts to upgrade to SUPER_ADMIN`,
  );
  if (!isDryRun) {
    for (const admin of admins) {
      await prisma.user.update({
        where: { id: admin.id },
        data: { role: Role.SUPER_ADMIN },
      });
      console.log(`  ✅ Upgraded ${admin.email}`);
    }
  } else {
    admins.forEach((a) => console.log(`  Would upgrade: ${a.email}`));
  }

  // 4. Initialize RolePermission table
  const existingPerms = await prisma.rolePermission.count();
  console.log(`\n🔐 RolePermission table has ${existingPerms} entries`);

  if (existingPerms === 0) {
    const permEntries: { role: Role; permission: string; granted: boolean }[] =
      [];
    for (const [permission, roles] of Object.entries(DEFAULT_PERMISSIONS)) {
      permEntries.push({
        role: Role.OPERATOR,
        permission,
        granted: roles.OPERATOR,
      });
      permEntries.push({ role: Role.ADMIN, permission, granted: roles.ADMIN });
    }
    console.log(`  Will create ${permEntries.length} permission entries`);

    if (!isDryRun) {
      for (const entry of permEntries) {
        await prisma.rolePermission.create({ data: entry });
      }
      console.log(`  ✅ Created ${permEntries.length} permissions`);
    }
  } else {
    console.log(`  ⏭️ Skipping — already populated`);
  }

  console.log(`\n✅ Backfill ${isDryRun ? 'dry run' : 'complete'}!\n`);
}

main()
  .catch((e) => {
    console.error('❌ Backfill failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
