#!/usr/bin/env tsx
/**
 * Phase 3 — Purdue University (West Lafayette) end-to-end closure of the 7
 * prediction-critical fields.
 *
 * Source: Purdue CDS 2025-2026 (Fall 2025 entering class) — Institutional Data
 *   Analytics + Assessment (IDA+A) office.
 *   Direct XLSX URL: https://www.purdue.edu/idata/wp-content/uploads/2026/04/CDS-2025-2026.xlsx
 *   Index: https://www.purdue.edu/idata/products-services/common-data-set/
 *   (NOTE: prior DB sourceUrl pointed to a 404 PDF
 *    `/2026/01/CDS_2025-2026.pdf` — replaced with the current XLSX link from
 *    the IDA+A CDS index page.)
 *
 * NOTE: Purdue is a PUBLIC institution.
 *   - isPrivate=false  ->  oosAcceptanceRate MUST carry a real OFFICIAL number
 *     from CDS C1 residency table (PWL respondent).
 *
 * Test policy: SAT/ACT used in admission decisions (C8A "Yes"). C9 SAT
 * Composite reported normally.
 *
 * Value changes (vs. existing DB):
 *   - acceptanceRate    : 43.43 -> 43.43 (CDS 2025-26 C1: 37,881 admits /
 *                          87,220 applicants = 43.4338% (rounded to 43.43%).
 *                          Value identical to prior DB; tier upgraded from
 *                          LEGACY_DB to OFFICIAL.)
 *   - sat25             : 1230  -> 1220  (CDS 2025-26 C9: SAT Composite 25th =
 *                          1220 reported directly. CORRECTION DOWN -10 from
 *                          prior 1230 (SEED/PR-15 heuristic).)
 *   - sat75             : 1410  -> 1470  (CDS 2025-26 C9: SAT Composite 75th =
 *                          1470 reported directly. CORRECTION UP +60 from prior
 *                          1410 (SEED/PR-15 heuristic).)
 *   - intlAcceptanceRate: 22.49 -> 22.49 (CDS 2025-26 C1 residency: 3,672
 *                          international admits / 16,327 international
 *                          applicants = 22.4904% (rounded to 22.49%). Value
 *                          identical to prior DB; tier upgraded from LEGACY_DB
 *                          to OFFICIAL.)
 *   - oosAcceptanceRate : 43.58 -> 43.58 (CDS 2025-26 C1 residency: 25,650 OOS
 *                          admits / 58,853 OOS applicants = 43.5832% (rounded
 *                          to 43.58%). Value identical to prior DB; tier
 *                          upgraded from LEGACY_DB to OFFICIAL. Public school
 *                          -> oosAR carries real OFFICIAL number.)
 *   - edAcceptanceRate  : null  -> null  (CDS 2025-26 C21: "No" — Purdue does
 *                          NOT offer Early Decision. Field stays null.
 *                          Provenance refreshed from prior
 *                          POLICY_DETERMINATION/NOT_APPLICABLE to authoritative
 *                          UNAVAILABLE/OFFICIAL_BLANK_SECTION/NOT_OFFERED.)
 *   - eaAcceptanceRate  : 54    -> null  (CDS 2025-26 C22: "Yes" — Purdue
 *                          OFFERS Early Action (closes 11/1, notification
 *                          1/15). HOWEVER, Purdue does NOT publish EA
 *                          applicants/admits counts in CDS C22 (those fields
 *                          are blank/not provided). Prior DB carried 54% from
 *                          TAVILY_ENRICHMENT (non-CDS aggregator) — cleared to
 *                          null per closure-pipeline convention (CDS_OFFICIAL
 *                          authoritative over secondary aggregators). Tier
 *                          UNAVAILABLE source=OFFICIAL_BLANK_SECTION: plan
 *                          exists but CDS does not report numbers.)
 *
 * NOTE on hasEarlyDecision: current DB value is false; CDS C21 confirms "No".
 * No change required.
 */
import { PrismaClient, Prisma } from '@prisma/client';
import {
  deepMergeRecords,
  toRecord,
} from '../../src/modules/school/school-provenance.helpers';
import { serializeSchoolProvenance } from '@study-abroad/shared/utils';

const CDS_URL =
  'https://www.purdue.edu/idata/wp-content/uploads/2026/04/CDS-2025-2026.xlsx';
const CYCLE_YEAR = 2025; // CDS 2025-2026 = Fall 2025 entering class
const NOW = new Date().toISOString();
const SCHOOL_ID = 'cmn1htkq30018vqf2xt2csyoe';

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
  if (!school) throw new Error(`School ${SCHOOL_ID} (Purdue) not found`);
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
    generatedBy: 'phase3-purdue-validation',
  };

  const provenance = {
    acceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 43.43,
      policyLabel: 'Overall admit rate',
      reason:
        'CDS 2025-26 Section C1: 37,881 admits / 87,220 applicants = 43.4338% (rounded to 43.43%). Value identical to prior LEGACY_DB; tier upgraded to OFFICIAL with provenance pointed at the IDA+A 2025-26 XLSX.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat25: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1220,
      policyLabel: 'SAT composite 25th percentile (reported composite row)',
      reason:
        'CDS 2025-26 Section C9: SAT Composite 25th = 1220 (reported directly). CORRECTION DOWN -10 from prior 1230 (SEED/PR-15 heuristic).',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat75: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1470,
      policyLabel: 'SAT composite 75th percentile (reported composite row)',
      reason:
        'CDS 2025-26 Section C9: SAT Composite 75th = 1470 (reported directly). CORRECTION UP +60 from prior 1410 (SEED/PR-15 heuristic).',
      realDataStatus: 'VERIFIED_REAL',
    },
    intlAcceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 22.49,
      policyLabel: 'International admit rate',
      reason:
        'CDS 2025-26 Section C1 residency table: 3,672 international admits / 16,327 international applicants = 22.4904% (rounded to 22.49%). Value identical to prior LEGACY_DB; tier upgraded to OFFICIAL with refreshed provenance.',
      realDataStatus: 'VERIFIED_REAL',
    },
    oosAcceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 43.58,
      policyLabel: 'Out-of-state admit rate',
      reason:
        'CDS 2025-26 Section C1 residency table: 25,650 out-of-state admits / 58,853 out-of-state applicants = 43.5832% (rounded to 43.58%). Purdue is a PUBLIC institution — in-state vs. out-of-state distinction carries real policy meaning (different tuition, residency-preference admit pathways), so this field is in eligible scope and MUST carry a real CDS number. Value identical to prior LEGACY_DB; tier upgraded to OFFICIAL.',
      realDataStatus: 'VERIFIED_REAL',
    },
    edAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'Early Decision admit rate',
      reason:
        'CDS 2025-26 Section C21: "Does your institution offer an early decision plan?" — NO checked. Purdue does NOT offer Early Decision. Field stays cleared. Provenance refreshed from prior POLICY_DETERMINATION/NOT_APPLICABLE to authoritative UNAVAILABLE/OFFICIAL_BLANK_SECTION/NOT_OFFERED for current 2025-26 cycle.',
      realDataStatus: 'NOT_OFFERED',
    },
    eaAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'Early Action admit rate',
      reason:
        'CDS 2025-26 Section C22: "Do you have a nonbinding early action plan?" — YES checked. Purdue OFFERS Early Action (closing 11/1/2025, notification 1/15/2025). HOWEVER, Purdue does NOT publish EA applicants/admits counts in CDS C22 (those fields are blank/not provided in the IDA+A 2025-26 XLSX). Prior DB value 54% was sourced from TAVILY_ENRICHMENT (non-CDS aggregator) — cleared per closure-pipeline convention (CDS_OFFICIAL authoritative over secondary aggregators). Field marked UNAVAILABLE/OFFICIAL_BLANK_SECTION: plan exists but CDS does not report numbers.',
      realDataStatus: 'NOT_AVAILABLE',
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
      acceptanceRate: new Prisma.Decimal('43.43'),
      sat25: 1220,
      sat75: 1470,
      intlAcceptanceRate: new Prisma.Decimal('22.49'),
      oosAcceptanceRate: new Prisma.Decimal('43.58'),
      edAcceptanceRate: null,
      eaAcceptanceRate: null,
      lastDataReviewAt: new Date(),
      metadata: nextMetadata,
    },
    select: { id: true },
  });

  console.log(
    '  ✅ updated 7 fields (AR=43.43, sat25=1220, sat75=1470, intlAR=22.49, oosAR=43.58, edAR=NOT_OFFERED, eaAR=NOT_AVAILABLE)',
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
