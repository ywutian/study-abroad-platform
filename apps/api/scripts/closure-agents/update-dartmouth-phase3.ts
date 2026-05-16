#!/usr/bin/env tsx
/**
 * Phase 3 — Dartmouth College end-to-end closure of the 7 prediction-critical
 * fields.
 *
 * Source: Dartmouth College CDS 2024-2025 (parsed by Claude from PDF)
 *   URL: https://www.dartmouth.edu/oir/pdfs/cds_2024-2025.pdf
 *   IR Index: https://www.dartmouth.edu/oir/data-reporting/cds/
 *
 * NOTABLE OMISSIONS in Dartmouth's CDS 2024-25 submission:
 *   - Section C9 (SAT/ACT score distribution): ENTIRELY OMITTED. Pages jump
 *     C8G → C10. Dartmouth was test-optional for the Fall 2024 entering class
 *     (per C8F note: "Test Optional Admissions policy ended with the Fall 2024
 *     application cycle. Standardized testing will be required for the Fall
 *     2025 admissions cycle"). They chose not to publish a percentile
 *     distribution for this final test-optional cohort.
 *   - Section C1 residency: Total applicants split (In-State 468 / OOS 21,220
 *     / Intl 9,968), but ADMITS row only shows total (1,710) with blank
 *     residency columns. Only enrolled row is split (25/988/170). No way to
 *     compute intl or oos admit rate.
 *
 * Value changes (vs. existing DB):
 *   - acceptanceRate    : 5.4     → 5.40  (CDS C1: 1,710 admits / 31,656
 *                          applicants = 5.4019% (rounded to 5.40%). Value
 *                          matches prior; tier upgraded LEGACY_DB → OFFICIAL.)
 *   - sat25             : 1490    → null   (CDS C9 entirely omitted. Prior
 *                          LEGACY_DB value cleared; UNAVAILABLE/
 *                          OFFICIAL_BLANK_SECTION.)
 *   - sat75             : 1560    → null   (CDS C9 entirely omitted. Prior
 *                          LEGACY_DB value cleared; UNAVAILABLE/
 *                          OFFICIAL_BLANK_SECTION.)
 *   - intlAcceptanceRate: 2.16    → null   (CDS C1 residency admit row blank;
 *                          only enrolled (170 intl of 1,182) is split.
 *                          Prior INFERRED value cleared; UNAVAILABLE/
 *                          OFFICIAL_BLANK_SECTION.)
 *   - oosAcceptanceRate : 4.66    → null   (Private institution + CDS C1
 *                          residency admit row blank. Prior INFERRED value
 *                          cleared; UNAVAILABLE/TERMINAL per closure-pipeline
 *                          convention for private institutions.)
 *   - edAcceptanceRate  : 19.18   → 19.18  (CDS C21: ED Yes; single plan
 *                          (closing 11/1, notification mid-December — no ED II
 *                          listed). Fall 2024 entering class: 681 admits /
 *                          3,551 ED applications = 19.1777% (rounded to
 *                          19.18%). Value matches prior; tier upgraded
 *                          LEGACY_DB → OFFICIAL.)
 *   - eaAcceptanceRate  : null    → null   (CDS C22: Dartmouth does NOT offer
 *                          a nonbinding Early Action plan ("No" checked).
 *                          Field stays null; provenance refreshed from prior
 *                          CDS_LLM_EXTRACT to UNAVAILABLE/OFFICIAL_BLANK_SECTION/
 *                          NOT_OFFERED.)
 */
import { PrismaClient, Prisma } from '@prisma/client';
import {
  deepMergeRecords,
  toRecord,
} from '../../src/modules/school/school-provenance.helpers';
import { serializeSchoolProvenance } from '@study-abroad/shared/utils';

const DARTMOUTH_CDS_URL =
  'https://www.dartmouth.edu/oir/pdfs/cds_2024-2025.pdf';
const CYCLE_YEAR = 2024; // CDS 2024-2025 = Fall 2024 entering class
const NOW = new Date().toISOString();

const prisma = new PrismaClient();

async function main() {
  const dartmouth = await prisma.school.findFirst({
    where: { id: 'cmn1htko2000hvqf2r5gxwf84' },
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
  if (!dartmouth) throw new Error('Dartmouth College not found');
  console.log(`Updating ${dartmouth.name} (${dartmouth.id})`);
  console.log(
    `  current AR=${dartmouth.acceptanceRate?.toString()} sat25=${dartmouth.sat25} sat75=${dartmouth.sat75}`,
  );
  console.log(
    `  current intlAR=${dartmouth.intlAcceptanceRate?.toString()} oosAR=${dartmouth.oosAcceptanceRate?.toString()}`,
  );
  console.log(
    `  current edAR=${dartmouth.edAcceptanceRate?.toString() ?? 'null'} eaAR=${dartmouth.eaAcceptanceRate?.toString() ?? 'null'}`,
  );

  const baseProv = {
    sourceUrl: DARTMOUTH_CDS_URL,
    cycleYear: CYCLE_YEAR,
    fetchedAt: NOW,
    verifiedAt: NOW,
    confidence: 1.0,
    verifiedBy: 'closure-pipeline-phase3-claude',
    generatedBy: 'phase3-dartmouth-validation',
  };

  const provenance = {
    acceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 5.4,
      policyLabel: 'Overall admit rate',
      reason:
        'CDS 2024-25 Section C1 Total: 1,710 admits (893 men + 795 women + 22 another gender) / 31,656 applicants (15,153 men + 15,812 women + 690 another gender + 1 unknown) = 5.4019% (rounded to 5.40%). Value matches prior DB (5.4); tier upgraded from LEGACY_DB to OFFICIAL/CDS_OFFICIAL with refreshed provenance to current cycle metadata.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat25: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'SAT composite 25th percentile',
      reason:
        'CDS 2024-25 Section C9 (SAT/ACT score distribution) entirely omitted in Dartmouth\'s submission — pages jump from C8G directly to C10 with no C9 header or table. Per C8F: "Test Optional Admissions policy ended with the Fall 2024 application cycle." Dartmouth was test-optional for Fall 2024 entry (final test-optional cohort) and chose not to publish a percentile distribution for this cohort. Class of 2028 admissions profile (1,685 admits, 5.3% rate per Dartmouth News) does not include CDS-style 25th/75th composite percentiles. Prior DB value 1490 was LEGACY_DB_VALUE with no sourceUrl. Cleared to null and marked UNAVAILABLE/OFFICIAL_BLANK_SECTION (NOT_COLLECTED). When Fall 2025 CDS releases (test-required cycle), this field should re-populate.',
      realDataStatus: 'NOT_COLLECTED',
    },
    sat75: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'SAT composite 75th percentile',
      reason:
        "CDS 2024-25 Section C9 entirely omitted in Dartmouth's submission (see sat25 reason). Prior DB value 1560 was LEGACY_DB_VALUE. Cleared to null and marked UNAVAILABLE/OFFICIAL_BLANK_SECTION (NOT_COLLECTED).",
      realDataStatus: 'NOT_COLLECTED',
    },
    intlAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'International admit rate',
      reason:
        'CDS 2024-25 Section C1 residency breakdown: applicants row IS split (In-State 468 / OOS 21,220 / Intl 9,968) but ADMITS row only shows total (1,710) with blank residency columns. Only enrolled row is split (25 in-state / 988 OOS / 170 intl out of 1,182 total enrolled). No way to compute intl admit rate from CDS. Prior DB value 2.16% was INFERRED/PERMANENT_HEURISTIC with no sourceUrl. Cleared to null and marked UNAVAILABLE/OFFICIAL_BLANK_SECTION (NOT_REPORTED).',
      realDataStatus: 'NOT_REPORTED',
    },
    oosAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'TERMINAL',
      confidence: 1.0,
      policyLabel: 'Out-of-state admit rate',
      reason:
        'Dartmouth College is a private Ivy League institution in Hanover, NH; in-state / out-of-state distinction carries no policy meaning (no in-state tuition advantage). Additionally, CDS C1 residency admits row is blank — no OOS admits even if it were policy-relevant (98% of first-year students are from out of state per CDS F1). Prior DB value 4.66% was INFERRED/PERMANENT_HEURISTIC. Cleared to null and marked UNAVAILABLE-terminal per closure-pipeline convention for private institutions.',
      realDataStatus: 'NOT_APPLICABLE',
    },
    edAcceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 19.18,
      policyLabel: 'Early Decision admit rate (single ED plan)',
      reason:
        'CDS 2024-25 Section C21: Dartmouth offers a single Early Decision plan ("Yes" checked) with closing date 11/1 and notification mid-December. No ED II plan listed (Other ED plan closing/notification dates blank). Fall 2024 entering class: 681 admits / 3,551 ED applications = 19.1777% (rounded to 19.18%). Value matches prior DB (19.18); tier upgraded from LEGACY_DB to OFFICIAL/CDS_OFFICIAL with refreshed cycle metadata.',
      realDataStatus: 'VERIFIED_REAL',
    },
    eaAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'Early Action admit rate',
      reason:
        'CDS 2024-25 Section C22: Dartmouth does NOT offer a nonbinding Early Action plan ("No" box checked). Field stays null; provenance refreshed from prior CDS_LLM_EXTRACT_2026_04 (with value=undefined) to authoritative CDS_OFFICIAL pull marked UNAVAILABLE/OFFICIAL_BLANK_SECTION (NOT_OFFERED).',
      realDataStatus: 'NOT_OFFERED',
    },
  };

  const existingMeta = toRecord(dartmouth.metadata);
  const serialized = serializeSchoolProvenance(provenance as any);
  const nextMetadata = {
    ...existingMeta,
    provenance: deepMergeRecords(toRecord(existingMeta.provenance), serialized),
    closureSourceIndex: DARTMOUTH_CDS_URL,
  };

  await prisma.school.update({
    where: { id: dartmouth.id },
    data: {
      acceptanceRate: new Prisma.Decimal('5.40'),
      sat25: null,
      sat75: null,
      intlAcceptanceRate: null,
      oosAcceptanceRate: null,
      edAcceptanceRate: new Prisma.Decimal('19.18'),
      eaAcceptanceRate: null,
      hasEarlyDecision: true,
      lastDataReviewAt: new Date(),
      metadata: nextMetadata,
    },
    select: { id: true },
  });

  console.log(
    '  ✅ updated 7 fields (AR=5.40, sat25=NOT_COLLECTED, sat75=NOT_COLLECTED, intlAR=NOT_REPORTED, oosAR=N/A, edAR=19.18, eaAR=NOT_OFFERED)',
  );

  // verify
  const after = await prisma.school.findUnique({
    where: { id: dartmouth.id },
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
