#!/usr/bin/env tsx
/**
 * Phase 3 — Boston College end-to-end closure of the 7 prediction-critical fields.
 *
 * Source: Boston College CDS 2024-2025 (Fall 2024 entering class)
 *   URL: https://www.bc.edu/content/dam/bc1/offices/irp/ir/cds/Boston_College_CDS_2024-2025_Final.pdf
 *
 * Convention: BC is PRIVATE → oosAcceptanceRate marked UNAVAILABLE/TERMINAL
 * (even though CDS C1 residency table reports it, the value is not policy-actionable
 * for applicants to a private school with no in-state tuition advantage).
 *
 * Value changes (vs. existing DB):
 *   - acceptanceRate    : 14.7   → 16.19  (CDS C1: 5,632 admits / 34,779 applicants
 *                          = 16.1937%. CORRECTION UP +1.49pp from prior LEGACY_DB.)
 *   - sat25             : 1410   → 1460   (CDS C9: SAT Composite 25th = 1460
 *                          reported. CORRECTION UP +50 from prior LEGACY_DB.)
 *   - sat75             : 1510   → 1520   (CDS C9: SAT Composite 75th = 1520
 *                          reported. CORRECTION UP +10 from prior LEGACY_DB.)
 *   - intlAcceptanceRate: 16.72  → 16.72  (CDS C1 residency: 618 intl admits /
 *                          3,696 intl applicants = 16.7208%. Value matches prior
 *                          DB; tier upgraded LEGACY_DB → OFFICIAL.)
 *   - oosAcceptanceRate : 16.04  → null   (BC is a private university; OOS pricing
 *                          is identical to in-state. CDS C1 residency does report
 *                          OOS (4,116/25,661 = 16.04%) but per closure-pipeline
 *                          convention, private schools → UNAVAILABLE/TERMINAL.
 *                          Prior legacy DB value cleared.)
 *   - edAcceptanceRate  : 33.44  → 33.44  (CDS C21: ED = "Yes". Fall 2024 entering
 *                          class: 1,434 admits / 4,288 ED applications = 33.4422%
 *                          → 33.44%. Value matches prior DB; tier upgraded
 *                          LEGACY_DB → OFFICIAL.)
 *   - eaAcceptanceRate  : null   → null   (CDS C22: EA = "No". BC does not offer
 *                          a nonbinding Early Action plan. Field stays null.
 *                          Provenance refreshed to authoritative CDS pull marked
 *                          UNAVAILABLE/OFFICIAL_BLANK_SECTION/NOT_OFFERED.)
 */
import { PrismaClient, Prisma } from '@prisma/client';
import {
  deepMergeRecords,
  toRecord,
} from '../../src/modules/school/school-provenance.helpers';
import { serializeSchoolProvenance } from '@study-abroad/shared/utils';

const CDS_URL =
  'https://www.bc.edu/content/dam/bc1/offices/irp/ir/cds/Boston_College_CDS_2024-2025_Final.pdf';
const CYCLE_YEAR = 2024; // CDS 2024-2025 = Fall 2024 entering class
const NOW = new Date().toISOString();
const SCHOOL_ID = 'cmn1htkpl0012vqf28whnvaoj';

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
    throw new Error(`School ${SCHOOL_ID} (Boston College) not found`);
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
    generatedBy: 'phase3-boston-college-validation',
  };

  const provenance = {
    acceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 16.19,
      policyLabel: 'Overall admit rate',
      reason:
        'CDS 2024-25 Section C1: 5,632 admits / 34,779 applicants = 16.1937% (rounded to 16.19%). Tier upgraded from LEGACY_DB (value 14.7) to OFFICIAL. CORRECTION UP +1.49pp.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat25: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1460,
      policyLabel: 'SAT composite 25th percentile (reported composite row)',
      reason:
        'CDS 2024-25 Section C9: SAT Composite 25th = 1460 (reported directly; EBRW 710 + Math 730 sum = 1440 differs because composite quantiles ≠ section sums). CORRECTION UP from prior 1410 (LEGACY_DB). 30% of Fall 2024 enrolled (711 students) submitted SAT.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat75: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1520,
      policyLabel: 'SAT composite 75th percentile (reported composite row)',
      reason:
        'CDS 2024-25 Section C9: SAT Composite 75th = 1520 (reported directly; EBRW 760 + Math 780 sum = 1540 differs because composite quantiles ≠ section sums). CORRECTION UP from prior 1510 (LEGACY_DB).',
      realDataStatus: 'VERIFIED_REAL',
    },
    intlAcceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 16.72,
      policyLabel: 'International admit rate',
      reason:
        'CDS 2024-25 Section C1 residency table: 618 international admits / 3,696 international applicants = 16.7208% (rounded to 16.72%). Value matches prior DB; tier upgraded from LEGACY_DB to OFFICIAL with refreshed provenance.',
      realDataStatus: 'VERIFIED_REAL',
    },
    oosAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'TERMINAL',
      confidence: 1.0,
      policyLabel: 'Out-of-state admit rate',
      reason:
        'Boston College is a private university; in-state / out-of-state distinction carries no policy meaning (no in-state tuition advantage). CDS C1 residency table does report OOS (4,116 admits / 25,661 applicants = 16.0399%), but the value is not actionable for applicants. Prior legacy DB value (16.04%) cleared. Field marked UNAVAILABLE-terminal per closure-pipeline convention for private institutions.',
      realDataStatus: 'NOT_APPLICABLE',
    },
    edAcceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 33.44,
      policyLabel: 'Early Decision admit rate',
      reason:
        'CDS 2024-25 Section C21: BC offers Early Decision ("Yes" checked) — ED I closes 11/1, notify by 12/15; ED II closes 1/2, notify by 2/15. Fall 2024 entering class combined totals: 1,434 admits / 4,288 ED applications = 33.4422% (rounded to 33.44%). Value matches prior DB; tier upgraded from LEGACY_DB to OFFICIAL with current cycle metadata.',
      realDataStatus: 'VERIFIED_REAL',
    },
    eaAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'Early Action admit rate',
      reason:
        'CDS 2024-25 Section C22: Boston College does NOT offer a nonbinding Early Action plan ("No" checked for EA plan). DB value was already null; provenance refreshed from prior CDS_LLM_EXTRACT_2026_04 (with value=undefined) to authoritative CDS_OFFICIAL pull marked UNAVAILABLE-terminal/NOT_OFFERED.',
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
      acceptanceRate: new Prisma.Decimal('16.19'),
      sat25: 1460,
      sat75: 1520,
      intlAcceptanceRate: new Prisma.Decimal('16.72'),
      oosAcceptanceRate: null,
      edAcceptanceRate: new Prisma.Decimal('33.44'),
      eaAcceptanceRate: null, // CDS C22 "No" — BC does not offer EA
      hasEarlyDecision: true, // re-confirm from CDS C21 "Yes"
      lastDataReviewAt: new Date(),
      metadata: nextMetadata,
    },
    select: { id: true },
  });

  console.log(
    '  ✅ updated 7 fields (AR=16.19, sat25=1460, sat75=1520, intlAR=16.72, oosAR=N/A, edAR=33.44, eaAR=NOT_OFFERED)',
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
