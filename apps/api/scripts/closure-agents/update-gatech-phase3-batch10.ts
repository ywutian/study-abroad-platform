#!/usr/bin/env tsx
/**
 * Phase 3 — Georgia Institute of Technology (Georgia Tech) end-to-end closure
 * of the 7 prediction-critical fields.
 *
 * Source: GaTech CDS 2024-2025 (Office of Institutional Research and Planning)
 *   URL: https://irp.gatech.edu/files/CDS/CDS_2024-2025_FINAL_20FEB2025.pdf
 *
 * NOTE: Georgia Tech is a PUBLIC institution (Georgia Board of Regents). Per
 *   closure-pipeline convention:
 *     - isPrivate=false  →  oosAcceptanceRate is in eligible scope and MUST
 *       carry a real OFFICIAL number extracted from CDS C1 residency table.
 *     - oosAR is NEVER marked UNAVAILABLE/TERMINAL for public schools.
 *
 * Test policy (CDS C8A): SAT or ACT "Required to be considered for admission"
 *   (NOT test-blind, NOT test-optional). SAT/ACT scores are USED and gating.
 *   SAT Composite 25/75 are OFFICIAL and material.
 *
 * Early plans:
 *   - C21 Early Decision: "No" — Georgia Tech does NOT offer ED.
 *   - C22 Early Action: "Yes" — Georgia Tech offers EA (11/1 close, 1/31 notify,
 *     non-restrictive). HOWEVER the C22 section in this CDS does NOT publish
 *     EA applicant/admit counts (only the dates and "restrictive: No"). Per
 *     closure-pipeline convention, an offered-but-unpublished plan is recorded
 *     as eaAR=null with tier=UNAVAILABLE source=OFFICIAL_BLANK_SECTION (the
 *     section is officially blank for the metric). The stale DB value of 14.65
 *     (no traceable source url in prior provenance) is cleared.
 *
 * Value changes (vs. existing DB):
 *   - acceptanceRate    : 14      → 14.07  (CDS C1: 8,413 admits / 59,789
 *                          applicants = 14.0728%. Minor precision upgrade.
 *                          Tier LEGACY_DB_VALUE → OFFICIAL.)
 *   - sat25             : 1400    → 1370   (CDS C9 SAT Composite 25th = 1370
 *                          reported directly. CORRECTION DOWN -30 from prior
 *                          1400 (LEGACY_DB heuristic).)
 *   - sat75             : 1530    → 1530   (CDS C9 SAT Composite 75th = 1530.
 *                          Value matches DB; tier LEGACY_DB → OFFICIAL.)
 *   - intlAcceptanceRate: 8.2     → 8.20   (CDS C1 residency: 885 intl admits /
 *                          10,795 intl applicants = 8.1982%. Value matches;
 *                          tier LEGACY_DB → OFFICIAL.)
 *   - oosAcceptanceRate : 10.42   → 10.42  (CDS C1 residency: 3,992 OOS admits
 *                          / 38,320 OOS applicants = 10.4175%. Value matches;
 *                          tier LEGACY_DB → OFFICIAL. **PUBLIC SCHOOL — oosAR
 *                          carries the real OFFICIAL number, not TERMINAL.**)
 *   - edAcceptanceRate  : null    → null   (CDS C21 "No" — GaTech does NOT
 *                          offer ED. Field stays null with UNAVAILABLE /
 *                          OFFICIAL_BLANK_SECTION / NOT_OFFERED.)
 *   - eaAcceptanceRate  : 14.65   → null   (CDS C22 "Yes" GaTech offers EA but
 *                          this CDS section does not publish EA app/admit
 *                          counts. Stale DB value 14.65 (no source url in
 *                          provenance) cleared. Marked UNAVAILABLE /
 *                          OFFICIAL_BLANK_SECTION.)
 */
import { PrismaClient, Prisma } from '@prisma/client';
import {
  deepMergeRecords,
  toRecord,
} from '../../src/modules/school/school-provenance.helpers';
import { serializeSchoolProvenance } from '@study-abroad/shared/utils';

const CDS_URL =
  'https://irp.gatech.edu/files/CDS/CDS_2024-2025_FINAL_20FEB2025.pdf';
const CYCLE_YEAR = 2024; // CDS 2024-2025 = Fall 2024 entering class
const NOW = new Date().toISOString();
const SCHOOL_ID = 'cmn1htkp4000wvqf2ah317ku6';

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
  if (!school) throw new Error(`School ${SCHOOL_ID} (Georgia Tech) not found`);
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
    generatedBy: 'phase3-gatech-validation',
  };

  const provenance = {
    acceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 14.07,
      policyLabel: 'Overall admit rate',
      reason:
        'CDS 2024-25 Section C1: 8,413 admits / 59,789 applicants = 14.0728% (rounded to 14.07%). Tier upgraded from LEGACY_DB_VALUE (value 14, sourceUrl pointed to collegekickstart.com aggregator) to OFFICIAL with minor precision adjustment.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat25: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1370,
      policyLabel: 'SAT composite 25th percentile (reported composite row)',
      reason:
        'CDS 2024-25 Section C9: SAT Composite 25th = 1370 (reported directly; EBRW 680 + Math 690 sum = 1370 also coincides). CORRECTION DOWN -30 from prior 1400 (LEGACY_DB heuristic). Test policy CDS C8A "Required to be considered for admission" — SAT scores ARE used in admission, this is a material number.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat75: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1530,
      policyLabel: 'SAT composite 75th percentile (reported composite row)',
      reason:
        'CDS 2024-25 Section C9: SAT Composite 75th = 1530 (reported directly; EBRW 750 + Math 790 sum = 1540 differs because composite quantiles ≠ section sums). Value matches prior DB; tier upgraded LEGACY_DB_VALUE → OFFICIAL.',
      realDataStatus: 'VERIFIED_REAL',
    },
    intlAcceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 8.2,
      policyLabel: 'International admit rate',
      reason:
        'CDS 2024-25 Section C1 residency table: 885 international admits / 10,795 international applicants = 8.1982% (rounded to 8.20%). Value matches prior DB (8.2); tier upgraded LEGACY_DB_VALUE → OFFICIAL with refreshed provenance pointing directly at GaTech IRP CDS PDF.',
      realDataStatus: 'VERIFIED_REAL',
    },
    oosAcceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 10.42,
      policyLabel: 'Out-of-state admit rate',
      reason:
        'CDS 2024-25 Section C1 residency table: 3,992 out-of-state admits / 38,320 out-of-state applicants = 10.4175% (rounded to 10.42%). Georgia Tech is a PUBLIC University System of Georgia institution — in-state vs. out-of-state distinction carries real policy meaning (different tuition, residency-preference admit pathways), so this field is in eligible scope and MUST carry a real CDS number. Value matches prior DB (10.42); tier upgraded LEGACY_DB_VALUE → OFFICIAL. (PUBLIC SCHOOL — oosAR carries the real number, never marked TERMINAL.)',
      realDataStatus: 'VERIFIED_REAL',
    },
    edAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'Early Decision admit rate',
      reason:
        'CDS 2024-25 Section C21: "Does your institution offer an early decision plan?" — NO checked. Georgia Tech does NOT offer Early Decision (the EA plan listed in C22 is non-binding and non-restrictive). Field stays cleared (UNAVAILABLE/OFFICIAL_BLANK_SECTION/NOT_OFFERED). Provenance refreshed to 2024-25 cycle authoritative source.',
      realDataStatus: 'NOT_OFFERED',
    },
    eaAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'Early Action admit rate',
      reason:
        'CDS 2024-25 Section C22: "Do you have a nonbinding early action plan?" — YES checked. Georgia Tech offers EA (11/1 closing, 1/31 notification, non-restrictive). HOWEVER C22 in this CDS does NOT publish EA applicant or admit counts — only dates and the restrictive flag. Per closure-pipeline convention an offered-but-unpublished plan is recorded as eaAR=null with tier=UNAVAILABLE source=OFFICIAL_BLANK_SECTION (the section is officially blank for the metric). Stale DB value 14.65 (no traceable source url in prior provenance — flagged as LEGACY_DB_VALUE) is cleared.',
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

  // Bypass SchoolWriteService (schema drift). Minimal update with explicit select.
  await prisma.school.update({
    where: { id: school.id },
    data: {
      acceptanceRate: new Prisma.Decimal('14.07'),
      sat25: 1370,
      sat75: 1530,
      intlAcceptanceRate: new Prisma.Decimal('8.20'),
      oosAcceptanceRate: new Prisma.Decimal('10.42'),
      edAcceptanceRate: null,
      eaAcceptanceRate: null,
      // CDS C21 "No", C22 "Yes" — GaTech offers EA only, no ED.
      // hasEarlyDecision stays false (correctly already false in DB).
      lastDataReviewAt: new Date(),
      metadata: nextMetadata,
    },
    select: { id: true },
  });

  console.log(
    '  ✅ updated 7 fields (AR=14.07, sat25=1370, sat75=1530, intlAR=8.20, oosAR=10.42, edAR=NOT_OFFERED, eaAR=OFFERED_NOT_REPORTED)',
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
