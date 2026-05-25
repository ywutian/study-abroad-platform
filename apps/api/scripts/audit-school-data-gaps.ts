#!/usr/bin/env tsx
/**
 * Audit School data completeness across all fields the counselor engine reads.
 *
 * Output: markdown report grouped by tier × gap type so we can prioritize
 * backfill work.
 *
 * Engine field criticality (per counselor-engine.service.ts + modifiers):
 *   - HIGH (anchor):     acceptanceRate, sat25, sat75, satAvg
 *   - HIGH (CDS bands):  separate table SchoolCdsAdmitBand
 *   - HIGH (modifiers):  oosAcceptanceRate, intlAcceptanceRate,
 *                        edAcceptanceRate, eaAcceptanceRate, testingPolicy
 *   - MED (hooks):       legacyAdmitMultiplier, athleteAdmitMultiplier,
 *                        legacyClassPct, athleteClassPct, firstGenClassPct
 *   - MED (profile ctx): gpaDistribution, admitsWithNationalAwardPct, etc.
 *   - LOW (display):     yieldRate, usNewsRank, etc.
 */

import { PrismaClient } from '@prisma/client';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

interface SchoolGapRow {
  rank: number | null;
  name: string;
  nameNorm: string;
  // HIGH — engine anchor
  acceptanceRate: boolean;
  sat25: boolean;
  sat75: boolean;
  satAvg: boolean;
  cdsBands: number; // count
  // HIGH — modifiers
  oosAcceptanceRate: boolean;
  intlAcceptanceRate: boolean;
  edAcceptanceRate: boolean;
  eaAcceptanceRate: boolean;
  testingPolicy: boolean;
  needBlindIntl: boolean;
  // MED — hooks
  legacyAdmitMult: boolean;
  athleteAdmitMult: boolean;
  legacyClassPct: boolean;
  athleteClassPct: boolean;
  firstGenClassPct: boolean;
  // MED — profile context
  gpaDistribution: boolean;
  admitsWithNationalAwardPct: boolean;
  admitsWithResearchPct: boolean;
}

const fieldExists = (v: unknown) =>
  v !== null && v !== undefined && (typeof v !== 'string' || v.trim() !== '');

async function main() {
  const prisma = new PrismaClient();

  // Pull schools sorted by US News rank (top first)
  const schools = await prisma.school.findMany({
    where: { country: 'US' },
    orderBy: [{ usNewsRank: 'asc' }, { name: 'asc' }],
    select: {
      name: true,
      nameNorm: true,
      usNewsRank: true,
      acceptanceRate: true,
      sat25: true,
      sat75: true,
      satAvg: true,
      oosAcceptanceRate: true,
      intlAcceptanceRate: true,
      edAcceptanceRate: true,
      eaAcceptanceRate: true,
      testingPolicy: true,
      needBlindInternational: true,
      legacyAdmitMultiplier: true,
      athleteAdmitMultiplier: true,
      legacyClassPct: true,
      athleteClassPct: true,
      firstGenClassPct: true,
      gpaDistribution: true,
      admitsWithNationalAwardPct: true,
      admitsWithResearchPct: true,
    },
  });

  // CDS band counts per school (separate table)
  const cdsBandCounts = await prisma.schoolCdsAdmitBand.groupBy({
    by: ['schoolId'],
    _count: { _all: true },
  });
  const cdsBandMap = new Map(
    cdsBandCounts.map((r) => [r.schoolId, r._count._all]),
  );
  const schoolIdRows = await prisma.school.findMany({
    where: { nameNorm: { in: schools.map((s) => s.nameNorm) } },
    select: { id: true, nameNorm: true },
  });
  const schoolIdByNorm = new Map(schoolIdRows.map((s) => [s.nameNorm, s.id]));

  const rows: SchoolGapRow[] = schools.map((s) => ({
    rank: s.usNewsRank,
    name: s.name,
    nameNorm: s.nameNorm,
    acceptanceRate: fieldExists(s.acceptanceRate),
    sat25: fieldExists(s.sat25),
    sat75: fieldExists(s.sat75),
    satAvg: fieldExists(s.satAvg),
    cdsBands: cdsBandMap.get(schoolIdByNorm.get(s.nameNorm) ?? '') ?? 0,
    oosAcceptanceRate: fieldExists(s.oosAcceptanceRate),
    intlAcceptanceRate: fieldExists(s.intlAcceptanceRate),
    edAcceptanceRate: fieldExists(s.edAcceptanceRate),
    eaAcceptanceRate: fieldExists(s.eaAcceptanceRate),
    testingPolicy:
      fieldExists(s.testingPolicy) && s.testingPolicy !== 'UNKNOWN',
    needBlindIntl: s.needBlindInternational !== null,
    legacyAdmitMult: fieldExists(s.legacyAdmitMultiplier),
    athleteAdmitMult: fieldExists(s.athleteAdmitMultiplier),
    legacyClassPct: fieldExists(s.legacyClassPct),
    athleteClassPct: fieldExists(s.athleteClassPct),
    firstGenClassPct: fieldExists(s.firstGenClassPct),
    gpaDistribution: fieldExists(s.gpaDistribution),
    admitsWithNationalAwardPct: fieldExists(s.admitsWithNationalAwardPct),
    admitsWithResearchPct: fieldExists(s.admitsWithResearchPct),
  }));

  // Summarize by tier band
  const tiers: Array<{ label: string; min: number; max: number }> = [
    { label: 'T10', min: 1, max: 10 },
    { label: 'T11-25', min: 11, max: 25 },
    { label: 'T26-50', min: 26, max: 50 },
    { label: 'T51-100', min: 51, max: 100 },
    { label: 'T100+/unranked', min: 101, max: Number.POSITIVE_INFINITY },
  ];

  const summary: Record<string, Record<string, number>> = {};
  for (const tier of tiers) {
    const tierRows = rows.filter(
      (r) =>
        (r.rank ?? Number.POSITIVE_INFINITY) >= tier.min &&
        (r.rank ?? Number.POSITIVE_INFINITY) <= tier.max,
    );
    summary[tier.label] = {
      total: tierRows.length,
      'missing-acceptanceRate': tierRows.filter((r) => !r.acceptanceRate)
        .length,
      'missing-SAT-bands': tierRows.filter((r) => !r.sat25 || !r.sat75).length,
      'missing-cds-bands': tierRows.filter((r) => r.cdsBands === 0).length,
      'missing-oosAcceptanceRate': tierRows.filter((r) => !r.oosAcceptanceRate)
        .length,
      'missing-intlAcceptanceRate': tierRows.filter(
        (r) => !r.intlAcceptanceRate,
      ).length,
      'missing-edAcceptanceRate': tierRows.filter((r) => !r.edAcceptanceRate)
        .length,
      'missing-eaAcceptanceRate': tierRows.filter((r) => !r.eaAcceptanceRate)
        .length,
      'missing-testingPolicy': tierRows.filter((r) => !r.testingPolicy).length,
      'missing-needBlindIntl': tierRows.filter((r) => !r.needBlindIntl).length,
      'missing-legacyAdmitMult': tierRows.filter((r) => !r.legacyAdmitMult)
        .length,
      'missing-athleteAdmitMult': tierRows.filter((r) => !r.athleteAdmitMult)
        .length,
      'missing-legacyClassPct': tierRows.filter((r) => !r.legacyClassPct)
        .length,
      'missing-firstGenClassPct': tierRows.filter((r) => !r.firstGenClassPct)
        .length,
      'missing-gpaDistribution': tierRows.filter((r) => !r.gpaDistribution)
        .length,
    };
  }

  // Worklist: top 50 schools with their biggest gaps
  const worklist = rows
    .filter((r) => (r.rank ?? 999) <= 50)
    .map((r) => {
      const missing: string[] = [];
      if (!r.acceptanceRate) missing.push('acceptanceRate ⚠️ CRITICAL');
      if (!r.sat25 || !r.sat75) missing.push('SAT 25/75');
      if (!r.oosAcceptanceRate) missing.push('oosAcceptanceRate');
      if (!r.intlAcceptanceRate) missing.push('intlAcceptanceRate');
      if (!r.edAcceptanceRate) missing.push('edAcceptanceRate');
      if (!r.eaAcceptanceRate) missing.push('eaAcceptanceRate');
      if (!r.testingPolicy) missing.push('testingPolicy');
      if (!r.needBlindIntl) missing.push('needBlindIntl');
      if (!r.legacyAdmitMult) missing.push('legacyAdmitMultiplier');
      if (!r.athleteAdmitMult) missing.push('athleteAdmitMultiplier');
      if (!r.legacyClassPct) missing.push('legacyClassPct');
      if (!r.firstGenClassPct) missing.push('firstGenClassPct');
      if (!r.gpaDistribution) missing.push('gpaDistribution');
      if (r.cdsBands === 0) missing.push('cdsBands');
      return { name: r.name, rank: r.rank, missing };
    })
    .filter((r) => r.missing.length > 0)
    .sort((a, b) => (a.rank ?? 999) - (b.rank ?? 999));

  // Build markdown
  const lines: string[] = [];
  lines.push(`# School Data Gap Audit — ${new Date().toISOString()}`);
  lines.push('');
  lines.push(`Total US schools in DB: **${rows.length}**`);
  lines.push('');
  lines.push('## §1 Missing-field counts by tier');
  lines.push('');
  const allKeys = Object.keys(summary[tiers[0].label]).filter(
    (k) => k !== 'total',
  );
  lines.push(`| Field | ${tiers.map((t) => t.label).join(' | ')} |`);
  lines.push(`|---|${tiers.map(() => '---').join('|')}|`);
  lines.push(
    `| (total schools) | ${tiers.map((t) => summary[t.label].total).join(' | ')} |`,
  );
  allKeys.forEach((k) => {
    const cells = tiers.map((t) => {
      const total = summary[t.label].total;
      const missing = summary[t.label][k];
      if (total === 0) return '—';
      const pct = ((missing / total) * 100).toFixed(0);
      const flag =
        missing === 0
          ? '✅'
          : missing === total
            ? '❌'
            : pct === '100'
              ? '❌'
              : Number(pct) > 50
                ? '⚠️'
                : '';
      return `${missing}/${total} ${flag}`;
    });
    lines.push(`| ${k} | ${cells.join(' | ')} |`);
  });
  lines.push('');

  // Top-50 worklist
  lines.push(`## §2 Top-50 worklist — ${worklist.length} schools have gaps`);
  lines.push('');
  if (worklist.length === 0) {
    lines.push('No gaps in top-50!');
  } else {
    lines.push('| Rank | School | Missing fields |');
    lines.push('|---|---|---|');
    for (const w of worklist) {
      lines.push(`| ${w.rank ?? '—'} | ${w.name} | ${w.missing.join(', ')} |`);
    }
  }
  lines.push('');

  // Specific schools I tested with gaps
  lines.push(
    '## §3 Schools from comprehensive matrix with KNOWN engine impact',
  );
  lines.push('');
  const tested = [
    'university of michigan, ann arbor',
    'university of north carolina at chapel hill',
    'williams college',
    'amherst college',
  ];
  for (const norm of tested) {
    const r = rows.find((row) => row.nameNorm === norm);
    if (!r) continue;
    const issues: string[] = [];
    if (!r.acceptanceRate) issues.push('❌ acceptanceRate');
    if (!r.sat25) issues.push('SAT25 missing');
    if (!r.oosAcceptanceRate) issues.push('oosAcceptanceRate');
    if (!r.intlAcceptanceRate) issues.push('intlAcceptanceRate');
    if (!r.edAcceptanceRate) issues.push('edAcceptanceRate');
    if (!r.eaAcceptanceRate) issues.push('eaAcceptanceRate');
    if (!r.legacyAdmitMult) issues.push('legacyAdmitMult');
    if (!r.athleteAdmitMult) issues.push('athleteAdmitMult');
    if (!r.gpaDistribution) issues.push('gpaDistribution');
    if (r.cdsBands === 0) issues.push('cdsBands');
    lines.push(
      `- **${r.name}** (rank ${r.rank ?? '—'}): ${issues.length === 0 ? '✅ no gaps' : issues.join(', ')}`,
    );
  }
  lines.push('');

  const outDir = resolve(__dirname, '..', 'verification-report');
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const mdPath = `${outDir}/school-data-gaps-${ts}.md`;
  const jsonPath = `${outDir}/school-data-gaps-${ts}.json`;
  writeFileSync(mdPath, lines.join('\n'), 'utf8');
  writeFileSync(
    jsonPath,
    JSON.stringify({ summary, worklist, allRows: rows }, null, 2),
    'utf8',
  );
  console.log(
    `\nAudited ${rows.length} schools, ${worklist.length} top-50 schools with gaps.`,
  );
  console.log(`Report: ${mdPath}\n`);

  await prisma.$disconnect();
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
