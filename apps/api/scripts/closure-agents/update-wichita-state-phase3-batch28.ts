#!/usr/bin/env tsx
/**
 * Phase 3 — Wichita State University (Wichita, KS) end-to-end closure of
 * the 7 prediction-critical fields.
 *
 * Source: Wichita State CDS 2024-2025 (Fall 2024 entering class)
 *   URL: https://www.wichita.edu/services/planning_and_analysis/documents/WSU_CDS_2024_2025.xlsx
 *   Published as XLSX by the WSU Office of Planning and Analysis.
 *
 * IMPORTANT — URL CORRECTION:
 *   Prior DB intl/oos URLs pointed to https://wpcdn.web.wsu.edu/.../CDS_2024-2025.pdf
 *   which is **Washington State University** (WSU Pullman), the WRONG
 *   institution. URL scrubbed/replaced across all 7 provenance entries
 *   with the correct Wichita State source.
 *
 * Wichita State is a PUBLIC Kansas research university. oosAcceptanceRate
 * is in eligible scope.
 *
 * Value changes (vs. existing DB):
 *   - acceptanceRate    : 86.7   -> 72.11  (CORRECTION DOWN -14.59. CDS C1
 *                          total: 9,270 applied, 6,685 admitted. AR =
 *                          6,685 / 9,270 = 72.1144%, rounds to 72.11%.
 *                          Prior 86.7 was LEGACY_DB_VALUE with no source.
 *                          Tier LEGACY_DB_VALUE -> OFFICIAL.)
 *   - sat25             : 913    -> 913    (CDS C9 SAT Composite 25th = 913.
 *                          Value matches DB exactly. Tier upgraded
 *                          OFFICIAL/CDS_PDF_AUTO (prepscholar.com URL — not
 *                          actually a CDS) -> OFFICIAL/CDS_OFFICIAL with
 *                          correct WSU source URL.)
 *   - sat75             : 1240   -> 1240   (CDS C9 SAT Composite 75th = 1240.
 *                          Same as sat25 — value confirmed, source
 *                          corrected.)
 *   - intlAcceptanceRate: 82     -> 82.59  (CDS C1 residency: INTERNATIONAL
 *                          580 applied / 479 admitted. intlAR = 479/580 =
 *                          82.5862%, rounds to 82.59%. Prior 82 was a
 *                          rounded LEGACY_DB_VALUE pointing to a Washington
 *                          State CDS URL (wrong institution). MINOR
 *                          REFINEMENT +0.59 + URL fix. Tier upgraded
 *                          LEGACY_DB_VALUE -> OFFICIAL.)
 *   - oosAcceptanceRate : 87.8   -> 73.30  (CORRECTION DOWN -14.5. CDS C1
 *                          residency: OUT-OF-STATE 4,288 applied / 3,143
 *                          admitted. oosAR = 3,143 / 4,288 = 73.2980%,
 *                          rounds to 73.30%. Prior 87.8 was LEGACY_DB_VALUE
 *                          pointing to Washington State CDS (wrong
 *                          institution). Tier LEGACY_DB_VALUE -> OFFICIAL.)
 *   - edAcceptanceRate  : null   -> null   (CDS C21: "Early Decision —
 *                          Yes/No" — NO checked. Wichita State does not
 *                          offer ED. Prior tier NO_PUBLIC_ROUND_RATE/
 *                          TERMINAL with a sourceUrl pointing to Olin
 *                          College CDS (egregious cross-institution
 *                          MISCLASSIFICATION). Tier transitions to
 *                          UNAVAILABLE/OFFICIAL_BLANK_SECTION/NOT_OFFERED
 *                          with the correct WSU source URL.)
 *   - eaAcceptanceRate  : null   -> null   (CDS C22: "Early Action —
 *                          Yes/No" — NO checked. Same Olin URL scrubbed.
 *                          Same treatment as edAR.)
 *
 * NOTE on hasEarlyDecision: current DB value is true, but CDS C21 is "No".
 *   Correcting to false to match CDS reality.
 */
import { PrismaClient, Prisma } from '@prisma/client';
import {
  deepMergeRecords,
  toRecord,
} from '../../src/modules/school/school-provenance.helpers';
import { serializeSchoolProvenance } from '@study-abroad/shared/utils';

const CDS_URL =
  'https://www.wichita.edu/services/planning_and_analysis/documents/WSU_CDS_2024_2025.xlsx';
const CYCLE_YEAR = 2024; // CDS 2024-2025 = Fall 2024 entering class
const NOW = new Date().toISOString();
const SCHOOL_ID = 'cmnwr8ito003oz0tiyojti719';

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
  if (!school) throw new Error(`School ${SCHOOL_ID} (Wichita State) not found`);
  console.log(`Updating ${school.name} (${school.id})`);
  console.log(`  isPrivate=${school.isPrivate}  [PUBLIC Kansas]`);
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
    verifiedBy: 'closure-pipeline-phase3-claude',
    generatedBy: 'phase3-batch28-wichita-state',
  };

  const provenance = {
    acceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 72.11,
      policyLabel: 'Overall admit rate',
      reason:
        'CDS 2024-25 Section C1: 9,270 total applied, 6,685 total admitted. AR = 6,685 / 9,270 = 72.1144%, rounds to 72.11%. CORRECTION DOWN -14.59 from prior LEGACY_DB_VALUE 86.7 (no source URL on record). Tier upgraded LEGACY_DB_VALUE -> OFFICIAL.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat25: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 913,
      policyLabel: 'SAT composite 25th percentile',
      reason:
        'CDS 2024-25 Section C9 SAT Composite 25th percentile = 913. Value matches DB exactly. Tier upgraded OFFICIAL/CDS_PDF_AUTO (prior URL was prepscholar.com — not a CDS) -> OFFICIAL/CDS_OFFICIAL with corrected source URL pointing to the actual WSU CDS xlsx.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat75: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1240,
      policyLabel: 'SAT composite 75th percentile',
      reason:
        'CDS 2024-25 Section C9 SAT Composite 75th percentile = 1240. Value matches DB exactly. Same source correction as sat25.',
      realDataStatus: 'VERIFIED_REAL',
    },
    intlAcceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 82.59,
      policyLabel: 'International admit rate',
      reason:
        'CDS 2024-25 Section C1 residency breakdown: INTERNATIONAL 580 applied / 479 admitted. intlAR = 479 / 580 = 82.5862%, rounds to 82.59%. MINOR REFINEMENT from prior LEGACY_DB_VALUE 82 (rounded) +0.59. CRITICAL URL FIX: prior sourceUrl pointed to https://wpcdn.web.wsu.edu/.../CDS_2024-2025.pdf which is Washington State University (WSU Pullman), the WRONG institution. URL scrubbed and replaced with the correct Wichita State CDS xlsx. Tier upgraded LEGACY_DB_VALUE -> OFFICIAL.',
      realDataStatus: 'VERIFIED_REAL',
    },
    oosAcceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 73.3,
      policyLabel: 'Out-of-state admit rate',
      reason:
        'CDS 2024-25 Section C1 residency breakdown: OUT-OF-STATE 4,288 applied / 3,143 admitted. oosAR = 3,143 / 4,288 = 73.2980%, rounds to 73.30%. CORRECTION DOWN -14.5 from prior LEGACY_DB_VALUE 87.8. CRITICAL URL FIX: prior sourceUrl pointed to Washington State University CDS (wrong institution). Tier upgraded LEGACY_DB_VALUE -> OFFICIAL.',
      realDataStatus: 'VERIFIED_REAL',
    },
    edAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'Early Decision admit rate',
      reason:
        'CDS 2024-25 Section C21: "Does your institution offer an early decision plan?" — NO checked. Wichita State does not offer Early Decision. CRITICAL URL FIX: prior sourceUrl pointed to https://www.olin.edu/.../CDS_2022-2023.pdf which is Olin College of Engineering (wrong institution AND wrong cycle). Tier transitions NO_PUBLIC_ROUND_RATE/TERMINAL -> UNAVAILABLE/OFFICIAL_BLANK_SECTION/NOT_OFFERED with the correct WSU source URL.',
      realDataStatus: 'NOT_OFFERED',
    },
    eaAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'Early Action admit rate',
      reason:
        'CDS 2024-25 Section C22: "Do you have a nonbinding early action plan?" — NO checked. Wichita State does not offer Early Action. Same Olin URL scrubbed. Same treatment as edAR.',
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
      acceptanceRate: new Prisma.Decimal('72.11'),
      sat25: 913,
      sat75: 1240,
      intlAcceptanceRate: new Prisma.Decimal('82.59'),
      oosAcceptanceRate: new Prisma.Decimal('73.30'),
      edAcceptanceRate: null,
      eaAcceptanceRate: null,
      // CDS C21 "No" — Wichita State does not offer ED; correct stale DB true.
      hasEarlyDecision: false,
      lastDataReviewAt: new Date(),
      metadata: nextMetadata,
    },
    select: { id: true },
  });

  console.log(
    '  updated 7 fields (AR=72.11 down -14.59, sat25=913 same, sat75=1240 same, intlAR=82.59 refined +0.59, oosAR=73.30 down -14.5, edAR=NOT_OFFERED, eaAR=NOT_OFFERED, hasED=false) + scrubbed Washington-State + Olin URL misclassifications',
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
