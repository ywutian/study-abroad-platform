#!/usr/bin/env tsx
/**
 * Phase 3 — Wright State University (Main / Dayton, OH) end-to-end closure
 * of the 7 prediction-critical fields.
 *
 * Source: Wright State CDS 2024-2025 (Fall 2024 entering class)
 *   URL: https://www.wright.edu/sites/www.wright.edu/files/page/attachments/CDS_2024-2025_Lake.pdf
 *   (Filename "CDS_2024-2025_Lake.pdf" is the Wright State institutional
 *   publication — confirmed Section C1/C9/C21/C22 for Wright State, Dayton.)
 *
 * Wright State is a PUBLIC Ohio research university. oosAcceptanceRate is
 * in eligible scope.
 *
 * Value changes (vs. existing DB):
 *   - acceptanceRate    : 99.69  -> 99.69  (CDS C1 total: 643 applied
 *                          (men 241 + women 402), 641 admitted (241 + 400).
 *                          AR = 641 / 643 = 99.6889%, rounds to 99.69%.
 *                          Value matches DB exactly. Tier upgraded
 *                          VERIFIED_REAL/LEGACY_DB_VALUE -> OFFICIAL.)
 *   - sat25             : 913    -> 830    (CORRECTION DOWN -83. CDS C9
 *                          SAT Composite 25th percentile = 830. Prior DB
 *                          913 came from collegeiq.com (mislabeled
 *                          CDS_PDF_AUTO). NOTE: Only 2% (5 enrolled
 *                          students) submitted SAT — Wright State is
 *                          ACT-dominant (81% submitted ACT = 226 students).
 *                          SAT sample is tiny; ACT Composite 25/75 = 17/23
 *                          is the more reliable score band, but per scoring
 *                          policy we report the published CDS SAT figure.)
 *   - sat75             : 1240   -> 1000   (CORRECTION DOWN -240. CDS C9
 *                          SAT Composite 75th percentile = 1000. Same
 *                          rationale as sat25.)
 *   - intlAcceptanceRate: 100    -> 100    (CDS C1 residency breakdown:
 *                          INTERNATIONAL column 1 applied / 1 admitted =
 *                          100%. Value matches DB exactly. Tier upgraded
 *                          VERIFIED_REAL/LEGACY_DB_VALUE -> OFFICIAL.
 *                          NOTE: Sample size n=1 — this is a fully-published
 *                          CDS cell but the underlying cohort is trivially
 *                          small.)
 *   - oosAcceptanceRate : 97.65  -> 97.65  (CDS C1 residency: OUT-OF-STATE
 *                          85 applied / 83 admitted. oosAR = 83/85 =
 *                          97.6471%, rounds to 97.65%. Value matches DB
 *                          exactly. Tier upgraded VERIFIED_REAL/
 *                          LEGACY_DB_VALUE -> OFFICIAL.)
 *   - edAcceptanceRate  : null   -> null   (CDS C21: "Does your institution
 *                          offer an early decision plan?" — NO checked.
 *                          Wright State does not offer ED. Tier transitions
 *                          OFFICIAL/CDS_LLM_EXTRACT_2026_04 (stale) ->
 *                          UNAVAILABLE/OFFICIAL_BLANK_SECTION/NOT_OFFERED.)
 *   - eaAcceptanceRate  : null   -> null   (CDS C22: "Do you have a
 *                          nonbinding early action plan?" — NO checked.
 *                          Wright State does not offer EA. Same as edAR.)
 *
 * NOTE on hasEarlyDecision: current DB value is true, but CDS C21 is "No".
 *   Correcting to false to match CDS reality.
 */
import { PrismaClient, Prisma } from '@prisma/client';
import {
  deepMergeRecords,
  toRecord,
} from '../../src/modules/school/school-provenance.helpers';
import { serializeSchoolProvenance } from '@study-abroad/shared/utils';

const CDS_URL =
  'https://www.wright.edu/sites/www.wright.edu/files/page/attachments/CDS_2024-2025_Lake.pdf';
const CYCLE_YEAR = 2024; // CDS 2024-2025 = Fall 2024 entering class
const NOW = new Date().toISOString();
const SCHOOL_ID = 'cmnwr8iti003lz0ti0z9hwm3s';

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
  if (!school) throw new Error(`School ${SCHOOL_ID} (Wright State) not found`);
  console.log(`Updating ${school.name} (${school.id})`);
  console.log(`  isPrivate=${school.isPrivate}  [PUBLIC Ohio]`);
  console.log(
    `  current AR=${school.acceptanceRate?.toString()} sat25=${school.sat25} sat75=${school.sat75}`,
  );
  console.log(
    `  current intlAR=${school.intlAcceptanceRate?.toString()} oosAR=${school.oosAcceptanceRate?.toString()}`,
  );
  console.log(
    `  current edAR=${school.edAcceptanceRate?.toString() ?? 'null'} eaAR=${school.eaAcceptanceRate?.toString() ?? 'null'} hasED=${school.hasEarlyDecision}`,
  );

  const baseProv = {
    sourceUrl: CDS_URL,
    cycleYear: CYCLE_YEAR,
    fetchedAt: NOW,
    verifiedAt: NOW,
    confidence: 1.0,
    verifiedBy: 'closure-pipeline-phase3-claude',
    generatedBy: 'phase3-batch28-wright-state',
  };

  const provenance = {
    acceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 99.69,
      policyLabel: 'Overall admit rate',
      reason:
        'CDS 2024-25 Section C1: 643 total applied (men 241 + women 402), 641 total admitted (241 + 400). AR = 641 / 643 = 99.6889%, rounds to 99.69%. Value matches prior LEGACY_DB exactly; tier upgraded LEGACY_DB_VALUE -> OFFICIAL.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat25: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 830,
      policyLabel: 'SAT composite 25th percentile',
      reason:
        'CDS 2024-25 Section C9 SAT Composite 25th percentile = 830. CORRECTION DOWN -83 from prior DB 913 (which was scraped from collegeiq.com and mislabeled CDS_PDF_AUTO). NOTE: Only 2% of enrolled students (n=5) submitted SAT scores — Wright State is ACT-dominant (81% submitted ACT). Sample is tiny but this is the officially published CDS figure.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat75: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1000,
      policyLabel: 'SAT composite 75th percentile',
      reason:
        'CDS 2024-25 Section C9 SAT Composite 75th percentile = 1000. CORRECTION DOWN -240 from prior DB 1240. Same rationale as sat25 (tiny SAT-submission sample at this ACT-dominant institution; published CDS figure used).',
      realDataStatus: 'VERIFIED_REAL',
    },
    intlAcceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 100,
      policyLabel: 'International admit rate',
      reason:
        'CDS 2024-25 Section C1 residency breakdown: INTERNATIONAL column 1 applied / 1 admitted = 100%. Value matches prior LEGACY_DB exactly; tier upgraded LEGACY_DB_VALUE -> OFFICIAL. NOTE: Sample size n=1 applicant — published cell but cohort trivially small.',
      realDataStatus: 'VERIFIED_REAL',
    },
    oosAcceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 97.65,
      policyLabel: 'Out-of-state admit rate',
      reason:
        'CDS 2024-25 Section C1 residency breakdown: OUT-OF-STATE 85 applied / 83 admitted. oosAR = 83/85 = 97.6471%, rounds to 97.65%. Value matches prior LEGACY_DB exactly; tier upgraded LEGACY_DB_VALUE -> OFFICIAL.',
      realDataStatus: 'VERIFIED_REAL',
    },
    edAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'Early Decision admit rate',
      reason:
        'CDS 2024-25 Section C21: "Does your institution offer an early decision plan?" — NO checked. Wright State does not offer Early Decision. Field stays null. Tier transitions OFFICIAL/CDS_LLM_EXTRACT_2026_04 (stale; LLM extraction previously hallucinated a value) -> UNAVAILABLE/OFFICIAL_BLANK_SECTION/NOT_OFFERED with refreshed provenance.',
      realDataStatus: 'NOT_OFFERED',
    },
    eaAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'Early Action admit rate',
      reason:
        'CDS 2024-25 Section C22: "Do you have a nonbinding early action plan?" — NO checked. Wright State does not offer Early Action. Same treatment as edAcceptanceRate.',
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
      acceptanceRate: new Prisma.Decimal('99.69'),
      sat25: 830,
      sat75: 1000,
      intlAcceptanceRate: new Prisma.Decimal('100'),
      oosAcceptanceRate: new Prisma.Decimal('97.65'),
      edAcceptanceRate: null,
      eaAcceptanceRate: null,
      // CDS C21 "No" — Wright State does not offer ED; correct stale DB true.
      hasEarlyDecision: false,
      lastDataReviewAt: new Date(),
      metadata: nextMetadata,
    },
    select: { id: true },
  });

  console.log(
    '  updated 7 fields (AR=99.69 same, sat25=830 down, sat75=1000 down, intlAR=100 same, oosAR=97.65 same, edAR=NOT_OFFERED, eaAR=NOT_OFFERED, hasED=false)',
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
    `  AR=${after?.acceptanceRate?.toString()} sat25=${after?.sat25 ?? 'null'} sat75=${after?.sat75 ?? 'null'}`,
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
