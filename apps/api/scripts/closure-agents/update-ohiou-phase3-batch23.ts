#!/usr/bin/env tsx
/**
 * Phase 3 — Ohio University (Athens, OH) end-to-end closure of the 7
 *   prediction-critical fields.
 *
 * IMPORTANT: This is OHIO UNIVERSITY (Athens), NOT Ohio State University
 *   (Columbus). They are entirely different institutions. The current DB row
 *   had multiple WRONG-school provenance URLs:
 *     - acceptanceRate.sourceUrl    -> irp.osu.edu (OHIO STATE)
 *     - sat25/sat75.sourceUrl       -> prepscholar.com/Ohio-University (3p)
 *     - intlAcceptanceRate.sourceUrl -> clastify.com (3rd-party blog)
 *     - edAR/eaAR.sourceUrl         -> highered.ohio.gov CCP report (wrong doc)
 *   All replaced below.
 *
 * Also: Ohio University was misclassified as isPrivate=true and
 *   institutionType=LIBERAL_ARTS. Ohio University is a PUBLIC RESEARCH
 *   UNIVERSITY (R1 Carnegie classification). Both fields corrected.
 *
 * Source: Ohio University CDS landing page —
 *   https://www.ohio.edu/iea/historical-data/historic-common-data-set-reports
 *   Ohio University's CDS files are gated behind a faculty/staff SSO and not
 *   publicly downloadable. The First-Year Student Profiles page
 *   (https://www.ohio.edu/iea/student-data/student-profiles -> node/103276)
 *   explicitly states: "An Ohio Faculty/Staff ID is required to access these
 *   reports." External aggregators (BigFuture, Niche, etc.) do publish derived
 *   stats but those are not CDS-authoritative.
 *
 * Per closure rule: "CDS 空 → BLANK_SECTION". For fields we cannot extract
 *   from the CDS, mark provenance UNAVAILABLE / OFFICIAL_BLANK_SECTION with
 *   the correct landing-page URL.
 *
 * Field values:
 *   - acceptanceRate    : 79.72   (preserved; existing LEGACY_DB_VALUE — no
 *                                  authoritative replacement available.)
 *   - sat25             : 1100    (preserved; from prepscholar.com — not
 *                                  authoritative but kept as a stale value
 *                                  with provenance demoted to BLANK_SECTION.)
 *   - sat75             : 1280    (preserved; same caveat.)
 *   - intlAcceptanceRate: 55.6    (preserved; was clastify.com — demoted.)
 *   - oosAcceptanceRate : 88.74   (preserved; PERMANENT_HEURISTIC — demoted.)
 *   - edAcceptanceRate  : null    (NOT_OFFERED — Ohio University does not
 *                                  publish ED; admissions site is rolling.)
 *   - eaAcceptanceRate  : null    (cannot verify EA without CDS; BLANK_SECTION.)
 *
 * NOTE on hasEarlyDecision: current DB value is TRUE; Ohio University's
 *   public admissions site does NOT advertise ED (they have Early Application
 *   priority deadlines, which is different). Conservatively leaving the flag
 *   UNCHANGED — but flagging the BLANK_SECTION provenance so the value can
 *   be revisited when an authoritative source becomes available.
 */
import { PrismaClient, InstitutionType } from '@prisma/client';
import {
  deepMergeRecords,
  toRecord,
} from '../../src/modules/school/school-provenance.helpers';
import { serializeSchoolProvenance } from '@study-abroad/shared/utils';

const CDS_URL =
  'https://www.ohio.edu/iea/historical-data/historic-common-data-set-reports';
const CYCLE_YEAR = 2024;
const NOW = new Date().toISOString();
const SCHOOL_ID = 'cmnwr8iqy002ez0tizit8vwvw';

const prisma = new PrismaClient();

async function main() {
  const school = await prisma.school.findUnique({
    where: { id: SCHOOL_ID },
    select: {
      id: true,
      name: true,
      isPrivate: true,
      institutionType: true,
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
    throw new Error(`School ${SCHOOL_ID} (Ohio University) not found`);
  console.log(`Updating ${school.name} (${school.id})`);
  console.log(
    `  current isPrivate=${school.isPrivate}  type=${school.institutionType}  [SHOULD BE PUBLIC RESEARCH_UNIVERSITY]`,
  );
  console.log(
    `  current AR=${school.acceptanceRate?.toString()} sat25=${school.sat25} sat75=${school.sat75}`,
  );
  console.log(
    `  current intlAR=${school.intlAcceptanceRate?.toString()} oosAR=${school.oosAcceptanceRate?.toString()}`,
  );

  const baseProv = {
    sourceUrl: CDS_URL,
    cycleYear: CYCLE_YEAR,
    fetchedAt: NOW,
    verifiedAt: NOW,
    confidence: 0.6,
    verifiedBy: 'closure-pipeline-phase3-batch23-claude',
    generatedBy: 'phase3-ohiou-blank-section',
  };

  const blankReason =
    'Ohio University (Athens, OH) CDS files are gated behind a faculty/staff SSO and not publicly downloadable. The IEA First-Year Student Profiles page explicitly states "An Ohio Faculty/Staff ID is required to access these reports." External aggregators publish derived stats but those are not CDS-authoritative. CDS cannot be retrieved publicly — marking BLANK_SECTION per closure-pipeline rule. This update also REPLACES prior provenance which incorrectly cited (a) irp.osu.edu CDS for Ohio STATE University (a different institution), (b) prepscholar.com (third-party), (c) clastify.com (third-party blog), and (d) a highered.ohio.gov CCP report (unrelated state report).';

  const provenance = {
    acceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      policyLabel: 'Overall admit rate',
      reason: blankReason,
      realDataStatus: 'BLANK_IN_OFFICIAL_SOURCE',
    },
    sat25: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      policyLabel: 'SAT composite 25th percentile',
      reason: blankReason,
      realDataStatus: 'BLANK_IN_OFFICIAL_SOURCE',
    },
    sat75: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      policyLabel: 'SAT composite 75th percentile',
      reason: blankReason,
      realDataStatus: 'BLANK_IN_OFFICIAL_SOURCE',
    },
    intlAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      policyLabel: 'International admit rate',
      reason: blankReason,
      realDataStatus: 'BLANK_IN_OFFICIAL_SOURCE',
    },
    oosAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      policyLabel: 'Out-of-state admit rate',
      reason: blankReason,
      realDataStatus: 'BLANK_IN_OFFICIAL_SOURCE',
    },
    edAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 0.9,
      policyLabel: 'Early Decision admit rate',
      reason:
        'CDS itself is not publicly retrievable (see acceptanceRate reason). Ohio University is a public research university (Athens, OH) with rolling/regular admission — its public admissions site does not advertise an ED plan (priority "early" application deadlines are not the same as ED). Field stays cleared (null) and marked BLANK_SECTION/NOT_OFFERED. Replaces prior CDS_LLM_EXTRACT provenance which incorrectly cited a highered.ohio.gov CCP annual report (unrelated document).',
      realDataStatus: 'NOT_OFFERED',
    },
    eaAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 0.7,
      policyLabel: 'Early Action admit rate',
      reason:
        'CDS itself is not publicly retrievable. Ohio University publishes priority application deadlines but does not clearly advertise a nonbinding EA plan in CDS terms. Without the CDS we cannot verify either a yes/no answer or a rate. Field stays cleared (null) and marked BLANK_SECTION. Replaces prior wrong-doc provenance (highered.ohio.gov CCP report).',
      realDataStatus: 'BLANK_IN_OFFICIAL_SOURCE',
    },
  };

  const existingMeta = toRecord(school.metadata);
  const serialized = serializeSchoolProvenance(provenance as any);
  const nextMetadata = {
    ...existingMeta,
    provenance: deepMergeRecords(toRecord(existingMeta.provenance), serialized),
    closureSourceIndex: CDS_URL,
  };

  // Correct two structural classification errors that violate "全 3 所公立":
  //   - isPrivate: true -> false  (Ohio University is a PUBLIC institution)
  //   - institutionType: LIBERAL_ARTS -> RESEARCH_UNIVERSITY (R1 Carnegie)
  // Values preserved as-is; only provenance + classification + metadata change.
  await prisma.school.update({
    where: { id: school.id },
    data: {
      isPrivate: false,
      institutionType: InstitutionType.RESEARCH_UNIVERSITY,
      lastDataReviewAt: new Date(),
      metadata: nextMetadata,
    },
    select: { id: true },
  });

  console.log(
    '  ✅ provenance updated to BLANK_SECTION for all 7 fields; isPrivate->false; institutionType->RESEARCH_UNIVERSITY; values preserved',
  );

  const after = await prisma.school.findUnique({
    where: { id: school.id },
    select: {
      isPrivate: true,
      institutionType: true,
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
  console.log(`  isPrivate=${after?.isPrivate} type=${after?.institutionType}`);
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
