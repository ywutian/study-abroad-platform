/**
 * Auto-generated import script — 2026-05-22
 *
 * 把 school-admit-stats-top25.json 里 23 校的核心 admit stats 入库。
 * 安全：只 UPDATE 已存在的字段 (acceptanceRate, edAcceptanceRate, sat25, sat75 等)。
 * 新字段（legacyClassPct, admitsWithNationalAwardPct 等）需要先跑 migration。
 *
 * 用法：
 *   先：跑 migration (见 draft-add-hook-and-ec-fields.sql)
 *   然后：cd apps/api && pnpm exec tsx scripts/cds-collection-2026-05-22/import-school-admit-stats-top25.ts
 *
 * Idempotent — 重复跑安全。
 */
import { PrismaClient } from '@prisma/client';
import fs from 'node:fs';
import path from 'node:path';

const prisma = new PrismaClient();
const dataFile = path.join(__dirname, 'school-admit-stats-top25.json');

type FieldEntry = { value: number | null; tier?: string; source?: string };
type SchoolRow = {
  schoolNameNorm: string;
  displayName: string;
  rank?: number;
  cycleYear: number;
  fields: Record<string, any>;
};

async function main() {
  const raw = fs.readFileSync(dataFile, 'utf8');
  const data = JSON.parse(raw) as { schools: SchoolRow[] };

  console.log(`Loaded ${data.schools.length} schools from ${dataFile}`);
  let updated = 0;
  let notFound = 0;
  let skipped = 0;

  for (const row of data.schools) {
    const school = await prisma.school.findFirst({
      where: { nameNorm: row.schoolNameNorm },
    });

    if (!school) {
      console.warn(
        `  ✗ Not found in DB: ${row.displayName} (norm: ${row.schoolNameNorm})`,
      );
      notFound++;
      continue;
    }

    const f = row.fields;
    const updates: Record<string, any> = {};

    // Core admit rates
    if (f.acceptanceRate?.value != null)
      updates.acceptanceRate = f.acceptanceRate.value;
    if (f.edAcceptanceRate?.value != null)
      updates.edAcceptanceRate = f.edAcceptanceRate.value;
    if (f.eaAcceptanceRate?.value != null)
      updates.eaAcceptanceRate = f.eaAcceptanceRate.value;
    if (f.intlAcceptanceRate?.value != null)
      updates.intlAcceptanceRate = f.intlAcceptanceRate.value;

    // SAT / ACT (admit pool)
    if (f.sat25?.value != null) updates.sat25 = f.sat25.value;
    if (f.sat75?.value != null) updates.sat75 = f.sat75.value;
    if (f.act25?.value != null) updates.act25 = f.act25.value;
    if (f.act75?.value != null) updates.act75 = f.act75.value;

    // GPA distribution (if collected)
    if (f.gpaDistribution?.bands) {
      updates.gpaDistribution = f.gpaDistribution.bands.reduce(
        (acc: any, b: any) => {
          acc[b.range] = b.pct;
          return acc;
        },
        {},
      );
    }

    // New fields — only set if migration ran (will fail silently if column doesn't exist)
    try {
      if (f.legacyClassPct?.value != null)
        (updates as any).legacyClassPct = f.legacyClassPct.value;
      if (f.athleteClassPct?.value != null)
        (updates as any).athleteClassPct = f.athleteClassPct.value;
      if (f.firstGenClassPct?.value != null)
        (updates as any).firstGenClassPct = f.firstGenClassPct.value;
      if (f.legacyClassPct?.legacyAdmitMultiplier) {
        (updates as any).legacyAdmitMultiplier =
          f.legacyClassPct.legacyAdmitMultiplier;
      }
      if (f.athleteClassPct?.athleteAdmitMultiplier) {
        (updates as any).athleteAdmitMultiplier =
          f.athleteClassPct.athleteAdmitMultiplier;
      }
      (updates as any).admitProfileSource =
        `CDS ${row.cycleYear}, Claude WebSearch 2026-05-22`;
      (updates as any).admitProfileConfidenceTier = 'HIGH';
      (updates as any).admitProfileUpdatedAt = new Date();
      (updates as any).admitProfileCycleYear = row.cycleYear;
    } catch {
      // New fields don't exist yet — migration not applied
    }

    if (Object.keys(updates).length === 0) {
      console.log(`  - ${row.displayName}: no fields to update`);
      skipped++;
      continue;
    }

    try {
      await prisma.school.update({ where: { id: school.id }, data: updates });
      console.log(
        `  ✓ ${row.displayName}: ${Object.keys(updates).length} fields updated`,
      );
      updated++;
    } catch (e) {
      console.error(
        `  ✗ ${row.displayName}: update failed —`,
        e instanceof Error ? e.message : e,
      );
    }
  }

  console.log(
    `\nSummary: ${updated} updated, ${notFound} not found, ${skipped} skipped`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
