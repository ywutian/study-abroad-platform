#!/usr/bin/env tsx
/**
 * Phase 3 — North Carolina State University (public R1 land-grant) end-to-end
 * closure of the 7 prediction-critical fields.
 *
 * Source: NC State CDS 2024-2025
 *   URL: https://report.isa.ncsu.edu/ir/cds/pdfs/CDS_2024-25.v3.pdf
 *
 * NOTE: NC State is a PUBLIC land-grant institution — oosAcceptanceRate is in
 *   eligible scope and MUST carry a real OFFICIAL number extracted from CDS
 *   C1 residency table (in-state tuition / residency-preference admit
 *   pathways).
 *
 * NOTE: NC State is **test-optional** per CDS C8A admission-policies sub-table
 *   (SAT/ACT row checked "Not considered for admission" column). C8F notes
 *   "test optional for applicants with a weighted GPA of 2.8 or above".
 *   Per closure-pipeline convention, SAT C9 Composite percentiles are still
 *   recorded OFFICIAL for descriptive applicant-profile use (not as a gating
 *   threshold).
 *
 * NOTE on Early plans: prior DB had hasEarlyDecision=true with edAR=undefined.
 *   CDS C21 confirms ED is **NOT** offered (Yes box unchecked; all ED date /
 *   applicant-count fields blank). CDS C22 confirms EA IS offered (closing
 *   11/1, notification 1/30, non-restrictive) but NC State did not report EA
 *   applicant / admit counts in C22 (CDS template doesn't require them and
 *   NC State opted not to provide them). Setting hasEarlyDecision=false to
 *   reflect CDS reality. Clearing prior TAVILY eaAR=48 (not authoritative)
 *   and marking eaAR UNAVAILABLE/OFFICIAL_BLANK_SECTION.
 *
 * Value changes (vs. existing DB):
 *   - acceptanceRate    : 41.33  → 41.33 (CDS C1 Total: 18,201 admits / 44,043
 *                          applicants = 41.3335%, rounds to 41.33%. Existing
 *                          value matches; tier already OFFICIAL/CDS_OFFICIAL
 *                          cycle 2024 — refresh metadata.)
 *   - sat25             : 1260   → 1290 (CDS C9 SAT Composite 25th = 1290.
 *                          CORRECTION UP +30 from prior 1260 (LEGACY_DB).)
 *   - sat75             : 1410   → 1440 (CDS C9 SAT Composite 75th = 1440.
 *                          CORRECTION UP +30 from prior 1410 (LEGACY_DB).)
 *   - intlAcceptanceRate: 22.88  → 22.88 (CDS C1 residency: 668 intl admits /
 *                          2,920 intl applicants = 22.8767%, rounds to 22.88.
 *                          Value matches; tier already OFFICIAL — refresh.)
 *   - oosAcceptanceRate : 35.73  → 35.73 (CDS C1 residency: 6,963 OOS admits /
 *                          19,487 OOS applicants = 35.7316%, rounds to 35.73.
 *                          Value matches; tier already OFFICIAL — refresh.)
 *   - edAcceptanceRate  : null   → null  (CDS C21 "No" — NC State does NOT
 *                          offer Early Decision. Field stays null; tier
 *                          UNAVAILABLE/OFFICIAL_BLANK_SECTION/NOT_OFFERED.
 *                          Correct stale hasEarlyDecision=true → false.)
 *   - eaAcceptanceRate  : 48     → null  (CDS C22 "Yes" — NC State offers
 *                          non-restrictive EA with closing 11/1 and
 *                          notification 1/30, but CDS C22 / NC State's filing
 *                          does not include EA applicant or admit counts.
 *                          Prior TAVILY_ENRICHMENT value 48% cleared as
 *                          non-authoritative; mark
 *                          UNAVAILABLE/OFFICIAL_BLANK_SECTION/NOT_REPORTED_IN_CDS.)
 */
import { PrismaClient, Prisma } from '@prisma/client';
import {
  deepMergeRecords,
  toRecord,
} from '../../src/modules/school/school-provenance.helpers';
import { serializeSchoolProvenance } from '@study-abroad/shared/utils';

const CDS_URL = 'https://report.isa.ncsu.edu/ir/cds/pdfs/CDS_2024-25.v3.pdf';
const CYCLE_YEAR = 2024; // CDS 2024-2025 = Fall 2024 entering class
const NOW = new Date().toISOString();
const SCHOOL_ID = 'cmnwr8io20018z0tizk1tsitd';

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
  if (!school) throw new Error(`School ${SCHOOL_ID} (NC State) not found`);
  console.log(`Updating ${school.name} (${school.id})`);
  console.log(
    `  isPrivate=${school.isPrivate}  [PUBLIC — oosAR carries real CDS number]`,
  );
  console.log(
    `  current AR=${school.acceptanceRate?.toString()} sat25=${school.sat25} sat75=${school.sat75}`,
  );
  console.log(
    `  current intlAR=${school.intlAcceptanceRate?.toString()} oosAR=${school.oosAcceptanceRate?.toString()}`,
  );
  console.log(
    `  current edAR=${school.edAcceptanceRate?.toString() ?? 'null'} eaAR=${school.eaAcceptanceRate?.toString() ?? 'null'} hasED=${school.hasEarlyDecision}`,
  );

  const baseProv = {
    sourceUrl: CDS_URL,
    cycleYear: CYCLE_YEAR,
    fetchedAt: NOW,
    verifiedAt: NOW,
    confidence: 1.0,
    verifiedBy: 'closure-pipeline-phase3-claude',
    generatedBy: 'phase3-ncsu-validation',
  };

  const provenance = {
    acceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 41.33,
      policyLabel: 'Overall admit rate',
      reason:
        'CDS 2024-25 Section C1: 18,201 admits / 44,043 applicants = 41.3335% (rounded to 41.33%). Value matches prior DB; provenance refreshed to closure-pipeline-phase3 cycle 2024.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat25: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1290,
      policyLabel: 'SAT composite 25th percentile (reported composite row)',
      reason:
        'CDS 2024-25 Section C9: SAT Composite 25th = 1290 (reported directly). CORRECTION UP +30 from prior 1260 (LEGACY_DB_VALUE). NOTE: NC State is test-optional for applicants with weighted GPA ≥ 2.8 (CDS C8F); SAT/ACT row checked "Not considered for admission" in C8A sub-table. SAT band is recorded for descriptive applicant-profile use only, not as a gating threshold.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat75: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1440,
      policyLabel: 'SAT composite 75th percentile (reported composite row)',
      reason:
        'CDS 2024-25 Section C9: SAT Composite 75th = 1440 (reported directly). CORRECTION UP +30 from prior 1410 (LEGACY_DB_VALUE). NOTE: NC State is test-optional (see sat25 note); SAT band is descriptive only.',
      realDataStatus: 'VERIFIED_REAL',
    },
    intlAcceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 22.88,
      policyLabel: 'International admit rate',
      reason:
        'CDS 2024-25 Section C1 residency table: 668 international admits / 2,920 international applicants = 22.8767% (rounded to 22.88%). Value matches prior DB; provenance refreshed to closure-pipeline-phase3 cycle 2024.',
      realDataStatus: 'VERIFIED_REAL',
    },
    oosAcceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 35.73,
      policyLabel: 'Out-of-state admit rate',
      reason:
        'CDS 2024-25 Section C1 residency table: 6,963 out-of-state admits / 19,487 out-of-state applicants = 35.7316% (rounded to 35.73%). NC State is a PUBLIC land-grant institution — in-state (NC) vs. out-of-state distinction carries real policy meaning (different tuition, residency-preference admit pathways), so this field is in eligible scope and MUST carry a real CDS number. Value matches prior DB; provenance refreshed to closure-pipeline-phase3 cycle 2024.',
      realDataStatus: 'VERIFIED_REAL',
    },
    edAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'Early Decision admit rate',
      reason:
        'CDS 2024-25 Section C21: "Does your institution offer an early decision plan?" — NO checked (all ED date and applicant-count fields blank). NC State does not offer Early Decision. Stale DB hasEarlyDecision=true corrected to false. Field stays cleared (UNAVAILABLE/OFFICIAL_BLANK_SECTION). Provenance refreshed to 2024-25 cycle.',
      realDataStatus: 'NOT_OFFERED',
    },
    eaAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'Early Action admit rate',
      reason:
        'CDS 2024-25 Section C22: NC State offers a nonbinding, non-restrictive Early Action plan ("Yes" checked) with closing 11/1 and notification 1/30. However, the CDS C22 template / NC State\'s filing does not include EA applicant or admit counts (only the closing/notification dates are reported). Prior TAVILY_ENRICHMENT value 48% cleared as non-authoritative; mark UNAVAILABLE/OFFICIAL_BLANK_SECTION/NOT_REPORTED_IN_CDS. Provenance refreshed to authoritative CDS pull.',
      realDataStatus: 'NOT_REPORTED_IN_CDS',
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
      acceptanceRate: new Prisma.Decimal('41.33'),
      sat25: 1290,
      sat75: 1440,
      intlAcceptanceRate: new Prisma.Decimal('22.88'),
      oosAcceptanceRate: new Prisma.Decimal('35.73'),
      edAcceptanceRate: null,
      eaAcceptanceRate: null,
      // CDS C21 "No" — NC State does NOT offer ED; correct stale DB true
      hasEarlyDecision: false,
      lastDataReviewAt: new Date(),
      metadata: nextMetadata,
    },
    select: { id: true },
  });

  console.log(
    '  ✅ updated 7 fields (AR=41.33, sat25=1290, sat75=1440, intlAR=22.88, oosAR=35.73, edAR=NOT_OFFERED, eaAR=NOT_REPORTED, hasED=false)',
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
