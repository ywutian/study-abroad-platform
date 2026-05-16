#!/usr/bin/env tsx
/**
 * Phase 3 — Missouri University of Science and Technology (Missouri S&T,
 *   formerly UMR) end-to-end closure of the 7 prediction-critical fields.
 *
 * Source: Missouri S&T CDS 2025-2026 (Fall 2025 entering class) — most recent
 *   posted 4/17/26 by Institutional Research and Data Management.
 *   URL: https://data.mst.edu/media/administrative/data/documents/cds/CDS%202025-26%20Gold%20for%20Posting.xlsx
 *   Landing: https://data.mst.edu/cds/
 *
 * Missouri S&T is a PUBLIC research university (CDS A2 "Public" checked) —
 *   oosAR is in eligible scope and carries the real CDS number, not TERMINAL.
 *
 * Missouri S&T uses SAT/ACT scores in admission decisions (CDS C8 "Yes",
 *   C8A: SAT or ACT marked "Recommended"). Reported CDS C9 SAT Composite
 *   percentiles are OFFICIAL.
 *
 * Value changes (vs. existing DB):
 *   - acceptanceRate    : 81    -> 78.63 (CDS 2025-26 C1: 6,550 admits /
 *                          8,330 applicants = 78.6315%. CORRECTION DOWN from
 *                          prior 81 (LEGACY_DB) — admit pool shifted YoY. Tier
 *                          LEGACY_DB_VALUE -> OFFICIAL.)
 *   - sat25             : 1220  -> 1220  (CDS 2025-26 C9 SAT Composite 25th =
 *                          1220. NO CHANGE in value — tier upgraded from
 *                          CDS_PDF_AUTO (which pointed at a third-party blog,
 *                          clastify.com) to direct CDS_OFFICIAL.)
 *   - sat75             : 1400  -> 1380  (CDS 2025-26 C9 SAT Composite 75th =
 *                          1380. CORRECTION DOWN -20 from prior 1400 (which
 *                          was the 2024-25 SAT 75th value).)
 *   - intlAcceptanceRate: 51.35 -> 56.34 (CDS 2025-26 C1 residency: 1,119 intl
 *                          admits / 1,986 intl applicants = 56.3444%.
 *                          CORRECTION UP ~5pp from prior LEGACY_DB 51.35
 *                          (which was 2024-25 cycle 1371/2670 = 51.35%); intl
 *                          admit policy loosened year-over-year. Tier
 *                          LEGACY_DB_VALUE -> OFFICIAL.)
 *   - oosAcceptanceRate : 80.32 -> 84.35 (CDS 2025-26 C1 residency: 2,845 OOS
 *                          admits / 3,373 OOS applicants = 84.3463%.
 *                          CORRECTION UP ~4pp from prior LEGACY_DB 80.32
 *                          (which was 2024-25 cycle 2263/2817 = 80.33%).
 *                          Missouri S&T is a public engineering research
 *                          university in Rolla, MO — in-state vs. OOS distinction
 *                          carries real policy meaning. Tier LEGACY_DB_VALUE
 *                          -> OFFICIAL.)
 *   - edAcceptanceRate  : null  -> null  (CDS 2025-26 C21: "No" — Missouri
 *                          S&T does NOT offer Early Decision. Replace prior
 *                          provenance (source=CDS_LLM_EXTRACT_2026_04 pointing
 *                          at wrong school — missouristate.edu, a different
 *                          institution) with explicit UNAVAILABLE/
 *                          OFFICIAL_BLANK_SECTION/NOT_OFFERED.)
 *   - eaAcceptanceRate  : null  -> null  (CDS 2025-26 C22: "No" — Missouri
 *                          S&T does NOT offer Early Action. Same correction as
 *                          ED. Replace prior wrong-school provenance.)
 *
 * Cross-check vs. CDS 2024-25 (Fall 2024): C21 X in column 6 (No), C22 X in
 *   column 6 (No) — same answer two cycles in a row. Confirms NOT_OFFERED.
 *
 * NOTE on hasEarlyDecision: current DB value is TRUE, but CDS C21 is "No".
 *   Setting to FALSE to match CDS reality.
 */
import { PrismaClient, Prisma } from '@prisma/client';
import {
  deepMergeRecords,
  toRecord,
} from '../../src/modules/school/school-provenance.helpers';
import { serializeSchoolProvenance } from '@study-abroad/shared/utils';

const CDS_URL =
  'https://data.mst.edu/media/administrative/data/documents/cds/CDS%202025-26%20Gold%20for%20Posting.xlsx';
const CYCLE_YEAR = 2025; // CDS 2025-2026 = Fall 2025 entering class
const NOW = new Date().toISOString();
const SCHOOL_ID = 'cmnwr8iqf0024z0tiy29w0e1z';

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
  if (!school) throw new Error(`School ${SCHOOL_ID} (Missouri S&T) not found`);
  console.log(`Updating ${school.name} (${school.id})`);
  console.log(`  isPrivate=${school.isPrivate}  [PUBLIC SCHOOL]`);
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
    verifiedBy: 'closure-pipeline-phase3-batch22-claude',
    generatedBy: 'phase3-mst-validation',
  };

  const provenance = {
    acceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 78.63,
      policyLabel: 'Overall admit rate',
      reason:
        'CDS 2025-26 Section C1: 6,550 admits / 8,330 first-time, first-year applicants = 78.6315% (rounded to 78.63%). CORRECTION DOWN ~2.4pp from prior LEGACY_DB 81. Tier LEGACY_DB_VALUE -> OFFICIAL.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat25: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1220,
      policyLabel: 'SAT composite 25th percentile (reported composite row)',
      reason:
        'CDS 2025-26 Section C9: SAT Composite 25th = 1220 (reported directly). No change in value but source corrected: prior provenance pointed at clastify.com (third-party blog), now replaced with direct CDS_OFFICIAL xlsx. NOTE: Missouri S&T uses SAT/ACT in admission decisions (CDS C8 "Yes", C8A "Recommended"); 11.7% (147) of enrolled freshmen submitted SAT, 68.2% (853) submitted ACT (ACT Composite 25/50/75 = 25/28/31).',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat75: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1380,
      policyLabel: 'SAT composite 75th percentile (reported composite row)',
      reason:
        'CDS 2025-26 Section C9: SAT Composite 75th = 1380 (reported directly). CORRECTION DOWN -20 from prior 1400 (which matched the 2024-25 cycle SAT 75th); 2025-26 cycle reported a lower SAT 75th. Source corrected from clastify.com to direct CDS_OFFICIAL xlsx.',
      realDataStatus: 'VERIFIED_REAL',
    },
    intlAcceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 56.34,
      policyLabel: 'International admit rate',
      reason:
        'CDS 2025-26 Section C1 residency table: 1,119 international admits / 1,986 international applicants = 56.3444% (rounded to 56.34%). CORRECTION UP ~5pp from prior LEGACY_DB 51.35 (which was 2024-25 cycle: 1,371 intl admits / 2,670 intl applicants = 51.35%). Intl applicant pool shrank ~26% YoY (2670 -> 1986) while admits dropped ~18% (1371 -> 1119), lifting the intl admit rate. Tier LEGACY_DB_VALUE -> OFFICIAL.',
      realDataStatus: 'VERIFIED_REAL',
    },
    oosAcceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 84.35,
      policyLabel: 'Out-of-state admit rate',
      reason:
        'CDS 2025-26 Section C1 residency table: 2,845 out-of-state admits / 3,373 out-of-state applicants = 84.3463% (rounded to 84.35%). CORRECTION UP ~4pp from prior LEGACY_DB 80.32 (which was 2024-25 cycle: 2,263 OOS admits / 2,817 OOS applicants = 80.33%). Missouri S&T is a PUBLIC engineering research university (Rolla, MO) — in-state vs. OOS distinction carries policy meaning (tuition, residency-preference admit pathways). Tier LEGACY_DB_VALUE -> OFFICIAL.',
      realDataStatus: 'VERIFIED_REAL',
    },
    edAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'Early Decision admit rate',
      reason:
        'CDS 2025-26 Section C21: "Does your institution offer an early decision plan?" — NO checked (cross-confirmed in CDS 2024-25 C21 = No). Missouri S&T does NOT offer Early Decision. Field stays cleared (UNAVAILABLE/OFFICIAL_BLANK_SECTION/NOT_OFFERED). Replaces prior provenance which incorrectly cited missouristate.edu (Missouri State University, a different institution). Also corrects stale hasEarlyDecision=true.',
      realDataStatus: 'NOT_OFFERED',
    },
    eaAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'Early Action admit rate',
      reason:
        'CDS 2025-26 Section C22: "Do you have a nonbinding early action plan?" — NO checked (cross-confirmed in CDS 2024-25 C22 = No). Missouri S&T does NOT offer Early Action. Field stays cleared (UNAVAILABLE/OFFICIAL_BLANK_SECTION/NOT_OFFERED). Replaces prior wrong-school provenance.',
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
      acceptanceRate: new Prisma.Decimal('78.63'),
      sat25: 1220,
      sat75: 1380,
      intlAcceptanceRate: new Prisma.Decimal('56.34'),
      oosAcceptanceRate: new Prisma.Decimal('84.35'),
      edAcceptanceRate: null,
      eaAcceptanceRate: null,
      // CDS C21 "No" — Missouri S&T does not offer ED; correct stale DB true
      hasEarlyDecision: false,
      lastDataReviewAt: new Date(),
      metadata: nextMetadata,
    },
    select: { id: true },
  });

  console.log(
    '  ✅ updated 7 fields (AR=78.63, sat25=1220, sat75=1380, intlAR=56.34, oosAR=84.35, edAR=NOT_OFFERED, eaAR=NOT_OFFERED, hasED=false)',
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
