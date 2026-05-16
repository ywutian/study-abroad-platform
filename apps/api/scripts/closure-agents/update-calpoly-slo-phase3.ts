#!/usr/bin/env tsx
/**
 * Phase 3 — California Polytechnic State University, San Luis Obispo
 * (Cal Poly SLO) end-to-end closure of the 7 prediction-critical fields.
 *
 * Source: Cal Poly SLO CDS 2025-2026 (Fall 2025 entering class) — most recent
 *   posted 4/10/26 by the Office of Institutional Research.
 *   URL: https://content-calpoly-edu.s3.amazonaws.com/ir/1/images/CDS-PDF-2025-2026_final_nonfillable_web.pdf
 *   Index: https://ir.calpoly.edu/content/publications_reports/cds/index
 *
 * NOTE: Cal Poly SLO is FIRST PUBLIC SCHOOL through the closure pipeline.
 *   - isPrivate=false  ->  oosAcceptanceRate is in eligible scope, MUST carry
 *     a real OFFICIAL number extracted from CDS C1 residency table.
 *   - oosAR is NOT marked UNAVAILABLE/TERMINAL.
 *
 * Cal Poly SLO is **test-blind** (CDS C8A "No" for SAT/ACT use in admission
 * decisions). However, per closure-pipeline convention, the reported CDS C9
 * SAT Composite percentiles are still recorded as OFFICIAL for descriptive
 * applicant-profile use (not as a gating threshold).
 *
 * Value changes (vs. existing DB):
 *   - acceptanceRate    : 30     -> 29.96  (CDS 2025-26 C1: 21,367 admits /
 *                          71,309 applicants = 29.9569%. Minor precision
 *                          upgrade, tier LEGACY_DB->OFFICIAL.)
 *   - sat25             : 1250   -> 1240   (CDS 2025-26 C9: SAT Composite 25th
 *                          = 1240 reported. CORRECTION DOWN from prior 1250
 *                          (SEED/PR-15 heuristic).)
 *   - sat75             : 1450   -> 1420   (CDS 2025-26 C9: SAT Composite 75th
 *                          = 1420 reported. CORRECTION DOWN from prior 1450
 *                          (SEED/PR-15 heuristic).)
 *   - intlAcceptanceRate: 30.83  -> 31.03  (CDS 2025-26 C1 residency: 211 intl
 *                          admits / 680 intl applicants = 31.0294%. Minor
 *                          shift, tier LEGACY_DB->OFFICIAL. Prior 30.83 was
 *                          the 2024-25 cycle (205/665).)
 *   - oosAcceptanceRate : 53.57  -> 62.08  (CDS 2025-26 C1 residency: 4,413
 *                          OOS admits / 7,109 OOS applicants = 62.0762%. BIG
 *                          UPWARD CORRECTION — OOS pool grew 9% YoY (6508 ->
 *                          7109) and admits grew 27% (3486 -> 4413), driving
 *                          the OOS rate up from 53.57% to 62.08%. Tier
 *                          LEGACY_DB->OFFICIAL. **FIRST PUBLIC SCHOOL — oosAR
 *                          IS a real OFFICIAL number, not TERMINAL.**)
 *   - edAcceptanceRate  : null   -> null   (CDS 2025-26 C21: "No" — Cal Poly
 *                          does not offer Early Decision. No change, retain
 *                          UNAVAILABLE/OFFICIAL_BLANK_SECTION. Provenance
 *                          refreshed to 2025-26 cycle.)
 *   - eaAcceptanceRate  : null   -> null   (CDS 2025-26 C22: "No" — Cal Poly
 *                          does not offer Early Action. No change, retain
 *                          UNAVAILABLE/OFFICIAL_BLANK_SECTION. Provenance
 *                          refreshed to 2025-26 cycle.)
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
  'https://content-calpoly-edu.s3.amazonaws.com/ir/1/images/CDS-PDF-2025-2026_final_nonfillable_web.pdf';
const CYCLE_YEAR = 2025; // CDS 2025-2026 = Fall 2025 entering class
const NOW = new Date().toISOString();
const SCHOOL_ID = 'cmnwr8is1002xz0ti23uxhu2j';

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
  if (!school) throw new Error(`School ${SCHOOL_ID} (Cal Poly SLO) not found`);
  console.log(`Updating ${school.name} (${school.id})`);
  console.log(`  isPrivate=${school.isPrivate}  [FIRST PUBLIC SCHOOL]`);
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
    generatedBy: 'phase3-calpoly-slo-validation',
  };

  const provenance = {
    acceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 29.96,
      policyLabel: 'Overall admit rate',
      reason:
        'CDS 2025-26 Section C1: 21,367 admits / 71,309 applicants = 29.9569% (rounded to 29.96%). Tier upgraded from LEGACY_DB (value 30) to OFFICIAL with minor precision adjustment.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat25: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1240,
      policyLabel: 'SAT composite 25th percentile (reported composite row)',
      reason:
        'CDS 2025-26 Section C9: SAT Composite 25th = 1240 (reported directly). CORRECTION DOWN from prior 1250 (SEED/PR-15 heuristic). NOTE: Cal Poly SLO is test-blind (CDS C8A "No" — scores not used in admission decisions); SAT band is recorded for descriptive applicant-profile use only, not as a gating threshold.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat75: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1420,
      policyLabel: 'SAT composite 75th percentile (reported composite row)',
      reason:
        'CDS 2025-26 Section C9: SAT Composite 75th = 1420 (reported directly). CORRECTION DOWN from prior 1450 (SEED/PR-15 heuristic). NOTE: Cal Poly SLO is test-blind (CDS C8A "No"); SAT band is descriptive only.',
      realDataStatus: 'VERIFIED_REAL',
    },
    intlAcceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 31.03,
      policyLabel: 'International admit rate',
      reason:
        'CDS 2025-26 Section C1 residency table: 211 international admits / 680 international applicants = 31.0294% (rounded to 31.03%). Tier upgraded from LEGACY_DB (value 30.83 from prior 2024-25 cycle) to OFFICIAL.',
      realDataStatus: 'VERIFIED_REAL',
    },
    oosAcceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 62.08,
      policyLabel: 'Out-of-state admit rate',
      reason:
        'CDS 2025-26 Section C1 residency table: 4,413 out-of-state admits / 7,109 out-of-state applicants = 62.0762% (rounded to 62.08%). Cal Poly SLO is a PUBLIC CSU institution — in-state vs. out-of-state distinction carries real policy meaning (different tuition, residency-preference admit pathways), so this field is in eligible scope and MUST carry a real CDS number. SIGNIFICANT UPWARD CORRECTION from prior LEGACY_DB value 53.57% (2024-25 cycle = 3486/6508): OOS applicant pool grew ~9% YoY while OOS admits grew ~27%, lifting the OOS admit rate by ~8.5 percentage points. Tier upgraded LEGACY_DB -> OFFICIAL. (FIRST PUBLIC SCHOOL in closure pipeline — confirms public-school convention: oosAR carries the real number, never marked TERMINAL.)',
      realDataStatus: 'VERIFIED_REAL',
    },
    edAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'Early Decision admit rate',
      reason:
        'CDS 2025-26 Section C21: "Does your institution offer an early decision plan?" — NO checked. Cal Poly SLO does not offer Early Decision. Field stays cleared (UNAVAILABLE/OFFICIAL_BLANK_SECTION). Provenance refreshed to 2025-26 cycle.',
      realDataStatus: 'NOT_OFFERED',
    },
    eaAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'Early Action admit rate',
      reason:
        'CDS 2025-26 Section C22: "Do you have a nonbinding early action plan?" — NO checked. Cal Poly SLO does not offer Early Action. Field stays cleared (UNAVAILABLE/OFFICIAL_BLANK_SECTION). Provenance refreshed to 2025-26 cycle.',
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
      acceptanceRate: new Prisma.Decimal('29.96'),
      sat25: 1240,
      sat75: 1420,
      intlAcceptanceRate: new Prisma.Decimal('31.03'),
      oosAcceptanceRate: new Prisma.Decimal('62.08'),
      edAcceptanceRate: null,
      eaAcceptanceRate: null,
      // CDS C21 "No" — Cal Poly SLO does not offer ED; correct stale DB true
      hasEarlyDecision: false,
      lastDataReviewAt: new Date(),
      metadata: nextMetadata,
    },
    select: { id: true },
  });

  console.log(
    '  ✅ updated 7 fields (AR=29.96, sat25=1240, sat75=1420, intlAR=31.03, oosAR=62.08, edAR=NOT_OFFERED, eaAR=NOT_OFFERED, hasED=false)',
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
