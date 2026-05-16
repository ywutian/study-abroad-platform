#!/usr/bin/env tsx
/**
 * Phase 3 — University of Idaho (Moscow, ID) end-to-end closure of the 7
 * prediction-critical fields.
 *
 * Source: University of Idaho Common Data Set 2023-2024 (Fall 2023 entering
 *   class) published by the Office of Institutional Effectiveness /
 *   Institutional Research. Note: the 2024-2025 CDS has NOT yet been published
 *   by UI Institutional Research as of this writing — the latest CDS available
 *   on the UI IR page is 2023-2024. The previously-cited
 *   `boardofed.idaho.gov/.../UI-FY2025-Undergraduate-Report.pdf` URL is a
 *   different State Board of Education report, NOT a Common Data Set; replacing
 *   with the canonical UI CDS PDF.
 *
 *   Canonical UI CDS index: https://www.uidaho.edu/provost/ir/institutional-data/common-data-set
 *   PDF (latest, content hub): https://content-hub.uidaho.edu/api/public/content/bf62e21cc0114b06bed65dc2a5e6c633?v=aee281dc
 *   PDF (named copy): https://www.uidaho.edu/-/media/uidaho-responsive/files/provost/ir/common-data-set/cds-2023-2024.pdf
 *
 * U Idaho is a PUBLIC land-grant research university (A2 "Public" checked) —
 *   oosAR is in eligible scope and carries the real CDS number.
 *
 * Value validation (vs. existing DB):
 *   - acceptanceRate    : 79.09  ~  79.09 (CDS C1: 9,666 admits / 12,222
 *                          first-time, first-year applicants = 79.0869%
 *                          (rounded to 79.09%). DB matches exactly. Tier
 *                          LEGACY_DB_VALUE -> OFFICIAL re-anchored to the
 *                          canonical UI CDS PDF.)
 *   - sat25             : 1000   -> 950  (CDS C9: SAT Composite 25th = 950
 *                          reported directly. DB had 1000 (LEGACY_DB_VALUE,
 *                          likely a different cohort or aggregator). Corrected
 *                          downward to OFFICIAL 950.)
 *   - sat75             : 1230   -> 1200 (CDS C9: SAT Composite 75th = 1200
 *                          reported directly. DB had 1230 (LEGACY_DB_VALUE).
 *                          Corrected downward to OFFICIAL 1200.)
 *   - intlAcceptanceRate: 34.1   ~  34.11 (CDS C1 residency: 753 intl admits
 *                          / 2,208 intl applicants = 34.1033% (rounded to
 *                          34.10%). DB matches. Tier LEGACY_DB_VALUE ->
 *                          OFFICIAL with full precision.)
 *   - oosAcceptanceRate : 85.94  ~  85.94 (CDS C1 residency: 2,493 OOS
 *                          admits / 2,901 OOS applicants = 85.9359%
 *                          (rounded to 85.94%). DB matches exactly. Land-grant
 *                          public — real policy meaning. Tier LEGACY_DB_VALUE
 *                          -> OFFICIAL.)
 *   - edAcceptanceRate  : null   -> null  (CDS C21: "No" — U Idaho does NOT
 *                          offer Early Decision. Stays null. Re-stamped from
 *                          prior CDS_LLM_EXTRACT_2026_04 (which incorrectly
 *                          cited the State Board UI-FY2025 PDF) to explicit
 *                          NOT_OFFERED with the canonical UI CDS PDF URL.)
 *   - eaAcceptanceRate  : null   -> null  (CDS C22: "No" — U Idaho does NOT
 *                          offer Early Action either. Stays null. Re-stamped
 *                          to NOT_OFFERED with canonical CDS URL.)
 *
 * NOTE on hasEarlyDecision: current DB value is TRUE, but CDS C21 = "No" and
 *   C22 = "No". U Idaho is rolling admission (C16 = rolling). Setting to FALSE.
 *
 * NOTE on cycleYear: stamped as 2023 (CDS 2023-2024 covers Fall 2023 entering
 *   class). When UI publishes their 2024-2025 CDS, a future batch should
 *   re-validate against the Fall 2024 cohort numbers.
 */
import { PrismaClient, Prisma } from '@prisma/client';
import {
  deepMergeRecords,
  toRecord,
} from '../../src/modules/school/school-provenance.helpers';
import { serializeSchoolProvenance } from '@study-abroad/shared/utils';

const CDS_URL =
  'https://www.uidaho.edu/-/media/uidaho-responsive/files/provost/ir/common-data-set/cds-2023-2024.pdf';
const CYCLE_YEAR = 2023; // CDS 2023-2024 = Fall 2023 entering class (2024-2025 not yet published)
const NOW = new Date().toISOString();
const SCHOOL_ID = 'cmnwr8iro002qz0tiayclu6c9';

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
  if (!school) throw new Error(`School ${SCHOOL_ID} (U Idaho) not found`);
  console.log(`Updating ${school.name} (${school.id})`);
  console.log(`  isPrivate=${school.isPrivate}  [PUBLIC SCHOOL]`);
  console.log(
    `  current AR=${school.acceptanceRate?.toString()} sat25=${school.sat25} sat75=${school.sat75}`,
  );
  console.log(
    `  current intlAR=${school.intlAcceptanceRate?.toString()} oosAR=${school.oosAcceptanceRate?.toString()}`,
  );
  console.log(
    `  current edAR=${school.edAcceptanceRate?.toString() ?? 'null'} eaAR=${school.eaAcceptanceRate?.toString() ?? 'null'} hasED=${school.hasEarlyDecision}`,
  );

  const baseProv = {
    sourceUrl: CDS_URL,
    cycleYear: CYCLE_YEAR,
    fetchedAt: NOW,
    verifiedAt: NOW,
    confidence: 1.0,
    verifiedBy: 'closure-pipeline-phase3-batch25-claude',
    generatedBy: 'phase3-uidaho-validation',
  };

  const provenance = {
    acceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 79.09,
      policyLabel: 'Overall admit rate',
      reason:
        'CDS 2023-24 Section C1: 9,666 admits / 12,222 first-time, first-year applicants = 79.0869% (rounded to 79.09%). DB value of 79.09 matches exactly. Tier LEGACY_DB_VALUE -> OFFICIAL re-anchored to the canonical UI CDS PDF (the 2024-2025 CDS has not yet been published by UI Institutional Research).',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat25: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 950,
      policyLabel: 'SAT composite 25th percentile (reported composite row)',
      reason:
        'CDS 2023-24 Section C9: SAT Composite 25th = 950 reported directly (1,088 students = 64% of enrolled submitted SAT). DB had LEGACY_DB_VALUE 1000 — that value was incorrect (likely from a different cohort or aggregator). Corrected downward from the official UI CDS PDF.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat75: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1200,
      policyLabel: 'SAT composite 75th percentile (reported composite row)',
      reason:
        'CDS 2023-24 Section C9: SAT Composite 75th = 1200 reported directly. DB had LEGACY_DB_VALUE 1230 — that value was incorrect (likely from a different cohort or aggregator). Corrected downward from the official UI CDS PDF.',
      realDataStatus: 'VERIFIED_REAL',
    },
    intlAcceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 34.1,
      policyLabel: 'International admit rate',
      reason:
        'CDS 2023-24 Section C1 residency table: 753 international admits / 2,208 international applicants = 34.1033% (rounded to 34.10%). DB value of 34.1 matches. Tier LEGACY_DB_VALUE -> OFFICIAL with full precision.',
      realDataStatus: 'VERIFIED_REAL',
    },
    oosAcceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 85.94,
      policyLabel: 'Out-of-state admit rate',
      reason:
        'CDS 2023-24 Section C1 residency table: 2,493 out-of-state admits / 2,901 out-of-state applicants = 85.9359% (rounded to 85.94%). DB value of 85.94 matches exactly. U Idaho is the PUBLIC land-grant flagship — in-state vs. out-of-state distinction carries real policy meaning. Tier LEGACY_DB_VALUE -> OFFICIAL.',
      realDataStatus: 'VERIFIED_REAL',
    },
    edAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'Early Decision admit rate',
      reason:
        'CDS 2023-24 Section C21: "Does your institution offer an early decision plan?" — NO checked. U Idaho does NOT offer Early Decision (admissions are rolling; C16 = rolling). Field stays cleared (UNAVAILABLE/OFFICIAL_BLANK_SECTION/NOT_OFFERED). Re-stamped from prior CDS_LLM_EXTRACT_2026_04 which incorrectly cited boardofed.idaho.gov UI-FY2025-Undergraduate-Report (a separate State Board report, not a CDS) — now anchored to the canonical UI CDS PDF.',
      realDataStatus: 'NOT_OFFERED',
    },
    eaAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'Early Action admit rate',
      reason:
        'CDS 2023-24 Section C22: "Do you have a nonbinding early action plan?" — NO checked. U Idaho does NOT offer Early Action either. Field stays cleared (UNAVAILABLE/OFFICIAL_BLANK_SECTION/NOT_OFFERED). Re-stamped to NOT_OFFERED with canonical UI CDS URL (replacing prior incorrect State Board report reference).',
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
      acceptanceRate: new Prisma.Decimal('79.09'),
      sat25: 950,
      sat75: 1200,
      intlAcceptanceRate: new Prisma.Decimal('34.10'),
      oosAcceptanceRate: new Prisma.Decimal('85.94'),
      edAcceptanceRate: null,
      eaAcceptanceRate: null,
      // CDS C21 "No" and C22 "No" — U Idaho offers only rolling admission
      hasEarlyDecision: false,
      lastDataReviewAt: new Date(),
      metadata: nextMetadata,
    },
    select: { id: true },
  });

  console.log(
    '  ✅ updated 7 fields (AR=79.09, sat25=950, sat75=1200, intlAR=34.10, oosAR=85.94, edAR=NOT_OFFERED, eaAR=NOT_OFFERED, hasED=false)',
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
