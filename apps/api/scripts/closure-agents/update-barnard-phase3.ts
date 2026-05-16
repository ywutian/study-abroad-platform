#!/usr/bin/env tsx
/**
 * Phase 3 — Barnard College end-to-end closure of the 7 prediction-critical
 * fields.
 *
 * Source: Barnard College CDS 2024-2025 (parsed by Claude from PDF)
 *   URL: https://barnard.edu/sites/default/files/inline-files/Barnard%20CDS%202024-2025.pdf
 *
 * Value changes (vs. existing DB):
 *   - acceptanceRate    : 7.00  → 8.84  (CDS C1 Total: 1,046 admits / 11,836
 *                          applicants = 8.8374% (rounded to 8.84%). CORRECTION
 *                          UP +1.84pp from prior LEGACY_DB value 7.00.)
 *   - sat25             : 1460  → 1480  (CDS C9 SAT Composite 25th = 1480
 *                          reported directly. CORRECTION UP +20 from prior
 *                          1460 SEED/PR-15 heuristic. 35% of Fall 2024
 *                          enrolled (248 students) submitted SAT.)
 *   - sat75             : 1570  → 1540  (CDS C9 SAT Composite 75th = 1540
 *                          reported directly (composite quantiles ≠ section
 *                          sums; EBRW 770 + Math 790 = 1560 differs).
 *                          CORRECTION DOWN -30 from prior 1570 SEED/PR-15
 *                          heuristic.)
 *   - intlAcceptanceRate: null  → null  (CDS C1 residency breakdown rows
 *                          (in-state/OOS/intl) are BLANK in Barnard's 2024-
 *                          25 CDS — they do not break out international
 *                          applicants/admits. Field marked UNAVAILABLE/
 *                          OFFICIAL_BLANK_SECTION (institution did not
 *                          report). Prior INFERRED/PERMANENT_HEURISTIC
 *                          provenance superseded.)
 *   - oosAcceptanceRate : null  → null  (Barnard is a private women's college;
 *                          in-state / out-of-state distinction carries no
 *                          policy meaning. CDS C1 residency breakdown is also
 *                          blank. Field marked UNAVAILABLE-terminal per
 *                          closure-pipeline convention for private
 *                          institutions. Prior INFERRED provenance
 *                          superseded.)
 *   - edAcceptanceRate  : 27.05 → 25.62 (CDS C21: Barnard offers ED ("Yes"
 *                          checked) — single plan, ED closes 11/1 (12/15
 *                          notification). Fall 2024 entering class: 434
 *                          admits / 1,694 ED applications = 25.6198%
 *                          (rounded to 25.62%). CORRECTION DOWN -1.43pp from
 *                          prior LEGACY_DB value 27.05.)
 *   - eaAcceptanceRate  : null  → null  (CDS C22: Barnard does NOT offer a
 *                          nonbinding Early Action plan ("No" checked).
 *                          Field stays null; provenance refreshed from prior
 *                          CDS_LLM_EXTRACT_2026_04 (with value=undefined) to
 *                          authoritative CDS_OFFICIAL pull marked
 *                          UNAVAILABLE-terminal / NOT_OFFERED.)
 */
import { PrismaClient, Prisma } from '@prisma/client';
import {
  deepMergeRecords,
  toRecord,
} from '../../src/modules/school/school-provenance.helpers';
import { serializeSchoolProvenance } from '@study-abroad/shared/utils';

const BARNARD_CDS_URL =
  'https://barnard.edu/sites/default/files/inline-files/Barnard%20CDS%202024-2025.pdf';
const CYCLE_YEAR = 2024; // CDS 2024-2025 = Fall 2024 entering class
const NOW = new Date().toISOString();

const prisma = new PrismaClient();

async function main() {
  const barnard = await prisma.school.findFirst({
    where: { id: 'cmnwr8ivm004lz0tio6m2uic4', name: 'Barnard College' },
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
  if (!barnard) throw new Error('Barnard College not found');
  console.log(`Updating ${barnard.name} (${barnard.id})`);
  console.log(
    `  current AR=${barnard.acceptanceRate?.toString()} sat25=${barnard.sat25} sat75=${barnard.sat75}`,
  );
  console.log(
    `  current intlAR=${barnard.intlAcceptanceRate?.toString() ?? 'null'} oosAR=${barnard.oosAcceptanceRate?.toString() ?? 'null'}`,
  );
  console.log(
    `  current edAR=${barnard.edAcceptanceRate?.toString()} eaAR=${barnard.eaAcceptanceRate?.toString() ?? 'null'}`,
  );

  const baseProv = {
    sourceUrl: BARNARD_CDS_URL,
    cycleYear: CYCLE_YEAR,
    fetchedAt: NOW,
    verifiedAt: NOW,
    confidence: 1.0,
    verifiedBy: 'closure-pipeline-phase3-claude',
    generatedBy: 'phase3-barnard-validation',
  };

  const provenance = {
    acceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 8.84,
      policyLabel: 'Overall admit rate',
      reason:
        'CDS 2024-25 Section C1: 1,046 admits / 11,836 applicants = 8.8374% (rounded to 8.84%). CORRECTION UP +1.84pp from prior LEGACY_DB value 7.00. Tier upgraded LEGACY_DB → OFFICIAL.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat25: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1480,
      policyLabel: 'SAT composite 25th percentile (reported composite row)',
      reason:
        'CDS 2024-25 Section C9: SAT Composite 25th = 1480 reported directly. CORRECTION UP +20 from prior 1460 (SEED/PR-15 heuristic). 35% of Fall 2024 enrolled (248 students) submitted SAT.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat75: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1540,
      policyLabel: 'SAT composite 75th percentile (reported composite row)',
      reason:
        'CDS 2024-25 Section C9: SAT Composite 75th = 1540 reported directly (composite quantiles ≠ section sums; EBRW 770 + Math 790 = 1560 differs). CORRECTION DOWN -30 from prior 1570 (SEED/PR-15 heuristic).',
      realDataStatus: 'VERIFIED_REAL',
    },
    intlAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'International admit rate',
      reason:
        "CDS 2024-25 Section C1 residency breakdown rows (In-State / Out-of-State / International) are BLANK in Barnard's 2024-25 CDS — Barnard does not publicly break out international applicants/admits via CDS. Field marked UNAVAILABLE / OFFICIAL_BLANK_SECTION (institution did not report). Prior INFERRED/PERMANENT_HEURISTIC provenance superseded by authoritative CDS pull.",
      realDataStatus: 'NOT_REPORTED',
    },
    oosAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'TERMINAL',
      confidence: 1.0,
      policyLabel: 'Out-of-state admit rate',
      reason:
        "Barnard College is a private women's liberal arts college; in-state / out-of-state distinction carries no policy meaning (no in-state tuition advantage). CDS C1 residency breakdown is also BLANK. Field marked UNAVAILABLE-terminal per closure-pipeline convention for private institutions. Prior INFERRED/PERMANENT_HEURISTIC provenance superseded.",
      realDataStatus: 'NOT_APPLICABLE',
    },
    edAcceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 25.62,
      policyLabel: 'Early Decision admit rate',
      reason:
        'CDS 2024-25 Section C21: Barnard offers Early Decision ("Yes" checked) — single plan, ED closes 11/1 (12/15 notification). Fall 2024 entering class: 434 admits / 1,694 ED applications = 25.6198% (rounded to 25.62%). CORRECTION DOWN -1.43pp from prior LEGACY_DB value 27.05.',
      realDataStatus: 'VERIFIED_REAL',
    },
    eaAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'Early Action admit rate',
      reason:
        'CDS 2024-25 Section C22: Barnard College does NOT offer a nonbinding Early Action plan ("No" checked for EA plan). DB value was already null; provenance refreshed from prior CDS_LLM_EXTRACT_2026_04 (with value=undefined) to authoritative CDS_OFFICIAL pull marked UNAVAILABLE-terminal / NOT_OFFERED.',
      realDataStatus: 'NOT_OFFERED',
    },
  };

  const existingMeta = toRecord(barnard.metadata);
  const serialized = serializeSchoolProvenance(provenance as any);
  const nextMetadata = {
    ...existingMeta,
    provenance: deepMergeRecords(toRecord(existingMeta.provenance), serialized),
    closureSourceIndex: BARNARD_CDS_URL,
  };

  await prisma.school.update({
    where: { id: barnard.id },
    data: {
      acceptanceRate: new Prisma.Decimal('8.84'),
      sat25: 1480,
      sat75: 1540,
      intlAcceptanceRate: null,
      oosAcceptanceRate: null,
      edAcceptanceRate: new Prisma.Decimal('25.62'),
      eaAcceptanceRate: null,
      hasEarlyDecision: true,
      lastDataReviewAt: new Date(),
      metadata: nextMetadata,
    },
    select: { id: true },
  });

  console.log(
    '  updated 7 fields (AR=8.84, sat25=1480, sat75=1540, intlAR=BLANK_SECTION, oosAR=N/A, edAR=25.62, eaAR=NOT_OFFERED)',
  );

  const after = await prisma.school.findUnique({
    where: { id: barnard.id },
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
