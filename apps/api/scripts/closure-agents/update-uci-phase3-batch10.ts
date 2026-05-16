#!/usr/bin/env tsx
/**
 * Phase 3 — University of California, Irvine (UCI) end-to-end closure of the 7
 * prediction-critical fields.
 *
 * Source: UCI CDS 2024-2025 (Office of Institutional Research, Assessment and
 *   Planning — IRAP). Index page:
 *     https://irap.uci.edu/institutional-research/data-hub/common-data-set/
 *   Direct PDF:
 *     https://bpb-us-e2.wpmucdn.com/sites.uci.edu/dist/2/5478/files/2025/09/CDS-2024-25.pdf
 *
 * UCI is a PUBLIC institution (University of California system). Per closure-
 * pipeline convention:
 *   - isPrivate=false  →  oosAcceptanceRate is in eligible scope and MUST carry
 *     a real OFFICIAL number extracted from CDS C1 residency table.
 *   - oosAR is NEVER marked UNAVAILABLE/TERMINAL for public schools.
 *
 * Test policy (CDS C8): "Does your institution make use of SAT or ACT scores
 *   in admission decisions?" — NO checked. C8F clarifies: "Standardized exams
 *   (SAT, ACT) are not used for admissions or scholarship decisions. Exam
 *   scores may be used after admission for class placement, or to satisfy
 *   certain graduation requirements." → UCI is **TEST-BLIND** (consistent with
 *   the system-wide UC test-blind policy in effect for Fall 2024).
 *
 * Because UCI is test-blind, C9 SAT/ACT percentile tables are intentionally
 * blank (UCI does not collect SAT/ACT scores from applicants for the purpose
 * of admission). sat25/sat75 are therefore marked tier=UNAVAILABLE,
 * source=OFFICIAL_BLANK_SECTION, realDataStatus=NOT_COLLECTED. Prior DB values
 * 1250 / 1430 are cleared.
 *
 * Early plans:
 *   - C21 Early Decision: "No" — UCI does NOT offer ED (UC system policy).
 *   - C22 Early Action: "No" — UCI does NOT offer EA (UC system policy).
 *   Both fields stay null with UNAVAILABLE/OFFICIAL_BLANK_SECTION/NOT_OFFERED.
 *
 * Value changes (vs. existing DB):
 *   - acceptanceRate    : 28.8    → 28.78  (CDS C1: 35,317 admits / 122,706
 *                          applicants = 28.7811%. Tier upgraded from
 *                          LEGACY_DB_VALUE (value 28.8, sourceUrl pointed to
 *                          UCOP system aggregate report — not UCI's own CDS)
 *                          to OFFICIAL with minor precision adjustment.)
 *   - sat25             : 1250    → null   (UCI is test-blind; CDS C9 SAT
 *                          percentiles are blank. Stale DB value 1250 cleared.
 *                          Marked UNAVAILABLE/OFFICIAL_BLANK_SECTION/
 *                          NOT_COLLECTED.)
 *   - sat75             : 1430    → null   (UCI is test-blind; CDS C9 SAT
 *                          percentiles are blank. Stale DB value 1430 cleared.
 *                          Marked UNAVAILABLE/OFFICIAL_BLANK_SECTION/
 *                          NOT_COLLECTED.)
 *   - intlAcceptanceRate: 43.1    → 43.14  (CDS C1 residency: 8,358 intl
 *                          admits / 19,376 intl applicants = 43.1359%. Minor
 *                          precision upgrade; tier LEGACY_DB_VALUE → OFFICIAL.)
 *   - oosAcceptanceRate : 49.9    → 49.76  (CDS C1 residency: 7,858 OOS admits
 *                          / 15,792 OOS applicants = 49.7593%. Minor precision
 *                          adjustment from prior 49.9 (UCOP aggregate);
 *                          tier LEGACY_DB_VALUE → OFFICIAL. **PUBLIC SCHOOL —
 *                          oosAR carries the real OFFICIAL number, not
 *                          TERMINAL.**)
 *   - edAcceptanceRate  : null    → null   (CDS C21 "No" — UCI does NOT offer
 *                          ED. Stays UNAVAILABLE/OFFICIAL_BLANK_SECTION/
 *                          NOT_OFFERED.)
 *   - eaAcceptanceRate  : null    → null   (CDS C22 "No" — UCI does NOT offer
 *                          EA. Stays UNAVAILABLE/OFFICIAL_BLANK_SECTION/
 *                          NOT_OFFERED.)
 */
import { PrismaClient, Prisma } from '@prisma/client';
import {
  deepMergeRecords,
  toRecord,
} from '../../src/modules/school/school-provenance.helpers';
import { serializeSchoolProvenance } from '@study-abroad/shared/utils';

const CDS_URL =
  'https://bpb-us-e2.wpmucdn.com/sites.uci.edu/dist/2/5478/files/2025/09/CDS-2024-25.pdf';
const CDS_INDEX =
  'https://irap.uci.edu/institutional-research/data-hub/common-data-set/';
const CYCLE_YEAR = 2024; // CDS 2024-2025 = Fall 2024 entering class
const NOW = new Date().toISOString();
const SCHOOL_ID = 'cmn1htkp6000xvqf2rhj774d8';

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
  if (!school) throw new Error(`School ${SCHOOL_ID} (UC Irvine) not found`);
  console.log(`Updating ${school.name} (${school.id})`);
  console.log(
    `  isPrivate=${school.isPrivate}  [PUBLIC, UC system, test-blind]`,
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
    generatedBy: 'phase3-uci-validation',
  };

  const provenance = {
    acceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 28.78,
      policyLabel: 'Overall admit rate',
      reason:
        "CDS 2024-25 Section C1: 35,317 admits / 122,706 applicants = 28.7811% (rounded to 28.78%). Tier upgraded from LEGACY_DB_VALUE (value 28.8, sourceUrl pointed to UCOP system-wide aggregate report — not UCI's own CDS) to OFFICIAL with minor precision adjustment.",
      realDataStatus: 'VERIFIED_REAL',
    },
    sat25: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'SAT composite 25th percentile',
      reason:
        'CDS 2024-25 Section C8: "Does your institution make use of SAT or ACT scores in admission decisions?" — NO. C8F: "Standardized exams (SAT, ACT) are not used for admissions or scholarship decisions." UCI is TEST-BLIND (UC system-wide policy effective Fall 2024). Consequently C9 SAT percentile table is intentionally blank — UCI does not collect SAT scores from applicants for admission purposes. Stale DB value 1250 (no traceable source url in prior provenance) cleared. Marked UNAVAILABLE/OFFICIAL_BLANK_SECTION/NOT_COLLECTED.',
      realDataStatus: 'NOT_COLLECTED',
    },
    sat75: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'SAT composite 75th percentile',
      reason:
        'CDS 2024-25 Section C8: "Does your institution make use of SAT or ACT scores in admission decisions?" — NO. C8F: "Standardized exams (SAT, ACT) are not used for admissions or scholarship decisions." UCI is TEST-BLIND (UC system-wide policy effective Fall 2024). Consequently C9 SAT percentile table is intentionally blank. Stale DB value 1430 cleared. Marked UNAVAILABLE/OFFICIAL_BLANK_SECTION/NOT_COLLECTED.',
      realDataStatus: 'NOT_COLLECTED',
    },
    intlAcceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 43.14,
      policyLabel: 'International admit rate',
      reason:
        "CDS 2024-25 Section C1 residency table: 8,358 international admits / 19,376 international applicants = 43.1359% (rounded to 43.14%). Tier upgraded from LEGACY_DB_VALUE (value 43.1, sourceUrl pointed to UCOP system aggregate) to OFFICIAL with refreshed provenance pointing at UCI's own CDS PDF.",
      realDataStatus: 'VERIFIED_REAL',
    },
    oosAcceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 49.76,
      policyLabel: 'Out-of-state admit rate',
      reason:
        'CDS 2024-25 Section C1 residency table: 7,858 out-of-state admits / 15,792 out-of-state applicants = 49.7593% (rounded to 49.76%). UCI is a PUBLIC UC system institution — in-state vs. out-of-state distinction carries real policy meaning (different tuition, residency-preference pathways), so this field is in eligible scope and MUST carry a real CDS number. Minor downward precision adjustment from prior 49.9 (UCOP system aggregate); tier upgraded LEGACY_DB_VALUE → OFFICIAL. (PUBLIC SCHOOL — oosAR carries the real number, never marked TERMINAL.)',
      realDataStatus: 'VERIFIED_REAL',
    },
    edAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'Early Decision admit rate',
      reason:
        'CDS 2024-25 Section C21: "Does your institution offer an early decision plan?" — NO checked. UCI does NOT offer Early Decision (UC system policy — no UC campus offers ED or EA). Field stays cleared. UNAVAILABLE/OFFICIAL_BLANK_SECTION/NOT_OFFERED.',
      realDataStatus: 'NOT_OFFERED',
    },
    eaAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'Early Action admit rate',
      reason:
        'CDS 2024-25 Section C22: "Do you have a nonbinding early action plan?" — NO checked. UCI does NOT offer Early Action (UC system policy — single November 1-30 application window with March/April notification, no early plans). Field stays cleared. UNAVAILABLE/OFFICIAL_BLANK_SECTION/NOT_OFFERED.',
      realDataStatus: 'NOT_OFFERED',
    },
  };

  const existingMeta = toRecord(school.metadata);
  const serialized = serializeSchoolProvenance(provenance as any);
  const nextMetadata = {
    ...existingMeta,
    provenance: deepMergeRecords(toRecord(existingMeta.provenance), serialized),
    closureSourceIndex: CDS_INDEX,
  };

  // Bypass SchoolWriteService (schema drift). Minimal update with explicit select.
  await prisma.school.update({
    where: { id: school.id },
    data: {
      acceptanceRate: new Prisma.Decimal('28.78'),
      sat25: null,
      sat75: null,
      intlAcceptanceRate: new Prisma.Decimal('43.14'),
      oosAcceptanceRate: new Prisma.Decimal('49.76'),
      edAcceptanceRate: null,
      eaAcceptanceRate: null,
      // CDS C21 "No", C22 "No" — UCI offers neither ED nor EA.
      // hasEarlyDecision stays false (correctly already false in DB).
      lastDataReviewAt: new Date(),
      metadata: nextMetadata,
    },
    select: { id: true },
  });

  console.log(
    '  ✅ updated 7 fields (AR=28.78, sat25=NOT_COLLECTED, sat75=NOT_COLLECTED, intlAR=43.14, oosAR=49.76, edAR=NOT_OFFERED, eaAR=NOT_OFFERED)',
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
    `  AR=${after?.acceptanceRate?.toString()} sat25=${after?.sat25 ?? 'null'} sat75=${after?.sat75 ?? 'null'}`,
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
