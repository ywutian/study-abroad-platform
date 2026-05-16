#!/usr/bin/env tsx
/**
 * Phase 3 — University of Hawaii at Manoa (Public, Honolulu, HI)
 *
 * Source: University of Hawaii at Manoa Common Data Set 2024-2025 (Fall 2024
 *   entering class), Section C — First-Time, First-Year (Freshman) Admission.
 *   URL: https://manoa.hawaii.edu/miro/wp-content/uploads/2025/07/Common_Data_Set_2024-2025.pdf
 *   Hosted by UHM MIRO (Mānoa Institutional Research Office).
 *
 * UH Mānoa is a PUBLIC institution (CDS A2 "Public"; isPrivate=false).
 *   - oosAR is in eligible scope, but C1 residency breakdown is NOT REPORTED
 *     (UH Mānoa publishes only the totals row in the residency sub-table; the
 *     In-State / Out-of-State / International / Unknown columns are all blank).
 *   - Like Auburn, the field will be cleared to UNAVAILABLE/OFFICIAL_BLANK_SECTION.
 *
 * UH Mānoa is TEST-OPTIONAL (CDS C8A "Considered if Submitted" for SAT/ACT;
 * C8F note: "Moved to test optional"). C9 SAT/ACT 25/75 percentile tables are
 * ALL BLANK with the explicit footnote: "Since UH Mānoa moved to a test-optional
 * policy for admission, there has been a dramatic decrease in the number of
 * students submitting test scores. Because the data may be unrepresentative, it
 * is not provided." Per closure-pipeline convention (cf. ASU), the existing
 * sat25/sat75 values (1050/1240 from plexuss.com aggregator — NOT a real CDS
 * source despite being mis-tagged tier=OFFICIAL) must be cleared.
 *
 * Value changes (vs. existing DB):
 *   - acceptanceRate    : 86.6   -> 86.60  (CDS 2024-25 C1: 14,481 admits /
 *                          16,722 applicants = 86.5984%. Same value at 2dp.
 *                          Tier LEGACY_DB (sourceUrl already pointed to UHM
 *                          CDS PDF) -> OFFICIAL; just refresh provenance to
 *                          authoritative cycle.)
 *   - sat25             : 1050   -> null   (CDS 2024-25 C9 SAT Composite row
 *                          BLANK with explicit "not provided" footnote citing
 *                          test-optional / unrepresentative sample. Prior 1050
 *                          was tagged OFFICIAL but sourceUrl was plexuss.com —
 *                          NOT a real CDS extraction. Cleared and marked
 *                          UNAVAILABLE/OFFICIAL_BLANK_SECTION.)
 *   - sat75             : 1240   -> null   (CDS 2024-25 C9 BLANK. Same as
 *                          sat25 — prior 1240 from plexuss.com aggregator.
 *                          UNAVAILABLE/OFFICIAL_BLANK_SECTION.)
 *   - intlAcceptanceRate: 78.85  -> null   (CDS 2024-25 C1 residency table:
 *                          UH Mānoa publishes only the totals row, no In-State
 *                          / Out-of-State / International / Unknown columns.
 *                          Prior 78.85% was INFERRED/PERMANENT_HEURISTIC, no
 *                          source URL — not authoritative. Cleared and marked
 *                          UNAVAILABLE/OFFICIAL_BLANK_SECTION.)
 *   - oosAcceptanceRate : 84.66  -> null   (CDS 2024-25 C1 residency table
 *                          BLANK at UH Mānoa. UH Mānoa IS a public flagship
 *                          where in-state (HI) vs OOS distinction carries
 *                          policy meaning (different tuition, WUE Western
 *                          Undergraduate Exchange tier) so the field is in
 *                          eligible scope, but the institution simply does not
 *                          publish the breakdown. Prior 84.66% was INFERRED/
 *                          PERMANENT_HEURISTIC. UNAVAILABLE/OFFICIAL_BLANK_SECTION.)
 *   - edAcceptanceRate  : null   -> null   (CDS 2024-25 C21: "No" — UH Mānoa
 *                          does not offer Early Decision. UNAVAILABLE/
 *                          OFFICIAL_BLANK_SECTION. Provenance refreshed from
 *                          a stale 2021 UH FB23-25 budget PDF URL to the
 *                          correct UHM CDS 2024-25. NOTE: existing DB
 *                          hasEarlyDecision=true is STALE — corrected to false.)
 *   - eaAcceptanceRate  : null   -> null   (CDS 2024-25 C22: "No" — UH Mānoa
 *                          does not offer a nonbinding Early Action plan
 *                          (closing/notification dates blank, restrictive flag
 *                          blank). UNAVAILABLE/OFFICIAL_BLANK_SECTION.
 *                          Provenance refreshed.)
 *
 * NOTE on hasEarlyDecision: current DB value is true, but CDS C21 is "No".
 *   Setting to false to match CDS reality.
 */
import { PrismaClient, Prisma } from '@prisma/client';
import {
  deepMergeRecords,
  toRecord,
} from '../../src/modules/school/school-provenance.helpers';
import { serializeSchoolProvenance } from '@study-abroad/shared/utils';

const CDS_URL =
  'https://manoa.hawaii.edu/miro/wp-content/uploads/2025/07/Common_Data_Set_2024-2025.pdf';
const CYCLE_YEAR = 2024; // CDS 2024-2025 = Fall 2024 entering class
const NOW = new Date().toISOString();
const SCHOOL_ID = 'cmnwr8iq70021z0titshta238';

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
  if (!school) throw new Error(`School ${SCHOOL_ID} (UH Mānoa) not found`);
  console.log(`Updating ${school.name} (${school.id})`);
  console.log(`  isPrivate=${school.isPrivate}  [PUBLIC]`);
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
    generatedBy: 'phase3-uh-manoa-validation',
  };

  const provenance = {
    acceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 86.6,
      policyLabel: 'Overall admit rate',
      reason:
        'CDS 2024-25 Section C1: 14,481 admits / 16,722 applicants = 86.5984% (rounded to 86.60%). Same value at 2dp as prior 86.6 (LEGACY_DB whose sourceUrl already pointed at the UHM CDS PDF). Tier upgraded LEGACY_DB -> OFFICIAL with authoritative-cycle provenance refresh.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat25: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'SAT composite 25th percentile (reported composite row)',
      reason:
        'CDS 2024-25 Section C9 SAT/ACT percentile tables are ALL BLANK with explicit institutional footnote: "Since UH Mānoa moved to a test-optional policy for admission, there has been a dramatic decrease in the number of students submitting test scores. Because the data may be unrepresentative, it is not provided." Per CDS C8A SAT/ACT "Considered if Submitted" and C8F "Moved to test optional", the institution withholds the percentile data. Prior DB value 1050 was tagged tier=OFFICIAL but sourceUrl was plexuss.com — a third-party aggregator, NOT a real CDS source (mis-tagged). Cleared and marked UNAVAILABLE/OFFICIAL_BLANK_SECTION per closure-pipeline convention for test-optional schools whose CDS withholds C9 percentile data (cf. ASU).',
      realDataStatus: 'NOT_REPORTED',
    },
    sat75: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'SAT composite 75th percentile (reported composite row)',
      reason:
        'CDS 2024-25 Section C9 BLANK with explicit "not provided" footnote (test-optional / unrepresentative). Prior 1240 from plexuss.com aggregator (mis-tagged OFFICIAL). Cleared and marked UNAVAILABLE/OFFICIAL_BLANK_SECTION.',
      realDataStatus: 'NOT_REPORTED',
    },
    intlAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'International admit rate',
      reason:
        'CDS 2024-25 Section C1 residency sub-table at UH Mānoa publishes ONLY the totals row (16,722 applied / 14,481 admitted / 3,123 enrolled). The In-State / Out-of-State / International / Unknown columns are all blank — UH Mānoa does not disaggregate by residency in the CDS. Prior DB value 78.85% was tagged INFERRED/PERMANENT_HEURISTIC with no source URL — not authoritative. Cleared and marked UNAVAILABLE/OFFICIAL_BLANK_SECTION.',
      realDataStatus: 'NOT_REPORTED',
    },
    oosAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'Out-of-state admit rate',
      reason:
        'CDS 2024-25 Section C1 residency breakdown at UH Mānoa is institutionally BLANK (only totals row populated). UH Mānoa IS a public flagship where in-state (HI) vs out-of-state distinction carries real policy meaning (different tuition tiers; WUE Western Undergraduate Exchange reduced-tuition tier) so this field is in eligible scope and would normally carry an OFFICIAL number — but the CDS section is institutionally blank (not refused — simply not disaggregated and published). Prior DB value 84.66% was INFERRED/PERMANENT_HEURISTIC, no source URL. Cleared and marked UNAVAILABLE/OFFICIAL_BLANK_SECTION per closure-pipeline convention for public schools with blank C1 residency sections.',
      realDataStatus: 'NOT_REPORTED',
    },
    edAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'Early Decision admit rate',
      reason:
        'CDS 2024-25 Section C21: "Does your institution offer an early decision plan?" — NO checked. UH Mānoa does not offer Early Decision (closing date, notification date, and applicant/admit count fields all blank). Field stays cleared (UNAVAILABLE/OFFICIAL_BLANK_SECTION). Provenance refreshed from a stale URL pointing at a 2021 UH FB23-25 budget PDF to the correct UHM CDS 2024-25. NOTE: existing DB hasEarlyDecision=true is STALE — being corrected to false in this update.',
      realDataStatus: 'NOT_OFFERED',
    },
    eaAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'Early Action admit rate',
      reason:
        'CDS 2024-25 Section C22: "Do you have a nonbinding early action plan?" — NO checked (closing date, notification date, and restrictive-plan flag all blank). UH Mānoa does not offer Early Action. Field stays cleared (UNAVAILABLE/OFFICIAL_BLANK_SECTION). Provenance refreshed from a stale URL pointing at a 2021 UH budget PDF to the correct UHM CDS 2024-25.',
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
      acceptanceRate: new Prisma.Decimal('86.60'),
      sat25: null,
      sat75: null,
      intlAcceptanceRate: null,
      oosAcceptanceRate: null,
      edAcceptanceRate: null,
      eaAcceptanceRate: null,
      // CDS C21 "No" — UH Mānoa does not offer ED; correct stale DB true
      hasEarlyDecision: false,
      lastDataReviewAt: new Date(),
      metadata: nextMetadata,
    },
    select: { id: true },
  });

  console.log(
    '  ✅ updated 7 fields (AR=86.60, sat25=NOT_REPORTED, sat75=NOT_REPORTED, intlAR=NOT_REPORTED, oosAR=NOT_REPORTED, edAR=NOT_OFFERED, eaAR=NOT_OFFERED, hasED=false)',
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
