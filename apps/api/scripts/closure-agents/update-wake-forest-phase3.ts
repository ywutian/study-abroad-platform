#!/usr/bin/env tsx
/**
 * Phase 3 — Wake Forest University (private R1) end-to-end closure of the 7
 * prediction-critical fields.
 *
 * Source: Wake Forest University CDS 2024-2025 (Fall 2024 entering class)
 *   URL: https://prod.wp.cdn.aws.wfu.edu/sites/202/2025/07/CDS-2024-2025-fillable-WFU.pdf
 *
 * Private R1 institution — oosAcceptanceRate carries no policy meaning
 * (no in-state tuition advantage), marked UNAVAILABLE/TERMINAL per closure-
 * pipeline convention for private schools.
 *
 * Wake Forest C8A: SAT/ACT "Not considered for admission, even if submitted"
 * — Wake Forest is the original test-blind elite private. CDS C9 SAT
 * Composite percentiles are recorded as OFFICIAL for descriptive applicant-
 * profile use only, NOT as a gating threshold.
 *
 * Value changes (vs. existing DB):
 *   - acceptanceRate    : 21.67 -> 21.67  (CDS C1: 4,058 admits (men 1,919 +
 *                          women 2,137 + another 2) / 18,727 applicants (men
 *                          8,224 + women 10,498 + another 5) = 21.6692%.
 *                          Value matches prior DB; tier upgraded
 *                          LEGACY_DB->OFFICIAL.)
 *   - sat25             : 1360  -> 1420   (CDS C9: SAT Composite 25th = 1420
 *                          reported directly. CORRECTION UP +60 from prior
 *                          1360 (LEGACY_DB heuristic).)
 *   - sat75             : 1480  -> 1500   (CDS C9: SAT Composite 75th = 1500
 *                          reported directly. CORRECTION UP +20 from prior
 *                          1480 (LEGACY_DB heuristic).)
 *   - intlAcceptanceRate: 14.98 -> null   (CDS C1 residency table is BLANK
 *                          (all zeros) — Wake Forest does not publish
 *                          residency/international breakdowns in its CDS.
 *                          Prior DB value 14.98 came from INFERRED/
 *                          PERMANENT_HEURISTIC (not real). Cleared to
 *                          UNAVAILABLE/OFFICIAL_BLANK_SECTION.)
 *   - oosAcceptanceRate : 21.4  -> null   (CDS C1 residency table is BLANK,
 *                          and Wake Forest is private — oosAR carries no
 *                          policy meaning regardless. Cleared per closure-
 *                          pipeline convention for private institutions to
 *                          UNAVAILABLE/TERMINAL.)
 *   - edAcceptanceRate  : 34    -> null   (CDS C21: "Yes" — Wake Forest
 *                          offers Early Decision (ED I closing 11/15, ED II
 *                          closing 1/1). However CDS C21 ED applicant/admit
 *                          counts are BLANK (Wake Forest does not publish ED
 *                          counts in CDS). Prior DB value 34 came from
 *                          TAVILY_ENRICHMENT aggregator (lower tier than
 *                          CDS). Per closure-pipeline convention CDS is
 *                          authoritative — cleared to
 *                          UNAVAILABLE/OFFICIAL_BLANK_SECTION/COUNTS_NOT_PUBLISHED
 *                          even though ED is offered.)
 *   - eaAcceptanceRate  : null  -> null   (CDS C22: "Yes" — Wake Forest
 *                          offers a nonbinding Early Action plan with 11/15
 *                          closing and 1/15 notification BUT explicitly only
 *                          for first-generation college students (annotation
 *                          in CDS). EA applicant/admit counts BLANK. Field
 *                          stays cleared,
 *                          UNAVAILABLE/OFFICIAL_BLANK_SECTION/COUNTS_NOT_PUBLISHED.)
 */
import { PrismaClient, Prisma } from '@prisma/client';
import {
  deepMergeRecords,
  toRecord,
} from '../../src/modules/school/school-provenance.helpers';
import { serializeSchoolProvenance } from '@study-abroad/shared/utils';

const CDS_URL =
  'https://prod.wp.cdn.aws.wfu.edu/sites/202/2025/07/CDS-2024-2025-fillable-WFU.pdf';
const CYCLE_YEAR = 2024; // CDS 2024-2025 = Fall 2024 entering class
const NOW = new Date().toISOString();
const SCHOOL_ID = 'cmn1htkqj001dvqf2n8mczcpn';

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
  if (!school) throw new Error(`School ${SCHOOL_ID} (Wake Forest) not found`);
  console.log(`Updating ${school.name} (${school.id})`);
  console.log(`  isPrivate=${school.isPrivate}  [PRIVATE R1]`);
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
    generatedBy: 'phase3-wake-forest-validation',
  };

  const provenance = {
    acceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 21.67,
      policyLabel: 'Overall admit rate',
      reason:
        'CDS 2024-25 Section C1: 4,058 admits (men 1,919 + women 2,137 + another gender 2) / 18,727 applicants (men 8,224 + women 10,498 + another gender 5) = 21.6692% (rounded to 21.67%). Value matches prior DB; tier upgraded LEGACY_DB->OFFICIAL with authoritative CDS source.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat25: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1420,
      policyLabel: 'SAT composite 25th percentile (reported composite row)',
      reason:
        'CDS 2024-25 Section C9: SAT Composite 25th = 1420 (reported directly). CORRECTION UP +60 from prior 1360 (LEGACY_DB heuristic). NOTE: Wake Forest is test-BLIND (CDS C8A: "Not considered for admission, even if submitted") — SAT band is recorded for descriptive applicant-profile use only, NOT as a gating threshold.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat75: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1500,
      policyLabel: 'SAT composite 75th percentile (reported composite row)',
      reason:
        'CDS 2024-25 Section C9: SAT Composite 75th = 1500 (reported directly). CORRECTION UP +20 from prior 1480 (LEGACY_DB heuristic). NOTE: Wake Forest is test-blind; SAT band is descriptive only.',
      realDataStatus: 'VERIFIED_REAL',
    },
    intlAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'International admit rate',
      reason:
        'CDS 2024-25 Section C1 residency table is BLANK (all zeros) — Wake Forest does not publish residency/international breakdowns in its CDS. Prior DB value 14.98 came from INFERRED/PERMANENT_HEURISTIC (not real data). Cleared to UNAVAILABLE/OFFICIAL_BLANK_SECTION per closure-pipeline convention when CDS is silent.',
      realDataStatus: 'OFFICIAL_BLANK_SECTION',
    },
    oosAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'TERMINAL',
      confidence: 1.0,
      policyLabel: 'Out-of-state admit rate',
      reason:
        'Wake Forest University is a private R1 institution; in-state / out-of-state distinction carries no policy meaning (no in-state tuition advantage). CDS C1 residency table is also BLANK (Wake Forest does not publish residency breakdowns). Prior DB value 21.4 from INFERRED/PERMANENT_HEURISTIC cleared. Field marked UNAVAILABLE-terminal per closure-pipeline convention for private institutions.',
      realDataStatus: 'NOT_APPLICABLE',
    },
    edAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'Early Decision admit rate (ED I + ED II combined)',
      reason:
        'CDS 2024-25 Section C21: "Yes" — Wake Forest offers Early Decision (ED I closing 11/15, ED II closing 1/1). However CDS C21 ED applicant/admit counts are BLANK (Wake Forest does not publish ED counts in its CDS). Prior DB value 34 came from TAVILY_ENRICHMENT (lower-tier aggregator). Per closure-pipeline convention CDS is the authoritative source — when CDS is silent on counts, field is cleared to UNAVAILABLE/OFFICIAL_BLANK_SECTION/COUNTS_NOT_PUBLISHED even though ED is offered. hasEarlyDecision retained as true (CDS C21 = Yes).',
      realDataStatus: 'OFFICIAL_BLANK_SECTION',
    },
    eaAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'Early Action admit rate',
      reason:
        'CDS 2024-25 Section C22: "Yes" — Wake Forest offers a nonbinding Early Action plan (closing 11/15, notification 1/15) BUT it is explicitly restricted to first-generation college students per the CDS annotation ("WFU has an early action plan for first-generation college students"). EA applicant/admit counts are BLANK in CDS. Field stays cleared (UNAVAILABLE/OFFICIAL_BLANK_SECTION/COUNTS_NOT_PUBLISHED). Provenance refreshed to 2024-25 cycle authoritative CDS pull.',
      realDataStatus: 'OFFICIAL_BLANK_SECTION',
    },
  };

  const existingMeta = toRecord(school.metadata);
  const serialized = serializeSchoolProvenance(provenance as any);
  const nextMetadata = {
    ...existingMeta,
    provenance: deepMergeRecords(toRecord(existingMeta.provenance), serialized),
    closureSourceIndex: CDS_URL,
  };

  await prisma.school.update({
    where: { id: school.id },
    data: {
      acceptanceRate: new Prisma.Decimal('21.67'),
      sat25: 1420,
      sat75: 1500,
      intlAcceptanceRate: null,
      oosAcceptanceRate: null,
      edAcceptanceRate: null,
      eaAcceptanceRate: null,
      // CDS C21 = Yes — Wake Forest does offer ED (ED I + ED II)
      hasEarlyDecision: true,
      lastDataReviewAt: new Date(),
      metadata: nextMetadata,
    },
    select: { id: true },
  });

  console.log(
    '  updated 7 fields (AR=21.67, sat25=1420, sat75=1500, intlAR=BLANK, oosAR=N/A, edAR=BLANK, eaAR=BLANK, hasED=true)',
  );

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
