#!/usr/bin/env tsx
/**
 * Phase 3 — California State University, Northridge (CSUN) closure of OPEN
 *   prediction-critical fields.
 *
 * Source: CSUN Common Data Set 2024-2025 (Fall 2024 entering class),
 *   published by CSUN Office of Institutional Research.
 *   PDF: https://live-csu-northridge.pantheonsite.io/sites/default/files/2026-04/CDS%202025%20v2.pdf
 *   (filename "CDS 2025" but document header reads "Common Data Set 2024-2025",
 *    Fall 2024 entering cohort — cycleYear=2024)
 *   XLSX (alternative): https://live-csu-northridge.pantheonsite.io/sites/default/files/2025-02/CDS%202024.xlsx
 *
 * CSUN is a PUBLIC university (CSU system).
 *
 * Test policy: CSU system is TEST-BLIND for admission. CDS Section C7
 *   "Standardized test scores" = "Very Important" check appears in 2024-25
 *   PDF but C8A indicates SAT/ACT "Required to be considered for admission"
 *   FOR FALL 2026 ONLY — CSUN announced a return to test consideration for
 *   Fall 2026. For Fall 2024 (this cohort) it was test-blind: CDS Section C9
 *   SAT/ACT submission percentages and 25/75 percentiles are ALL BLANK.
 *   sat25/sat75 -> NULL with UNAVAILABLE/OFFICIAL_BLANK_SECTION.
 *
 * Closure rule: DO NOT override fields already closed. Already closed at
 *   OFFICIAL (with incorrect source URL pointing at California College of ASU):
 *   edAR, eaAR. These are LEFT UNCHANGED per "do not override closed" rule.
 *   Touch only open: AR (VERIFIED_REAL), sat25/sat75 (SEED HEURISTIC),
 *   intlAR/oosAR (INFERRED PERMANENT_HEURISTIC).
 *
 * CDS 2024-25 Section C1 (Fall 2024 entering class) — confirmed from XLSX:
 *   - Total applied: 33,350
 *   - Total admitted: 30,842 → AR = 92.48% (30842/33350 = 0.92480)
 *     MAJOR CORRECTION UP +22.48 from prior DB value 70 (stale LEGACY_DB_VALUE).
 *   - C1 residency table in PDF is ALL BLANK (in-state, out-of-state,
 *     international counts not published) → intlAR/oosAR -> UNAVAILABLE.
 *   - C9 SAT all blank → sat25/sat75 -> UNAVAILABLE (test-blind era).
 */
import { PrismaClient, Prisma } from '@prisma/client';
import {
  deepMergeRecords,
  toRecord,
} from '../../src/modules/school/school-provenance.helpers';
import { serializeSchoolProvenance } from '@study-abroad/shared/utils';

const CDS_URL =
  'https://live-csu-northridge.pantheonsite.io/sites/default/files/2026-04/CDS%202025%20v2.pdf';
const CYCLE_YEAR = 2024;
const NOW = new Date().toISOString();
const SCHOOL_ID = 'cmnwr8ish0036z0tiy3l6tt76';

const prisma = new PrismaClient();

async function main() {
  const school = await prisma.school.findUnique({
    where: { id: SCHOOL_ID },
    select: { id: true, name: true, metadata: true },
  });
  if (!school) throw new Error(`School ${SCHOOL_ID} (CSUN) not found`);
  console.log(`Updating ${school.name} (${school.id})`);

  const baseProv = {
    sourceUrl: CDS_URL,
    cycleYear: CYCLE_YEAR,
    fetchedAt: NOW,
    verifiedAt: NOW,
    confidence: 1.0,
    verifiedBy: 'closure-pipeline-phase3-batch26-claude',
    generatedBy: 'phase3-csun-validation',
  };

  const provenance = {
    acceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 92.48,
      policyLabel: 'Overall admit rate',
      reason:
        'CDS 2024-25 Section C1: 33,350 first-time, first-year applicants and 30,842 admits = 92.48% (30842/33350 = 0.92480). Verified via CSUN-published CDS XLSX (row r215=33350 applied, r217=30842 admitted). MAJOR CORRECTION UP +22.48 from prior DB value 70 (stale LEGACY_DB_VALUE — likely reflected a much older pre-pandemic cohort or system-wide guess). Tier upgraded VERIFIED_REAL/LEGACY_DB_VALUE -> OFFICIAL/CDS_OFFICIAL anchored to CSUN CDS PDF.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat25: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      value: null,
      policyLabel: 'SAT composite 25th percentile',
      reason:
        'CSUN / CSU system was TEST-BLIND for Fall 2024 admission. CDS 2024-25 Section C9 SAT/ACT submission percentages and 25/75 percentiles are ALL BLANK (no test scores collected from the Fall 2024 entering class for admission scoring). Prior SEED HEURISTIC:PR-15 value of 1080 was a heuristic guess that does not reflect CSU policy. Cleared to NULL and marked NOT_COLLECTED.',
      realDataStatus: 'NOT_COLLECTED',
    },
    sat75: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      value: null,
      policyLabel: 'SAT composite 75th percentile',
      reason:
        'CSUN / CSU system was TEST-BLIND for Fall 2024 admission (see sat25 reason). CDS C9 75th percentile blank. Prior SEED HEURISTIC:PR-15 value of 1320 cleared to NULL and marked NOT_COLLECTED.',
      realDataStatus: 'NOT_COLLECTED',
    },
    intlAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      value: null,
      policyLabel: 'International admit rate',
      reason:
        'CDS 2024-25 Section C1 residency breakdown table is ENTIRELY BLANK in the published CSUN CDS — in-state, out-of-state, and international applicant/admit/enrolled cells are all empty. CSUN does not publish residency split for Fall 2024. Prior value 66.5 was tier=INFERRED/source=PERMANENT_HEURISTIC (heuristic fabrication). Cleared to null and marked INSTITUTION_REDACTED.',
      realDataStatus: 'INSTITUTION_REDACTED',
    },
    oosAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      value: null,
      policyLabel: 'Out-of-state admit rate',
      reason:
        'CDS 2024-25 Section C1 residency breakdown table is ENTIRELY BLANK in the published CSUN CDS. CSUN is a PUBLIC CSU campus and OOS distinction is policy-meaningful, but the institution does not publish OOS counts for Fall 2024. Prior value 71.4 was tier=INFERRED/source=PERMANENT_HEURISTIC (heuristic fabrication). Cleared to null and marked INSTITUTION_REDACTED.',
      realDataStatus: 'INSTITUTION_REDACTED',
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
      acceptanceRate: new Prisma.Decimal('92.48'),
      sat25: null,
      sat75: null,
      intlAcceptanceRate: null,
      oosAcceptanceRate: null,
      // edAR/eaAR LEFT UNCHANGED (already OFFICIAL — do not override closed).
      lastDataReviewAt: new Date(),
      metadata: nextMetadata,
    },
    select: { id: true },
  });

  console.log(
    '  updated 5 open fields (AR=92.48 CORRECTION +22.48, sat25/sat75/intlAR/oosAR=UNAVAILABLE) -> OFFICIAL/CDS_OFFICIAL or OFFICIAL_BLANK_SECTION',
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
