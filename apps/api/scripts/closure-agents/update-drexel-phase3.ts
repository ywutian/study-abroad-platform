#!/usr/bin/env tsx
/**
 * Phase 3 — Drexel University end-to-end closure of the 7 prediction-critical
 * fields.
 *
 * Source: Drexel University CDS 2024-2025 (Fall 2024 entering class)
 *   URL: https://drexel.edu/institutionalresearch/~/media/Drexel/Provost-Group/InstitutionalResearch/Documents/Factbook/CDS-2024-2025-publish.pdf
 *
 * Drexel is a PRIVATE research university (Philadelphia, PA).
 *   - isPrivate=true  ->  oosAcceptanceRate is OUT of eligible scope; CDS C1
 *     residency table does report OOS (15,925/18,730 = 85.02%), but value is
 *     not actionable for applicants of a private school. Per closure-pipeline
 *     convention, private schools -> oosAR marked UNAVAILABLE/TERMINAL.
 *
 * Drexel SAT/ACT usage (C8A): YES — "Required for some" programs (Fall 2026).
 *
 * Value changes (vs. existing DB):
 *   - acceptanceRate    : 79.44   -> 79.44  (CDS C1: 29,642 admits / 37,314
 *                          applicants = 79.4339%. Value matches prior DB;
 *                          tier upgraded LEGACY_DB -> OFFICIAL.)
 *   - sat25             : 1200    -> 1250   (CDS C9: SAT Composite 25th = 1250
 *                          reported directly; EBRW 620 + Math 620 sum = 1240
 *                          differs because composite quantiles ≠ section sums.
 *                          CORRECTION UP +50 from prior 1200
 *                          (LEGACY_DB heuristic).)
 *   - sat75             : 1380    -> 1430   (CDS C9: SAT Composite 75th = 1430
 *                          reported directly; EBRW 700 + Math 740 sum = 1440
 *                          differs because composite quantiles ≠ section sums.
 *                          CORRECTION UP +50 from prior 1380
 *                          (LEGACY_DB heuristic).)
 *   - intlAcceptanceRate: 67.83   -> 67.83  (CDS C1 residency table: 6,046 intl
 *                          admits / 8,914 intl applicants = 67.8259% (rounded
 *                          to 67.83%). Value matches prior DB; tier upgraded
 *                          LEGACY_DB -> OFFICIAL.)
 *   - oosAcceptanceRate : 85.02   -> null   (Drexel is a PRIVATE research
 *                          university; in-state / out-of-state distinction
 *                          carries no policy meaning (no in-state tuition
 *                          advantage). CDS C1 residency reports OOS
 *                          (15,925/18,730 = 85.0240%) but per closure-pipeline
 *                          convention, private schools -> UNAVAILABLE/TERMINAL.
 *                          Prior legacy DB value cleared.)
 *   - edAcceptanceRate  : 91.74   -> 91.74  (CDS C21: ED offered ("Y" checked);
 *                          single plan closing 11/1, notification 12/15. Fall
 *                          2024 entering class: 300 admits / 327 ED applications
 *                          = 91.7431% (rounded to 91.74%). Value matches prior
 *                          DB; provenance refreshed to closure-pipeline-phase3
 *                          CDS_OFFICIAL.)
 *   - eaAcceptanceRate  : null    -> null   (CDS C22: EA offered ("Y" checked,
 *                          non-restrictive) but the Fall 2024 EA applications/
 *                          admits counts are BLANK in the published CDS — Drexel
 *                          offers EA structurally but did NOT report counts
 *                          for the 2024-25 cycle. Field stays null with tier
 *                          UNAVAILABLE/OFFICIAL_BLANK_SECTION.)
 */
import { PrismaClient, Prisma } from '@prisma/client';
import {
  deepMergeRecords,
  toRecord,
} from '../../src/modules/school/school-provenance.helpers';
import { serializeSchoolProvenance } from '@study-abroad/shared/utils';

const CDS_URL =
  'https://drexel.edu/institutionalresearch/~/media/Drexel/Provost-Group/InstitutionalResearch/Documents/Factbook/CDS-2024-2025-publish.pdf';
const CYCLE_YEAR = 2024; // CDS 2024-2025 = Fall 2024 entering class
const NOW = new Date().toISOString();
const SCHOOL_ID = 'cmnwr8ink000xz0tivm4enckb';

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
  if (!school) throw new Error(`School ${SCHOOL_ID} (Drexel) not found`);
  console.log(`Updating ${school.name} (${school.id})`);
  console.log(`  isPrivate=${school.isPrivate}  [PRIVATE — oosAR=TERMINAL]`);
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
    generatedBy: 'phase3-drexel-validation',
  };

  const provenance = {
    acceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 79.44,
      policyLabel: 'Overall admit rate',
      reason:
        'CDS 2024-25 Section C1: 29,642 admits / 37,314 applicants = 79.4339% (rounded to 79.44%). Value matches prior DB (79.44); tier upgraded from LEGACY_DB to OFFICIAL with cycle metadata.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat25: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1250,
      policyLabel: 'SAT composite 25th percentile (reported composite row)',
      reason:
        'CDS 2024-25 Section C9: SAT Composite 25th = 1250 (reported directly; EBRW 620 + Math 620 sum = 1240 differs because composite quantiles ≠ section sums). CORRECTION UP +50 from prior 1200 (LEGACY_DB heuristic). 34% of Fall 2024 enrolled (809 students) submitted SAT; SAT/ACT "Required for some" programs (C8A=Y).',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat75: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1430,
      policyLabel: 'SAT composite 75th percentile (reported composite row)',
      reason:
        'CDS 2024-25 Section C9: SAT Composite 75th = 1430 (reported directly; EBRW 700 + Math 740 sum = 1440 differs because composite quantiles ≠ section sums). CORRECTION UP +50 from prior 1380 (LEGACY_DB heuristic).',
      realDataStatus: 'VERIFIED_REAL',
    },
    intlAcceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 67.83,
      policyLabel: 'International admit rate',
      reason:
        'CDS 2024-25 Section C1 residency table: 6,046 international admits / 8,914 international applicants = 67.8259% (rounded to 67.83%). Value matches prior DB (67.83); tier upgraded from LEGACY_DB to OFFICIAL.',
      realDataStatus: 'VERIFIED_REAL',
    },
    oosAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'TERMINAL',
      confidence: 1.0,
      policyLabel: 'Out-of-state admit rate',
      reason:
        'Drexel University is a private research university; in-state / out-of-state distinction carries no policy meaning (no in-state tuition advantage). CDS C1 residency table does report OOS (15,925 admits / 18,730 applicants = 85.0240%), but the value is not actionable for applicants. Prior legacy DB value (85.02%) cleared. Field marked UNAVAILABLE-terminal per closure-pipeline convention for private institutions.',
      realDataStatus: 'NOT_APPLICABLE',
    },
    edAcceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 91.74,
      policyLabel: 'Early Decision admit rate',
      reason:
        'CDS 2024-25 Section C21: Drexel offers Early Decision ("Y" checked) — single plan closing 11/1, notification 12/15. Fall 2024 entering class: 300 admits / 327 ED applications = 91.7431% (rounded to 91.74%). Value matches prior DB; provenance refreshed to closure-pipeline-phase3 CDS_OFFICIAL with current cycle metadata.',
      realDataStatus: 'VERIFIED_REAL',
    },
    eaAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'Early Action admit rate',
      reason:
        'CDS 2024-25 Section C22: Drexel offers a nonbinding Early Action plan ("Y" checked, non-restrictive; closing 11/1, notification 12/15), but the Fall 2024 EA applications/admits counts are BLANK in the published CDS — Drexel offers EA structurally but did NOT report counts for the 2024-25 cycle. Field stays null with tier UNAVAILABLE/OFFICIAL_BLANK_SECTION (NOT_COLLECTED).',
      realDataStatus: 'NOT_COLLECTED',
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
      acceptanceRate: new Prisma.Decimal('79.44'),
      sat25: 1250,
      sat75: 1430,
      intlAcceptanceRate: new Prisma.Decimal('67.83'),
      oosAcceptanceRate: null,
      edAcceptanceRate: new Prisma.Decimal('91.74'),
      eaAcceptanceRate: null,
      hasEarlyDecision: true, // re-confirm from CDS C21 "Y"
      lastDataReviewAt: new Date(),
      metadata: nextMetadata,
    },
    select: { id: true },
  });

  console.log(
    '  ✅ updated 7 fields (AR=79.44, sat25=1250, sat75=1430, intlAR=67.83, oosAR=N/A, edAR=91.74, eaAR=BLANK)',
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
