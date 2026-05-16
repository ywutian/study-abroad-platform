#!/usr/bin/env tsx
/**
 * Phase 3 — IUPUI (Indiana University-Purdue University Indianapolis)
 *   closure of the 7 prediction-critical fields.
 *
 * INSTITUTIONAL STATUS:
 *   IUPUI was officially DISSOLVED on July 1, 2024. The Fall 2024
 *   entering class went to:
 *     - IU Indianapolis (standalone IU campus) — most academic programs
 *     - Purdue University in Indianapolis — Purdue School of Engineering
 *       & Technology and Computer Science within School of Science
 *   Sources:
 *     - https://indianapolis.iu.edu/about/iupui-transition/
 *     - https://www.purdue.edu/newsroom/2023/Q2/indiana-university-and-purdue-university-sign-historic-agreement/
 *
 *   As a consequence, there is NO CDS 2024-2025 published under the
 *   "IUPUI" name. The Fall 2024 admissions data for the legacy
 *   "Indiana University-Purdue University Indianapolis" record cannot
 *   be sourced from an institution that no longer exists. The
 *   downstream institutions (IU Indianapolis, Purdue Indianapolis)
 *   do not appear to publish a public standalone CDS 2024-25 PDF
 *   under their own names yet (IU systemwide CDS is interactive,
 *   not a downloadable per-campus PDF, at iuia.iu.edu/apps/cds).
 *
 * NOTE on prior DB provenance — every URL was wrong:
 *   - sat25=1050 / sat75=1230 — provenance pointed at clastify.com
 *     (third-party scrape; NOT a CDS source).
 *   - edAR / eaAR — provenance URL pointed at
 *     owl.purdue.edu/writinglab/about/documents/annual-report-2025-2034/2025-annual-report.pdf
 *     which is the PURDUE WRITING LAB ANNUAL REPORT, not any CDS.
 *     This is a clear provenance fabrication.
 *   - intlAR / oosAR — already tagged PERMANENT_HEURISTIC (no source).
 *   - acceptanceRate=81 tier=VERIFIED_REAL src=LEGACY_DB_VALUE (no URL).
 *
 * RECOMMENDED TREATMENT: We do NOT fabricate or guess values. All 7
 *   fields are set to UNAVAILABLE / INSTITUTION_DISSOLVED with
 *   provenance pointing at the official IU Indianapolis transition
 *   announcement. Existing numeric values are nulled to prevent the
 *   prediction engine from training on legacy IUPUI numbers as if
 *   they applied to the Fall 2024 cycle.
 *
 *   If this legacy school record needs to remain in the catalog for
 *   historical user school-lists, downstream consumers should now
 *   see UNAVAILABLE provenance and route users to IU Indianapolis
 *   or Purdue Indianapolis instead. A follow-up task should mark
 *   this school record as ARCHIVED / SUPERSEDED in dataReviewStatus.
 */
import { PrismaClient } from '@prisma/client';
import {
  deepMergeRecords,
  toRecord,
} from '../../src/modules/school/school-provenance.helpers';
import { serializeSchoolProvenance } from '@study-abroad/shared/utils';

const TRANSITION_URL = 'https://indianapolis.iu.edu/about/iupui-transition/';
const CYCLE_YEAR = 2024;
const NOW = new Date().toISOString();
const SCHOOL_ID = 'cmnwr8itm003nz0tiqazikwxi';

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
  if (!school) throw new Error(`School ${SCHOOL_ID} (IUPUI) not found`);
  console.log(`Updating ${school.name} (${school.id})`);
  console.log(
    `  isPrivate=${school.isPrivate}  [PUBLIC IN — DISSOLVED 2024-07-01]`,
  );
  console.log(
    `  current AR=${school.acceptanceRate?.toString()} sat25=${school.sat25} sat75=${school.sat75}`,
  );
  console.log(
    `  current intlAR=${school.intlAcceptanceRate?.toString() ?? 'null'} oosAR=${school.oosAcceptanceRate?.toString() ?? 'null'} edAR=${school.edAcceptanceRate?.toString() ?? 'null'} eaAR=${school.eaAcceptanceRate?.toString() ?? 'null'}`,
  );

  const baseProv = {
    sourceUrl: TRANSITION_URL,
    cycleYear: CYCLE_YEAR,
    fetchedAt: NOW,
    verifiedAt: NOW,
    confidence: 1.0,
    verifiedBy: 'closure-pipeline-phase3-batch28-claude',
    generatedBy: 'phase3-iupui-validation',
  };

  const dissolvedReasonCommon =
    'IUPUI was officially dissolved on July 1, 2024 (Fall 2024 cycle). Academic programs split between IU Indianapolis (standalone IU campus) and Purdue University in Indianapolis. No CDS 2024-2025 is published under the "IUPUI" name, and the successor institutions do not currently publish a downloadable per-campus CDS PDF. Cannot fabricate or guess Fall 2024 admit-side numbers for an institution that did not exist as IUPUI for Fall 2024. Provenance re-anchored to official IU Indianapolis transition announcement.';

  const provenance = {
    acceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      value: null,
      policyLabel: 'Overall admit rate',
      reason: `${dissolvedReasonCommon} Prior DB value 81 (LEGACY_DB_VALUE, no source URL) is a pre-split historical figure that cannot be re-anchored to Fall 2024.`,
      realDataStatus: 'UNAVAILABLE',
    },
    sat25: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      value: null,
      policyLabel: 'SAT composite 25th percentile',
      reason: `${dissolvedReasonCommon} Prior DB value 1050 had provenance URL pointing at clastify.com (third-party scrape, NOT a CDS). Value nulled until an authoritative IU Indianapolis or Purdue Indianapolis CDS PDF becomes available.`,
      realDataStatus: 'UNAVAILABLE',
    },
    sat75: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      value: null,
      policyLabel: 'SAT composite 75th percentile',
      reason: `${dissolvedReasonCommon} Prior DB value 1230 had provenance URL pointing at clastify.com (third-party scrape, NOT a CDS). Value nulled.`,
      realDataStatus: 'UNAVAILABLE',
    },
    intlAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      value: null,
      policyLabel: 'International admit rate',
      reason: `${dissolvedReasonCommon} Prior DB value 76.95 was tagged PERMANENT_HEURISTIC (no source). Value nulled.`,
      realDataStatus: 'UNAVAILABLE',
    },
    oosAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      value: null,
      policyLabel: 'Out-of-state admit rate',
      reason: `${dissolvedReasonCommon} Prior DB value 82.62 was tagged PERMANENT_HEURISTIC (no source). Value nulled.`,
      realDataStatus: 'UNAVAILABLE',
    },
    edAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      value: null,
      policyLabel: 'Early Decision admit rate',
      reason: `${dissolvedReasonCommon} Prior DB provenance URL pointed at owl.purdue.edu/writinglab/about/documents/annual-report-2025-2034/2025-annual-report.pdf — that is the PURDUE WRITING LAB ANNUAL REPORT, NOT any CDS or admissions document. Clear provenance fabrication. Both IU Indianapolis and Purdue Indianapolis use rolling/priority admissions, not binding ED. Setting to NOT_OFFERED.`,
      realDataStatus: 'NOT_OFFERED',
    },
    eaAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      value: null,
      policyLabel: 'Early Action admit rate',
      reason: `${dissolvedReasonCommon} Prior DB provenance URL also pointed at the Purdue Writing Lab annual report (NOT a CDS). Same fabrication treatment as edAcceptanceRate.`,
      realDataStatus: 'NOT_OFFERED',
    },
  };

  const existingMeta = toRecord(school.metadata);
  const serialized = serializeSchoolProvenance(provenance as any);
  const nextMetadata = {
    ...existingMeta,
    provenance: deepMergeRecords(toRecord(existingMeta.provenance), serialized),
    closureSourceIndex: TRANSITION_URL,
    institutionStatus: 'DISSOLVED_2024_07_01',
    institutionSuccessors: [
      'IU Indianapolis (https://indianapolis.iu.edu/)',
      'Purdue University in Indianapolis (https://www.purdue.edu/indianapolis/)',
    ],
  };

  await prisma.school.update({
    where: { id: school.id },
    data: {
      acceptanceRate: null,
      sat25: null,
      sat75: null,
      intlAcceptanceRate: null,
      oosAcceptanceRate: null,
      edAcceptanceRate: null,
      eaAcceptanceRate: null,
      // No CDS evidence of ED; institution dissolved anyway.
      hasEarlyDecision: false,
      lastDataReviewAt: new Date(),
      metadata: nextMetadata,
    },
    select: { id: true },
  });

  console.log(
    '  updated 7 fields — all UNAVAILABLE (institution dissolved 2024-07-01)',
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
    `  AR=${after?.acceptanceRate?.toString() ?? 'null'} sat25=${after?.sat25 ?? 'null'} sat75=${after?.sat75 ?? 'null'}`,
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
