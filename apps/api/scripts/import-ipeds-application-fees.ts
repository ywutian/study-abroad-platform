/**
 * Import Application Fees from IPEDS IC2023_RV.csv
 *
 * The College Scorecard `id` field == IPEDS UNITID, so we match via `scorecardId`.
 * APPLFEEU = undergraduate application fee (what we want)
 *
 * Data file: https://nces.ed.gov/ipeds/datacenter/data/IC2023.zip
 * (already downloaded to /tmp/IC2023_RV.csv)
 *
 * Usage:
 *   pnpm --filter api exec tsx scripts/import-ipeds-application-fees.ts
 *   pnpm --filter api exec tsx scripts/import-ipeds-application-fees.ts --dry-run
 *   pnpm --filter api exec tsx scripts/import-ipeds-application-fees.ts --csv /path/to/IC2023_RV.csv
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function parseIpedsCsv(csvPath: string): Map<string, number> {
  const content = fs.readFileSync(csvPath, 'utf-8');
  // Strip BOM if present
  const lines = content.replace(/^\uFEFF/, '').split('\n');
  const headers = lines[0].split(',').map((h) => h.trim());

  const unitidIdx = headers.findIndex((h) => h === 'UNITID');
  const feeIdx = headers.findIndex((h) => h === 'APPLFEEU');

  if (unitidIdx === -1 || feeIdx === -1) {
    throw new Error(
      `Could not find UNITID (${unitidIdx}) or APPLFEEU (${feeIdx}) in CSV headers`,
    );
  }

  const feeMap = new Map<string, number>();

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const cols = line.split(',');
    const unitid = cols[unitidIdx]?.trim();
    const feeStr = cols[feeIdx]?.trim();
    if (!unitid || !feeStr || feeStr === '' || feeStr === '.') continue;
    const fee = parseInt(feeStr, 10);
    if (!isNaN(fee) && fee >= 0) {
      feeMap.set(unitid, fee);
    }
  }

  return feeMap;
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const csvArg = args.find((a) => a.startsWith('--csv='));
  const csvPath = csvArg ? csvArg.split('=')[1] : '/tmp/IC2023_RV.csv';

  console.log(`\n🚀 IPEDS Application Fee Import`);
  console.log(`   CSV: ${csvPath}`);
  console.log(`   Mode: ${dryRun ? 'DRY-RUN' : 'LIVE'}\n`);

  if (!fs.existsSync(csvPath)) {
    console.error(`❌ CSV not found at ${csvPath}`);
    console.error(
      `   Download from: https://nces.ed.gov/ipeds/datacenter/data/IC2023.zip`,
    );
    process.exit(1);
  }

  // Parse CSV
  console.log('Parsing IPEDS CSV...');
  const feeMap = parseIpedsCsv(csvPath);
  console.log(`  Loaded ${feeMap.size} UNITID → fee mappings\n`);

  // Load US schools
  const schools = await prisma.school.findMany({
    where: { country: 'US' },
    select: {
      id: true,
      name: true,
      scorecardId: true,
      ipedsId: true,
      applicationFee: true,
    },
    orderBy: [{ usNewsRank: 'asc' }, { name: 'asc' }],
  });

  console.log(`Found ${schools.length} US schools\n`);

  const stats = {
    found: 0,
    updated: 0,
    noId: 0,
    noFeeData: 0,
    alreadySet: 0,
    zeroFee: 0,
  };
  const notFound: string[] = [];

  for (const school of schools) {
    // Prefer scorecardId (= IPEDS UNITID), fallback to ipedsId
    const unitid = school.scorecardId ?? school.ipedsId ?? null;

    if (!unitid) {
      console.log(
        `  ⚠️  ${school.name} → no UNITID (no scorecardId or ipedsId)`,
      );
      stats.noId++;
      notFound.push(school.name);
      continue;
    }

    const fee = feeMap.get(unitid);

    if (fee === undefined) {
      console.log(
        `  ⚠️  ${school.name} (UNITID=${unitid}) → not in IPEDS data`,
      );
      stats.noFeeData++;
      notFound.push(school.name);
      continue;
    }

    if (fee === 0) {
      // Some schools have $0 application fee (e.g., some state schools)
      console.log(`  ○  ${school.name} → fee=$0 (free to apply)`);
      stats.zeroFee++;
    }

    stats.found++;

    if (!dryRun) {
      await prisma.school.update({
        where: { id: school.id },
        data: { applicationFee: fee },
      });
    }

    stats.updated++;
    console.log(`  ✅ ${school.name} → $${fee}`);
  }

  console.log('\n=== RESULTS ===');
  console.log(`  Found in IPEDS: ${stats.found}`);
  console.log(`  Updated:        ${stats.updated}`);
  console.log(`  $0 fee schools: ${stats.zeroFee}`);
  console.log(`  No UNITID:      ${stats.noId}`);
  console.log(`  Not in IPEDS:   ${stats.noFeeData}`);

  if (notFound.length > 0) {
    console.log(`\nSchools not updated (${notFound.length}):`);
    notFound.forEach((n) => console.log(`  - ${n}`));
  }

  if (dryRun) {
    console.log(
      '\n⚠️  DRY-RUN: no DB writes. Re-run without --dry-run to apply.',
    );
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
