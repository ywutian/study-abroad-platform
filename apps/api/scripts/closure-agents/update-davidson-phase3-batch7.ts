#!/usr/bin/env tsx
/**
 * Phase 3 batch 7 — Davidson College end-to-end closure of the 7
 * prediction-critical fields.
 *
 * Source: Davidson College Common Data Set 2025-2026 (Fall 2025 entering
 *   class) — the most recent CDS posted by the Office of Institutional
 *   Research at the same canonical URL that prior LEGACY_DB provenance
 *   already referenced.
 *   URL: https://www.davidson.edu/media/9718/download
 *
 * Davidson is a private liberal arts college (CDS C1 confirms it is highly
 * selective with national applicant pool). Per closure-pipeline convention
 * for private institutions, oosAcceptanceRate is NOT actionable (no
 * in-state tuition advantage) and is marked UNAVAILABLE/TERMINAL even
 * though Davidson's CDS C1 residency table does report the OOS figure.
 *
 * Value changes (vs. existing DB):
 *   - acceptanceRate    : 12.62  -> 12.62  (CDS 2025-26 C1: 1,127 admits /
 *                          8,933 applicants = 12.6161%, rounds to 12.62.
 *                          Value matches; tier upgraded LEGACY_DB ->
 *                          OFFICIAL with current cycle metadata.)
 *   - sat25             : 1380   -> 1410   (CDS 2025-26 C9: SAT Composite
 *                          25th = 1410 (reported directly). CORRECTION UP
 *                          from prior 1380 (SEED/PR-15 heuristic).
 *                          NOTE: Davidson is test-flexible — "Not required
 *                          for admission, but consider if submitted" for
 *                          Fall 2027 (C8A); only 25.4% of enrolled
 *                          submitted SAT, 24.3% submitted ACT (C9).
 *                          Reported composite percentiles describe the
 *                          submitter sub-population.)
 *   - sat75             : 1540   -> 1500   (CDS 2025-26 C9: SAT Composite
 *                          75th = 1500 (reported directly). CORRECTION
 *                          DOWN from prior 1540 (SEED/PR-15 heuristic).)
 *   - intlAcceptanceRate: 2.38   -> 2.38   (CDS 2025-26 C1 residency: 85
 *                          intl admits / 3,574 intl applicants = 2.3782%.
 *                          Value matches; tier LEGACY_DB -> OFFICIAL.)
 *   - oosAcceptanceRate : 20.42  -> null   (Davidson is a private LAC; in-
 *                          state / out-of-state distinction carries no
 *                          policy meaning (no in-state tuition advantage).
 *                          CDS C1 does report OOS (808/3,957 = 20.42%) but
 *                          per closure-pipeline convention, private
 *                          schools -> UNAVAILABLE/TERMINAL. Prior legacy
 *                          DB value cleared.)
 *   - edAcceptanceRate  : 29.06  -> 29.06  (CDS 2025-26 C21: Davidson
 *                          offers Early Decision ("Yes" checked); deadline
 *                          11/15, notification 12/15 (ED I); 1/5 -> 1/7
 *                          (ED II). 358 ED admits / 1,232 ED applications
 *                          = 29.0584% (rounds to 29.06%). Value matches
 *                          prior DB; provenance refreshed to OFFICIAL.)
 *   - eaAcceptanceRate  : null   -> null   (CDS 2025-26 C22: Davidson does
 *                          NOT offer Early Action ("No" checked). Stays
 *                          UNAVAILABLE/OFFICIAL_BLANK_SECTION. Provenance
 *                          refreshed to 2025-26 cycle.)
 *
 * NOTE on cycle: CDS form's C21 sub-table is labeled "For the Fall 2024
 *   entering class" — this is a stale label in Davidson's CDS template; the
 *   surrounding cycle is 2025-2026 (Fall 2025 entering, per B1 header).
 *   We adopt cycleYear=2025 (= Fall 2025 entering, the CDS body cycle).
 */
import { PrismaClient, Prisma } from '@prisma/client';
import {
  deepMergeRecords,
  toRecord,
} from '../../src/modules/school/school-provenance.helpers';
import { serializeSchoolProvenance } from '@study-abroad/shared/utils';

const CDS_URL = 'https://www.davidson.edu/media/9718/download';
const CYCLE_YEAR = 2025; // CDS 2025-2026 = Fall 2025 entering class
const NOW = new Date().toISOString();
const SCHOOL_ID = 'cmnwr8ive004gz0tihs1kxbek';

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
  if (!school)
    throw new Error(`School ${SCHOOL_ID} (Davidson College) not found`);
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
    generatedBy: 'phase3-batch7-davidson-validation',
  };

  const provenance = {
    acceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 12.62,
      policyLabel: 'Overall admit rate',
      reason:
        'CDS 2025-26 Section C1: 1,127 admits / 8,933 applicants = 12.6161% (rounds to 12.62%). Value matches prior DB; tier upgraded LEGACY_DB -> OFFICIAL with current cycle metadata.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat25: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1410,
      policyLabel: 'SAT composite 25th percentile (reported composite row)',
      reason:
        'CDS 2025-26 Section C9: SAT Composite 25th = 1410 (reported directly). CORRECTION UP from prior 1380 (SEED/PR-15 heuristic). NOTE: Davidson is test-flexible for Fall 2027 (C8A "Not required for admission, but consider if submitted"); only 25.4% of enrolled submitted SAT scores per C9, so the band describes the submitter sub-population.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat75: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1500,
      policyLabel: 'SAT composite 75th percentile (reported composite row)',
      reason:
        'CDS 2025-26 Section C9: SAT Composite 75th = 1500 (reported directly). CORRECTION DOWN from prior 1540 (SEED/PR-15 heuristic). Test-flexible context as in sat25.',
      realDataStatus: 'VERIFIED_REAL',
    },
    intlAcceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 2.38,
      policyLabel: 'International admit rate',
      reason:
        'CDS 2025-26 Section C1 residency table: 85 international admits / 3,574 international applicants = 2.3782% (rounds to 2.38%). Value matches prior DB; tier upgraded LEGACY_DB -> OFFICIAL.',
      realDataStatus: 'VERIFIED_REAL',
    },
    oosAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'TERMINAL',
      confidence: 1.0,
      policyLabel: 'Out-of-state admit rate',
      reason:
        'Davidson College is a private liberal arts college; in-state / out-of-state distinction carries no policy meaning (no in-state tuition advantage). CDS C1 residency table does report OOS (808 admits / 3,957 applicants = 20.42%), but the value is not actionable for applicants. Prior legacy DB value (20.42%) cleared. Field marked UNAVAILABLE-terminal per closure-pipeline convention for private institutions.',
      realDataStatus: 'NOT_APPLICABLE',
    },
    edAcceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 29.06,
      policyLabel: 'Early Decision admit rate',
      reason:
        'CDS 2025-26 Section C21: Davidson offers Early Decision ("Yes" checked); ED I deadline 11/15, notification 12/15; ED II deadline 1/5, notification 1/7. CDS sub-table reports 1,232 ED applications and 358 ED admits = 29.0584% (rounds to 29.06%). (Sub-table label "Fall 2024 entering class" appears to be stale Davidson form template; we adopt cycleYear=2025 per CDS body cycle 2025-2026.) Value matches prior DB; provenance refreshed to OFFICIAL.',
      realDataStatus: 'VERIFIED_REAL',
    },
    eaAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'Early Action admit rate',
      reason:
        'CDS 2025-26 Section C22: "Do you have a nonbinding early action plan?" — NO checked. Davidson does not offer Early Action. Field stays cleared (UNAVAILABLE/OFFICIAL_BLANK_SECTION). Provenance refreshed to 2025-26 cycle.',
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
      acceptanceRate: new Prisma.Decimal('12.62'),
      sat25: 1410,
      sat75: 1500,
      intlAcceptanceRate: new Prisma.Decimal('2.38'),
      oosAcceptanceRate: null,
      edAcceptanceRate: new Prisma.Decimal('29.06'),
      eaAcceptanceRate: null,
      hasEarlyDecision: true,
      lastDataReviewAt: new Date(),
      metadata: nextMetadata,
    },
    select: { id: true },
  });

  console.log(
    '  ✅ updated 7 fields (AR=12.62, sat25=1410, sat75=1500, intlAR=2.38, oosAR=N/A, edAR=29.06, eaAR=NOT_OFFERED, hasED=true)',
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
