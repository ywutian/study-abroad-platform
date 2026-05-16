#!/usr/bin/env tsx
/**
 * Phase 3 — University of Maryland, College Park end-to-end closure of the 7
 * prediction-critical fields.
 *
 * Source: UMD College Park CDS 2024-2025 (Fall 2024 entering class) — Office of
 *   Institutional Research, Planning, and Assessment (IRPA).
 *   Direct XLSX URL: https://www.irpa.umd.edu/InstitutionalData/CommonDataSet/CDS_2024-2025.xlsx
 *   Index: https://www.irpa.umd.edu/InstitutionalData/cds.html
 *   (NOTE: prior DB sourceUrl pointed to the UMD *Baltimore* School of Social
 *    Work student handbook — wrong institution entirely. Replaced with the
 *    correct IRPA CDS XLSX for the College Park flagship campus.)
 *
 * NOTE: UMD CP is a PUBLIC institution.
 *   - isPrivate=false  ->  oosAcceptanceRate MUST carry a real OFFICIAL number
 *     from CDS C1 residency table.
 *
 * Test policy: SAT/ACT used in admission decisions (C8A "Yes"). C8F note: "The
 *   University of Maryland is true test optional in that if a student chooses
 *   to not submit their test scores, they are still considered for all factors
 *   of admission..." C9 SAT Composite reported for the 37% who submitted.
 *
 * Value changes (vs. existing DB):
 *   - acceptanceRate    : 45    -> 44.80 (CDS 2024-25 C1: 26,897 admits /
 *                          60,042 applicants = 44.7970% (rounded to 44.80%).
 *                          Minor precision adjustment from prior LEGACY_DB 45.
 *                          Tier upgraded LEGACY_DB->OFFICIAL. Prior sourceUrl
 *                          pointed to toptieradmissions.com aggregator —
 *                          replaced with primary IRPA CDS.)
 *   - sat25             : 1310  -> 1410 (CDS 2024-25 C9: SAT Composite 25th =
 *                          1410 reported directly. MAJOR CORRECTION UP +100
 *                          from prior 1310 (SEED/PR-15 heuristic). The prior
 *                          value substantially understated the test-submitting
 *                          cohort's profile — only ~37% submitted SAT under
 *                          true test-optional, and that submitting cohort sits
 *                          markedly higher.)
 *   - sat75             : 1460  -> 1520 (CDS 2024-25 C9: SAT Composite 75th =
 *                          1520 reported directly. CORRECTION UP +60 from prior
 *                          1460 (SEED/PR-15 heuristic).)
 *   - intlAcceptanceRate: 42.28 -> null (CDS 2024-25 C1 residency table at UMD
 *                          reports In-State + Out-of-State only — the
 *                          "International" column is BLANK, and In-State (16254)
 *                          + Out-of-State (43788) sums exactly to Total (60042),
 *                          implying UMD folds international counts into the OOS
 *                          bucket rather than breaking them out separately.
 *                          International admit rate is therefore NOT REPORTED
 *                          in this CDS. Prior DB 42.28% from
 *                          INFERRED/PERMANENT_HEURISTIC cleared per
 *                          CDS_OFFICIAL authoritative principle. Tier
 *                          UNAVAILABLE/OFFICIAL_BLANK_SECTION/NOT_AVAILABLE.)
 *   - oosAcceptanceRate : 42.54 -> 42.54 (CDS 2024-25 C1 residency: 18,626
 *                          out-of-state admits / 43,788 out-of-state
 *                          applicants = 42.5390% (rounded to 42.54%). Value
 *                          identical to prior DB (which was INFERRED but
 *                          coincidentally correct); tier upgraded
 *                          INFERRED/PERMANENT_HEURISTIC -> OFFICIAL.
 *                          NOTE: UMD's CDS Out-of-State column may include
 *                          international students (see intlAR note), so this
 *                          value reflects the broader non-resident
 *                          (OOS+international) admit rate as published.
 *                          Public school -> oosAR carries real OFFICIAL.)
 *   - edAcceptanceRate  : null  -> null  (CDS 2024-25 C21: "No" — UMD does
 *                          NOT offer Early Decision. Field stays null.
 *                          Provenance refreshed from prior
 *                          POLICY_DETERMINATION/NOT_APPLICABLE (with a
 *                          wrong-institution sourceUrl) to authoritative
 *                          UNAVAILABLE/OFFICIAL_BLANK_SECTION/NOT_OFFERED on
 *                          the correct IRPA source.)
 *   - eaAcceptanceRate  : 34    -> null  (CDS 2024-25 C22: "Yes" — UMD OFFERS
 *                          Early Action (closing 11/1, notification by 2/1,
 *                          non-restrictive). HOWEVER, UMD does NOT publish EA
 *                          applicants/admits counts in CDS C22 (those fields
 *                          are absent from the IRPA XLSX). Prior DB carried
 *                          34% from TAVILY_ENRICHMENT — cleared per
 *                          closure-pipeline convention (CDS_OFFICIAL
 *                          authoritative over secondary aggregators).
 *                          Tier UNAVAILABLE/OFFICIAL_BLANK_SECTION: plan
 *                          exists but CDS does not report numbers.)
 *
 * NOTE on hasEarlyDecision: current DB value is false; CDS C21 confirms "No".
 * No change required.
 */
import { PrismaClient, Prisma } from '@prisma/client';
import {
  deepMergeRecords,
  toRecord,
} from '../../src/modules/school/school-provenance.helpers';
import { serializeSchoolProvenance } from '@study-abroad/shared/utils';

const CDS_URL =
  'https://www.irpa.umd.edu/InstitutionalData/CommonDataSet/CDS_2024-2025.xlsx';
const CYCLE_YEAR = 2024; // CDS 2024-2025 = Fall 2024 entering class
const NOW = new Date().toISOString();
const SCHOOL_ID = 'cmn1htkq60019vqf2lmijsj2s';

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
  if (!school) throw new Error(`School ${SCHOOL_ID} (UMD CP) not found`);
  console.log(`Updating ${school.name} (${school.id})`);
  console.log(`  isPrivate=${school.isPrivate}  [PUBLIC]`);
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
    generatedBy: 'phase3-umd-cp-validation',
  };

  const provenance = {
    acceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 44.8,
      policyLabel: 'Overall admit rate',
      reason:
        'CDS 2024-25 Section C1: 26,897 admits / 60,042 applicants = 44.7970% (rounded to 44.80%). Minor precision adjustment from prior LEGACY_DB 45. Tier upgraded LEGACY_DB->OFFICIAL. Prior sourceUrl pointed to toptieradmissions.com aggregator — replaced with primary IRPA CDS XLSX for the College Park flagship campus.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat25: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1410,
      policyLabel: 'SAT composite 25th percentile (reported composite row)',
      reason:
        "CDS 2024-25 Section C9: SAT Composite 25th = 1410 (reported directly). MAJOR CORRECTION UP +100 from prior 1310 (SEED/PR-15 heuristic). Only ~37% of Fall 2024 enrollees submitted SAT under UMD's true test-optional policy; the submitting cohort sits markedly higher than the heuristic assumed.",
      realDataStatus: 'VERIFIED_REAL',
    },
    sat75: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1520,
      policyLabel: 'SAT composite 75th percentile (reported composite row)',
      reason:
        'CDS 2024-25 Section C9: SAT Composite 75th = 1520 (reported directly). CORRECTION UP +60 from prior 1460 (SEED/PR-15 heuristic).',
      realDataStatus: 'VERIFIED_REAL',
    },
    intlAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'International admit rate',
      reason:
        'CDS 2024-25 Section C1 residency table at UMD College Park reports In-State + Out-of-State only — the "International" column is BLANK across applied / admitted / enrolled rows. In-State (16,254) + Out-of-State (43,788) sums exactly to Total (60,042), implying UMD folds international counts into the Out-of-State bucket rather than breaking them out separately. International admit rate is therefore NOT REPORTED in this CDS. Prior DB value 42.28% (INFERRED/PERMANENT_HEURISTIC) cleared per CDS_OFFICIAL authoritative principle.',
      realDataStatus: 'NOT_AVAILABLE',
    },
    oosAcceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 42.54,
      policyLabel: 'Out-of-state admit rate',
      reason:
        "CDS 2024-25 Section C1 residency table: 18,626 out-of-state admits / 43,788 out-of-state applicants = 42.5390% (rounded to 42.54%). Value identical to prior DB (which was INFERRED but coincidentally aligned with the CDS figure); tier upgraded INFERRED/PERMANENT_HEURISTIC -> OFFICIAL. NOTE: UMD's CDS Out-of-State column appears to include international students (the International column is blank and In+OOS sums to Total), so this value reflects the broader non-resident admit rate as published. UMD is a PUBLIC institution — in-state vs. out-of-state distinction carries real policy meaning (different tuition, residency-preference admit pathways), so this field is in eligible scope and MUST carry a real CDS number.",
      realDataStatus: 'VERIFIED_REAL',
    },
    edAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'Early Decision admit rate',
      reason:
        'CDS 2024-25 Section C21: "Does your institution offer an early decision plan?" — NO checked. UMD does NOT offer Early Decision. Field stays cleared. Provenance refreshed from prior POLICY_DETERMINATION/NOT_APPLICABLE (with a wrong-institution sourceUrl pointing to UMD Baltimore School of Social Work handbook) to authoritative UNAVAILABLE/OFFICIAL_BLANK_SECTION/NOT_OFFERED on the correct IRPA source.',
      realDataStatus: 'NOT_OFFERED',
    },
    eaAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'Early Action admit rate',
      reason:
        'CDS 2024-25 Section C22: "Do you have a nonbinding early action plan?" — YES checked. UMD OFFERS Early Action (closing 11/1, notification by 2/1, non-restrictive). HOWEVER, UMD does NOT publish EA applicants/admits counts in CDS C22 (those fields are absent from the IRPA XLSX). Prior DB value 34% was sourced from TAVILY_ENRICHMENT (non-CDS aggregator) — cleared per closure-pipeline convention (CDS_OFFICIAL authoritative over secondary aggregators). Field marked UNAVAILABLE/OFFICIAL_BLANK_SECTION: plan exists but CDS does not report numbers.',
      realDataStatus: 'NOT_AVAILABLE',
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
      acceptanceRate: new Prisma.Decimal('44.80'),
      sat25: 1410,
      sat75: 1520,
      intlAcceptanceRate: null,
      oosAcceptanceRate: new Prisma.Decimal('42.54'),
      edAcceptanceRate: null,
      eaAcceptanceRate: null,
      lastDataReviewAt: new Date(),
      metadata: nextMetadata,
    },
    select: { id: true },
  });

  console.log(
    '  ✅ updated 7 fields (AR=44.80, sat25=1410, sat75=1520, intlAR=NOT_AVAILABLE, oosAR=42.54, edAR=NOT_OFFERED, eaAR=NOT_AVAILABLE)',
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
