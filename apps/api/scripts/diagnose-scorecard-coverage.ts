/**
 * Scorecard Coverage Diagnostic
 *
 * Reports per-tier coverage of Scorecard-derived fields required by
 * ScorecardTeacherService (acceptanceRate + SAT/ACT percentiles).
 *
 * Usage:
 *   pnpm --filter api exec tsx scripts/diagnose-scorecard-coverage.ts
 *   pnpm --filter api exec tsx scripts/diagnose-scorecard-coverage.ts --tier=top50
 *   pnpm --filter api exec tsx scripts/diagnose-scorecard-coverage.ts --json
 */

import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface SchoolRow {
  id: string;
  name: string;
  usNewsRank: number | null;
  acceptanceRate: { toNumber: () => number } | null;
  sat25: number | null;
  sat75: number | null;
  satAvg: number | null;
  act25: number | null;
  act75: number | null;
  actAvg: number | null;
}

interface TierReport {
  tier: string;
  total: number;
  hasAcceptanceRate: number;
  hasSatPercentiles: number;
  hasActPercentiles: number;
  teacherEligible: number;
  coveragePct: number;
}

function hasNumber(v: unknown): boolean {
  if (typeof v === 'number') return v > 0;
  if (v && typeof v === 'object' && 'toNumber' in v) {
    return (v as { toNumber: () => number }).toNumber() > 0;
  }
  return false;
}

function isTeacherEligible(row: SchoolRow): boolean {
  const acceptance = hasNumber(row.acceptanceRate);
  const satOk = hasNumber(row.sat25) && hasNumber(row.sat75);
  const actOk = hasNumber(row.act25) && hasNumber(row.act75);
  return acceptance && (satOk || actOk);
}

function summarize(tier: string, rows: SchoolRow[]): TierReport {
  const total = rows.length;
  const hasAcceptanceRate = rows.filter((r) =>
    hasNumber(r.acceptanceRate),
  ).length;
  const hasSatPercentiles = rows.filter(
    (r) => hasNumber(r.sat25) && hasNumber(r.sat75),
  ).length;
  const hasActPercentiles = rows.filter(
    (r) => hasNumber(r.act25) && hasNumber(r.act75),
  ).length;
  const teacherEligible = rows.filter(isTeacherEligible).length;
  const coveragePct = total > 0 ? (teacherEligible / total) * 100 : 0;
  return {
    tier,
    total,
    hasAcceptanceRate,
    hasSatPercentiles,
    hasActPercentiles,
    teacherEligible,
    coveragePct,
  };
}

function tierOf(rank: number | null): string {
  if (rank === null) return 'unranked';
  if (rank <= 10) return 'T10';
  if (rank <= 30) return 'T30';
  if (rank <= 50) return 'T50';
  if (rank <= 100) return 'T100';
  return 'T100+';
}

async function main() {
  const args = process.argv.slice(2);
  const emitJson = args.includes('--json');
  const tierFilter = args
    .find((a) => a.startsWith('--tier='))
    ?.split('=')[1]
    ?.toLowerCase();

  const schools = (await prisma.school.findMany({
    select: {
      id: true,
      name: true,
      usNewsRank: true,
      acceptanceRate: true,
      sat25: true,
      sat75: true,
      satAvg: true,
      act25: true,
      act75: true,
      actAvg: true,
    },
  })) as SchoolRow[];

  const bucketed = new Map<string, SchoolRow[]>();
  for (const s of schools) {
    const t = tierOf(s.usNewsRank);
    if (!bucketed.has(t)) bucketed.set(t, []);
    bucketed.get(t)!.push(s);
  }

  const ORDER = ['T10', 'T30', 'T50', 'T100', 'T100+', 'unranked'];
  const reports = ORDER.filter((t) => bucketed.has(t)).map((t) =>
    summarize(t, bucketed.get(t)!),
  );

  if (tierFilter) {
    const filtered = reports.filter((r) => r.tier.toLowerCase() === tierFilter);
    if (filtered.length === 0) {
      console.error(`No tier matched: ${tierFilter}`);
      process.exit(1);
    }
  }

  const overall = summarize('ALL', schools);

  if (emitJson) {
    console.log(JSON.stringify({ overall, tiers: reports }, null, 2));
    await prisma.$disconnect();
    return;
  }

  console.log('\n=== Scorecard Teacher Coverage Report ===\n');
  console.log(
    'Tier       Total  AcceptRate   SAT%ile   ACT%ile   Eligible   Coverage%',
  );
  console.log(
    '----------------------------------------------------------------------',
  );
  for (const r of reports) {
    const row = [
      r.tier.padEnd(10),
      String(r.total).padStart(5),
      String(r.hasAcceptanceRate).padStart(11),
      String(r.hasSatPercentiles).padStart(9),
      String(r.hasActPercentiles).padStart(9),
      String(r.teacherEligible).padStart(10),
      `${r.coveragePct.toFixed(1).padStart(8)}%`,
    ].join('  ');
    console.log(row);
  }
  console.log(
    '----------------------------------------------------------------------',
  );
  console.log(
    [
      'ALL'.padEnd(10),
      String(overall.total).padStart(5),
      String(overall.hasAcceptanceRate).padStart(11),
      String(overall.hasSatPercentiles).padStart(9),
      String(overall.hasActPercentiles).padStart(9),
      String(overall.teacherEligible).padStart(10),
      `${overall.coveragePct.toFixed(1).padStart(8)}%`,
    ].join('  '),
  );

  const t50 = reports.find((r) => r.tier === 'T50');
  const t10 = reports.find((r) => r.tier === 'T10');
  console.log('\nGate status (Phase 2 → Phase 3):');
  console.log(
    `  T10 coverage ≥ 95%:  ${t10 ? (t10.coveragePct >= 95 ? 'PASS' : 'FAIL') : 'N/A (no T10 schools)'}`,
  );
  console.log(
    `  T50 coverage ≥ 95%:  ${t50 ? (t50.coveragePct >= 95 ? 'PASS' : 'FAIL') : 'N/A (no T50 schools)'}`,
  );
  console.log(
    `  Overall coverage ≥ 80%:  ${overall.coveragePct >= 80 ? 'PASS' : 'FAIL'}`,
  );

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  prisma.$disconnect().finally(() => process.exit(1));
});
