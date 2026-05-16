#!/usr/bin/env tsx
/**
 * Phase 3 (batch14) — Michigan State University end-to-end closure of the 7
 * prediction-critical fields.
 *
 * Source: MSU CDS 2024-2025 (Fall 2024 entering class)
 *   URL: https://xmc-michiganstab57e-msustrategi129d-prod9868.sitecorecloud.io/-/media/project/msu/ir/docs/cds/cds-2024-2025.pdf
 *   Index: https://ir.msu.edu/cds
 *
 * NOTE: MSU is a PUBLIC institution (isPrivate=false). Per closure-pipeline
 *   convention, oosAcceptanceRate is in eligible scope and MUST carry a real
 *   OFFICIAL number extracted from CDS C1 residency table (NOT marked
 *   UNAVAILABLE/TERMINAL).
 *
 * Existing DB values are SIGNIFICANTLY WRONG (sourced from
 * nextgenadmit.com aggregator with stale or fabricated numbers): DB AR=81.3 vs
 * CDS C1 84.79%, DB sat25/75=1110/1310 (actually matches CDS!), DB oosAR=84.4
 * (close), DB intlAR=88.1 (close). Big corrections coming via OFFICIAL tier.
 *
 * Value changes (vs. existing DB):
 *   - acceptanceRate    : 81.3   -> 84.79  (CDS C1: 52,690 admits / 62,138
 *                          applicants = 84.7945%. Tier upgrade
 *                          LEGACY_DB->OFFICIAL. CORRECTION UP +3.49pp.)
 *   - sat25             : 1110   -> 1100   (CDS C9: SAT Composite 25th =
 *                          1100 reported directly. CORRECTION DOWN -10 from
 *                          prior 1110 (LEGACY_DB).)
 *   - sat75             : 1310   -> 1310   (CDS C9: SAT Composite 75th =
 *                          1310 reported directly. Value matches prior DB;
 *                          tier upgraded LEGACY_DB->OFFICIAL.)
 *   - intlAcceptanceRate: 88.1   -> 88.10  (CDS C1 residency: 6,257 intl
 *                          admits / 7,102 intl applicants = 88.1019%. Value
 *                          essentially matches prior DB; tier upgraded
 *                          LEGACY_DB->OFFICIAL.)
 *   - oosAcceptanceRate : 84.4   -> 84.37  (CDS C1 residency: 25,528 OOS
 *                          admits / 30,256 OOS applicants = 84.3733%. Value
 *                          essentially matches prior DB; tier upgraded
 *                          LEGACY_DB->OFFICIAL. **MSU is PUBLIC — oosAR IS a
 *                          real OFFICIAL number, not TERMINAL.**)
 *   - edAcceptanceRate  : null   -> null   (CDS C21: "No" — MSU does not
 *                          offer Early Decision. Field stays cleared; tier
 *                          UNAVAILABLE/OFFICIAL_BLANK_SECTION.
 *                          NOTE on hasEarlyDecision: current DB has
 *                          hasEarlyDecision=true, but CDS C21 is "No" —
 *                          setting to false to match CDS reality.)
 *   - eaAcceptanceRate  : 84.7   -> null   (CDS C22: "Yes" — MSU offers
 *                          Early Action, with closing 11/1 and notification
 *                          1/15. HOWEVER, CDS C22 does NOT report
 *                          EA applicants or admits — only dates. Prior DB
 *                          value 84.7 (TAVILY_ENRICHMENT) is not an
 *                          authoritative CDS-published number. Field cleared
 *                          to null; tier UNAVAILABLE/OFFICIAL_BLANK_SECTION
 *                          (plan exists but counts not published).)
 */
import { PrismaClient, Prisma } from '@prisma/client';
import {
  deepMergeRecords,
  toRecord,
} from '../../src/modules/school/school-provenance.helpers';
import { serializeSchoolProvenance } from '@study-abroad/shared/utils';

const CDS_URL =
  'https://xmc-michiganstab57e-msustrategi129d-prod9868.sitecorecloud.io/-/media/project/msu/ir/docs/cds/cds-2024-2025.pdf';
const CDS_INDEX_URL = 'https://ir.msu.edu/cds';
const CYCLE_YEAR = 2024; // CDS 2024-2025 = Fall 2024 entering class
const NOW = new Date().toISOString();
const SCHOOL_ID = 'cmnwr8imv000kz0ti6chk6fxq';

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
  if (!school) throw new Error(`School ${SCHOOL_ID} (MSU) not found`);
  console.log(`Updating ${school.name} (${school.id})`);
  console.log(`  isPrivate=${school.isPrivate}  [PUBLIC — oosAR is OFFICIAL]`);
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
    verifiedBy: 'closure-pipeline-phase3-batch14-claude',
    generatedBy: 'phase3-batch14-msu-validation',
  };

  const provenance = {
    acceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 84.79,
      policyLabel: 'Overall admit rate',
      reason:
        'CDS 2024-25 Section C1: 52,690 admits / 62,138 applicants = 84.7945% (rounded to 84.79%). Tier upgraded from LEGACY_DB (value 81.3, sourceUrl pointed to nextgenadmit.com aggregator — not MSU) to OFFICIAL. CORRECTION UP +3.49pp.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat25: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1100,
      policyLabel: 'SAT composite 25th percentile (reported composite row)',
      reason:
        'CDS 2024-25 Section C9: SAT Composite 25th = 1100 (reported directly). CORRECTION DOWN -10 from prior 1110 (LEGACY_DB). 52% of Fall 2024 enrolled (4,998 students) submitted SAT.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat75: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1310,
      policyLabel: 'SAT composite 75th percentile (reported composite row)',
      reason:
        'CDS 2024-25 Section C9: SAT Composite 75th = 1310 (reported directly). Value matches prior DB; tier upgraded LEGACY_DB->OFFICIAL.',
      realDataStatus: 'VERIFIED_REAL',
    },
    intlAcceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 88.1,
      policyLabel: 'International admit rate',
      reason:
        'CDS 2024-25 Section C1 residency table: 6,257 international admits / 7,102 international applicants = 88.1019% (rounded to 88.10%). Value essentially matches prior DB (88.1); tier upgraded LEGACY_DB->OFFICIAL with refreshed provenance.',
      realDataStatus: 'VERIFIED_REAL',
    },
    oosAcceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 84.37,
      policyLabel: 'Out-of-state admit rate',
      reason:
        'CDS 2024-25 Section C1 residency table: 25,528 out-of-state admits / 30,256 out-of-state applicants = 84.3733% (rounded to 84.37%). MSU is a PUBLIC university — in-state vs. out-of-state distinction carries real policy meaning (different tuition, residency factors), so this field is in eligible scope and MUST carry a real CDS number. Tier upgraded LEGACY_DB->OFFICIAL. (Confirms public-school convention: oosAR carries the real number, never marked TERMINAL.) For reference: in-state 20,905/24,780 = 84.36%.',
      realDataStatus: 'VERIFIED_REAL',
    },
    edAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'Early Decision admit rate',
      reason:
        'CDS 2024-25 Section C21: "Does your institution offer an early decision plan?" — NO checked. Michigan State University does not offer Early Decision. Field stays cleared (UNAVAILABLE/OFFICIAL_BLANK_SECTION). NOTE: prior DB had hasEarlyDecision=true (stale), corrected to false to match CDS.',
      realDataStatus: 'NOT_OFFERED',
    },
    eaAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'Early Action admit rate',
      reason:
        'CDS 2024-25 Section C22: "Yes" — MSU offers a nonbinding Early Action plan (closing 11/1, notification 1/15, not restrictive). HOWEVER, MSU does not publish EA-specific applicant or admit counts in CDS C22 (only dates). Prior DB value 84.7 (TAVILY_ENRICHMENT from a third-party 2024-25 PDF) is not an authoritative CDS-published EA-cohort admit rate. Field cleared to null; tier UNAVAILABLE/OFFICIAL_BLANK_SECTION (EA plan exists but counts not published in CDS).',
      realDataStatus: 'NOT_OFFERED',
    },
  };

  const existingMeta = toRecord(school.metadata);
  const serialized = serializeSchoolProvenance(provenance as any);
  const nextMetadata = {
    ...existingMeta,
    provenance: deepMergeRecords(toRecord(existingMeta.provenance), serialized),
    closureSourceIndex: CDS_INDEX_URL,
  };

  // Bypass SchoolWriteService (schema drift). Minimal update with explicit select.
  await prisma.school.update({
    where: { id: school.id },
    data: {
      acceptanceRate: new Prisma.Decimal('84.79'),
      sat25: 1100,
      sat75: 1310,
      intlAcceptanceRate: new Prisma.Decimal('88.10'),
      oosAcceptanceRate: new Prisma.Decimal('84.37'),
      edAcceptanceRate: null,
      eaAcceptanceRate: null,
      // CDS C21 "No" — MSU does not offer ED; correct stale DB true
      hasEarlyDecision: false,
      lastDataReviewAt: new Date(),
      metadata: nextMetadata,
    },
    select: { id: true },
  });

  console.log(
    '  ✅ updated 7 fields (AR=84.79, sat25=1100, sat75=1310, intlAR=88.10, oosAR=84.37, edAR=NOT_OFFERED, eaAR=OFFERED_NO_COUNTS, hasED=false)',
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
