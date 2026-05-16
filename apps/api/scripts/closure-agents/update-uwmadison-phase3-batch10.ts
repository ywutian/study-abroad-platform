#!/usr/bin/env tsx
/**
 * Phase 3 batch 10 — University of Wisconsin-Madison (UW-Madison) end-to-end
 * closure of the 7 prediction-critical fields.
 *
 * Source: UW-Madison Common Data Set 2024-2025 (Fall 2024 entering class),
 *   published by UW-Madison Data, Academic Planning & Institutional Research
 *   (DAPIR).
 *   PDF: https://uwmadison.app.box.com/s/cm3r7gc83w3eqjotfbva111dnin6toer
 *   Index: https://data.wisc.edu/common-data-set-and-rankings/
 *
 * KEY UW-MADISON POLICIES (drive the closure decisions):
 *   - UW-Madison is **test-optional** (CDS 2024-25 C8A "Yes" — institution
 *     makes use of SAT/ACT in admission decisions; SAT or ACT row marked
 *     "Not required for admission, but consider if submitted"; C8F: "Including
 *     scores from either the ACT or the SAT with your application is optional
 *     for students applying for admission through the spring 2027 term"). UW-
 *     Madison reports SAT Composite percentiles in C9 (14.70% submitted SAT,
 *     35.10% submitted ACT). SAT Composite 25/75 are recorded as OFFICIAL.
 *   - UW-Madison is a **public** Big Ten flagship. HOWEVER its CDS 2024-25 C1
 *     residency breakdown table (in-state / out-of-state / international /
 *     unknown) is COMPLETELY BLANK (every cell, including the Total row,
 *     reads "0"). UW-Madison did not fill the optional residency breakdown.
 *     Per closure-pipeline convention "C1 residency 空 → UNAVAILABLE/
 *     OFFICIAL_BLANK_SECTION" (no other UC-style federation feed exists for
 *     UW), oosAR and intlAR are recorded as UNAVAILABLE/OFFICIAL_BLANK_SECTION
 *     keyed to the CDS C1 blank section. Prior LEGACY_DB column values are
 *     preserved as the historical column value, but provenance flags them as
 *     non-OFFICIAL (officially blank in current cycle's source). NOTE: This
 *     follows the explicit task instruction for batch 10 (residency blank ->
 *     blank-section), not the UCLA-style UC Infocenter fallback (no such
 *     alternative authoritative source exists for UW-Madison).
 *   - UW-Madison does NOT offer Early Decision (CDS 2024-25 C21 "No"). ->
 *     edAR cleared, UNAVAILABLE/OFFICIAL_BLANK_SECTION/NOT_OFFERED.
 *   - UW-Madison DOES offer Early Action (CDS 2024-25 C22 "Yes"; closing
 *     11/1, notification 1/31, non-restrictive). HOWEVER C22 in CDS does
 *     NOT publish EA applicant or admit counts (only ED has C2106/C2107
 *     numeric fields). Per closure-pipeline convention an offered-but-
 *     unpublished plan is recorded as eaAR=null tier=UNAVAILABLE source=
 *     OFFICIAL_BLANK_SECTION (section officially blank for the metric).
 *
 * Value changes (vs. existing DB):
 *   - acceptanceRate    : 45.2   -> 45.17  (UW-Madison CDS 2024-25 C1 Total:
 *                          29,784 admits (M 13,835 + W 15,940 + Another 9 +
 *                          Unknown 0) / 65,933 applicants (M 32,863 + W
 *                          33,050 + Another 20 + Unknown 0) = 45.1730%
 *                          (rounds to 45.17%). Minor precision adjustment
 *                          -0.03pp from prior LEGACY_DB 45.2. Tier upgraded
 *                          LEGACY_DB -> OFFICIAL, sourced from UW-Madison
 *                          DAPIR CDS PDF.)
 *   - sat25             : 1310   -> 1370   (UW-Madison CDS 2024-25 C9: SAT
 *                          Composite 25th Percentile = 1370 (reported
 *                          directly). UW-Madison is test-optional but
 *                          reports scores for submitting students (14.70%
 *                          submitted SAT). CORRECTION UP +60 from prior
 *                          LEGACY_DB 1310 (older cycle). Tier upgraded
 *                          LEGACY_DB -> OFFICIAL.)
 *   - sat75             : 1440   -> 1490   (UW-Madison CDS 2024-25 C9: SAT
 *                          Composite 75th Percentile = 1490. CORRECTION UP
 *                          +50 from prior LEGACY_DB 1440.)
 *   - intlAcceptanceRate: 31.6   -> 31.6   (UW-Madison CDS 2024-25 C1
 *                          residency table is BLANK — all in-state / out-of-
 *                          state / international / unknown cells, including
 *                          Total row, read "0". Per closure-pipeline
 *                          convention "C1 residency 空 → UNAVAILABLE/
 *                          OFFICIAL_BLANK_SECTION". Prior LEGACY_DB column
 *                          value 31.6 is preserved (no authoritative
 *                          replacement source) but tier is recorded as
 *                          UNAVAILABLE/OFFICIAL_BLANK_SECTION/LEGACY_VALUE
 *                          to reflect that the current CDS cycle's residency
 *                          section is officially blank. NOTE: prior column
 *                          intentionally preserved to avoid corrupting
 *                          downstream prediction inputs with null while
 *                          provenance signals to consumers that the value is
 *                          not OFFICIAL.)
 *   - oosAcceptanceRate : 40.3   -> 40.3   (Same as intlAR: CDS 2024-25 C1
 *                          residency table is BLANK. Prior LEGACY_DB 40.3
 *                          preserved. Tier UNAVAILABLE/OFFICIAL_BLANK_SECTION.
 *                          Public Big Ten institution — in-state vs. OOS
 *                          distinction carries real policy meaning, but the
 *                          official source did not publish the breakdown.)
 *   - edAcceptanceRate  : null   -> null   (UW-Madison CDS 2024-25 C21: "No".
 *                          UW-Madison does not offer Early Decision. Field
 *                          stays cleared. Provenance anchored to UW-Madison
 *                          DAPIR CDS as UNAVAILABLE/OFFICIAL_BLANK_SECTION/
 *                          NOT_OFFERED.)
 *   - eaAcceptanceRate  : null   -> null   (UW-Madison CDS 2024-25 C22:
 *                          "Yes" — EA offered (closing 11/1, notification
 *                          1/31, non-restrictive). HOWEVER C22 in this CDS
 *                          does NOT publish EA applicant or admit counts
 *                          (only ED has C2106/C2107 numeric fields). Per
 *                          closure-pipeline convention an offered-but-
 *                          unpublished plan is recorded as eaAR=null tier=
 *                          UNAVAILABLE source=OFFICIAL_BLANK_SECTION (the
 *                          section is officially blank for the metric).)
 */
import { PrismaClient, Prisma } from '@prisma/client';
import {
  deepMergeRecords,
  toRecord,
} from '../../src/modules/school/school-provenance.helpers';
import { serializeSchoolProvenance } from '@study-abroad/shared/utils';

const CDS_URL =
  'https://uwmadison.app.box.com/s/cm3r7gc83w3eqjotfbva111dnin6toer';
const CDS_INDEX_URL = 'https://data.wisc.edu/common-data-set-and-rankings/';
const CYCLE_YEAR = 2024; // CDS 2024-2025 = Fall 2024 entering class
const NOW = new Date().toISOString();
const SCHOOL_ID = 'cmn1htkpi0011vqf28xmv4but';

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
  if (!school) throw new Error(`School ${SCHOOL_ID} (UW-Madison) not found`);
  console.log(`Updating ${school.name} (${school.id})`);
  console.log(
    `  isPrivate=${school.isPrivate}  [PUBLIC Big Ten — C1 residency BLANK in source]`,
  );
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
    generatedBy: 'phase3-batch10-uwmadison-validation',
    notes: `CDS index: ${CDS_INDEX_URL}`,
  };

  const provenance = {
    acceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 45.17,
      policyLabel: 'Overall admit rate',
      reason:
        'UW-Madison CDS 2024-25 C1 Total: 29,784 admits (Men 13,835 + Women 15,940 + Another 9 + Unknown 0) / 65,933 applicants (Men 32,863 + Women 33,050 + Another 20 + Unknown 0) = 45.1730% (rounds to 45.17%). Minor precision adjustment -0.03pp from prior LEGACY_DB 45.2. Tier upgraded LEGACY_DB -> OFFICIAL, sourced from UW-Madison DAPIR CDS PDF.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat25: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1370,
      policyLabel: 'SAT composite 25th percentile (reported composite row)',
      reason:
        'UW-Madison CDS 2024-25 C9: SAT Composite 25th Percentile = 1370 (reported directly). UW-Madison is test-optional (C8A "Yes"; SAT or ACT marked "Not required for admission, but consider if submitted"; C8F: optional through spring 2027) but reports scores for the 14.70% of enrollees who submitted SAT (35.10% submitted ACT). CORRECTION UP +60 from prior LEGACY_DB 1310 (older cycle). Tier upgraded LEGACY_DB -> OFFICIAL.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat75: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1490,
      policyLabel: 'SAT composite 75th percentile (reported composite row)',
      reason:
        'UW-Madison CDS 2024-25 C9: SAT Composite 75th Percentile = 1490 (reported directly). UW-Madison is test-optional but reports scores. CORRECTION UP +50 from prior LEGACY_DB 1440. Tier upgraded LEGACY_DB -> OFFICIAL.',
      realDataStatus: 'VERIFIED_REAL',
    },
    intlAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'International admit rate',
      reason:
        'UW-Madison CDS 2024-25 C1 residency table is BLANK — every cell in the in-state / out-of-state / international / unknown breakdown, including the Total row, reads "0". UW-Madison did not fill the optional residency breakdown. Per closure-pipeline convention "C1 residency 空 → UNAVAILABLE/OFFICIAL_BLANK_SECTION" (no UC-style federation feed exists for UW), this field is recorded as UNAVAILABLE/OFFICIAL_BLANK_SECTION keyed to the CDS blank section. Prior LEGACY_DB column value 31.6 is preserved in the column to avoid corrupting downstream prediction inputs with null, but provenance signals to consumers that the value is officially blank in the current cycle and should be treated as legacy/non-OFFICIAL.',
      realDataStatus: 'OFFICIAL_BLANK',
    },
    oosAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'Out-of-state admit rate',
      reason:
        'UW-Madison CDS 2024-25 C1 residency table is BLANK (same as intlAR). UW-Madison is a public Big Ten institution — in-state vs. OOS distinction carries real policy meaning (nonresident tuition surcharge), but the official source did not publish the breakdown. Per closure-pipeline convention "C1 residency 空 → UNAVAILABLE/OFFICIAL_BLANK_SECTION". Prior LEGACY_DB column value 40.3 preserved in the column to avoid corrupting downstream prediction inputs with null, but provenance flags it as officially blank in the current cycle and not OFFICIAL.',
      realDataStatus: 'OFFICIAL_BLANK',
    },
    edAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'Early Decision admit rate',
      reason:
        'UW-Madison CDS 2024-25 C21: "Does your institution offer an early decision plan?" — No. UW-Madison does not offer Early Decision (only Regular Decision and non-restrictive Early Action). Field stays cleared (UNAVAILABLE/OFFICIAL_BLANK_SECTION). Provenance anchored to UW-Madison DAPIR CDS.',
      realDataStatus: 'NOT_OFFERED',
    },
    eaAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'Early Action admit rate',
      reason:
        'UW-Madison CDS 2024-25 C22: "Do you have a nonbinding early action plan?" — Yes. UW-Madison offers EA (closing 11/1, notification 1/31, restrictive=No — i.e. non-restrictive). HOWEVER C22 in this CDS does NOT publish EA applicant or admit counts (only ED has C2106/C2107 numeric fields). Per closure-pipeline convention an offered-but-unpublished plan is recorded as eaAR=null tier=UNAVAILABLE source=OFFICIAL_BLANK_SECTION (the section is officially blank for the metric).',
      realDataStatus: 'OFFERED_NOT_REPORTED',
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
      acceptanceRate: new Prisma.Decimal('45.17'),
      sat25: 1370,
      sat75: 1490,
      // intlAR / oosAR columns intentionally preserved at legacy values to
      // avoid null-corruption of downstream prediction inputs; provenance
      // flags both as OFFICIAL_BLANK from the current cycle's source.
      intlAcceptanceRate: new Prisma.Decimal('31.6'),
      oosAcceptanceRate: new Prisma.Decimal('40.3'),
      edAcceptanceRate: null,
      eaAcceptanceRate: null,
      // CDS C21 "No" — UW-Madison does not offer ED. hasEarlyDecision stays false.
      hasEarlyDecision: false,
      lastDataReviewAt: new Date(),
      metadata: nextMetadata,
    },
    select: { id: true },
  });

  console.log(
    '  ✅ updated 7 fields (AR=45.17, sat25=1370, sat75=1490, intlAR=31.6[BLANK_SECTION], oosAR=40.3[BLANK_SECTION], edAR=NOT_OFFERED, eaAR=OFFERED_NOT_REPORTED, hasED=false)',
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
