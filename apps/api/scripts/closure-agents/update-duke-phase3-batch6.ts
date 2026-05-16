#!/usr/bin/env tsx
/**
 * Phase 3 batch 6 — Duke University end-to-end closure of the 7 prediction-critical
 * fields.
 *
 * Source: Duke University CDS 2024-2025
 *   URL: https://ir.provost.duke.edu/sites/default/files/CDS-2024-25-Final-2.pdf
 *
 * Value changes (vs. existing DB):
 *   - acceptanceRate    : 5.15  → 5.71   (CDS C1 Total: 2,957 admits / 51,795
 *                          applicants = 5.7090%. Tier upgraded LEGACY_DB
 *                          (sourceUrl pointed to collegekickstart.com
 *                          aggregator) → OFFICIAL. CORRECTION UP +0.56pp.)
 *   - sat25             : 1500  → 1500   (CDS C9: SAT Composite row blank;
 *                          EBRW 740 + Math 760 sum = 1500. Value matches prior
 *                          DB; tier upgraded LEGACY_DB → OFFICIAL.)
 *   - sat75             : 1570  → 1570   (CDS C9: SAT Composite row blank;
 *                          EBRW 770 + Math 800 sum = 1570. Value matches prior
 *                          DB; tier upgraded LEGACY_DB → OFFICIAL.)
 *   - intlAcceptanceRate: 3.86  → 3.86   (CDS C1 residency: 585 intl admits /
 *                          15,141 intl applicants = 3.8637%. Value matches
 *                          prior DB; tier upgraded LEGACY_DB → OFFICIAL.)
 *   - oosAcceptanceRate : 6.25  → null   (Duke is a private research
 *                          university; in-state / out-of-state distinction
 *                          carries no policy meaning. CDS C1 reports OOS
 *                          (1,995/31,906 = 6.25%) but per closure-pipeline
 *                          convention, private schools → UNAVAILABLE/TERMINAL.
 *                          Prior legacy DB value cleared.)
 *   - edAcceptanceRate  : 17.33 → 17.33  (CDS C21: ED offered ("Yes"). Fall
 *                          2024 entering class: 1,042 admits / 6,013 ED
 *                          applications = 17.3291% (rounded 17.33%). Value
 *                          matches prior DB; tier upgraded LEGACY_DB →
 *                          OFFICIAL.)
 *   - eaAcceptanceRate  : null  → null   (CDS C22: Duke does NOT offer a
 *                          nonbinding Early Action plan ("No" checked).
 *                          Provenance refreshed to authoritative CDS pull
 *                          UNAVAILABLE/OFFICIAL_BLANK_SECTION/NOT_OFFERED.)
 */
import { PrismaClient, Prisma } from '@prisma/client';
import {
  deepMergeRecords,
  toRecord,
} from '../../src/modules/school/school-provenance.helpers';
import { serializeSchoolProvenance } from '@study-abroad/shared/utils';

const DUKE_CDS_URL =
  'https://ir.provost.duke.edu/sites/default/files/CDS-2024-25-Final-2.pdf';
const CYCLE_YEAR = 2024; // CDS 2024-2025 = Fall 2024 entering class
const NOW = new Date().toISOString();

const prisma = new PrismaClient();

async function main() {
  const duke = await prisma.school.findFirst({
    where: { id: 'cmn1htkng0007vqf224oeyvgq', name: 'Duke University' },
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
  if (!duke) throw new Error('Duke University not found');
  console.log(`Updating ${duke.name} (${duke.id})`);
  console.log(
    `  current AR=${duke.acceptanceRate?.toString()} sat25=${duke.sat25} sat75=${duke.sat75}`,
  );
  console.log(
    `  current intlAR=${duke.intlAcceptanceRate?.toString()} oosAR=${duke.oosAcceptanceRate?.toString()}`,
  );
  console.log(
    `  current edAR=${duke.edAcceptanceRate?.toString()} eaAR=${duke.eaAcceptanceRate?.toString() ?? 'null'}`,
  );

  const baseProv = {
    sourceUrl: DUKE_CDS_URL,
    cycleYear: CYCLE_YEAR,
    fetchedAt: NOW,
    verifiedAt: NOW,
    confidence: 1.0,
    verifiedBy: 'closure-pipeline-phase3-claude',
    generatedBy: 'phase3-duke-validation',
  };

  const provenance = {
    acceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 5.71,
      policyLabel: 'Overall admit rate',
      reason:
        'CDS 2024-25 Section C1: 2,957 admits / 51,795 applicants = 5.7090% (rounded to 5.71%). Tier upgraded from LEGACY_DB (value 5.15, sourceUrl pointed to collegekickstart.com aggregator — not Duke) to OFFICIAL. CORRECTION UP +0.56pp.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat25: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1500,
      policyLabel:
        'SAT composite 25th percentile (section sum; composite row blank)',
      reason:
        'CDS 2024-25 Section C9: SAT Composite row blank in CDS; EBRW 25th=740 + Math 25th=760 sum = 1500. Value matches prior DB; tier upgraded from LEGACY_DB to OFFICIAL. 48% of Fall 2024 enrolled (824 students) submitted SAT under test-optional policy.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat75: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1570,
      policyLabel:
        'SAT composite 75th percentile (section sum; composite row blank)',
      reason:
        'CDS 2024-25 Section C9: SAT Composite row blank in CDS; EBRW 75th=770 + Math 75th=800 sum = 1570. Value matches prior DB; tier upgraded from LEGACY_DB to OFFICIAL.',
      realDataStatus: 'VERIFIED_REAL',
    },
    intlAcceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 3.86,
      policyLabel: 'International admit rate',
      reason:
        'CDS 2024-25 Section C1 residency table: 585 international admits / 15,141 international applicants = 3.8637% (rounded to 3.86%). Value matches prior DB; tier upgraded from LEGACY_DB to OFFICIAL with refreshed provenance.',
      realDataStatus: 'VERIFIED_REAL',
    },
    oosAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'TERMINAL',
      confidence: 1.0,
      policyLabel: 'Out-of-state admit rate',
      reason:
        'Duke University is a private research university; in-state / out-of-state distinction carries no policy meaning (no in-state tuition advantage). CDS C1 residency table does report OOS (1,995 admits / 31,906 applicants = 6.2527%), but the value is not actionable for applicants. Prior legacy DB value (6.25%) cleared. Field marked UNAVAILABLE-terminal per closure-pipeline convention for private institutions.',
      realDataStatus: 'NOT_APPLICABLE',
    },
    edAcceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 17.33,
      policyLabel: 'Early Decision admit rate',
      reason:
        'CDS 2024-25 Section C21: Duke offers Early Decision ("Yes" checked) — ED closes 11/1, notification Mid December. Fall 2024 entering class: 1,042 admits / 6,013 ED applications = 17.3291% (rounded to 17.33%). Value matches prior DB; tier upgraded from LEGACY_DB to OFFICIAL with refreshed provenance.',
      realDataStatus: 'VERIFIED_REAL',
    },
    eaAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'Early Action admit rate',
      reason:
        'CDS 2024-25 Section C22: Duke University does NOT offer a nonbinding Early Action plan ("No" checked). DB value was already null; provenance refreshed to authoritative CDS_OFFICIAL pull marked UNAVAILABLE-terminal/NOT_OFFERED.',
      realDataStatus: 'NOT_OFFERED',
    },
  };

  const existingMeta = toRecord(duke.metadata);
  const serialized = serializeSchoolProvenance(provenance as any);
  const nextMetadata = {
    ...existingMeta,
    provenance: deepMergeRecords(toRecord(existingMeta.provenance), serialized),
    closureSourceIndex: DUKE_CDS_URL,
  };

  await prisma.school.update({
    where: { id: duke.id },
    data: {
      acceptanceRate: new Prisma.Decimal('5.71'),
      sat25: 1500,
      sat75: 1570,
      intlAcceptanceRate: new Prisma.Decimal('3.86'),
      oosAcceptanceRate: null,
      edAcceptanceRate: new Prisma.Decimal('17.33'),
      eaAcceptanceRate: null,
      hasEarlyDecision: true,
      lastDataReviewAt: new Date(),
      metadata: nextMetadata,
    },
    select: { id: true },
  });

  console.log(
    '  ✅ updated 7 fields (AR=5.71, sat25=1500, sat75=1570, intlAR=3.86, oosAR=N/A, edAR=17.33, eaAR=NOT_OFFERED)',
  );

  const after = await prisma.school.findUnique({
    where: { id: duke.id },
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
