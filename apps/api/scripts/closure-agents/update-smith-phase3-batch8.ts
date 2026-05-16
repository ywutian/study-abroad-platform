#!/usr/bin/env tsx
/**
 * Phase 3 batch 8 — Smith College end-to-end closure of the 7
 * prediction-critical fields.
 *
 * Source: Smith College CDS 2024-2025 (Fall 2024 entering class)
 *   URL: https://www1.smith.edu/sites/default/files/2025-02/2024-2025-CDS-Smith-PUB19Dec24%20v2.pdf
 *
 * Value changes (vs. existing DB):
 *   - acceptanceRate    : 20.5  → 21.00  (CDS C1 Total: 1,820 admits / 8,666
 *                          applicants = 21.0016% (rounded 21.00%). CORRECTION
 *                          UP +0.50pp from prior LEGACY_DB (sourceUrl pointed
 *                          to collegekickstart.com aggregator — not Smith).
 *                          Tier upgraded LEGACY_DB → OFFICIAL.)
 *   - sat25             : 1250  → 1450   (CDS C9: SAT Composite 25th = 1450
 *                          reported directly. CORRECTION UP +200 from prior
 *                          SEED/HEURISTIC:PR-15 (1250). Tier upgraded SEED →
 *                          OFFICIAL. 29.3% of Fall 2024 enrolled (189 students)
 *                          submitted SAT under test-optional policy.)
 *   - sat75             : 1450  → 1520   (CDS C9: SAT Composite 75th = 1520
 *                          reported directly; EBRW 760 + Math 780 sum = 1540
 *                          differs because composite quantiles ≠ section sums.
 *                          CORRECTION UP +70 from prior SEED/HEURISTIC:PR-15
 *                          (1450). Tier upgraded SEED → OFFICIAL.)
 *   - intlAcceptanceRate: 6.02  → 6.02   (CDS C1 residency: 165 intl admits /
 *                          2,743 intl applicants = 6.0153% (rounded 6.02%).
 *                          Value matches prior DB; tier upgraded LEGACY_DB →
 *                          OFFICIAL.)
 *   - oosAcceptanceRate : 28.79 → null   (Smith is a private liberal arts
 *                          college; in-state / out-of-state distinction carries
 *                          no policy meaning. CDS C1 residency does report OOS
 *                          (1,467/5,095 = 28.7929%) but per closure-pipeline
 *                          convention, private schools → UNAVAILABLE/TERMINAL.
 *                          Prior legacy DB value cleared.)
 *   - edAcceptanceRate  : 38.2  → 38.20  (CDS C21: Smith offers ED ("Yes"). Two
 *                          plans — ED I 11/15 closing (Mid-December
 *                          notification); ED II 1/1 closing (Late January
 *                          notification). Fall 2024 entering class combined:
 *                          353 admits / 924 ED applications = 38.2035%
 *                          (rounded 38.20). Value matches prior DB; tier
 *                          upgraded LEGACY_DB → OFFICIAL.)
 *   - eaAcceptanceRate  : 22    → null   (CDS C22: Smith College does NOT offer
 *                          a nonbinding Early Action plan ("No" checked for EA
 *                          plan). Prior DB value (22% from
 *                          TAVILY_ENRICHMENT tier=VERIFIED_REAL) was
 *                          incorrectly preserved — Smith does not offer EA.
 *                          CORRECTION: value cleared, marked
 *                          UNAVAILABLE/OFFICIAL_BLANK_SECTION/NOT_OFFERED.)
 */
import { PrismaClient, Prisma } from '@prisma/client';
import {
  deepMergeRecords,
  toRecord,
} from '../../src/modules/school/school-provenance.helpers';
import { serializeSchoolProvenance } from '@study-abroad/shared/utils';

const SMITH_CDS_URL =
  'https://www1.smith.edu/sites/default/files/2025-02/2024-2025-CDS-Smith-PUB19Dec24%20v2.pdf';
const CYCLE_YEAR = 2024; // CDS 2024-2025 = Fall 2024 entering class
const NOW = new Date().toISOString();

const prisma = new PrismaClient();

async function main() {
  const smith = await prisma.school.findFirst({
    where: { id: 'cmnwr8ivg004hz0ti8c1ggiw8', name: 'Smith College' },
    select: {
      id: true,
      name: true,
      isPrivate: true,
      hasEarlyDecision: true,
      acceptanceRate: true,
      sat25: true,
      sat75: true,
      intlAcceptanceRate: true,
      oosAcceptanceRate: true,
      edAcceptanceRate: true,
      eaAcceptanceRate: true,
      metadata: true,
    },
  });
  if (!smith) throw new Error('Smith College not found');
  console.log(`Updating ${smith.name} (${smith.id})`);
  console.log(
    `  current AR=${smith.acceptanceRate?.toString()} sat25=${smith.sat25} sat75=${smith.sat75}`,
  );
  console.log(
    `  current intlAR=${smith.intlAcceptanceRate?.toString()} oosAR=${smith.oosAcceptanceRate?.toString()}`,
  );
  console.log(
    `  current edAR=${smith.edAcceptanceRate?.toString()} eaAR=${smith.eaAcceptanceRate?.toString() ?? 'null'}`,
  );

  const baseProv = {
    sourceUrl: SMITH_CDS_URL,
    cycleYear: CYCLE_YEAR,
    fetchedAt: NOW,
    verifiedAt: NOW,
    confidence: 1.0,
    verifiedBy: 'closure-pipeline-phase3-claude',
    generatedBy: 'phase3-smith-validation',
  };

  const provenance = {
    acceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 21.0,
      policyLabel: 'Overall admit rate',
      reason:
        'CDS 2024-25 Section C1: 1,820 admits / 8,666 applicants = 21.0016% (rounded to 21.00%). Tier upgraded from LEGACY_DB (value 20.5, sourceUrl pointed to collegekickstart.com aggregator — not Smith) to OFFICIAL. CORRECTION UP +0.50pp.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat25: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1450,
      policyLabel: 'SAT composite 25th percentile (reported composite row)',
      reason:
        'CDS 2024-25 Section C9: SAT Composite 25th = 1450 (reported directly; EBRW 720 + Math 700 sum = 1420 differs because composite quantiles ≠ section sums). CORRECTION UP +200 from prior 1250 (SEED/HEURISTIC:PR-15). Tier upgraded from SEED/HEURISTIC to OFFICIAL. 29.3% of Fall 2024 enrolled (189 students) submitted SAT under test-optional policy.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat75: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1520,
      policyLabel: 'SAT composite 75th percentile (reported composite row)',
      reason:
        'CDS 2024-25 Section C9: SAT Composite 75th = 1520 (reported directly; EBRW 760 + Math 780 sum = 1540 differs because composite quantiles ≠ section sums). CORRECTION UP +70 from prior 1450 (SEED/HEURISTIC:PR-15). Tier upgraded from SEED/HEURISTIC to OFFICIAL.',
      realDataStatus: 'VERIFIED_REAL',
    },
    intlAcceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 6.02,
      policyLabel: 'International admit rate',
      reason:
        'CDS 2024-25 Section C1 residency table: 165 international admits / 2,743 international applicants = 6.0153% (rounded to 6.02%). Value matches prior DB; tier upgraded from LEGACY_DB to OFFICIAL with refreshed provenance.',
      realDataStatus: 'VERIFIED_REAL',
    },
    oosAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'TERMINAL',
      confidence: 1.0,
      policyLabel: 'Out-of-state admit rate',
      reason:
        'Smith College is a private liberal arts college; in-state / out-of-state distinction carries no policy meaning (no in-state tuition advantage). CDS C1 residency table does report OOS (1,467 admits / 5,095 applicants = 28.7929%), but the value is not actionable for applicants. Prior legacy DB value (28.79%) cleared. Field marked UNAVAILABLE-terminal per closure-pipeline convention for private institutions.',
      realDataStatus: 'NOT_APPLICABLE',
    },
    edAcceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 38.2,
      policyLabel: 'Early Decision admit rate (ED I + ED II combined)',
      reason:
        'CDS 2024-25 Section C21: Smith offers Early Decision ("Yes" checked) — two plans: ED I closes 11/15 (Mid-December notification); ED II closes 1/1 (Late January notification). Fall 2024 entering class combined: 353 admits / 924 ED applications = 38.2035% (rounded to 38.20%). Value matches prior DB; tier upgraded from LEGACY_DB to OFFICIAL with refreshed provenance.',
      realDataStatus: 'VERIFIED_REAL',
    },
    eaAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'Early Action admit rate',
      reason:
        'CDS 2024-25 Section C22: Smith College does NOT offer a nonbinding Early Action plan ("No" checked for EA plan). Prior DB value (22% from TAVILY_ENRICHMENT tier=VERIFIED_REAL) was incorrectly preserved — Smith does not offer EA. CORRECTION: value cleared, provenance refreshed from prior TAVILY_ENRICHMENT (value=22) to authoritative CDS_OFFICIAL pull marked UNAVAILABLE-terminal/NOT_OFFERED.',
      realDataStatus: 'NOT_OFFERED',
    },
  };

  const existingMeta = toRecord(smith.metadata);
  const serialized = serializeSchoolProvenance(provenance as any);
  const nextMetadata = {
    ...existingMeta,
    provenance: deepMergeRecords(toRecord(existingMeta.provenance), serialized),
    closureSourceIndex: SMITH_CDS_URL,
  };

  await prisma.school.update({
    where: { id: smith.id },
    data: {
      acceptanceRate: new Prisma.Decimal('21.00'),
      sat25: 1450,
      sat75: 1520,
      intlAcceptanceRate: new Prisma.Decimal('6.02'),
      oosAcceptanceRate: null,
      edAcceptanceRate: new Prisma.Decimal('38.20'),
      eaAcceptanceRate: null,
      hasEarlyDecision: true,
      lastDataReviewAt: new Date(),
      metadata: nextMetadata,
    },
    select: { id: true },
  });

  console.log(
    '  ✅ updated 7 fields (AR=21.00, sat25=1450, sat75=1520, intlAR=6.02, oosAR=N/A, edAR=38.20, eaAR=NOT_OFFERED)',
  );

  const after = await prisma.school.findUnique({
    where: { id: smith.id },
    select: {
      acceptanceRate: true,
      sat25: true,
      sat75: true,
      intlAcceptanceRate: true,
      oosAcceptanceRate: true,
      edAcceptanceRate: true,
      eaAcceptanceRate: true,
      hasEarlyDecision: true,
      metadata: true,
    },
  });
  console.log('');
  console.log('=== After update ===');
  console.log(
    `  AR=${after?.acceptanceRate?.toString()} sat25=${after?.sat25} sat75=${after?.sat75}`,
  );
  console.log(
    `  intlAR=${after?.intlAcceptanceRate?.toString() ?? 'null'} oosAR=${after?.oosAcceptanceRate?.toString() ?? 'null'} edAR=${after?.edAcceptanceRate?.toString() ?? 'null'} eaAR=${after?.eaAcceptanceRate?.toString() ?? 'null'} hasED=${after?.hasEarlyDecision}`,
  );
  const prov = (after?.metadata as any)?.provenance ?? {};
  for (const f of [
    'acceptanceRate',
    'sat25',
    'sat75',
    'intlAcceptanceRate',
    'oosAcceptanceRate',
    'edAcceptanceRate',
    'eaAcceptanceRate',
  ]) {
    const p = prov[f];
    console.log(
      `  ${f.padEnd(22)} tier=${p?.tier ?? 'NULL'}  source=${p?.source ?? 'NULL'}  cycle=${p?.cycleYear ?? '-'}`,
    );
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
