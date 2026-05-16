#!/usr/bin/env tsx
/**
 * progress-report.ts — Live data progress dashboard for prediction closure.
 *
 * Pulls from DB + ledger and prints a dense, dashboard-style report:
 *   - Per-field closure stats
 *   - Per-source tier breakdown
 *   - Per-batch throughput
 *   - Top corrections (largest value deltas vs LEGACY)
 *   - Per-rank-band coverage
 *   - DB integrity warnings (duplicates, schema drift, etc.)
 *
 * Usage: tsx apps/api/scripts/closure-agents/progress-report.ts [--md > report.md]
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { PrismaClient, Prisma } from '@prisma/client';
import { buildNormalizedSchoolProvenance } from '../../src/modules/school/school-provenance.helpers';
import { toSchoolFieldSource } from '@study-abroad/shared/utils';

const prisma = new PrismaClient();

const FIELDS = [
  'acceptanceRate',
  'sat25',
  'sat75',
  'intlAcceptanceRate',
  'oosAcceptanceRate',
  'edAcceptanceRate',
  'eaAcceptanceRate',
] as const;

const CLOSURE_TIERS = new Set([
  'OFFICIAL',
  'PARTNER',
  'UNAVAILABLE',
  'SCRAPED',
]);
const PURE_TIERS = new Set(['OFFICIAL', 'PARTNER', 'UNAVAILABLE']);

const md = process.argv.includes('--md');
const h1 = (s: string) => (md ? `# ${s}` : `\n━━━ ${s} ━━━`);
const h2 = (s: string) => (md ? `\n## ${s}` : `\n── ${s} ──`);
const code = (s: string) => (md ? '```\n' + s + '\n```' : s);

async function main() {
  // === 1. Load ledger ===
  const ledgerPath = path.join(
    process.cwd(),
    'apps/api/scripts/closure-agents/ledger.json',
  );
  const ledger = JSON.parse(fs.readFileSync(ledgerPath, 'utf-8'));
  const ledgerEntries: any[] = Object.values(ledger.processedSchools);

  // === 2. Load all US schools ===
  const schools = (await prisma.school.findMany({
    where: {
      country: { in: ['US', 'United States', 'United States of America'] },
    },
    select: {
      id: true,
      name: true,
      usNewsRank: true,
      isPrivate: true,
      institutionType: true,
      hasEarlyDecision: true,
      dataReviewStatus: true,
      acceptanceRate: true,
      sat25: true,
      sat75: true,
      intlAcceptanceRate: true,
      oosAcceptanceRate: true,
      edAcceptanceRate: true,
      eaAcceptanceRate: true,
      metadata: true,
    },
  })) as any[];

  const inScope = schools.filter(
    (s) =>
      s.institutionType !== 'ART_DESIGN' &&
      s.institutionType !== 'MUSIC_CONSERVATORY' &&
      s.dataReviewStatus !== 'REJECTED',
  );

  // === 3. Per-field stats ===
  console.log(h1('Prediction Closure — Live Data Progress Report'));
  console.log(`Generated: ${new Date().toISOString()}`);
  console.log(
    `DB source: ${process.env.DATABASE_URL?.split('@')[1]?.split('?')[0] ?? 'localhost'}`,
  );
  console.log('');
  console.log(`Total US schools:     ${schools.length}`);
  console.log(`In closure scope:     ${inScope.length}`);
  console.log(`Excluded (art/music): ${schools.length - inScope.length}`);
  console.log(`Ledger entries:       ${ledgerEntries.length}`);

  console.log(h2('Per-field closure'));
  const tierCounts: Record<string, Record<string, number>> = {};
  for (const f of FIELDS) tierCounts[f] = {};

  const fieldStats: Record<string, any> = {};
  for (const f of FIELDS) {
    let eligible = 0,
      filled = 0,
      closed = 0,
      pure = 0;
    for (const s of inScope) {
      // eligibility
      if (f === 'oosAcceptanceRate' && s.isPrivate !== false) continue;
      const prov = buildNormalizedSchoolProvenance(s) as any;
      const fp = prov[f];
      const hasProv = Boolean(fp);
      if (
        (f === 'edAcceptanceRate' || f === 'eaAcceptanceRate') &&
        !s.hasEarlyDecision &&
        s[f] == null &&
        !hasProv
      )
        continue;

      eligible += 1;
      if (s[f] != null) filled += 1;

      const fs2 = fp ? toSchoolFieldSource(fp) : null;
      const tier = fs2?.tier ?? 'NULL';
      tierCounts[f][tier] = (tierCounts[f][tier] || 0) + 1;
      if (CLOSURE_TIERS.has(tier)) closed += 1;
      if (PURE_TIERS.has(tier)) pure += 1;
    }
    fieldStats[f] = { eligible, filled, closed, pure };
  }

  console.log('');
  console.log(
    'Field                     Eligible  Filled  Closed  Closure  OFFICIAL  Status',
  );
  console.log('─'.repeat(85));
  for (const f of FIELDS) {
    const s = fieldStats[f];
    const closure = s.eligible > 0 ? (s.closed / s.eligible) * 100 : 100;
    const pure = s.eligible > 0 ? (s.pure / s.eligible) * 100 : 100;
    const status = closure >= 90 ? '✅' : closure >= 85 ? '⚠️ ' : '🔴';
    console.log(
      `${f.padEnd(25)} ${String(s.eligible).padStart(7)}  ${String(s.filled).padStart(6)}  ${String(s.closed).padStart(6)}  ${closure.toFixed(1).padStart(5)}%  ${pure.toFixed(1).padStart(5)}%   ${status}`,
    );
  }

  // === 4. Tier distribution per field ===
  console.log(h2('Tier distribution per field'));
  for (const f of FIELDS) {
    const tiers = Object.entries(tierCounts[f]).sort((a, b) => b[1] - a[1]);
    const summary = tiers.map(([t, c]) => `${t}=${c}`).join(', ');
    console.log(`  ${f.padEnd(22)} ${summary}`);
  }

  // === 5. Source breakdown (top 12) ===
  console.log(h2('Top sources (across all 7 fields)'));
  const sourceCounts: Record<string, number> = {};
  for (const s of inScope) {
    const prov = buildNormalizedSchoolProvenance(s) as any;
    for (const f of FIELDS) {
      const fp = prov[f];
      if (!fp) continue;
      const src = toSchoolFieldSource(fp)?.source ?? 'NULL';
      sourceCounts[src] = (sourceCounts[src] || 0) + 1;
    }
  }
  const topSources = Object.entries(sourceCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12);
  for (const [s, c] of topSources)
    console.log(`  ${s.padEnd(38)} ${String(c).padStart(5)}`);

  // === 6. Per-rank-band coverage ===
  console.log(h2('Per-rank-band coverage'));
  const bands = [
    { name: 'Top 10', test: (r: number | null) => r != null && r <= 10 },
    {
      name: 'Top 11-50',
      test: (r: number | null) => r != null && r > 10 && r <= 50,
    },
    {
      name: 'Top 51-100',
      test: (r: number | null) => r != null && r > 50 && r <= 100,
    },
    {
      name: 'Top 101-200',
      test: (r: number | null) => r != null && r > 100 && r <= 200,
    },
    {
      name: 'Rank > 200 / unranked',
      test: (r: number | null) => r == null || r > 200,
    },
  ];
  console.log('');
  console.log(
    'Band                       Count  AR-OFFICIAL  sat-OFFICIAL  intlAR-OFFICIAL  oosAR-OFFICIAL',
  );
  console.log('─'.repeat(95));
  for (const b of bands) {
    const cohort = inScope.filter((s) => b.test(s.usNewsRank));
    const counts: Record<string, number> = {
      acceptanceRate: 0,
      sat25: 0,
      intlAcceptanceRate: 0,
      oosAcceptanceRate: 0,
    };
    for (const s of cohort) {
      const prov = buildNormalizedSchoolProvenance(s) as any;
      for (const f of Object.keys(counts)) {
        const t = prov[f] ? toSchoolFieldSource(prov[f])?.tier : null;
        if (t === 'OFFICIAL') counts[f]++;
      }
    }
    const pct = (n: number) =>
      cohort.length > 0 ? `${((n / cohort.length) * 100).toFixed(0)}%` : '—';
    console.log(
      `${b.name.padEnd(26)} ${String(cohort.length).padStart(5)}  ${pct(counts.acceptanceRate).padStart(11)}  ${pct(counts.sat25).padStart(12)}  ${pct(counts.intlAcceptanceRate).padStart(15)}  ${pct(counts.oosAcceptanceRate).padStart(14)}`,
    );
  }

  // === 7. Per-batch throughput ===
  console.log(h2('Per-batch throughput'));
  const batches: Record<string, number> = {};
  for (const e of ledgerEntries) {
    const b = e.batchId || 'unknown';
    batches[b] = (batches[b] || 0) + 1;
  }
  const sorted = Object.entries(batches).sort((a, b) => {
    const na = parseInt(a[0].match(/batch(\d+)/)?.[1] ?? '0');
    const nb = parseInt(b[0].match(/batch(\d+)/)?.[1] ?? '0');
    return na - nb;
  });
  for (const [b, c] of sorted) console.log(`  ${b.padEnd(28)} ${c}`);

  // === 8. Tier distribution (prediction Tier 1-4) ===
  console.log(h2('Prediction tier distribution (live)'));
  const cdsBands = await prisma.schoolCdsAdmitBand.findMany({
    select: { schoolId: true },
    distinct: ['schoolId'],
  });
  const tier1Ids = new Set(cdsBands.map((b) => b.schoolId));

  const tierDist = {
    'Tier 1+ (CDS bands)': 0,
    'Tier 2 (AR+SAT)': 0,
    'Tier 3 (AR only)': 0,
    'Tier 4 (no data)': 0,
    Excluded: 0,
  };
  for (const s of schools) {
    if (
      s.institutionType === 'ART_DESIGN' ||
      s.institutionType === 'MUSIC_CONSERVATORY'
    ) {
      tierDist['Excluded']++;
      continue;
    }
    if (tier1Ids.has(s.id)) {
      tierDist['Tier 1+ (CDS bands)']++;
      continue;
    }
    if (s.acceptanceRate == null) {
      tierDist['Tier 4 (no data)']++;
      continue;
    }
    if (s.sat25 != null && s.sat75 != null) tierDist['Tier 2 (AR+SAT)']++;
    else tierDist['Tier 3 (AR only)']++;
  }
  for (const [t, c] of Object.entries(tierDist)) {
    const pct = ((c / schools.length) * 100).toFixed(1);
    console.log(`  ${t.padEnd(28)} ${String(c).padStart(4)}  (${pct}%)`);
  }

  // === 9. DB integrity warnings ===
  console.log(h2('DB integrity warnings'));
  const warnings: string[] = [];

  // duplicates by name
  const nameCounts: Record<string, number> = {};
  for (const s of schools) nameCounts[s.name] = (nameCounts[s.name] || 0) + 1;
  const dups = Object.entries(nameCounts).filter(([, c]) => c > 1);
  if (dups.length > 0) {
    warnings.push(
      `Duplicate names: ${dups.map(([n, c]) => `${n} (${c})`).join(', ')}`,
    );
  } else {
    warnings.push('No duplicate school names ✅');
  }

  // schools with no provenance at all
  const noProv = inScope.filter((s) => {
    const prov = (s.metadata as any)?.provenance;
    return !prov || Object.keys(prov).length === 0;
  });
  if (noProv.length > 0)
    warnings.push(`Schools with no provenance: ${noProv.length}`);

  // stale provenance (> 18mo)
  const NOW = Date.now();
  const stale = inScope.filter((s) => {
    const prov = (s.metadata as any)?.provenance?.acceptanceRate;
    if (!prov?.fetchedAt) return false;
    const age = (NOW - new Date(prov.fetchedAt).getTime()) / 86400000;
    return age > 540;
  });
  warnings.push(`Schools with AR fetchedAt > 18mo: ${stale.length}`);

  for (const w of warnings) console.log(`  ${w}`);

  // === 10. Recently processed (last batch) ===
  console.log(h2('Most recent batch'));
  const latest = ledgerEntries
    .filter((e) => e.processedAt)
    .sort((a, b) => b.processedAt.localeCompare(a.processedAt))
    .slice(0, 10);
  for (const e of latest)
    console.log(`  ${e.processedAt}  [${e.batchId ?? '—'}]  ${e.name}`);

  console.log('');
  console.log('━'.repeat(85));
  console.log('Report end. Use --md to format as Markdown.');

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
