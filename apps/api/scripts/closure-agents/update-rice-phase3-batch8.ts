#!/usr/bin/env tsx
/**
 * Phase 3 batch 8 — Rice University end-to-end closure of the 7
 * prediction-critical fields.
 *
 * Source: Rice University CDS 2024-2025 (Fall 2024 entering class)
 *   URL: https://ideas.rice.edu/wp-content/uploads/2025/10/CDS_2024-25_WEBSITE.pdf
 *
 * Value changes (vs. existing DB):
 *   - acceptanceRate    : 7.51  → 8.00   (CDS C1 Total: 2,597 admits / 32,473
 *                          applicants = 7.998% (rounded 8.00%). CORRECTION UP
 *                          +0.49pp from prior LEGACY_DB (sourceUrl pointed to
 *                          collegekickstart.com aggregator — not Rice). Tier
 *                          upgraded LEGACY_DB → OFFICIAL. Note: C1 Admits row
 *                          shows 1,330 men + 1,267 women = 2,597 admits;
 *                          residency table sums to 2,597 (762+1519+316).)
 *   - sat25             : 1500  → 1510   (CDS C9: SAT Composite 25th = 1510
 *                          reported directly; EBRW 740 + Math 770 sum = 1510
 *                          coincides. CORRECTION UP +10 from prior 1500
 *                          (LEGACY_DB). Tier upgraded LEGACY_DB → OFFICIAL.)
 *   - sat75             : 1560  → 1560   (CDS C9: SAT Composite 75th = 1560
 *                          reported directly; EBRW 770 + Math 800 sum = 1570
 *                          differs because composite quantiles ≠ section sums.
 *                          Value matches prior DB; tier upgraded LEGACY_DB →
 *                          OFFICIAL.)
 *   - intlAcceptanceRate: 3.75  → 3.95   (CDS C1 residency: 316 intl admits /
 *                          7,995 intl applicants = 3.9525% (rounded 3.95%).
 *                          CORRECTION UP +0.20pp from prior LEGACY_DB (3.75).
 *                          Note: existing provenance row already had value=3.95
 *                          but the live numeric field stored 3.75 — drift
 *                          corrected. Tier upgraded LEGACY_DB → OFFICIAL.)
 *   - oosAcceptanceRate : 9.92  → null   (Rice is a private research
 *                          university; in-state / out-of-state distinction
 *                          carries no policy meaning. CDS C1 residency does
 *                          report OOS (1,519/15,314 = 9.9190%) but per
 *                          closure-pipeline convention, private schools →
 *                          UNAVAILABLE/TERMINAL. Prior legacy DB value cleared.)
 *   - edAcceptanceRate  : 16.81 → 16.81  (CDS C21: Rice offers ED ("Yes"). Two
 *                          plans — ED I closes 11/1 (12/15 notification); ED II
 *                          closes 1/4 (Early Feb notification). Fall 2024
 *                          entering class combined: 519 admits / 3,087 ED
 *                          applications = 16.8124% (rounded 16.81%). Value
 *                          matches prior DB; tier upgraded LEGACY_DB → OFFICIAL.)
 *   - eaAcceptanceRate  : 1.96  → null   (CDS C22: Rice University does NOT
 *                          offer a nonbinding Early Action plan ("No" checked
 *                          for EA plan). Prior DB value (1.96% from
 *                          CDS_LLM_EXTRACT_2026_04 tier=OFFICIAL) was
 *                          incorrectly extracted — Rice does not offer EA in
 *                          CDS 2024-25. CORRECTION: value cleared, marked
 *                          UNAVAILABLE/OFFICIAL_BLANK_SECTION/NOT_OFFERED.)
 */
import { PrismaClient, Prisma } from '@prisma/client';
import {
  deepMergeRecords,
  toRecord,
} from '../../src/modules/school/school-provenance.helpers';
import { serializeSchoolProvenance } from '@study-abroad/shared/utils';

const RICE_CDS_URL =
  'https://ideas.rice.edu/wp-content/uploads/2025/10/CDS_2024-25_WEBSITE.pdf';
const CYCLE_YEAR = 2024; // CDS 2024-2025 = Fall 2024 entering class
const NOW = new Date().toISOString();

const prisma = new PrismaClient();

async function main() {
  const rice = await prisma.school.findFirst({
    where: { id: 'cmn1htko0000gvqf2pmjc1xi9', name: 'Rice University' },
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
  if (!rice) throw new Error('Rice University not found');
  console.log(`Updating ${rice.name} (${rice.id})`);
  console.log(
    `  current AR=${rice.acceptanceRate?.toString()} sat25=${rice.sat25} sat75=${rice.sat75}`,
  );
  console.log(
    `  current intlAR=${rice.intlAcceptanceRate?.toString()} oosAR=${rice.oosAcceptanceRate?.toString()}`,
  );
  console.log(
    `  current edAR=${rice.edAcceptanceRate?.toString()} eaAR=${rice.eaAcceptanceRate?.toString() ?? 'null'}`,
  );

  const baseProv = {
    sourceUrl: RICE_CDS_URL,
    cycleYear: CYCLE_YEAR,
    fetchedAt: NOW,
    verifiedAt: NOW,
    confidence: 1.0,
    verifiedBy: 'closure-pipeline-phase3-claude',
    generatedBy: 'phase3-rice-validation',
  };

  const provenance = {
    acceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 8.0,
      policyLabel: 'Overall admit rate',
      reason:
        'CDS 2024-25 Section C1: 2,597 admits / 32,473 applicants = 7.998% (rounded to 8.00%). C1 Admits row 1,330 men + 1,267 women = 2,597; residency table sums to 2,597 (762 in-state + 1,519 OOS + 316 intl). Tier upgraded from LEGACY_DB (value 7.51, sourceUrl pointed to collegekickstart.com aggregator — not Rice) to OFFICIAL. CORRECTION UP +0.49pp.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat25: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1510,
      policyLabel: 'SAT composite 25th percentile (reported composite row)',
      reason:
        'CDS 2024-25 Section C9: SAT Composite 25th = 1510 (reported directly; EBRW 740 + Math 770 sum = 1510 coincides). CORRECTION UP +10 from prior 1500 (LEGACY_DB). Tier upgraded from LEGACY_DB to OFFICIAL. 48% of Fall 2024 enrolled (546 students) submitted SAT.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat75: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1560,
      policyLabel: 'SAT composite 75th percentile (reported composite row)',
      reason:
        'CDS 2024-25 Section C9: SAT Composite 75th = 1560 (reported directly; EBRW 770 + Math 800 sum = 1570 differs because composite quantiles ≠ section sums). Value matches prior DB; tier upgraded from LEGACY_DB to OFFICIAL with refreshed provenance.',
      realDataStatus: 'VERIFIED_REAL',
    },
    intlAcceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 3.95,
      policyLabel: 'International admit rate',
      reason:
        'CDS 2024-25 Section C1 residency table: 316 international admits / 7,995 international applicants = 3.9525% (rounded to 3.95%). CORRECTION UP +0.20pp from prior LEGACY_DB live value (3.75). Note: existing provenance row already showed value=3.95 but the live numeric field stored 3.75 — drift corrected. Tier upgraded from LEGACY_DB to OFFICIAL.',
      realDataStatus: 'VERIFIED_REAL',
    },
    oosAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'TERMINAL',
      confidence: 1.0,
      policyLabel: 'Out-of-state admit rate',
      reason:
        'Rice University is a private research university; in-state / out-of-state distinction carries no policy meaning (no in-state tuition advantage). CDS C1 residency table does report OOS (1,519 admits / 15,314 applicants = 9.9190%), but the value is not actionable for applicants. Prior legacy DB value (9.92%) cleared. Field marked UNAVAILABLE-terminal per closure-pipeline convention for private institutions.',
      realDataStatus: 'NOT_APPLICABLE',
    },
    edAcceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 16.81,
      policyLabel: 'Early Decision admit rate (ED I + ED II combined)',
      reason:
        'CDS 2024-25 Section C21: Rice offers Early Decision ("Yes" checked) — two plans: ED I closes 11/1 (12/15 notification); ED II closes 1/4 (Early Feb notification). Fall 2024 entering class combined: 519 admits / 3,087 ED applications = 16.8124% (rounded to 16.81%). Value matches prior DB; tier upgraded from LEGACY_DB to OFFICIAL with refreshed provenance.',
      realDataStatus: 'VERIFIED_REAL',
    },
    eaAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'Early Action admit rate',
      reason:
        'CDS 2024-25 Section C22: Rice University does NOT offer a nonbinding Early Action plan ("No" checked for EA plan). Prior DB value (1.96% from CDS_LLM_EXTRACT_2026_04 tier=OFFICIAL) was incorrectly extracted — Rice does not offer EA in CDS 2024-25. CORRECTION: value cleared, provenance refreshed to authoritative CDS_OFFICIAL pull marked UNAVAILABLE-terminal/NOT_OFFERED.',
      realDataStatus: 'NOT_OFFERED',
    },
  };

  const existingMeta = toRecord(rice.metadata);
  const serialized = serializeSchoolProvenance(provenance as any);
  const nextMetadata = {
    ...existingMeta,
    provenance: deepMergeRecords(toRecord(existingMeta.provenance), serialized),
    closureSourceIndex: RICE_CDS_URL,
  };

  await prisma.school.update({
    where: { id: rice.id },
    data: {
      acceptanceRate: new Prisma.Decimal('8.00'),
      sat25: 1510,
      sat75: 1560,
      intlAcceptanceRate: new Prisma.Decimal('3.95'),
      oosAcceptanceRate: null,
      edAcceptanceRate: new Prisma.Decimal('16.81'),
      eaAcceptanceRate: null,
      hasEarlyDecision: true,
      lastDataReviewAt: new Date(),
      metadata: nextMetadata,
    },
    select: { id: true },
  });

  console.log(
    '  ✅ updated 7 fields (AR=8.00, sat25=1510, sat75=1560, intlAR=3.95, oosAR=N/A, edAR=16.81, eaAR=NOT_OFFERED)',
  );

  const after = await prisma.school.findUnique({
    where: { id: rice.id },
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
