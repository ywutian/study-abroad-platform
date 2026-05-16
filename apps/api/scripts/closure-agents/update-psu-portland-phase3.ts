#!/usr/bin/env tsx
/**
 * Phase 3 — Portland State University (PSU, Portland, OR) end-to-end closure
 * of the 7 prediction-critical fields. PUBLIC urban research university
 * (Oregon University System).
 *
 * (NOTE: Distinct from the unrelated Penn State University which is a separate
 * row id; this is Oregon's PSU.)
 *
 * Source: Portland State University CDS 2023-2024 (Fall 2023 entering class)
 *   from PSU Office of Institutional Research and Planning. The PSU CDS
 *   archive (https://www.pdx.edu/research-planning/common-data-set-archive)
 *   only goes through 2022-2023 publicly; the 2023-2024 PDF is hosted directly
 *   at the link below (dated 2024-05 in URL path) but not yet added to the
 *   archive index. The 2024-2025 cycle has not yet been published as of
 *   May 2026 — 2023-2024 is the most recent OFFICIAL CDS available.
 *   PDF: https://www.pdx.edu/research-planning/sites/researchplanning.web.wdt.pdx.edu/files/2024-05/CDS_2023-2024%20(Updated%205-8-24%20AM).pdf
 *
 * Institution facts:
 *   - PUBLIC urban research university; in-state/out-of-state distinction
 *     carries real policy meaning (different tuition); oosAR in eligible scope
 *   - CDS C8A "No" — PSU is TEST-BLIND for admissions (scores "Not considered
 *     for admission, even if submitted" per C8 table). PSU does still publish
 *     SAT Composite percentiles in C9 from the 34 students who submitted SAT
 *     scores (2.15%); per closure-pipeline convention (cf. Cal Poly SLO
 *     handling), these percentiles are recorded as OFFICIAL for descriptive
 *     applicant-profile use only — NOT as a gating threshold.
 *   - C21 "No" — PSU does NOT offer Early Decision. DB hasEarlyDecision=true
 *     is STALE — correcting to false.
 *   - C22 "No" — PSU does NOT offer Early Action.
 *
 * Value changes (vs. existing DB):
 *   - acceptanceRate    : 90.90 → 90.91 (CDS C1: 8,070 admits / 8,877
 *                          applicants = 90.9090% (rounded to 90.91%).
 *                          Composition: Men 2,904/3,234 = 89.79%; Women
 *                          5,075/5,535 = 91.69%; Another Gender 89/106 =
 *                          83.96%; Unknown 2/2 = 100%. Minor +0.01pp
 *                          precision adjustment. Tier upgraded LEGACY_DB →
 *                          OFFICIAL. Note: PSU CDS source URL was already
 *                          correct in prior provenance.)
 *   - sat25             : 1100 → 1100 (CDS C9 SAT Composite 25th = 1100.
 *                          Value matches prior DB; source upgraded from
 *                          prepscholar.com (third-party) to CDS_OFFICIAL.
 *                          NOTE: PSU is test-blind; SAT band is descriptive
 *                          only, not a gating threshold.)
 *   - sat75             : 1290 → 1290 (CDS C9 SAT Composite 75th = 1290.
 *                          Same as sat25 — provenance correction only.)
 *   - intlAcceptanceRate: 93.60 → 93.62 (CDS C1 residency: 279 intl admits /
 *                          298 intl applicants = 93.6242% (rounded to
 *                          93.62%). Minor +0.02pp precision adjustment.
 *                          Tier upgraded LEGACY_DB → OFFICIAL.)
 *   - oosAcceptanceRate : 90.00 → 89.99 (CDS C1 residency: 3,840 OOS admits
 *                          / 4,267 OOS applicants = 89.9930% (rounded to
 *                          89.99%). Minor −0.01pp precision adjustment.
 *                          Tier upgraded LEGACY_DB → OFFICIAL.)
 *   - edAcceptanceRate  : null → null (CDS C21 "No" — PSU does not offer
 *                          Early Decision. Provenance refreshed from
 *                          CDS_LLM_EXTRACT to authoritative CDS_OFFICIAL
 *                          marked UNAVAILABLE/NOT_OFFERED.)
 *   - eaAcceptanceRate  : null → null (CDS C22 "No" — PSU does not offer
 *                          Early Action. Provenance refreshed marked
 *                          UNAVAILABLE/NOT_OFFERED.)
 *
 * hasEarlyDecision correction: DB true → false (CDS C21 "No" — PSU does NOT
 *   offer ED). Stale flag corrected.
 */
import { PrismaClient, Prisma } from '@prisma/client';
import {
  deepMergeRecords,
  toRecord,
} from '../../src/modules/school/school-provenance.helpers';
import { serializeSchoolProvenance } from '@study-abroad/shared/utils';

const PSU_CDS_URL =
  'https://www.pdx.edu/research-planning/sites/researchplanning.web.wdt.pdx.edu/files/2024-05/CDS_2023-2024%20%28Updated%205-8-24%20AM%29.pdf';
const PSU_CDS_INDEX_URL =
  'https://www.pdx.edu/research-planning/common-data-set-archive';
const CYCLE_YEAR = 2023; // CDS 2023-2024 = Fall 2023 entering class
const NOW = new Date().toISOString();
const SCHOOL_ID = 'cmnwr8irl002oz0tiyc5w37jx';

const prisma = new PrismaClient();

async function main() {
  const school = await prisma.school.findUnique({
    where: { id: SCHOOL_ID },
    select: {
      id: true,
      name: true,
      isPrivate: true,
      hasEarlyDecision: true,
      dataReviewStatus: true,
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
    throw new Error(
      `School ${SCHOOL_ID} (Portland State University) not found`,
    );
  if (school.dataReviewStatus === 'REJECTED') {
    console.log(
      `Skipping closed/rejected school ${school.name} (status=${school.dataReviewStatus})`,
    );
    return;
  }
  console.log(`Updating ${school.name} (${school.id})`);
  console.log(`  isPrivate=${school.isPrivate}  [PUBLIC urban research]`);
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
    sourceUrl: PSU_CDS_URL,
    cycleYear: CYCLE_YEAR,
    fetchedAt: NOW,
    verifiedAt: NOW,
    confidence: 1.0,
    verifiedBy: 'closure-pipeline-phase3-batch24-claude',
    generatedBy: 'phase3-psu-portland-validation',
  };

  const provenance = {
    acceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 90.91,
      policyLabel: 'Overall admit rate',
      reason:
        'Portland State University CDS 2023-2024 Section C1 (Fall 2023 entering class): TOTAL applicants 8,877 (Men 3,234 + Women 5,535 + Another Gender 106 + Unknown 2); TOTAL admits 8,070 (Men 2,904 + Women 5,075 + Another Gender 89 + Unknown 2). AR = 8,070 / 8,877 = 90.9090% (rounded to 90.91%). Minor +0.01pp precision adjustment vs prior 90.90. Tier upgraded LEGACY_DB_VALUE → OFFICIAL (prior provenance already pointed to correct pdx.edu sourceUrl).',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat25: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1100,
      policyLabel: 'SAT composite 25th percentile (reported composite row)',
      reason:
        'PSU CDS 2023-2024 Section C9: SAT Composite 25th percentile = 1100 (34 students submitting SAT = 2.15% of enrolled; 47 students ACT = 2.97%). NOTE: PSU is test-blind per C8A "No" — scores "Not considered for admission, even if submitted." SAT band is recorded for descriptive applicant-profile use only, NOT as a gating threshold (cf. Cal Poly SLO closure-pipeline convention). Value matches prior DB; source upgraded from prepscholar.com (third-party) to authoritative CDS_OFFICIAL.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat75: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1290,
      policyLabel: 'SAT composite 75th percentile (reported composite row)',
      reason:
        'PSU CDS 2023-2024 Section C9: SAT Composite 75th percentile = 1290. NOTE: PSU is test-blind; SAT band is descriptive only. Value matches prior DB; source upgraded prepscholar.com → CDS_OFFICIAL.',
      realDataStatus: 'VERIFIED_REAL',
    },
    intlAcceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 93.62,
      policyLabel: 'International admit rate',
      reason:
        'PSU CDS 2023-2024 Section C1 residency breakdown: 298 international applicants; 279 international admits. intlAR = 279 / 298 = 93.6242% (rounded to 93.62%). Minor +0.02pp precision adjustment vs prior 93.60. Tier upgraded LEGACY_DB_VALUE → OFFICIAL.',
      realDataStatus: 'VERIFIED_REAL',
    },
    oosAcceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 89.99,
      policyLabel: 'Out-of-state admit rate',
      reason:
        'PSU CDS 2023-2024 Section C1 residency breakdown: 4,267 out-of-state applicants; 3,840 out-of-state admits. oosAR = 3,840 / 4,267 = 89.9930% (rounded to 89.99%). Minor −0.01pp precision adjustment vs prior 90.00. PSU is PUBLIC urban research university (Oregon University System) — in-state/out-of-state distinction carries real policy meaning (different tuition); oosAR in eligible scope. Tier upgraded LEGACY_DB_VALUE → OFFICIAL.',
      realDataStatus: 'VERIFIED_REAL',
    },
    edAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'Early Decision admit rate',
      reason:
        'PSU CDS 2023-2024 Section C21: "Does your institution offer an early decision plan?" — NO checked. Portland State University does NOT offer Early Decision. Prior provenance was CDS_LLM_EXTRACT_2026_04 (value=undefined). Provenance refreshed to authoritative CDS_OFFICIAL marked UNAVAILABLE/NOT_OFFERED. Stale DB hasEarlyDecision=true flag corrected to false.',
      realDataStatus: 'NOT_OFFERED',
    },
    eaAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'Early Action admit rate',
      reason:
        'PSU CDS 2023-2024 Section C22: "Do you have a nonbinding early action plan?" — NO checked. Portland State University does NOT offer Early Action. Prior provenance was CDS_LLM_EXTRACT_2026_04 (value=undefined). Provenance refreshed to authoritative CDS_OFFICIAL marked UNAVAILABLE/NOT_OFFERED.',
      realDataStatus: 'NOT_OFFERED',
    },
  };

  const existingMeta = toRecord(school.metadata);
  const serialized = serializeSchoolProvenance(provenance as any);
  const nextMetadata = {
    ...existingMeta,
    provenance: deepMergeRecords(toRecord(existingMeta.provenance), serialized),
    closureSourceIndex: PSU_CDS_INDEX_URL,
    closureSourcePdf: PSU_CDS_URL,
  };

  await prisma.school.update({
    where: { id: school.id },
    data: {
      acceptanceRate: new Prisma.Decimal('90.91'),
      sat25: 1100,
      sat75: 1290,
      intlAcceptanceRate: new Prisma.Decimal('93.62'),
      oosAcceptanceRate: new Prisma.Decimal('89.99'),
      edAcceptanceRate: null,
      eaAcceptanceRate: null,
      // CDS C21 "No" — PSU does NOT offer ED; correct stale DB true
      hasEarlyDecision: false,
      lastDataReviewAt: new Date(),
      metadata: nextMetadata,
    },
    select: { id: true },
  });

  console.log(
    '  ✅ updated 7 fields (AR=90.91, sat25=1100, sat75=1290, intlAR=93.62, oosAR=89.99, edAR=NOT_OFFERED, eaAR=NOT_OFFERED, hasED=false)',
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
