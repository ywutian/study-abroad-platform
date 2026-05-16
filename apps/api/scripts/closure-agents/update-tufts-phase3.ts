#!/usr/bin/env tsx
/**
 * Phase 3 — Tufts University end-to-end closure of the 7 prediction-critical fields.
 *
 * Source: Tufts University CDS 2024-2025 (Fall 2024 entering class)
 *   URL: https://provost.tufts.edu/institutionalresearch/wp-content/uploads/sites/5/CDS_2024-2025-1.pdf
 *
 * Convention: Tufts is PRIVATE → oosAcceptanceRate marked UNAVAILABLE/TERMINAL.
 *
 * Value changes (vs. existing DB):
 *   - acceptanceRate    : 10.0   → 11.49  (CDS C1: 3,957 admits / 34,432
 *                          applicants = 11.4922%. CORRECTION UP +1.49pp from
 *                          prior LEGACY_DB. Tier upgraded LEGACY_DB → OFFICIAL.)
 *   - sat25             : 1450   → 1480   (CDS C9: SAT Composite 25th = 1480
 *                          reported. CORRECTION UP +30 from prior LEGACY_DB.)
 *   - sat75             : 1540   → 1540   (CDS C9: SAT Composite 75th = 1540
 *                          reported. Value matches prior DB; tier upgraded
 *                          LEGACY_DB → OFFICIAL.)
 *   - intlAcceptanceRate: 6.26   → 6.26   (CDS C1 residency: 584 intl admits /
 *                          9,336 intl applicants = 6.2554% (rounded to 6.26%).
 *                          Value matches prior DB; tier upgraded LEGACY_DB →
 *                          OFFICIAL.)
 *   - oosAcceptanceRate : 13.1   → null   (Tufts is a private university; OOS
 *                          pricing is identical to in-state. CDS C1 residency
 *                          does report OOS (2,672 / 20,401 = 13.0974%), but per
 *                          closure-pipeline convention, private schools →
 *                          UNAVAILABLE/TERMINAL. Prior legacy DB value cleared.)
 *   - edAcceptanceRate  : 24.4   → null   (CDS C21: ED = "Yes" (ED I closes
 *                          11/4 notify Mid-Dec; ED II closes 1/6 notify Mid-Feb).
 *                          BUT Fall 2024 entering-class ED applicant/admit
 *                          counts are NOT REPORTED on this CDS (numeric fields
 *                          blank). Per closure-pipeline rule, field cleared,
 *                          marked UNAVAILABLE/OFFICIAL_BLANK_SECTION/NOT_REPORTED.
 *                          Prior TAVILY_ENRICHMENT value 24.4 superseded by
 *                          authoritative-CDS NOT_REPORTED gate.)
 *   - eaAcceptanceRate  : null   → null   (CDS C22: EA = "No". Tufts does not
 *                          offer a nonbinding Early Action plan. Field stays
 *                          null. Provenance refreshed to authoritative CDS
 *                          pull marked UNAVAILABLE/OFFICIAL_BLANK_SECTION/
 *                          NOT_OFFERED.)
 *
 * NOTE on hasEarlyDecision: DB true; matches CDS C21 "Yes". No change.
 */
import { PrismaClient, Prisma } from '@prisma/client';
import {
  deepMergeRecords,
  toRecord,
} from '../../src/modules/school/school-provenance.helpers';
import { serializeSchoolProvenance } from '@study-abroad/shared/utils';

const CDS_URL =
  'https://provost.tufts.edu/institutionalresearch/wp-content/uploads/sites/5/CDS_2024-2025-1.pdf';
const CYCLE_YEAR = 2024; // CDS 2024-2025 = Fall 2024 entering class
const NOW = new Date().toISOString();
const SCHOOL_ID = 'cmn1htkpr0014vqf2w1o1nsyd';

const prisma = new PrismaClient();

async function main() {
  const school = await prisma.school.findUnique({
    where: { id: SCHOOL_ID },
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
  if (!school) throw new Error(`School ${SCHOOL_ID} (Tufts) not found`);
  console.log(`Updating ${school.name} (${school.id})`);
  console.log(`  isPrivate=${school.isPrivate}`);
  console.log(
    `  current AR=${school.acceptanceRate?.toString()} sat25=${school.sat25} sat75=${school.sat75}`,
  );
  console.log(
    `  current intlAR=${school.intlAcceptanceRate?.toString()} oosAR=${school.oosAcceptanceRate?.toString()}`,
  );
  console.log(
    `  current edAR=${school.edAcceptanceRate?.toString() ?? 'null'} eaAR=${school.eaAcceptanceRate?.toString() ?? 'null'}`,
  );

  const baseProv = {
    sourceUrl: CDS_URL,
    cycleYear: CYCLE_YEAR,
    fetchedAt: NOW,
    verifiedAt: NOW,
    confidence: 1.0,
    verifiedBy: 'closure-pipeline-phase3-claude',
    generatedBy: 'phase3-tufts-validation',
  };

  const provenance = {
    acceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 11.49,
      policyLabel: 'Overall admit rate',
      reason:
        'CDS 2024-25 Section C1: 3,957 admits / 34,432 applicants = 11.4922% (rounded to 11.49%). Tier upgraded from LEGACY_DB (value 10.0) to OFFICIAL. CORRECTION UP +1.49pp.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat25: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1480,
      policyLabel: 'SAT composite 25th percentile (reported composite row)',
      reason:
        'CDS 2024-25 Section C9: SAT Composite 25th = 1480 (reported directly; EBRW 720 + Math 750 sum = 1470 differs because composite quantiles ≠ section sums). CORRECTION UP from prior 1450 (LEGACY_DB). 38% of Fall 2024 enrolled (687 students) submitted SAT.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat75: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1540,
      policyLabel: 'SAT composite 75th percentile (reported composite row)',
      reason:
        'CDS 2024-25 Section C9: SAT Composite 75th = 1540 (reported directly; EBRW 770 + Math 790 sum = 1560 differs because composite quantiles ≠ section sums). Value matches prior DB; tier upgraded from LEGACY_DB to OFFICIAL.',
      realDataStatus: 'VERIFIED_REAL',
    },
    intlAcceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 6.26,
      policyLabel: 'International admit rate',
      reason:
        'CDS 2024-25 Section C1 residency table: 584 international admits / 9,336 international applicants = 6.2554% (rounded to 6.26%). Value matches prior DB; tier upgraded from LEGACY_DB to OFFICIAL with refreshed provenance.',
      realDataStatus: 'VERIFIED_REAL',
    },
    oosAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'TERMINAL',
      confidence: 1.0,
      policyLabel: 'Out-of-state admit rate',
      reason:
        'Tufts University is a private research university; in-state / out-of-state distinction carries no policy meaning (no in-state tuition advantage). CDS C1 residency table does report OOS (2,672 admits / 20,401 applicants = 13.0974%), but the value is not actionable for applicants. Prior legacy DB value (13.1%) cleared. Field marked UNAVAILABLE-terminal per closure-pipeline convention for private institutions.',
      realDataStatus: 'NOT_APPLICABLE',
    },
    edAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'Early Decision admit rate',
      reason:
        'CDS 2024-25 Section C21: Tufts offers Early Decision ("Yes" checked) with two plans — ED I closes 11/4 (notify Mid-December); ED II closes 1/6 (notify Mid-February). HOWEVER, the Fall 2024 entering-class fields "Number of early decision applications received" and "Number of applicants admitted under early decision plan" are both BLANK on this CDS. Per closure-pipeline rule, field cleared, marked UNAVAILABLE/OFFICIAL_BLANK_SECTION/NOT_REPORTED. Prior DB value 24.4% (TAVILY_ENRICHMENT, not authoritative) is superseded by the authoritative-CDS gate.',
      realDataStatus: 'NOT_REPORTED',
    },
    eaAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'Early Action admit rate',
      reason:
        'CDS 2024-25 Section C22: Tufts does NOT offer a nonbinding Early Action plan ("No" checked for EA plan). DB value was already null; provenance refreshed from prior CDS_LLM_EXTRACT_2026_04 (with value=undefined) to authoritative CDS_OFFICIAL pull marked UNAVAILABLE-terminal/NOT_OFFERED.',
      realDataStatus: 'NOT_OFFERED',
    },
  };

  const existingMeta = toRecord(school.metadata);
  const serialized = serializeSchoolProvenance(provenance as any);
  const nextMetadata = {
    ...existingMeta,
    provenance: deepMergeRecords(toRecord(existingMeta.provenance), serialized),
    closureSourceIndex: CDS_URL,
  };

  // Bypass SchoolWriteService (schema drift). Minimal update with explicit select.
  await prisma.school.update({
    where: { id: school.id },
    data: {
      acceptanceRate: new Prisma.Decimal('11.49'),
      sat25: 1480,
      sat75: 1540,
      intlAcceptanceRate: new Prisma.Decimal('6.26'),
      oosAcceptanceRate: null,
      edAcceptanceRate: null, // CDS C21 numeric fields blank → NOT_REPORTED
      eaAcceptanceRate: null, // CDS C22 "No"
      hasEarlyDecision: true, // re-confirm from CDS C21 "Yes"
      lastDataReviewAt: new Date(),
      metadata: nextMetadata,
    },
    select: { id: true },
  });

  console.log(
    '  ✅ updated 7 fields (AR=11.49, sat25=1480, sat75=1540, intlAR=6.26, oosAR=N/A, edAR=NOT_REPORTED, eaAR=NOT_OFFERED)',
  );

  // verify
  const after = await prisma.school.findUnique({
    where: { id: school.id },
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
