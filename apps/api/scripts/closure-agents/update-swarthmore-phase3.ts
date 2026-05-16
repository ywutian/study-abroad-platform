#!/usr/bin/env tsx
/**
 * Phase 3 — Swarthmore College end-to-end closure of the 7 prediction-critical
 * fields.
 *
 * Source: Swarthmore College CDS 2024-2025 (parsed by Claude from PDF)
 *   URL: https://www.swarthmore.edu/sites/default/files/assets/documents/institutional-effectiveness-research-assessment/Swarthmore-CDS-2024-2025-fillable-pdf-version.pdf
 *
 * All 7 fields upgraded to OFFICIAL (or UNAVAILABLE-terminal where Swarthmore
 * structurally cannot publish the value).
 *
 * Value changes (vs. existing DB):
 *   - acceptanceRate    : 7.46  → 7.46   (CDS C1: 975 admits (465 M + 510 W) /
 *                          13,065 applicants (5,746 M + 7,311 W + 8 unknown)
 *                          = 7.4626%. Value confirmed. Tier upgraded
 *                          LEGACY_DB→OFFICIAL.)
 *   - sat25             : 1460  → 1500   (CDS C9: SAT Composite 25th = 1500
 *                          reported directly. CORRECTION UP from prior 1460
 *                          (SEED/PR-15 heuristic). EBRW 740 + Math 750 = 1490
 *                          differs because composite quantiles ≠ section sums;
 *                          prefer reported Composite row per Phase 3 convention.)
 *   - sat75             : 1570  → 1550   (CDS C9: SAT Composite 75th = 1550
 *                          reported directly. CORRECTION DOWN from prior 1570
 *                          (SEED/PR-15 heuristic). EBRW 770 + Math 790 = 1560
 *                          differs; prefer reported Composite row.)
 *   - intlAcceptanceRate: 2.8   → null   (CDS C1 residency table is marked
 *                          "Not available" — Swarthmore did not publish the
 *                          residency breakdown for Fall 2024. Prior INFERRED/
 *                          PERMANENT_HEURISTIC value (2.8) cleared. Field
 *                          marked UNAVAILABLE/OFFICIAL_BLANK_SECTION.)
 *   - oosAcceptanceRate : 4.9   → null   (Swarthmore is a private LAC; in-state /
 *                          out-of-state distinction carries no policy meaning
 *                          (no in-state tuition advantage). CDS C1 residency
 *                          table is also blank ("Not available"). Prior
 *                          INFERRED value (4.9) cleared. Field marked
 *                          UNAVAILABLE-terminal per closure-pipeline convention
 *                          for private institutions.)
 *   - edAcceptanceRate  : 18.02 → 18.02  (CDS C21: ED offered ("Yes" checked);
 *                          deadlines 11/15 + 1/4. Fall 2024 entering class:
 *                          220 admits / 1,221 ED applications = 18.0180%
 *                          (rounded to 18.02%). Value matches prior DB.
 *                          Provenance refreshed to closure-pipeline-phase3
 *                          CDS_OFFICIAL with current cycle metadata.)
 *   - eaAcceptanceRate  : null  → null   (CDS C22: Swarthmore does NOT offer a
 *                          nonbinding Early Action plan ("No" checked). DB
 *                          value was already null; prior provenance had
 *                          tier=OFFICIAL but lacked NOT_OFFERED label and value.
 *                          Refreshed to canonical UNAVAILABLE/OFFICIAL_BLANK_SECTION
 *                          NOT_OFFERED form for consistency.)
 */
import { PrismaClient, Prisma } from '@prisma/client';
import {
  deepMergeRecords,
  toRecord,
} from '../../src/modules/school/school-provenance.helpers';
import { serializeSchoolProvenance } from '@study-abroad/shared/utils';

const SWARTHMORE_CDS_URL =
  'https://www.swarthmore.edu/sites/default/files/assets/documents/institutional-effectiveness-research-assessment/Swarthmore-CDS-2024-2025-fillable-pdf-version.pdf';
const CYCLE_YEAR = 2024; // CDS 2024-2025 = Fall 2024 entering class
const NOW = new Date().toISOString();

const prisma = new PrismaClient();

async function main() {
  const swat = await prisma.school.findFirst({
    where: { name: 'Swarthmore College' },
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
  if (!swat) throw new Error('Swarthmore College not found');
  console.log(`Updating ${swat.name} (${swat.id})`);
  console.log(
    `  current AR=${swat.acceptanceRate?.toString()} sat25=${swat.sat25} sat75=${swat.sat75}`,
  );
  console.log(
    `  current intlAR=${swat.intlAcceptanceRate?.toString()} oosAR=${swat.oosAcceptanceRate?.toString()}`,
  );
  console.log(
    `  current edAR=${swat.edAcceptanceRate?.toString()} eaAR=${swat.eaAcceptanceRate?.toString() ?? 'null'}`,
  );

  const baseProv = {
    sourceUrl: SWARTHMORE_CDS_URL,
    cycleYear: CYCLE_YEAR,
    fetchedAt: NOW,
    verifiedAt: NOW,
    confidence: 1.0,
    verifiedBy: 'closure-pipeline-phase3-claude',
    generatedBy: 'phase3-swarthmore-validation',
  };

  const provenance = {
    acceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 7.46,
      policyLabel: 'Overall admit rate',
      reason:
        'CDS 2024-25 Section C1: 975 admits (465 M + 510 W) / 13,065 applicants (5,746 M + 7,311 W + 8 unknown) = 7.4626% (rounded to 7.46%). Value confirmed matching prior DB; tier upgraded from LEGACY_DB to OFFICIAL with current cycle metadata.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat25: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1500,
      policyLabel: 'SAT composite 25th percentile (reported composite row)',
      reason:
        'CDS 2024-25 Section C9: SAT Composite 25th = 1500 (reported directly; EBRW 740 + Math 750 sum = 1490 differs because composite quantiles ≠ section sums). CORRECTION UP from prior 1460 (SEED/PR-15 heuristic). 39.34% of enrolled class submitted SAT scores (168 students).',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat75: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1550,
      policyLabel: 'SAT composite 75th percentile (reported composite row)',
      reason:
        'CDS 2024-25 Section C9: SAT Composite 75th = 1550 (reported directly; LOWER than EBRW 770 + Math 790 = 1560 because composite quantiles ≠ section sums). CORRECTION DOWN from prior 1570 (SEED/PR-15 heuristic). 39.34% of enrolled class submitted SAT scores (168 students).',
      realDataStatus: 'VERIFIED_REAL',
    },
    intlAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'International admit rate',
      reason:
        'CDS 2024-25 Section C1 residency table is explicitly marked "Not available" — Swarthmore College did not publish the in-state / out-of-state / international breakdown for Fall 2024 (all residency rows are zero, total=0). Prior DB value 2.8 (INFERRED/PERMANENT_HEURISTIC) cleared. Field marked UNAVAILABLE/OFFICIAL_BLANK_SECTION.',
      realDataStatus: 'NO_PUBLIC_SOURCE',
    },
    oosAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'TERMINAL',
      confidence: 1.0,
      policyLabel: 'Out-of-state admit rate',
      reason:
        'Swarthmore College is a private liberal arts college; in-state / out-of-state distinction carries no policy meaning (no in-state tuition advantage). CDS C1 residency table is also marked "Not available" for Fall 2024. Prior DB value 4.9 (INFERRED/PERMANENT_HEURISTIC) cleared. Field marked UNAVAILABLE-terminal per closure-pipeline convention for private institutions.',
      realDataStatus: 'NOT_APPLICABLE',
    },
    edAcceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 18.02,
      policyLabel: 'Early Decision admit rate',
      reason:
        'CDS 2024-25 Section C21: Swarthmore offers Early Decision ("Yes" checked); ED I closing 11/15 (notification 12/15), ED II closing 1/4 (notification 1/15). Fall 2024 entering class: 220 admits / 1,221 ED applications = 18.0180% (rounded to 18.02%). Value matches prior DB; provenance refreshed to closure-pipeline-phase3 CDS_OFFICIAL with current cycle metadata.',
      realDataStatus: 'VERIFIED_REAL',
    },
    eaAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'Early Action admit rate',
      reason:
        'CDS 2024-25 Section C22: Swarthmore College does NOT offer a nonbinding Early Action plan ("No" checked). DB value was already null; prior provenance (tier=OFFICIAL CDS_LLM_EXTRACT_2026_04) lacked explicit NOT_OFFERED label. Refreshed to canonical UNAVAILABLE/OFFICIAL_BLANK_SECTION NOT_OFFERED form with current CDS source URL.',
      realDataStatus: 'NOT_OFFERED',
    },
  };

  const existingMeta = toRecord(swat.metadata);
  const serialized = serializeSchoolProvenance(provenance as any);
  const nextMetadata = {
    ...existingMeta,
    provenance: deepMergeRecords(toRecord(existingMeta.provenance), serialized),
    closureSourceIndex: SWARTHMORE_CDS_URL,
  };

  // Bypass SchoolWriteService (schema drift). Minimal update with explicit select.
  await prisma.school.update({
    where: { id: swat.id },
    data: {
      acceptanceRate: new Prisma.Decimal('7.46'),
      sat25: 1500,
      sat75: 1550,
      intlAcceptanceRate: null, // CDS C1 residency "Not available" — clear stale 2.8
      oosAcceptanceRate: null, // private LAC + blank residency — clear stale 4.9
      edAcceptanceRate: new Prisma.Decimal('18.02'),
      eaAcceptanceRate: null, // CDS C22 "No" — already null, re-confirm
      hasEarlyDecision: true, // re-confirm from CDS C21 "Yes"
      lastDataReviewAt: new Date(),
      metadata: nextMetadata,
    },
    select: { id: true },
  });

  console.log(
    '  ✅ updated 7 fields (AR=7.46, sat25=1500, sat75=1550, intlAR=BLANK, oosAR=N/A, edAR=18.02, eaAR=NOT_OFFERED)',
  );

  // verify
  const after = await prisma.school.findUnique({
    where: { id: swat.id },
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
