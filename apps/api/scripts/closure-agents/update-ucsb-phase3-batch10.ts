#!/usr/bin/env tsx
/**
 * Phase 3 batch 10 — University of California, Santa Barbara (UCSB) end-to-end
 * closure of the 7 prediction-critical fields.
 *
 * Source: UCSB Common Data Set 2025-2026 (Fall 2025 entering class),
 *   published by UCSB Office of Budget & Planning, Institutional Research.
 *   PDF: hosted on Google Drive — common.data.set.2025.26.pdf
 *   Direct: https://drive.google.com/file/d/1FIkvY5dANho45ioG7-JHgO3IPH6-ui1W/view
 *   Index: https://bap.ucsb.edu/institutional-research
 *
 * KEY UCSB POLICIES (drive the closure decisions):
 *   - UCSB is **test-blind** (CDS 2025-26 C8A: "Does your institution make use
 *     of SAT or ACT scores in admission decisions? — No"; C8A admission row
 *     SAT/ACT marked "Not considered for admission, even if submitted"; C8G
 *     placement uses AP + Institutional Exam + UC-AWPE State Exam). UCSB's
 *     CDS C9 SAT/ACT 25th/50th/75th percentile cells are entirely BLANK.
 *     -> sat25/sat75 set to UNAVAILABLE/OFFICIAL_BLANK_SECTION.
 *   - UCSB is a **public** UC institution. UCSB completes the CDS C1
 *     residency breakdown. OOS / international admit rates carry real policy
 *     meaning (nonresident supplemental tuition), so per closure convention
 *     they MUST carry a real OFFICIAL CDS number, never TERMINAL.
 *   - UC system uniformly does NOT offer Early Decision (CDS C21 "No") or
 *     Early Action (CDS C22 "No"). -> edAR/eaAR UNAVAILABLE/OFFICIAL_BLANK_SECTION.
 *
 * Value changes (vs. existing DB):
 *   - acceptanceRate    : 32.9   -> 38.20  (UCSB CDS 2025-26 C1 Total:
 *                          42,093 admits (M 16,945 + W 23,627 + Unknown
 *                          1,521) / 110,187 applicants (M 48,509 + W 58,374
 *                          + Unknown 3,304) = 38.2018% (rounds to 38.20%).
 *                          Gender table Total and residency table Total
 *                          MATCH for UCSB (both 110,187 / 42,093). BIG
 *                          UPWARD CORRECTION +5.30pp from prior LEGACY_DB
 *                          32.9 (older cycle, possibly Fall 2023 32.9%).
 *                          Tier upgraded LEGACY_DB -> OFFICIAL, sourced from
 *                          UCSB IR CDS.)
 *   - sat25             : 1290   -> null   (UCSB is test-blind. CDS 2025-26
 *                          C9 SAT Composite 25th/50th/75th percentile cells
 *                          are BLANK because scores are not collected/used
 *                          in admissions. Prior LEGACY_DB value 1290 (no
 *                          source URL) is not from any UCSB-published CDS;
 *                          UCSB has not reported SAT percentiles since
 *                          adopting test-blind in Fall 2021. Field cleared;
 *                          UNAVAILABLE/OFFICIAL_BLANK_SECTION/NOT_COLLECTED.)
 *   - sat75             : 1460   -> null   (Same rationale as sat25. Prior
 *                          LEGACY_DB 1460 cleared.)
 *   - intlAcceptanceRate: 30.4   -> 47.59  (UCSB CDS 2025-26 C1 residency
 *                          table: 8,868 international admits / 18,634
 *                          international applicants = 47.5904% (rounds to
 *                          47.59%). BIG UPWARD CORRECTION +17.19pp from
 *                          prior LEGACY_DB 30.4 (older cycle). Tier
 *                          upgraded LEGACY_DB -> OFFICIAL.)
 *   - oosAcceptanceRate : 38.5   -> 54.50  (UCSB CDS 2025-26 C1 residency
 *                          table: 9,302 out-of-state admits / 17,067
 *                          out-of-state applicants = 54.5028% (rounds to
 *                          54.50%). UCSB is a public UC institution — in-
 *                          state vs. OOS distinction carries real policy
 *                          meaning (nonresident supplemental tuition), so
 *                          this field MUST carry a real CDS number and is
 *                          NOT marked TERMINAL. BIG UPWARD CORRECTION
 *                          +16.00pp from prior LEGACY_DB 38.5. Tier
 *                          upgraded LEGACY_DB -> OFFICIAL.)
 *   - edAcceptanceRate  : null   -> null   (UCSB CDS 2025-26 C21: "No".
 *                          UC system uniformly does not offer Early
 *                          Decision. Field stays cleared. Provenance
 *                          anchored to UCSB IR CDS as UNAVAILABLE/
 *                          OFFICIAL_BLANK_SECTION/NOT_OFFERED.)
 *   - eaAcceptanceRate  : null   -> null   (UCSB CDS 2025-26 C22: "No".
 *                          UC system uniformly does not offer Early
 *                          Action. Field stays cleared. Provenance
 *                          anchored to UCSB IR CDS as UNAVAILABLE/
 *                          OFFICIAL_BLANK_SECTION/NOT_OFFERED.)
 */
import { PrismaClient, Prisma } from '@prisma/client';
import {
  deepMergeRecords,
  toRecord,
} from '../../src/modules/school/school-provenance.helpers';
import { serializeSchoolProvenance } from '@study-abroad/shared/utils';

const CDS_URL =
  'https://drive.google.com/file/d/1FIkvY5dANho45ioG7-JHgO3IPH6-ui1W/view';
const CDS_INDEX_URL = 'https://bap.ucsb.edu/institutional-research';
const CYCLE_YEAR = 2025; // CDS 2025-2026 = Fall 2025 entering class
const NOW = new Date().toISOString();
const SCHOOL_ID = 'cmn1htkpb000zvqf2645ltfg6';

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
  if (!school) throw new Error(`School ${SCHOOL_ID} (UCSB) not found`);
  console.log(`Updating ${school.name} (${school.id})`);
  console.log(
    `  isPrivate=${school.isPrivate}  [PUBLIC UC — oosAR must be OFFICIAL]`,
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
    generatedBy: 'phase3-batch10-ucsb-validation',
    notes: `CDS index: ${CDS_INDEX_URL}`,
  };

  const provenance = {
    acceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 38.2,
      policyLabel: 'Overall admit rate',
      reason:
        'UCSB CDS 2025-26 Section C1 Total: 42,093 admits (Men 16,945 + Women 23,627 + Unknown 1,521) / 110,187 applicants (Men 48,509 + Women 58,374 + Unknown 3,304) = 38.2018% (rounds to 38.20%). Gender table Total and residency table Total MATCH for UCSB (both 110,187 apps / 42,093 admits). BIG UPWARD CORRECTION +5.30pp from prior LEGACY_DB 32.9 (older cycle). Tier upgraded LEGACY_DB -> OFFICIAL, sourced from UCSB IR CDS.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat25: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'SAT composite 25th percentile',
      reason:
        'UCSB is test-blind (CDS 2025-26 C8A: "Does your institution make use of SAT or ACT scores in admission decisions? — No"; SAT/ACT admission row marked "Not considered for admission, even if submitted"; C8G placement only via AP + Institutional Exam + UC-AWPE State Exam). UCSB CDS C9 SAT Composite percentile cells are entirely BLANK. Prior LEGACY_DB value 1290 (no source URL) is not from any UCSB-published CDS — UCSB has not reported SAT percentiles since adopting test-blind in Fall 2021. Field cleared; UNAVAILABLE/OFFICIAL_BLANK_SECTION/NOT_COLLECTED.',
      realDataStatus: 'OFFICIAL_BLANK',
    },
    sat75: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'SAT composite 75th percentile',
      reason:
        'UCSB is test-blind; CDS 2025-26 C9 SAT Composite percentile cells blank. Same rationale as sat25. Prior LEGACY_DB 1460 cleared.',
      realDataStatus: 'OFFICIAL_BLANK',
    },
    intlAcceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 47.59,
      policyLabel: 'International admit rate',
      reason:
        'UCSB CDS 2025-26 Section C1 residency table: 8,868 international admits / 18,634 international applicants = 47.5904% (rounds to 47.59%). BIG UPWARD CORRECTION +17.19pp from prior LEGACY_DB 30.4 (older cycle). Tier upgraded LEGACY_DB -> OFFICIAL.',
      realDataStatus: 'VERIFIED_REAL',
    },
    oosAcceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 54.5,
      policyLabel: 'Out-of-state admit rate',
      reason:
        'UCSB CDS 2025-26 Section C1 residency table: 9,302 out-of-state admits / 17,067 out-of-state applicants = 54.5028% (rounds to 54.50%). UCSB is a public UC institution — in-state vs. out-of-state distinction carries real policy meaning (nonresident supplemental tuition surcharge), so this field MUST carry a real CDS number and is NOT marked TERMINAL. BIG UPWARD CORRECTION +16.00pp from prior LEGACY_DB 38.5. Tier upgraded LEGACY_DB -> OFFICIAL.',
      realDataStatus: 'VERIFIED_REAL',
    },
    edAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'Early Decision admit rate',
      reason:
        'UCSB CDS 2025-26 Section C21: "Does your institution offer an early decision plan?" — NO. The UC system uniformly does not offer Early Decision (all UC campuses share the system-wide UC Application with one November application window for fall enrollment). Field stays cleared (UNAVAILABLE/OFFICIAL_BLANK_SECTION).',
      realDataStatus: 'NOT_OFFERED',
    },
    eaAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'Early Action admit rate',
      reason:
        'UCSB CDS 2025-26 Section C22: "Do you have a nonbinding early action plan?" — NO. The UC system uniformly does not offer Early Action. Field stays cleared (UNAVAILABLE/OFFICIAL_BLANK_SECTION).',
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
      acceptanceRate: new Prisma.Decimal('38.20'),
      sat25: null,
      sat75: null,
      intlAcceptanceRate: new Prisma.Decimal('47.59'),
      oosAcceptanceRate: new Prisma.Decimal('54.50'),
      edAcceptanceRate: null,
      eaAcceptanceRate: null,
      hasEarlyDecision: false,
      lastDataReviewAt: new Date(),
      metadata: nextMetadata,
    },
    select: { id: true },
  });

  console.log(
    '  ✅ updated 7 fields (AR=38.20, sat25=null[test-blind], sat75=null[test-blind], intlAR=47.59, oosAR=54.50, edAR=NOT_OFFERED, eaAR=NOT_OFFERED, hasED=false)',
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
