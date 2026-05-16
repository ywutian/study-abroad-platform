#!/usr/bin/env tsx
/**
 * Phase 3 batch 9 — Washington University in St. Louis (WashU) end-to-end
 * closure of the 7 prediction-critical fields.
 *
 * Source: WashU Common Data Set 2024-2025 (Fall 2024 entering class),
 *   published by WashU Office of Institutional Research.
 *   PDF: https://washu.edu/app/uploads/2025/06/2024-2025-WashU-CDS.pdf
 *
 * KEY WashU POLICIES (drive the closure decisions):
 *   - WashU is a **private (nonprofit)** research university (CDS A2 "Private").
 *     In-state / out-of-state distinction carries NO policy meaning (no
 *     in-state tuition advantage), so per closure-pipeline convention
 *     private schools → oosAcceptanceRate marked UNAVAILABLE/TERMINAL even
 *     though the CDS C1 residency table DOES report OOS (3,064 admits /
 *     23,334 applicants = 13.13%).
 *   - WashU is **test-optional** (CDS C8A: SAT/ACT "Not required for
 *     admission, but considered if submitted"). 29% of enrolled submitted
 *     SAT; CDS C9 SAT Composite percentiles ARE reported.
 *   - WashU offers Early Decision with TWO plans:
 *     ED I closes 11/3 (notify 12/12) + ED II closes 1/2 (notify 2/13).
 *     CDS C21 reports combined Fall 2024: 4,817 ED apps / 1,217 ED admits.
 *   - WashU does NOT offer Early Action (CDS C22 "No").
 *
 * Value changes (vs. existing DB):
 *   - acceptanceRate    : 12.06  -> 12.06  (CDS C1 Total: 3,951 admits
 *                          (M 1,920 + W 2,030 + Another 1) / 32,754
 *                          applicants (M 15,330 + W 17,411 + Another 13) =
 *                          12.0626% (rounds to 12.06%). Value matches prior
 *                          DB; tier upgraded LEGACY_DB -> OFFICIAL with
 *                          authoritative CDS sourceUrl.)
 *   - sat25             : 1490   -> 1500   (CDS C9 SAT Composite 25th =
 *                          1500 reported directly; EBRW 730 + Math 770 sum
 *                          = 1500 also coincides. CORRECTION UP +10 from
 *                          prior LEGACY_DB heuristic 1490. 29% of enrolled
 *                          submitted SAT.)
 *   - sat75             : 1560   -> 1570   (CDS C9 SAT Composite 75th =
 *                          1570 reported directly; EBRW 770 + Math 800
 *                          sum = 1570 also coincides. CORRECTION UP +10
 *                          from prior LEGACY_DB heuristic 1560.)
 *   - intlAcceptanceRate: 6.8    -> 6.80   (CDS C1 residency: 501 intl
 *                          admits / 7,369 intl applicants = 6.7988%
 *                          (rounds to 6.80%). Value matches prior DB;
 *                          tier upgraded LEGACY_DB -> OFFICIAL.)
 *   - oosAcceptanceRate : 13.13  -> null   (WashU is a private research
 *                          university; in-state / out-of-state distinction
 *                          carries no policy meaning. CDS C1 residency
 *                          table does report OOS (3,064 admits / 23,334
 *                          applicants = 13.1310%), but the value is not
 *                          actionable for applicants. Prior LEGACY_DB
 *                          value (13.13%) cleared. Field marked
 *                          UNAVAILABLE-TERMINAL per closure-pipeline
 *                          convention for private institutions.)
 *   - edAcceptanceRate  : 25.26  -> 25.26  (CDS C21: Early Decision
 *                          offered with two plans — ED I closes 11/3
 *                          (notify 12/12), ED II closes 1/2 (notify 2/13).
 *                          For Fall 2024 entering class: 4,817 ED
 *                          applications / 1,217 ED admits = 25.2648%
 *                          (rounds to 25.26%). Value matches prior DB;
 *                          tier upgraded LEGACY_DB -> OFFICIAL.)
 *   - eaAcceptanceRate  : null   -> null   (CDS C22: WashU does NOT offer
 *                          a nonbinding Early Action plan ("No" checked).
 *                          Field stays cleared. Existing provenance
 *                          tier=UNAVAILABLE source=OFFICIAL_BLANK_SECTION
 *                          preserved and refreshed.)
 */
import { PrismaClient, Prisma } from '@prisma/client';
import {
  deepMergeRecords,
  toRecord,
} from '../../src/modules/school/school-provenance.helpers';
import { serializeSchoolProvenance } from '@study-abroad/shared/utils';

const CDS_URL = 'https://washu.edu/app/uploads/2025/06/2024-2025-WashU-CDS.pdf';
const CYCLE_YEAR = 2024; // CDS 2024-2025 = Fall 2024 entering class
const NOW = new Date().toISOString();
const SCHOOL_ID = 'cmn1htkoo000qvqf2jgkrffw1';

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
  if (!school) throw new Error(`School ${SCHOOL_ID} (WashU) not found`);
  console.log(`Updating ${school.name} (${school.id})`);
  console.log(
    `  isPrivate=${school.isPrivate}  [PRIVATE — oosAR UNAVAILABLE/TERMINAL]`,
  );
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
    generatedBy: 'phase3-batch9-washu-validation',
  };

  const provenance = {
    acceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 12.06,
      policyLabel: 'Overall admit rate',
      reason:
        'WashU CDS 2024-25 Section C1 Total: 3,951 admits (Men 1,920 + Women 2,030 + Another 1) / 32,754 applicants (Men 15,330 + Women 17,411 + Another 13) = 12.0626% (rounds to 12.06%). Value matches prior LEGACY_DB; tier upgraded LEGACY_DB -> OFFICIAL with authoritative WashU OIR CDS sourceUrl.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat25: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1500,
      policyLabel: 'SAT composite 25th percentile (reported composite row)',
      reason:
        'WashU CDS 2024-25 Section C9: SAT Composite 25th = 1500 (reported directly; EBRW 730 + Math 770 sum = 1500 also coincides). CORRECTION UP +10 from prior LEGACY_DB heuristic 1490. 29% of Fall 2024 enrolled (538 students) submitted SAT under test-optional policy.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat75: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1570,
      policyLabel: 'SAT composite 75th percentile (reported composite row)',
      reason:
        'WashU CDS 2024-25 Section C9: SAT Composite 75th = 1570 (reported directly; EBRW 770 + Math 800 sum = 1570 also coincides). CORRECTION UP +10 from prior LEGACY_DB heuristic 1560.',
      realDataStatus: 'VERIFIED_REAL',
    },
    intlAcceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 6.8,
      policyLabel: 'International admit rate',
      reason:
        'WashU CDS 2024-25 Section C1 residency table: 501 international admits / 7,369 international applicants = 6.7988% (rounds to 6.80%). Value matches prior LEGACY_DB; tier upgraded LEGACY_DB -> OFFICIAL.',
      realDataStatus: 'VERIFIED_REAL',
    },
    oosAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'TERMINAL',
      confidence: 1.0,
      policyLabel: 'Out-of-state admit rate',
      reason:
        'Washington University in St. Louis is a private (nonprofit) research university (CDS A2 "Private"); in-state / out-of-state distinction carries no policy meaning (no in-state tuition advantage). CDS C1 residency table does report OOS (3,064 admits / 23,334 applicants = 13.1310%), but the value is not actionable for applicants. Prior LEGACY_DB value (13.13%) cleared. Field marked UNAVAILABLE-TERMINAL per closure-pipeline convention for private institutions.',
      realDataStatus: 'NOT_APPLICABLE',
    },
    edAcceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 25.26,
      policyLabel: 'Early Decision admit rate (ED I + ED II combined)',
      reason:
        'WashU CDS 2024-25 Section C21: Early Decision offered ("Yes" checked) with two plans — ED I closes 11/3 (notify 12/12), ED II closes 1/2 (notify 2/13). For the Fall 2024 entering class CDS reports combined: 4,817 ED applications received / 1,217 ED admits = 25.2648% (rounds to 25.26%). Value matches prior LEGACY_DB; tier upgraded LEGACY_DB -> OFFICIAL.',
      realDataStatus: 'VERIFIED_REAL',
    },
    eaAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'Early Action admit rate',
      reason:
        'WashU CDS 2024-25 Section C22: "Do you have a nonbinding early action plan?" — NO. WashU offers only Early Decision (binding), not Early Action. Field stays cleared (UNAVAILABLE/OFFICIAL_BLANK_SECTION). Provenance refreshed to 2024-25 cycle and pointed at authoritative WashU OIR CDS.',
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
      acceptanceRate: new Prisma.Decimal('12.06'),
      sat25: 1500,
      sat75: 1570,
      intlAcceptanceRate: new Prisma.Decimal('6.8'),
      oosAcceptanceRate: null,
      edAcceptanceRate: new Prisma.Decimal('25.26'),
      eaAcceptanceRate: null,
      hasEarlyDecision: true,
      lastDataReviewAt: new Date(),
      metadata: nextMetadata,
    },
    select: { id: true },
  });

  console.log(
    '  ✅ updated 7 fields (AR=12.06, sat25=1500, sat75=1570, intlAR=6.8, oosAR=N/A[private], edAR=25.26, eaAR=NOT_OFFERED, hasED=true)',
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
