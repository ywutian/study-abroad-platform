#!/usr/bin/env tsx
/**
 * Phase 3 batch 6 — Middlebury College end-to-end closure of the 7
 * prediction-critical fields.
 *
 * Source: Middlebury College CDS 2024-2025
 *   URL: https://www.middlebury.edu/sites/default/files/2025-04/Middlebury%20CDS%202024_2025.pdf
 *
 * Value changes (vs. existing DB):
 *   - acceptanceRate    : 10.75 → 10.75  (CDS C1 Total: 1,348 admits / 12,540
 *                          applicants = 10.7496%. Value matches prior DB;
 *                          tier upgraded LEGACY_DB → OFFICIAL.)
 *   - sat25             : 1380  → 1450   (CDS C9: SAT Composite 25th = 1450
 *                          (reported directly). CORRECTION UP +70 from prior
 *                          1380 (SEED/PR-15 heuristic). Tier upgraded
 *                          SEED/HEURISTIC → OFFICIAL.)
 *   - sat75             : 1540  → 1530   (CDS C9: SAT Composite 75th = 1530
 *                          (reported directly; SAT EBRW 760 + SAT Math 790
 *                          sum = 1550 differs because composite quantiles ≠
 *                          section sums). CORRECTION DOWN -10 from prior 1540
 *                          (SEED/PR-15 heuristic). Tier upgraded
 *                          SEED/HEURISTIC → OFFICIAL.)
 *   - intlAcceptanceRate: 5.2   → null   (CDS C1 residency breakdown: only
 *                          "Total" column is populated; In-State /
 *                          Out-of-State / International / Unknown columns are
 *                          entirely blank in the CDS. Middlebury does not
 *                          publish international admit rate via CDS C1.
 *                          Prior INFERRED/PERMANENT_HEURISTIC value (5.2%)
 *                          cleared. Field marked
 *                          UNAVAILABLE/OFFICIAL_BLANK_SECTION.)
 *   - oosAcceptanceRate : 9.75  → null   (CDS C1 residency rows blank +
 *                          Middlebury is a private liberal arts college.
 *                          Per closure-pipeline convention, private schools
 *                          → UNAVAILABLE/TERMINAL. Prior
 *                          INFERRED/PERMANENT_HEURISTIC value (9.75%)
 *                          cleared.)
 *   - edAcceptanceRate  : 30.5  → 30.50  (CDS C21: ED offered ("Yes"
 *                          checked) — two plans: ED I 11/1 closing
 *                          (Mid December notification); ED II 1/1 closing
 *                          (Early February notification). Fall 2024 entering
 *                          class combined: 409 admits / 1,341 ED applications
 *                          = 30.4996% (rounded 30.50%). Note: ED admits
 *                          excludes Feb admits per CDS footnote. Value matches
 *                          prior DB; tier upgraded LEGACY_DB → OFFICIAL.)
 *   - eaAcceptanceRate  : null  → null   (CDS C22: Early Action plan
 *                          checkbox not marked (section blank — no "Yes" or
 *                          "No" checked; closing/notification dates blank;
 *                          restrictive Yes/No blank). Interpreted as
 *                          Middlebury does not offer EA. Provenance refreshed
 *                          to authoritative CDS pull marked
 *                          UNAVAILABLE/OFFICIAL_BLANK_SECTION/NOT_OFFERED.)
 */
import { PrismaClient, Prisma } from '@prisma/client';
import {
  deepMergeRecords,
  toRecord,
} from '../../src/modules/school/school-provenance.helpers';
import { serializeSchoolProvenance } from '@study-abroad/shared/utils';

const MIDDLEBURY_CDS_URL =
  'https://www.middlebury.edu/sites/default/files/2025-04/Middlebury%20CDS%202024_2025.pdf?fv=_3Gr6e2c';
const CYCLE_YEAR = 2024; // CDS 2024-2025 = Fall 2024 entering class
const NOW = new Date().toISOString();

const prisma = new PrismaClient();

async function main() {
  const mid = await prisma.school.findFirst({
    where: { id: 'cmnwr8iv00048z0tityzi3zx8', name: 'Middlebury College' },
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
  if (!mid) throw new Error('Middlebury College not found');
  console.log(`Updating ${mid.name} (${mid.id})`);
  console.log(
    `  current AR=${mid.acceptanceRate?.toString()} sat25=${mid.sat25} sat75=${mid.sat75}`,
  );
  console.log(
    `  current intlAR=${mid.intlAcceptanceRate?.toString()} oosAR=${mid.oosAcceptanceRate?.toString()}`,
  );
  console.log(
    `  current edAR=${mid.edAcceptanceRate?.toString()} eaAR=${mid.eaAcceptanceRate?.toString() ?? 'null'}`,
  );

  const baseProv = {
    sourceUrl: MIDDLEBURY_CDS_URL,
    cycleYear: CYCLE_YEAR,
    fetchedAt: NOW,
    verifiedAt: NOW,
    confidence: 1.0,
    verifiedBy: 'closure-pipeline-phase3-claude',
    generatedBy: 'phase3-middlebury-validation',
  };

  const provenance = {
    acceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 10.75,
      policyLabel: 'Overall admit rate',
      reason:
        'CDS 2024-25 Section C1: 1,348 admits / 12,540 applicants = 10.7496% (rounded to 10.75%). Value matches prior DB; tier upgraded from LEGACY_DB (sourceUrl already pointed to Middlebury CDS) to OFFICIAL with refreshed provenance.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat25: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1450,
      policyLabel: 'SAT composite 25th percentile (reported composite row)',
      reason:
        'CDS 2024-25 Section C9: SAT Composite 25th = 1450 (reported directly). CORRECTION UP from prior 1380 (SEED/HEURISTIC:PR-15). Tier upgraded from SEED/HEURISTIC to OFFICIAL. 28% of Fall 2024 enrolled (167 students) submitted SAT under test-optional policy.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat75: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1530,
      policyLabel: 'SAT composite 75th percentile (reported composite row)',
      reason:
        'CDS 2024-25 Section C9: SAT Composite 75th = 1530 (reported directly; SAT EBRW 760 + SAT Math 790 sum = 1550 differs because composite quantiles ≠ section sums). CORRECTION DOWN from prior 1540 (SEED/HEURISTIC:PR-15). Tier upgraded from SEED/HEURISTIC to OFFICIAL.',
      realDataStatus: 'VERIFIED_REAL',
    },
    intlAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'International admit rate',
      reason:
        'CDS 2024-25 Section C1 residency breakdown: only the "Total" column is populated; In-State / Out-of-State / International / Unknown columns are entirely blank in the CDS. Middlebury College does not publish international admit rate via CDS C1. Prior INFERRED/PERMANENT_HEURISTIC value (5.2%) cleared. Field marked UNAVAILABLE-terminal/OFFICIAL_BLANK_SECTION.',
      realDataStatus: 'OFFICIAL_BLANK_SECTION',
    },
    oosAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'TERMINAL',
      confidence: 1.0,
      policyLabel: 'Out-of-state admit rate',
      reason:
        "Middlebury College is a private liberal arts college; in-state / out-of-state distinction carries no policy meaning (no in-state tuition advantage). CDS C1 residency rows are blank in Middlebury's CDS; even if they were populated, the value is not actionable for applicants. Prior INFERRED/PERMANENT_HEURISTIC value (9.75%) cleared. Field marked UNAVAILABLE-terminal per closure-pipeline convention for private institutions.",
      realDataStatus: 'NOT_APPLICABLE',
    },
    edAcceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 30.5,
      policyLabel: 'Early Decision admit rate (ED I + ED II combined)',
      reason:
        'CDS 2024-25 Section C21: Middlebury offers Early Decision ("Yes" checked) — two plans: ED I closes 11/1 (Mid December notification); ED II closes 1/1 (Early February notification). Fall 2024 entering class combined: 409 admits / 1,341 ED applications = 30.4996% (rounded to 30.50%). CDS footnote notes "Number of applicants admitted under early decision plan (excludes Feb admits)". Value matches prior DB; tier upgraded from LEGACY_DB to OFFICIAL.',
      realDataStatus: 'VERIFIED_REAL',
    },
    eaAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'Early Action admit rate',
      reason:
        "CDS 2024-25 Section C22: Early Action plan checkboxes (Yes/No) are not marked; closing date, notification date, and restrictive Yes/No are all blank in Middlebury's CDS. Interpreted as Middlebury does not offer an Early Action plan. DB value was already null; provenance refreshed from prior CDS_LLM_EXTRACT_2026_04 to authoritative CDS_OFFICIAL pull marked UNAVAILABLE-terminal/NOT_OFFERED.",
      realDataStatus: 'NOT_OFFERED',
    },
  };

  const existingMeta = toRecord(mid.metadata);
  const serialized = serializeSchoolProvenance(provenance as any);
  const nextMetadata = {
    ...existingMeta,
    provenance: deepMergeRecords(toRecord(existingMeta.provenance), serialized),
    closureSourceIndex: MIDDLEBURY_CDS_URL,
  };

  await prisma.school.update({
    where: { id: mid.id },
    data: {
      acceptanceRate: new Prisma.Decimal('10.75'),
      sat25: 1450,
      sat75: 1530,
      intlAcceptanceRate: null,
      oosAcceptanceRate: null,
      edAcceptanceRate: new Prisma.Decimal('30.50'),
      eaAcceptanceRate: null,
      hasEarlyDecision: true,
      lastDataReviewAt: new Date(),
      metadata: nextMetadata,
    },
    select: { id: true },
  });

  console.log(
    '  ✅ updated 7 fields (AR=10.75, sat25=1450, sat75=1530, intlAR=N/A, oosAR=N/A, edAR=30.50, eaAR=NOT_OFFERED)',
  );

  const after = await prisma.school.findUnique({
    where: { id: mid.id },
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
