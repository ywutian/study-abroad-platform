#!/usr/bin/env tsx
/**
 * Phase 3 — Illinois Institute of Technology (Illinois Tech / IIT) end-to-end
 * closure of the 7 prediction-critical fields.
 *
 * Source: IIT CDS 2023-2024 (Fall 2023 entering class) — most recent published
 *   URL: https://www.iit.edu/sites/default/files/2024-07/Full-2023-2024-Common-Data-Set.pdf
 *   Index: https://www.iit.edu/about/institutional-research (IIT has not yet
 *     published CDS 2024-2025 as of this writing.)
 *
 * NOTE: IIT is a PRIVATE university (isPrivate=true).
 *   - Per closure-pipeline convention, private schools: oosAR is marked
 *     UNAVAILABLE/TERMINAL even when CDS reports the residency breakdown
 *     (in-state / out-of-state distinction carries no policy meaning for
 *     private institutions).
 *   - intlAcceptanceRate IS in scope and recorded from CDS C1 residency
 *     breakdown.
 *   - IIT offers BOTH Early Decision (C21 "Yes") and Early Action (C22 "Yes").
 *     ED Fall 2023 numbers ARE published (69 / 47); EA cells on the C22 form
 *     are blank for applicants/admits (only dates published).
 *
 * Value changes (vs. existing DB):
 *   - acceptanceRate    : 60.75   -> 55.42  (CDS 2023-24 C1: 4,939 admits /
 *                          8,912 applicants = 55.4197%. CORRECTION DOWN
 *                          from prior LEGACY_DB 60.75 to OFFICIAL 55.42.)
 *   - sat25             : 1220    -> 1190   (CDS 2023-24 C9: SAT Composite
 *                          25th = 1190 reported directly. CORRECTION DOWN
 *                          from prior 1220 (LEGACY_DB). Tier upgraded
 *                          LEGACY_DB -> OFFICIAL.)
 *   - sat75             : 1410    -> 1400   (CDS 2023-24 C9: SAT Composite
 *                          75th = 1400 reported directly. CORRECTION DOWN
 *                          from prior 1410 (LEGACY_DB). Tier upgraded
 *                          LEGACY_DB -> OFFICIAL.)
 *   - intlAcceptanceRate: 46.56   -> 43.58  (CDS 2023-24 C1 residency: 1,188
 *                          intl admits / 2,726 intl applicants = 43.5803%.
 *                          CORRECTION DOWN from prior 46.56% LEGACY_DB.)
 *   - oosAcceptanceRate : 43.58   -> null   (IIT is a private university;
 *                          in-state vs. out-of-state distinction carries no
 *                          policy meaning. CDS C1 residency DOES report OOS
 *                          (1,430 admits / 2,321 apps = 61.61%), but per
 *                          private-school convention -> UNAVAILABLE/TERMINAL.
 *                          NOTE: prior DB value 43.58 actually corresponded
 *                          to the INTERNATIONAL rate, not OOS — DB had the
 *                          two confused. Field cleared.)
 *   - edAcceptanceRate  : 68.12   -> 68.12  (CDS 2023-24 C21: "Yes" — IIT
 *                          offers ED (ED I closing 11/1, notification 12/1;
 *                          ED II closing 1/1, notification 2/1). Fall 2023:
 *                          47 admits / 69 ED applications = 68.1159%
 *                          (rounded 68.12%). Value matches prior DB; tier
 *                          upgraded LEGACY_DB -> OFFICIAL.)
 *   - eaAcceptanceRate  : 70      -> null   (CDS 2023-24 C22: "Yes" — IIT
 *                          offers EA (closing 11/15, notification 1/3,
 *                          non-restrictive). However the CDS C22 form does
 *                          NOT include EA applicants/admits cells, and IIT
 *                          did not publish round-level numbers in CDS.
 *                          Prior DB value 70 came from TAVILY_ENRICHMENT —
 *                          retired as not CDS-sourceable. Field cleared,
 *                          marked UNAVAILABLE/OFFICIAL_BLANK_SECTION/
 *                          OFFERED_NOT_PUBLISHED.)
 *
 * NOTE on hasEarlyDecision: current DB true matches CDS C21 "Yes" — retained.
 */
import { PrismaClient, Prisma } from '@prisma/client';
import {
  deepMergeRecords,
  toRecord,
} from '../../src/modules/school/school-provenance.helpers';
import { serializeSchoolProvenance } from '@study-abroad/shared/utils';

const CDS_URL =
  'https://www.iit.edu/sites/default/files/2024-07/Full-2023-2024-Common-Data-Set.pdf';
const CYCLE_YEAR = 2023; // CDS 2023-2024 = Fall 2023 entering class
const NOW = new Date().toISOString();
const SCHOOL_ID = 'cmnwr8inb000sz0ti3r4uwfjt';

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
  if (!school) throw new Error(`School ${SCHOOL_ID} (Illinois Tech) not found`);
  console.log(`Updating ${school.name} (${school.id})`);
  console.log(`  isPrivate=${school.isPrivate}  [PRIVATE university]`);
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
    generatedBy: 'phase3-iit-validation',
  };

  const provenance = {
    acceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 55.42,
      policyLabel: 'Overall admit rate',
      reason:
        'CDS 2023-24 Section C1: 4,939 admits / 8,912 applicants = 55.4197% (rounded to 55.42%). CORRECTION DOWN from prior LEGACY_DB value 60.75 to OFFICIAL 55.42.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat25: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1190,
      policyLabel: 'SAT composite 25th percentile (reported composite row)',
      reason:
        'CDS 2023-24 Section C9: SAT Composite 25th = 1190 (reported directly). CORRECTION DOWN from prior 1220 (LEGACY_DB). 45% of Fall 2023 enrolled (239 students) submitted SAT under test-optional policy.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat75: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1400,
      policyLabel: 'SAT composite 75th percentile (reported composite row)',
      reason:
        'CDS 2023-24 Section C9: SAT Composite 75th = 1400 (reported directly). CORRECTION DOWN from prior 1410 (LEGACY_DB). Tier upgraded LEGACY_DB -> OFFICIAL.',
      realDataStatus: 'VERIFIED_REAL',
    },
    intlAcceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 43.58,
      policyLabel: 'International admit rate',
      reason:
        'CDS 2023-24 Section C1 residency table: 1,188 international admits / 2,726 international applicants = 43.5803% (rounded to 43.58%). CORRECTION DOWN from prior LEGACY_DB value 46.56% to OFFICIAL 43.58%.',
      realDataStatus: 'VERIFIED_REAL',
    },
    oosAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'TERMINAL',
      confidence: 1.0,
      policyLabel: 'Out-of-state admit rate',
      reason:
        'Illinois Tech is a private university; in-state / out-of-state distinction carries no policy meaning (no in-state tuition advantage). CDS C1 residency table does report OOS (1,430 admits / 2,321 applicants = 61.61%), but the value is not actionable for applicants. Prior legacy DB value (43.58) was actually the INTERNATIONAL rate, mistakenly stored as OOS — corrected by clearing this field. Marked UNAVAILABLE-terminal per closure-pipeline convention for private institutions.',
      realDataStatus: 'NOT_APPLICABLE',
    },
    edAcceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 68.12,
      policyLabel: 'Early Decision admit rate (ED I + ED II combined)',
      reason:
        'CDS 2023-24 Section C21: "Yes" — Illinois Tech offers Early Decision (ED I closing 11/1, notification 12/1; ED II closing 1/1, notification 2/1). Fall 2023: 47 admits / 69 ED applications = 68.1159% (rounded to 68.12%). Value matches prior DB; tier upgraded LEGACY_DB -> OFFICIAL.',
      realDataStatus: 'VERIFIED_REAL',
    },
    eaAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'Early Action admit rate',
      reason:
        'CDS 2023-24 Section C22: "Yes" — Illinois Tech offers a nonbinding Early Action plan (closing 11/15, notification 1/3, non-restrictive). However the CDS C22 form template does NOT include EA applicants/admits cells, and IIT did not publish round-level numbers in the CDS. Prior DB value 70 came from TAVILY_ENRICHMENT (not authoritative CDS) — retired. Field cleared, marked UNAVAILABLE/OFFICIAL_BLANK_SECTION/OFFERED_NOT_PUBLISHED.',
      realDataStatus: 'OFFERED_NOT_PUBLISHED',
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
      acceptanceRate: new Prisma.Decimal('55.42'),
      sat25: 1190,
      sat75: 1400,
      intlAcceptanceRate: new Prisma.Decimal('43.58'),
      oosAcceptanceRate: null,
      edAcceptanceRate: new Prisma.Decimal('68.12'),
      eaAcceptanceRate: null,
      hasEarlyDecision: true, // CDS C21 "Yes"
      lastDataReviewAt: new Date(),
      metadata: nextMetadata,
    },
    select: { id: true },
  });

  console.log(
    '  ✅ updated 7 fields (AR=55.42, sat25=1190, sat75=1400, intlAR=43.58, oosAR=N/A, edAR=68.12, eaAR=BLANK, hasED=true)',
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
