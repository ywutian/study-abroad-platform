#!/usr/bin/env tsx
/**
 * Phase 3 — University of Rochester end-to-end closure of the 7 prediction-
 * critical fields.
 *
 * Source: University of Rochester CDS 2024-2025 (Fall 2024 entering class)
 *   URL: https://www.rochester.edu/provost/wp-content/uploads/2025/06/CDS_2024-2025-completed-for-web.pdf
 *
 * NOTE: Rochester CDS reports two separate undergraduate divisions:
 *   - AS&E (Arts, Sciences & Engineering) — the primary undergraduate college
 *     reported on CDS pages 13/18.
 *   - Eastman School of Music — small specialized conservatory reported
 *     separately on CDS page 21 (1,077 apps / 420 admits).
 *   Per industry convention (US News, Common App, etc.), "University of
 *   Rochester" undergraduate admit metrics refer to AS&E. This closure
 *   adopts the AS&E figures. Eastman is a domain-specific audition-based
 *   admission and is not aggregated.
 *
 * PRIVATE school (A2: Private nonprofit) — oosAcceptanceRate is OUT OF SCOPE
 *   per closure-pipeline convention; cleared to UNAVAILABLE/TERMINAL even
 *   though CDS C1 residency does publish OOS counts (8,267 apps / 4,868
 *   admits = 58.88%). In-state vs. out-of-state has no policy meaning at a
 *   private institution.
 *
 * Test policy: C8A — SAT/ACT "Not required for admission, but considered if
 *   submitted" (test-optional). SAT Composite quantiles in C9 recorded as
 *   OFFICIAL for descriptive applicant-profile use.
 *
 * Value changes (vs. existing DB):
 *   - acceptanceRate    : 40.08    ->  40.13   (CDS C1 AS&E Total: 8,150 admits
 *                          / 20,307 applicants = 40.1339%. Minor precision
 *                          upgrade, tier LEGACY_DB->OFFICIAL.)
 *   - sat25             : 1370     ->  1420    (CDS C9 AS&E SAT Composite 25th
 *                          = 1420 reported directly. CORRECTION UP +50 from
 *                          prior 1370. Tier LEGACY_DB->OFFICIAL.)
 *   - sat75             : 1500     ->  1500    (CDS C9 AS&E SAT Composite 75th
 *                          = 1500 reported directly. Value matches; tier
 *                          LEGACY_DB->OFFICIAL.)
 *   - intlAcceptanceRate: 18.61    ->  18.00   (CDS C1 AS&E residency: 1,360
 *                          intl admits / 7,555 intl applicants = 18.0014%.
 *                          Minor downward correction. Tier LEGACY_DB->OFFICIAL.)
 *   - oosAcceptanceRate : 57.20    ->  null    (Private school — oosAR cleared
 *                          per closure-pipeline convention; UNAVAILABLE/
 *                          TERMINAL. CDS does publish OOS 4,868/8,267=58.88%
 *                          but value is not policy-actionable for private
 *                          institution applicants.)
 *   - edAcceptanceRate  : 38.05    ->  38.05   (CDS C21 AS&E: 527 ED admits /
 *                          1,385 ED applications = 38.0505%. Value matches
 *                          prior DB; tier LEGACY_DB->OFFICIAL. Rochester
 *                          offers ED I (closing 11/1, notification Mid-
 *                          December) + ED II (closing 1/5, notification 2/7);
 *                          CDS reports combined ED total.)
 *   - eaAcceptanceRate  : null     ->  null    (CDS C22 "No" — Rochester does
 *                          NOT offer Early Action. Field stays cleared.
 *                          Provenance refreshed to authoritative CDS pull
 *                          marked UNAVAILABLE/OFFICIAL_BLANK_SECTION/
 *                          NOT_OFFERED.)
 */
import { PrismaClient, Prisma } from '@prisma/client';
import {
  deepMergeRecords,
  toRecord,
} from '../../src/modules/school/school-provenance.helpers';
import { serializeSchoolProvenance } from '@study-abroad/shared/utils';

const CDS_URL =
  'https://www.rochester.edu/provost/wp-content/uploads/2025/06/CDS_2024-2025-completed-for-web.pdf';
const CYCLE_YEAR = 2024; // CDS 2024-2025 = Fall 2024 entering class
const NOW = new Date().toISOString();
const SCHOOL_ID = 'cmnwr8ilt0000z0ticnudxg0y';

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
    throw new Error(`School ${SCHOOL_ID} (University of Rochester) not found`);
  console.log(`Updating ${school.name} (${school.id})`);
  console.log(`  isPrivate=${school.isPrivate}  [PRIVATE]`);
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
    generatedBy: 'phase3-rochester-validation',
  };

  const provenance = {
    acceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 40.13,
      policyLabel: 'Overall admit rate (AS&E undergraduate college)',
      reason:
        'CDS 2024-25 Section C1 (AS&E only — Arts, Sciences & Engineering, the primary undergraduate college): 8,150 admits / 20,307 applicants = 40.1339% (rounded to 40.13%). Eastman School of Music is reported separately (1,077/420=39.0%) as a specialized audition-based conservatory and is not aggregated per industry convention. Tier upgraded from LEGACY_DB (value 40.08) to OFFICIAL with minor precision adjustment.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat25: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1420,
      policyLabel:
        'SAT composite 25th percentile (AS&E reported composite row)',
      reason:
        'CDS 2024-25 Section C9 (AS&E only): SAT Composite 25th = 1420 (reported directly). CORRECTION UP from prior 1370 (LEGACY_DB). NOTE: Rochester is test-optional (C8F "The University of Rochester has a test-optional application policy"); 19% of Fall 2024 AS&E enrolled (252 students) submitted SAT.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat75: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1500,
      policyLabel:
        'SAT composite 75th percentile (AS&E reported composite row)',
      reason:
        'CDS 2024-25 Section C9 (AS&E only): SAT Composite 75th = 1500 (reported directly). Value matches prior DB (1500); tier upgraded LEGACY_DB -> OFFICIAL.',
      realDataStatus: 'VERIFIED_REAL',
    },
    intlAcceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 18.0,
      policyLabel: 'International admit rate (AS&E)',
      reason:
        'CDS 2024-25 Section C1 residency table (AS&E only): 1,360 international admits / 7,555 international applicants = 18.0014% (rounded to 18.00%). Minor downward correction from prior 18.61 (LEGACY_DB). Tier upgraded LEGACY_DB -> OFFICIAL.',
      realDataStatus: 'VERIFIED_REAL',
    },
    oosAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'TERMINAL',
      confidence: 1.0,
      policyLabel: 'Out-of-state admit rate',
      reason:
        'University of Rochester is a private institution (A2: Private nonprofit); in-state / out-of-state distinction carries no policy meaning (no in-state tuition advantage). CDS C1 residency does report OOS (4,868 admits / 8,267 applicants = 58.88%), but the value is not actionable for applicants. Prior legacy DB value (57.20%) cleared. Field marked UNAVAILABLE-terminal per closure-pipeline convention for private institutions.',
      realDataStatus: 'NOT_APPLICABLE',
    },
    edAcceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 38.05,
      policyLabel: 'Early Decision admit rate (ED I + ED II combined, AS&E)',
      reason:
        'CDS 2024-25 Section C21 (AS&E only): Rochester offers Early Decision ("Yes" checked) with two plans — ED I closes 11/1 (Mid-December notification), ED II closes 1/5 (2/7 notification). Fall 2024 entering class combined totals: 527 admits / 1,385 ED applications = 38.0505% (rounded to 38.05%). Value matches prior DB; tier upgraded LEGACY_DB -> OFFICIAL with refreshed provenance.',
      realDataStatus: 'VERIFIED_REAL',
    },
    eaAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'Early Action admit rate',
      reason:
        'CDS 2024-25 Section C22: "Do you have a nonbinding early action plan?" — NO checked. University of Rochester does NOT offer Early Action. Field stays cleared. Provenance refreshed to authoritative CDS pull marked UNAVAILABLE/OFFICIAL_BLANK_SECTION/NOT_OFFERED.',
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
      acceptanceRate: new Prisma.Decimal('40.13'),
      sat25: 1420,
      sat75: 1500,
      intlAcceptanceRate: new Prisma.Decimal('18.00'),
      oosAcceptanceRate: null,
      edAcceptanceRate: new Prisma.Decimal('38.05'),
      eaAcceptanceRate: null,
      hasEarlyDecision: true, // re-confirm from CDS C21 "Yes"
      lastDataReviewAt: new Date(),
      metadata: nextMetadata,
    },
    select: { id: true },
  });

  console.log(
    '  ✅ updated 7 fields (AR=40.13, sat25=1420, sat75=1500, intlAR=18.00, oosAR=N/A, edAR=38.05, eaAR=NOT_OFFERED)',
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
