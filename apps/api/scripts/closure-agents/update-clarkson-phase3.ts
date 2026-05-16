#!/usr/bin/env tsx
/**
 * Phase 3 — Clarkson University end-to-end closure of the 7 prediction-critical
 * fields.
 *
 * Source: Clarkson University CDS 2025-2026 (Fall 2025 entering class)
 *   URL (Google Drive download): https://drive.google.com/file/d/1Q5RNO9IbYQUxmnRPR-SX41GudMoEjYI8/view
 *   Direct PDF: https://drive.usercontent.google.com/download?id=1Q5RNO9IbYQUxmnRPR-SX41GudMoEjYI8&export=download
 *   Index: https://sites.clarkson.edu/institutional-research/reports/
 *
 * NOTE: The Clarkson CDS 2024-2025 PDF (Fall 2024) was inspected first; that
 *   edition silently OMITS sections C9 (test scores) and C21/C22 (Early
 *   Decision / Early Action) — pages jump straight from C8 to D1. The
 *   2025-2026 PDF (Fall 2025 entering class), published February 2026 by the
 *   Office of Institutional Research, contains the complete C9/C21/C22 data
 *   and is the most recent authoritative source.
 *
 * Clarkson is a PRIVATE university (A2 not explicitly checked in 2025-26 PDF,
 * but Clarkson is a private nonprofit institution and is listed as such in
 * IPEDS/CDS 2024-25 G1 "PRIVATE INSTITUTIONS Tuition: $59,800").
 *   - oosAcceptanceRate -> UNAVAILABLE/TERMINAL per closure-pipeline convention
 *     (no in-state tuition policy meaning for private institutions). Although
 *     CDS C1 residency does report OOS (1,493 apps / 1,375 admits = 92.10%),
 *     the value carries no policy meaning for a private school.
 *
 * Value changes (vs. existing DB):
 *   - acceptanceRate    : 72     -> 82.50  (CDS 2025-26 C1: 4,082 admits /
 *                          4,948 applicants = 82.4980%. Rounded to 82.50%.
 *                          Tier upgraded LEGACY_DB (value 72, no sourceUrl) ->
 *                          OFFICIAL. CORRECTION UP +10.50pp.)
 *   - sat25             : 1215   -> 1190   (CDS 2025-26 C9: SAT Composite 25th
 *                          = 1190. CORRECTION DOWN -25 from prior 1215. Prior
 *                          provenance was CDS_PDF_AUTO with sourceUrl pointing
 *                          to prepscholar.com — not Clarkson; tier upgraded to
 *                          OFFICIAL with real Clarkson CDS.)
 *   - sat75             : 1370   -> 1360   (CDS 2025-26 C9: SAT Composite 75th
 *                          = 1360. CORRECTION DOWN -10. Prior CDS_PDF_AUTO/
 *                          prepscholar source replaced with real Clarkson CDS.)
 *   - intlAcceptanceRate: 68.4   -> 64.92  (CDS 2025-26 C1 residency table:
 *                          742 international admits / 1,143 international
 *                          applicants = 64.9169% (rounded to 64.92%). Tier
 *                          upgraded HEURISTIC/PERMANENT_HEURISTIC -> OFFICIAL.
 *                          CORRECTION DOWN -3.48pp.)
 *   - oosAcceptanceRate : 73.44  -> null   (Clarkson is a private university;
 *                          in-state / out-of-state distinction carries no
 *                          tuition policy meaning. CDS C1 residency does report
 *                          OOS (1,493 apps / 1,375 admits = 92.10%) but the
 *                          value is not actionable for applicants. Prior
 *                          HEURISTIC value (73.44%) cleared. Field marked
 *                          UNAVAILABLE/TERMINAL per closure-pipeline convention
 *                          for private institutions.)
 *   - edAcceptanceRate  : null   -> 75.74  (CDS 2025-26 C21: Clarkson offers
 *                          Early Decision ("Yes" checked); single plan, 12/1
 *                          notification. Fall 2025 entering class: 178 admits
 *                          / 235 ED applications = 75.7447% (rounded to
 *                          75.74%). Tier upgraded OFFICIAL/CDS_LLM_EXTRACT_2026_04
 *                          (with stale Clarkson factsheet sourceUrl and
 *                          value=undefined) -> OFFICIAL/CDS_OFFICIAL with real
 *                          CDS volume.)
 *   - eaAcceptanceRate  : null   -> null   (CDS 2025-26 C22: Clarkson does NOT
 *                          offer a nonbinding Early Action plan ("No" checked).
 *                          Field stays null. Tier transitions OFFICIAL/
 *                          CDS_LLM_EXTRACT_2026_04 (value=undefined) ->
 *                          UNAVAILABLE/OFFICIAL_BLANK_SECTION/NOT_OFFERED.)
 *
 * NOTE on hasEarlyDecision: DB already true; CDS C21 "Yes" confirms.
 */
import { PrismaClient, Prisma } from '@prisma/client';
import {
  deepMergeRecords,
  toRecord,
} from '../../src/modules/school/school-provenance.helpers';
import { serializeSchoolProvenance } from '@study-abroad/shared/utils';

const CDS_URL =
  'https://drive.usercontent.google.com/download?id=1Q5RNO9IbYQUxmnRPR-SX41GudMoEjYI8&export=download';
const CYCLE_YEAR = 2025; // CDS 2025-2026 = Fall 2025 entering class
const NOW = new Date().toISOString();
const SCHOOL_ID = 'cmnwr8ioo001hz0tim3isqwz9';

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
  if (!school) throw new Error(`School ${SCHOOL_ID} (Clarkson) not found`);
  console.log(`Updating ${school.name} (${school.id})`);
  console.log(`  isPrivate=${school.isPrivate}`);
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
    generatedBy: 'phase3-clarkson-validation',
  };

  const provenance = {
    acceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 82.5,
      policyLabel: 'Overall admit rate',
      reason:
        'CDS 2025-26 Section C1: 4,082 admits / 4,948 applicants = 82.4980% (rounded to 82.50%). Tier upgraded from LEGACY_DB (value 72, no sourceUrl recorded) to OFFICIAL. CORRECTION UP +10.50pp.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat25: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1190,
      policyLabel: 'SAT composite 25th percentile (reported composite row)',
      reason:
        'CDS 2025-26 Section C9: SAT Composite 25th = 1190 (reported directly). CORRECTION DOWN -25 from prior 1190 (previously CDS_PDF_AUTO with stale sourceUrl pointing to prepscholar.com — not Clarkson). 49% of Fall 2025 enrolled (251 students) submitted SAT under test-optional policy (CDS C8A: SAT/ACT "Not required for admission, but considered if submitted").',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat75: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1360,
      policyLabel: 'SAT composite 75th percentile (reported composite row)',
      reason:
        'CDS 2025-26 Section C9: SAT Composite 75th = 1360 (reported directly). CORRECTION DOWN -10 from prior 1370 (previously CDS_PDF_AUTO with stale sourceUrl pointing to prepscholar.com — not Clarkson).',
      realDataStatus: 'VERIFIED_REAL',
    },
    intlAcceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 64.92,
      policyLabel: 'International admit rate',
      reason:
        'CDS 2025-26 Section C1 residency table: 742 international admits / 1,143 international applicants = 64.9169% (rounded to 64.92%). Tier upgraded from HEURISTIC/PERMANENT_HEURISTIC (value 68.4) to OFFICIAL with refreshed provenance. CORRECTION DOWN -3.48pp.',
      realDataStatus: 'VERIFIED_REAL',
    },
    oosAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'TERMINAL',
      confidence: 1.0,
      policyLabel: 'Out-of-state admit rate',
      reason:
        'Clarkson University is a private (nonprofit) institution; in-state / out-of-state distinction carries no tuition policy meaning. CDS 2025-26 C1 residency table does report OOS (1,375 admits / 1,493 applicants = 92.10%) but the value is not actionable for applicants. Prior HEURISTIC value (73.44%) cleared. Field marked UNAVAILABLE/TERMINAL per closure-pipeline convention for private institutions.',
      realDataStatus: 'NOT_APPLICABLE',
    },
    edAcceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 75.74,
      policyLabel: 'Early Decision admit rate',
      reason:
        'CDS 2025-26 Section C21: Clarkson offers Early Decision ("Yes" checked); single plan, 12/1 notification. Fall 2025 entering class: 178 admits / 235 ED applications = 75.7447% (rounded to 75.74%). Tier upgraded from OFFICIAL/CDS_LLM_EXTRACT_2026_04 (with stale sourceUrl pointing to a Clarkson factsheet PDF and value=undefined) to OFFICIAL/CDS_OFFICIAL with real CDS volume.',
      realDataStatus: 'VERIFIED_REAL',
    },
    eaAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'Early Action admit rate',
      reason:
        'CDS 2025-26 Section C22: Clarkson does NOT offer a nonbinding Early Action plan ("No" checked). Field stays null. Tier transitions OFFICIAL/CDS_LLM_EXTRACT_2026_04 (with stale Clarkson factsheet sourceUrl and value=undefined) -> UNAVAILABLE/OFFICIAL_BLANK_SECTION/NOT_OFFERED.',
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
      acceptanceRate: new Prisma.Decimal('82.50'),
      sat25: 1190,
      sat75: 1360,
      intlAcceptanceRate: new Prisma.Decimal('64.92'),
      oosAcceptanceRate: null,
      edAcceptanceRate: new Prisma.Decimal('75.74'),
      eaAcceptanceRate: null, // CDS C22 "No" — Clarkson does not offer EA
      hasEarlyDecision: true, // re-confirm from CDS C21 "Yes"
      lastDataReviewAt: new Date(),
      metadata: nextMetadata,
    },
    select: { id: true },
  });

  console.log(
    '  ✅ updated 7 fields (AR=82.50, sat25=1190, sat75=1360, intlAR=64.92, oosAR=N/A, edAR=75.74, eaAR=NOT_OFFERED)',
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
