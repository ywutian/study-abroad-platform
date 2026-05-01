/**
 * Comprehensive College Scorecard Sync
 *
 * Pulls financial, outcomes, and campus fields that the original sync-schools.ts misses.
 * Targets fields currently at 0/240 coverage in DB:
 *   - salary6YrPostGrad  (earnings 6yr after entry)
 *   - averageNetPrice    (avg net price all income levels)
 *   - roomAndBoard       (on-campus room & board)
 *   - retentionRate      (4yr full-time retention)
 *   - studentFacultyRatio
 *   - monthlyLoanPayment (derived: median_debt / 120)
 *   - loanDefaultRate    (2yr cohort default rate)
 *   - totalEnrollment    (fill missing 53)
 *
 * Strategy:
 *   1. Schools with scorecardId → direct ID query (100% match)
 *   2. Schools without scorecardId → name search, save ID on first hit
 *
 * Usage:
 *   pnpm --filter api exec tsx scripts/sync-scorecard-comprehensive.ts
 *   pnpm --filter api exec tsx scripts/sync-scorecard-comprehensive.ts --dry-run
 *   pnpm --filter api exec tsx scripts/sync-scorecard-comprehensive.ts --limit=50
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import { PrismaClient, Prisma } from '@prisma/client';
import { normalizeSchoolName } from '../src/common/utils/school-name.util';

const prisma = new PrismaClient();
const API_KEY = process.env.COLLEGE_SCORECARD_API_KEY;
if (!API_KEY) {
  console.error('❌ COLLEGE_SCORECARD_API_KEY not set.');
  process.exit(1);
}

const BASE_URL = 'https://api.data.gov/ed/collegescorecard/v1/schools';
const SCORECARD_FIELDS = [
  'id',
  'school.name',
  // Financial
  'latest.cost.avg_net_price.overall',
  'latest.cost.avg_net_price.public',
  'latest.cost.avg_net_price.private',
  'latest.cost.roomboard.oncampus',
  'latest.cost.tuition.in_state',
  'latest.cost.tuition.out_of_state',
  // Aid
  'latest.aid.median_debt_suppressed.completers.overall',
  'latest.aid.pctpell',
  'latest.aid.federal_loan_rate',
  // Outcomes / earnings
  'latest.earnings.6_yrs_after_entry.median',
  'latest.earnings.10_yrs_after_entry.median',
  // Completion / retention
  'latest.completion.completion_rate_4yr_150nt',
  'latest.student.retention_rate.four_year.full_time',
  // Campus
  'latest.student.size',
  'latest.student.demographics.student_faculty_ratio',
  // Loan default (2yr CDR)
  'latest.repayment.1_yr_repayment.completers.rate',
  'latest.repayment.3_yr_repayment.completers.rate',
].join(',');

interface ScorecardResult {
  id: number;
  'school.name': string;
  'latest.cost.avg_net_price.overall': number | null;
  'latest.cost.avg_net_price.public': number | null;
  'latest.cost.avg_net_price.private': number | null;
  'latest.cost.roomboard.oncampus': number | null;
  'latest.cost.tuition.in_state': number | null;
  'latest.cost.tuition.out_of_state': number | null;
  'latest.aid.median_debt_suppressed.completers.overall': number | null;
  'latest.aid.pctpell': number | null;
  'latest.aid.federal_loan_rate': number | null;
  'latest.earnings.6_yrs_after_entry.median': number | null;
  'latest.earnings.10_yrs_after_entry.median': number | null;
  'latest.completion.completion_rate_4yr_150nt': number | null;
  'latest.student.retention_rate.four_year.full_time': number | null;
  'latest.student.size': number | null;
  'latest.student.demographics.student_faculty_ratio': number | null;
  'latest.repayment.1_yr_repayment.completers.rate': number | null;
  'latest.repayment.3_yr_repayment.completers.rate': number | null;
}

function toPercent(v: number | null): number | null {
  if (v === null || v === undefined) return null;
  // Scorecard rates are 0-1 decimal
  const pct = v * 100;
  return Math.round(pct * 100) / 100; // 2 decimal places
}

function toInt(v: number | null): number | null {
  if (v === null || v === undefined) return null;
  return Math.round(v);
}

function buildUpdate(sc: ScorecardResult): Prisma.SchoolUpdateInput {
  const update: Prisma.SchoolUpdateInput = {};

  // Salary 6yr
  const salary6yr = sc['latest.earnings.6_yrs_after_entry.median'];
  if (salary6yr && salary6yr > 0) update.salary6YrPostGrad = toInt(salary6yr);

  // Average net price
  const netPrice =
    sc['latest.cost.avg_net_price.overall'] ??
    sc['latest.cost.avg_net_price.public'] ??
    sc['latest.cost.avg_net_price.private'];
  if (netPrice && netPrice > 0) update.averageNetPrice = toInt(netPrice);

  // Room & board
  const roomBoard = sc['latest.cost.roomboard.oncampus'];
  if (roomBoard && roomBoard > 0) update.roomAndBoard = toInt(roomBoard);

  // Retention rate (decimal → percent)
  const retention = sc['latest.student.retention_rate.four_year.full_time'];
  if (retention !== null && retention > 0) {
    update.retentionRate = toPercent(retention) as any; // stored as Decimal
  }

  // Student-faculty ratio
  const sfRatio = sc['latest.student.demographics.student_faculty_ratio'];
  if (sfRatio && sfRatio > 0) update.studentFacultyRatio = toInt(sfRatio);

  // Monthly loan payment: median_debt / 120 (10-year standard repayment)
  const medianDebt = sc['latest.aid.median_debt_suppressed.completers.overall'];
  if (medianDebt && medianDebt > 0) {
    update.monthlyLoanPayment = Math.round(medianDebt / 120);
  }

  // Loan default rate — use 3yr repayment failure rate as proxy
  // (official CDR not directly in Scorecard v2, but 1yr/3yr repayment rates are)
  // loanDefaultRate here = 1 - 3yr_repayment_rate (those NOT repaying)
  const repay3yr = sc['latest.repayment.3_yr_repayment.completers.rate'];
  if (repay3yr !== null && repay3yr >= 0) {
    const defaultProxy = (1 - repay3yr) * 100;
    update.loanDefaultRate = (Math.round(defaultProxy * 100) / 100) as any;
  }

  // Total enrollment
  const size = sc['latest.student.size'];
  if (size && size > 0) update.totalEnrollment = toInt(size);

  // Store scorecard ID
  update.scorecardId = String(sc.id);

  return update;
}

async function fetchById(scorecardId: string): Promise<ScorecardResult | null> {
  const url = `${BASE_URL}?api_key=${API_KEY}&id=${scorecardId}&fields=${SCORECARD_FIELDS}`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const data = await res.json();
  return data.results?.[0] ?? null;
}

async function fetchByName(name: string): Promise<ScorecardResult | null> {
  const encoded = encodeURIComponent(name);
  const url = `${BASE_URL}?api_key=${API_KEY}&school.name=${encoded}&school.operating=1&school.degrees_awarded.predominant=3&fields=${SCORECARD_FIELDS}&per_page=3`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const data = await res.json();
  const results: ScorecardResult[] = data.results ?? [];
  if (results.length === 0) return null;

  // Pick closest name match
  const normTarget = normalizeSchoolName(name);
  const sorted = results.sort((a, b) => {
    const da = editDistance(normalizeSchoolName(a['school.name']), normTarget);
    const db = editDistance(normalizeSchoolName(b['school.name']), normTarget);
    return da - db;
  });
  const best = sorted[0];
  const dist = editDistance(
    normalizeSchoolName(best['school.name']),
    normTarget,
  );
  if (dist > 10) return null; // Too different — skip
  return best;
}

function editDistance(a: string, b: string): number {
  const m = a.length,
    n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)),
  );
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
  return dp[m][n];
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const limitArg = args.find((a) => a.startsWith('--limit='));
  const limit = limitArg ? parseInt(limitArg.split('=')[1]) : 999;
  const onlyMissing = args.includes('--only-missing');

  console.log(`\n🚀 Comprehensive Scorecard Sync`);
  console.log(
    `   Mode: ${dryRun ? 'DRY-RUN' : 'LIVE'} | Limit: ${limit} | Only-missing: ${onlyMissing}`,
  );
  console.log(
    `   Fields: salary6yr, netPrice, roomBoard, retention, sfRatio, monthlyLoan, loanDefault, enrollment\n`,
  );

  const where: Prisma.SchoolWhereInput = { country: 'US' };
  if (onlyMissing) {
    where.OR = [
      { salary6YrPostGrad: null },
      { averageNetPrice: null },
      { roomAndBoard: null },
      { retentionRate: null },
      { studentFacultyRatio: null },
    ];
  }

  const schools = await prisma.school.findMany({
    where,
    select: { id: true, name: true, scorecardId: true },
    orderBy: [{ usNewsRank: 'asc' }, { name: 'asc' }],
    take: limit,
  });

  console.log(`Found ${schools.length} schools to process\n`);

  const stats = { found: 0, updated: 0, notFound: 0, errors: 0, skipped: 0 };
  const fieldFills: Record<string, number> = {};

  for (let i = 0; i < schools.length; i++) {
    const school = schools[i];
    const prefix = `[${i + 1}/${schools.length}] ${school.name}`;

    try {
      // Fetch from Scorecard
      let sc: ScorecardResult | null = null;
      if (school.scorecardId) {
        sc = await fetchById(school.scorecardId);
      } else {
        sc = await fetchByName(school.name);
      }

      if (!sc) {
        console.log(`  ⚠️  ${prefix} → not found`);
        stats.notFound++;
        continue;
      }

      const update = buildUpdate(sc);
      const filledFields = Object.keys(update).filter(
        (k) => k !== 'scorecardId',
      );

      if (filledFields.length === 0) {
        console.log(`  ○  ${prefix} → no new data`);
        stats.skipped++;
        continue;
      }

      // Track per-field counts
      for (const f of filledFields) {
        fieldFills[f] = (fieldFills[f] ?? 0) + 1;
      }

      if (!dryRun) {
        await prisma.school.update({ where: { id: school.id }, data: update });
      }

      stats.found++;
      stats.updated++;
      console.log(`  ✅ ${prefix} → ${filledFields.join(', ')}`);
    } catch (err: unknown) {
      stats.errors++;
      console.error(
        `  ❌ ${prefix} → ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    // Rate limiting: 5 req/sec max for Scorecard API
    await new Promise((r) => setTimeout(r, 220));
  }

  console.log('\n=== RESULTS ===');
  console.log(`  Found:    ${stats.found}`);
  console.log(`  Updated:  ${stats.updated}`);
  console.log(`  Not found: ${stats.notFound}`);
  console.log(`  Skipped:  ${stats.skipped}`);
  console.log(`  Errors:   ${stats.errors}`);

  console.log('\n=== FIELDS FILLED ===');
  for (const [field, count] of Object.entries(fieldFills).sort(
    (a, b) => b[1] - a[1],
  )) {
    console.log(`  ${field}: ${count}/${schools.length}`);
  }

  if (dryRun) {
    console.log(
      '\n⚠️  DRY-RUN: no DB writes made. Re-run without --dry-run to apply.',
    );
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
