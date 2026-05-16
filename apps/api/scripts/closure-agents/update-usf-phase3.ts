#!/usr/bin/env tsx
/**
 * Phase 3 — University of South Florida (USF) end-to-end closure of the 7
 * prediction-critical fields.
 *
 * Source: USF CDS 2024-2025 (Fall 2024 entering class).
 *   URL: https://www.usf.edu/ods/documents/cds/cds-2024-2025-final.pdf
 *
 * USF is a PUBLIC Florida State University System research institution:
 *   - isPrivate=false  ->  oosAcceptanceRate is in eligible scope, MUST carry
 *     a real OFFICIAL number from CDS C1 residency table.
 *   - oosAR is NOT marked UNAVAILABLE/TERMINAL.
 *
 * USF is **test-required** per CDS C8A: "Required to be considered for
 * admission" is checked for SAT/ACT — SAT/ACT scores are required, so the
 * reported SAT band is a real admission gate (not merely descriptive).
 *
 * Value changes (vs. existing DB):
 *   - acceptanceRate    : 43.19  -> 43.19  (CDS C1 residency: 29,621 admits /
 *                          68,576 applicants = 43.1907%. No value change;
 *                          tier upgrade LEGACY_DB -> OFFICIAL. NOTE: USF's
 *                          residency mix is unusual — OOS applied (60,474)
 *                          dominates IS applied (7,508), driven by USF's
 *                          large national/online recruitment.)
 *   - sat25             : 1230   -> 1130   (CDS C9: USF does not publish a
 *                          separate SAT Composite line — the Composite row is
 *                          blank and the Composite score-range distribution
 *                          totals 0%. Per closure-pipeline convention (cf.
 *                          UBuffalo), sum the EBRW + Math 25th percentiles:
 *                          580 + 550 = 1130. CORRECTION DOWN from prior 1230
 *                          (SEED/PR-15 heuristic likely overstated). NOTE:
 *                          this is a sub-section sum, not a true composite
 *                          percentile, but it is the canonical CDS-derivable
 *                          composite when the composite row is unreported.)
 *   - sat75             : 1390   -> 1320   (CDS C9: SAT EBRW 75th=660 + SAT
 *                          Math 75th=660 = 1320. CORRECTION DOWN from prior
 *                          1390.)
 *   - intlAcceptanceRate: 89.9   -> 89.90  (CDS C1 residency: 534 intl admits
 *                          / 594 intl applicants = 89.8990% (rounded to
 *                          89.90%). No value change; tier upgrade LEGACY_DB
 *                          -> OFFICIAL.)
 *   - oosAcceptanceRate : 38.77  -> 38.77  (CDS C1 residency: 23,447 OOS
 *                          admits / 60,474 OOS applicants = 38.7654% (rounded
 *                          to 38.77%). No value change; tier upgrade
 *                          LEGACY_DB -> OFFICIAL.)
 *   - edAcceptanceRate  : null   -> null   (CDS C21: "No" — USF does NOT
 *                          offer Early Decision. Field cleared. Provenance
 *                          refreshed to 2024-25 cycle.)
 *   - eaAcceptanceRate  : null   -> null   (CDS C22: "No" — USF does NOT
 *                          offer a formal Early Action plan per CDS
 *                          definition (USF runs a "priority deadline" by
 *                          Nov 15 but does not classify it as EA on the CDS).
 *                          Field stays cleared. Provenance refreshed.)
 *
 * NOTE on hasEarlyDecision: existing DB has true; correct to false to match
 *   CDS C21 = No.
 */
import { PrismaClient, Prisma } from '@prisma/client';
import {
  deepMergeRecords,
  toRecord,
} from '../../src/modules/school/school-provenance.helpers';
import { serializeSchoolProvenance } from '@study-abroad/shared/utils';

const CDS_URL = 'https://www.usf.edu/ods/documents/cds/cds-2024-2025-final.pdf';
const CYCLE_YEAR = 2024; // CDS 2024-2025 = Fall 2024 entering class
const NOW = new Date().toISOString();
const SCHOOL_ID = 'cmnwr8inp0010z0tivwogzepz';

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
  if (!school) throw new Error(`School ${SCHOOL_ID} (USF) not found`);
  console.log(`Updating ${school.name} (${school.id})`);
  console.log(`  isPrivate=${school.isPrivate}  [PUBLIC Florida SUS]`);
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
    generatedBy: 'phase3-usf-validation',
  };

  const provenance = {
    acceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 43.19,
      policyLabel: 'Overall admit rate',
      reason:
        'CDS 2024-25 Section C1 residency table: 29,621 total admits (IS 5,640 + OOS 23,447 + Intl 534) / 68,576 total applicants (IS 7,508 + OOS 60,474 + Intl 594) = 43.1907% (rounded to 43.19%). Tier upgraded from LEGACY_DB (value 43.19) to OFFICIAL.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat25: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1130,
      policyLabel: 'SAT composite 25th percentile (EBRW+Math subsection sum)',
      reason:
        'CDS 2024-25 Section C9: SAT EBRW 25th=580 + SAT Math 25th=550 = 1130. USF CDS C9 does not publish a separate SAT Composite line (the Composite row is blank and the Composite distribution totals 0%), so the subsection sum is the canonical CDS-derivable composite. CORRECTION DOWN from prior 1230 (SEED/PR-15 heuristic). NOTE: USF is test-required (CDS C8A "Required to be considered for admission" checked for SAT or ACT); SAT band is a real admission gate.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat75: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1320,
      policyLabel: 'SAT composite 75th percentile (EBRW+Math subsection sum)',
      reason:
        'CDS 2024-25 Section C9: SAT EBRW 75th=660 + SAT Math 75th=660 = 1320. CORRECTION DOWN from prior 1390 (SEED/PR-15 heuristic).',
      realDataStatus: 'VERIFIED_REAL',
    },
    intlAcceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 89.9,
      policyLabel: 'International admit rate',
      reason:
        'CDS 2024-25 Section C1 residency table: 534 international admits / 594 international applicants = 89.8990% (rounded to 89.90%). Tier upgraded LEGACY_DB -> OFFICIAL.',
      realDataStatus: 'VERIFIED_REAL',
    },
    oosAcceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 38.77,
      policyLabel: 'Out-of-state admit rate',
      reason:
        'CDS 2024-25 Section C1 residency table: 23,447 out-of-state admits / 60,474 out-of-state applicants = 38.7654% (rounded to 38.77%). USF is a PUBLIC Florida State University System institution — IS vs OOS residency carries real policy meaning (different tuition, different residency-preference pathways). NOTE: USF has an unusually OOS-dominant applicant pool (60,474 OOS vs 7,508 IS applied), reflecting heavy national recruitment. Tier upgraded LEGACY_DB -> OFFICIAL.',
      realDataStatus: 'VERIFIED_REAL',
    },
    edAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'Early Decision admit rate',
      reason:
        'CDS 2024-25 Section C21: "Does your institution offer an early decision plan?" — NO. USF does not offer Early Decision. Field stays cleared (UNAVAILABLE/OFFICIAL_BLANK_SECTION). DB hasEarlyDecision corrected from true to false to match CDS. Provenance refreshed to 2024-25 cycle.',
      realDataStatus: 'NOT_OFFERED',
    },
    eaAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'Early Action admit rate',
      reason:
        'CDS 2024-25 Section C22: "Do you have a nonbinding early action plan?" — NO. USF does not classify its early-priority deadline (Nov 15 materials cutoff) as a formal CDS Early Action plan; USF admissions blog explicitly notes "USF doesn\'t put an \'early action\' label on their application deadlines." Field stays cleared (UNAVAILABLE/OFFICIAL_BLANK_SECTION). Provenance refreshed.',
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
      acceptanceRate: new Prisma.Decimal('43.19'),
      sat25: 1130,
      sat75: 1320,
      intlAcceptanceRate: new Prisma.Decimal('89.90'),
      oosAcceptanceRate: new Prisma.Decimal('38.77'),
      edAcceptanceRate: null,
      eaAcceptanceRate: null,
      // CDS C21 "No" — USF does not offer ED; correct stale DB true
      hasEarlyDecision: false,
      lastDataReviewAt: new Date(),
      metadata: nextMetadata,
    },
    select: { id: true },
  });

  console.log(
    '  ✅ updated 7 fields (AR=43.19, sat25=1130, sat75=1320, intlAR=89.90, oosAR=38.77, edAR=NOT_OFFERED, eaAR=NOT_OFFERED, hasED=false)',
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
