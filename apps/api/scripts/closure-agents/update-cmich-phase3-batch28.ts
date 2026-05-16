#!/usr/bin/env tsx
/**
 * Phase 3 — Central Michigan University (CMU) closure of the 7
 *   prediction-critical fields.
 *
 * Source: Central Michigan University Common Data Set 2024-2025
 *   (Fall 2024 entering class), Academic Planning and Analysis:
 *   https://www.cmich.edu/docs/default-source/academic-affairs-division/academic-administration/academic-planning-analysis/reports-(public)/common-data-sets/cds-2024-2025.pdf
 *
 * CMU is a PUBLIC research university (Mt. Pleasant, MI). CDS A2 = Public.
 *
 * CDS 2024-25 facts (extracted directly from CMU's CDS PDF, pages 1-19):
 *   Section C1 (Fall 2024 first-time first-year):
 *     - Applied:  men 8,657 + women 13,299 + another 0 + unknown 13 = 21,969
 *     - Admitted: men 7,708 + women 12,012 + another 0 + unknown 12 = 19,732
 *     - Enrolled: men   858 + women  1,360 + another 0 + unknown  4 =  2,222
 *     - Overall AR = 19,732 / 21,969 = 89.82%
 *   Section C1 residency table: LEFT BLANK by CMU
 *     (all in-state/out-of-state/international cells = 0). CMU does
 *     NOT publish an in-state vs. out-of-state vs. international
 *     applicant/admit breakdown in its CDS C1.
 *   Section F1: "Percent who are from out of state" (enrolled FTFY,
 *     excluding international) = 9.82%. This is an enrolled-cohort
 *     descriptive — NOT an out-of-state admit rate. We do NOT use it
 *     as oosAcceptanceRate.
 *   Section C9 (enrolled first-time first-year SAT/ACT, Fall 2024):
 *     - 60.60% submitted SAT (n=1,347); 7.07% submitted ACT (n=157)
 *     - SAT Composite: 25th=970, 50th=1080, 75th=1200
 *     - SAT EBRW: 490 / 550 / 610; SAT Math: 470 / 530 / 590
 *     - ACT Composite: 21 / 24 / 27
 *   Section C8: SAT/ACT "Not required for admission, but consider if submitted"
 *     for Fall 2026 admission cycle.
 *   Section C21 Early Decision: NO (CDS checkbox: ☑ No) — CMU does
 *     not offer Early Decision.
 *   Section C22 Early Action: NO (CDS checkbox: ☑ No) — CMU does NOT
 *     offer Early Action either. DB's prior eaAR=92 (TAVILY_ENRICHMENT)
 *     was a fabrication.
 *
 * NOTE on prior DB state — multiple provenance bugs:
 *   - acceptanceRate=72   tier=VERIFIED_REAL src=LEGACY_DB_VALUE (no URL)
 *     -> actual CDS 89.82, +17.82 correction.
 *   - sat25=970, sat75=1200 — values are correct but provenance URL
 *     points at prepscholar.com (third-party scrape, not CDS).
 *   - intlAR=70 / oosAR=73.44 — both wrong: CMU's CDS C1 residency
 *     table is BLANK. The prior "intl 70" was from yocket.com
 *     (third-party site) and "oos 73.44" was tagged PERMANENT_HEURISTIC.
 *     Neither has any official basis; set to UNAVAILABLE.
 *   - edAcceptanceRate=null but tagged OFFICIAL/CDS_LLM_EXTRACT — CDS
 *     says NO ED offered. Convert to NOT_OFFERED.
 *   - eaAcceptanceRate=92 tier=VERIFIED_REAL src=TAVILY_ENRICHMENT —
 *     CDS says NO EA offered. CMU is rolling admission only.
 *     Convert to NOT_OFFERED; null out the 92.
 *   - hasEarlyDecision=true — wrong per CDS C21. Correct to false.
 */
import { PrismaClient, Prisma } from '@prisma/client';
import {
  deepMergeRecords,
  toRecord,
} from '../../src/modules/school/school-provenance.helpers';
import { serializeSchoolProvenance } from '@study-abroad/shared/utils';

const CDS_URL =
  'https://www.cmich.edu/docs/default-source/academic-affairs-division/academic-administration/academic-planning-analysis/reports-(public)/common-data-sets/cds-2024-2025.pdf';
const CYCLE_YEAR = 2024;
const NOW = new Date().toISOString();
const SCHOOL_ID = 'cmnwr8itk003mz0tirfyu068c';

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
  if (!school) throw new Error(`School ${SCHOOL_ID} (CMU) not found`);
  console.log(`Updating ${school.name} (${school.id})`);
  console.log(`  isPrivate=${school.isPrivate}  [PUBLIC MI]`);
  console.log(
    `  current AR=${school.acceptanceRate?.toString()} sat25=${school.sat25} sat75=${school.sat75}`,
  );
  console.log(
    `  current intlAR=${school.intlAcceptanceRate?.toString()} oosAR=${school.oosAcceptanceRate?.toString()} edAR=${school.edAcceptanceRate?.toString() ?? 'null'} eaAR=${school.eaAcceptanceRate?.toString() ?? 'null'}`,
  );

  const baseProv = {
    sourceUrl: CDS_URL,
    cycleYear: CYCLE_YEAR,
    fetchedAt: NOW,
    verifiedAt: NOW,
    confidence: 1.0,
    verifiedBy: 'closure-pipeline-phase3-batch28-claude',
    generatedBy: 'phase3-cmich-validation',
  };

  const provenance = {
    acceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 89.82,
      policyLabel: 'Overall admit rate',
      reason:
        "CDS 2024-25 Section C1: 21,969 first-time first-year applicants (men 8,657 + women 13,299 + unknown 13), 19,732 admits (men 7,708 + women 12,012 + unknown 12). AR = 19,732 / 21,969 = 89.82%. CORRECTION +17.82 from prior 72 (LEGACY_DB_VALUE, no source URL). Tier LEGACY_DB_VALUE -> OFFICIAL/CDS_OFFICIAL with CMU's own CDS PDF.",
      realDataStatus: 'VERIFIED_REAL',
    },
    sat25: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 970,
      policyLabel: 'SAT composite 25th percentile',
      reason:
        "CDS 2024-25 Section C9 SAT Composite 25th = 970. Matches DB value exactly; tier re-anchored OFFICIAL/CDS_PDF_AUTO (prior URL prepscholar.com — third-party scrape, not CDS) -> OFFICIAL/CDS_OFFICIAL with CMU's own CDS PDF. NOTE: CMU is test-optional for Fall 2026; 60.60% (1,347) of enrolled FTFY submitted SAT, 7.07% (157) ACT.",
      realDataStatus: 'VERIFIED_REAL',
    },
    sat75: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1200,
      policyLabel: 'SAT composite 75th percentile',
      reason:
        "CDS 2024-25 Section C9 SAT Composite 75th = 1200. Matches DB value exactly; tier re-anchored OFFICIAL/CDS_PDF_AUTO (prior URL prepscholar.com) -> OFFICIAL/CDS_OFFICIAL with CMU's own CDS PDF.",
      realDataStatus: 'VERIFIED_REAL',
    },
    intlAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      value: null,
      policyLabel: 'International admit rate',
      reason:
        "CDS 2024-25 Section C1 residency breakdown: CMU leaves the in-state / out-of-state / international applicant/admit cells BLANK. There is no official international admit rate published. Prior DB value 70 came from yocket.com (third-party site mislabeled as CDS_PDF_AUTO) and has no official basis. Setting to UNAVAILABLE with provenance pointing at CMU's actual CDS. (For context, CDS B2 reports 84 nonresident FTFY enrolled — but that is a yield-side cohort count, not an admit rate.)",
      realDataStatus: 'UNAVAILABLE',
    },
    oosAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      value: null,
      policyLabel: 'Out-of-state admit rate',
      reason:
        'CDS 2024-25 Section C1 residency breakdown: BLANK (CMU does not publish in-state vs. out-of-state applicant/admit counts in its CDS). Prior DB value 73.44 was tagged PERMANENT_HEURISTIC — i.e. derived heuristically, not from any source. CDS F1 reports 9.82% of enrolled FTFY are out-of-state (descriptive yield-side stat, NOT an admit rate). Setting to UNAVAILABLE.',
      realDataStatus: 'UNAVAILABLE',
    },
    edAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      value: null,
      policyLabel: 'Early Decision admit rate',
      reason:
        'CDS 2024-25 Section C21: "Does your institution offer an early decision plan?" — NO checked. CMU does not offer Early Decision. Field stays null. Tier transitions OFFICIAL/CDS_LLM_EXTRACT_2026_04 -> UNAVAILABLE/OFFICIAL_BLANK_SECTION/NOT_OFFERED with refreshed provenance from CMU\'s actual CDS. (Prior URL was CMU CDS, so URL is unchanged.)',
      realDataStatus: 'NOT_OFFERED',
    },
    eaAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      value: null,
      policyLabel: 'Early Action admit rate',
      reason:
        'CDS 2024-25 Section C22: "Do you have a nonbinding early action plan?" — NO checked. CMU does NOT offer Early Action; CMU\'s C16 reply policy is "On a rolling basis" (rolling admission only, no separate EA round). Prior DB value 92 (tier VERIFIED_REAL, src TAVILY_ENRICHMENT) is a fabrication — CMU has no EA round so an EA admit rate cannot exist. Nulling the value; setting to NOT_OFFERED.',
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

  await prisma.school.update({
    where: { id: school.id },
    data: {
      acceptanceRate: new Prisma.Decimal('89.82'),
      sat25: 970,
      sat75: 1200,
      intlAcceptanceRate: null,
      oosAcceptanceRate: null,
      edAcceptanceRate: null,
      eaAcceptanceRate: null,
      // CDS C21 "No" — CMU does not offer ED; correct stale DB true.
      hasEarlyDecision: false,
      lastDataReviewAt: new Date(),
      metadata: nextMetadata,
    },
    select: { id: true },
  });

  console.log(
    '  updated 7 fields (AR=89.82, sat25=970, sat75=1200, intlAR=UNAVAIL, oosAR=UNAVAIL, edAR=NOT_OFFERED, eaAR=NOT_OFFERED, hasED=false)',
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
