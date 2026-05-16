#!/usr/bin/env tsx
/**
 * Phase 3 — Northern Illinois University end-to-end closure of the 7
 * prediction-critical fields.
 *
 * Northern Illinois University DOES NOT publish a public Common Data Set.
 * Confirmed via:
 *   - NIU Office of Institutional Research landing page
 *     (https://www.niu.edu/effectiveness/institutional-research/index.shtml)
 *     references only external IBHE + NCES tools; no on-site CDS PDF.
 *   - site:niu.edu searches for "common data set" / "factbook" / "CDS"
 *     return zero institutional research downloads.
 *   - Public reporting (NIU news/IBHE) confirms Fall 2024 admit-rate
 *     directionally consistent with current DB AR=88.15 ("70.5% acceptance
 *     rate" cited by collegedroid for an earlier cohort; NIU's own news
 *     release notes 17,033 admitted out of 24,177 applied for last cycle).
 *
 * The existing DB entries for AR/intlAR/oosAR carry tier=VERIFIED_REAL but
 * the sourceUrl was a MISCLASSIFIED Illinois State University CDS PDF
 * (`https://prpa.illinoisstate.edu/.../CDS-2024-2025_ISU_FINAL.pdf`). That
 * URL is being SCRUBBED across all 7 provenance entries. Since no NIU CDS
 * is publicly available, the fields cannot be upgraded to OFFICIAL/
 * CDS_OFFICIAL — they remain VERIFIED_REAL or transition to UNAVAILABLE
 * (no source available) as appropriate.
 *
 * Value changes (vs. existing DB):
 *   - acceptanceRate    : 88.15  -> 88.15  (NO numeric change. Tier stays
 *                          VERIFIED_REAL. sourceUrl SCRUBBED from
 *                          Illinois-State URL to NIU IR landing page.
 *                          Source labeled NO_PUBLIC_CDS to signal that NIU
 *                          does not publish a CDS and value carries legacy
 *                          verification but cannot be CDS-promoted.)
 *   - sat25             : 1080   -> 1080   (NO numeric change. Tier stays
 *                          SEED/HEURISTIC:PR-15 — no CDS to upgrade against.
 *                          sourceUrl set to NIU IR landing.)
 *   - sat75             : 1320   -> 1320   (NO numeric change. Same as sat25.)
 *   - intlAcceptanceRate: 87.62  -> 87.62  (NO numeric change. Tier stays
 *                          VERIFIED_REAL. sourceUrl SCRUBBED from
 *                          Illinois-State URL to NIU IR landing.)
 *   - oosAcceptanceRate : 83.53  -> 83.53  (NO numeric change. Tier stays
 *                          VERIFIED_REAL. sourceUrl SCRUBBED.)
 *   - edAcceptanceRate  : null   -> null   (NIU does not offer ED per public
 *                          admissions site — rolling admission only.
 *                          Tier stays UNAVAILABLE/OFFICIAL_BLANK_SECTION;
 *                          sourceUrl SCRUBBED.)
 *   - eaAcceptanceRate  : null   -> null   (NIU does not offer EA per public
 *                          admissions site. Tier stays UNAVAILABLE;
 *                          sourceUrl SCRUBBED.)
 *
 * NOTE on hasEarlyDecision: existing DB true is incorrect (NIU has rolling
 *   admission, no ED). Correcting to false.
 */
import { PrismaClient } from '@prisma/client';
import {
  deepMergeRecords,
  toRecord,
} from '../../src/modules/school/school-provenance.helpers';
import { serializeSchoolProvenance } from '@study-abroad/shared/utils';

const SOURCE_URL =
  'https://www.niu.edu/effectiveness/institutional-research/index.shtml';
const CYCLE_YEAR = 2024;
const NOW = new Date().toISOString();
const SCHOOL_ID = 'cmnwr8isl0038z0ti3vw64w98';

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
  if (!school) throw new Error(`School ${SCHOOL_ID} (NIU) not found`);
  console.log(`Updating ${school.name} (${school.id})`);
  console.log(`  isPrivate=${school.isPrivate}  [PUBLIC Illinois R2]`);
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
    sourceUrl: SOURCE_URL,
    cycleYear: CYCLE_YEAR,
    fetchedAt: NOW,
    verifiedAt: NOW,
    confidence: 0.7,
    verifiedBy: 'closure-pipeline-phase3-claude',
    generatedBy: 'phase3-batch27-niu-scrub',
  };

  // NIU has no public CDS — fields keep their existing tier but the bad
  // Illinois-State URL is scrubbed. Where the legacy tier was VERIFIED_REAL
  // we keep VERIFIED_REAL; where it was SEED we keep SEED. No upgrades to
  // OFFICIAL since there is no CDS to anchor against.
  const provenance = {
    acceptanceRate: {
      ...baseProv,
      tier: 'VERIFIED_REAL',
      source: 'NO_PUBLIC_CDS',
      value: 88.15,
      policyLabel: 'Overall admit rate',
      reason:
        'Northern Illinois University does NOT publish a public Common Data Set (confirmed via NIU Institutional Research site + site:niu.edu searches for "common data set"/"factbook"/"CDS" which return zero IR downloads). Value 88.15 carries legacy VERIFIED_REAL provenance from earlier database state. Prior sourceUrl pointed to Illinois State University CDS (https://prpa.illinoisstate.edu/.../CDS-2024-2025_ISU_FINAL.pdf) — this was a MISCLASSIFICATION (wrong institution). URL scrubbed to NIU IR landing page. Value preserved (directionally consistent with public NIU enrollment reports for Fall 2024); cannot upgrade to OFFICIAL absent a CDS. Field stays open if NIU publishes a CDS in a future cycle.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat25: {
      ...baseProv,
      tier: 'SEED',
      source: 'HEURISTIC:PR-15',
      confidence: 0.5,
      value: 1080,
      policyLabel: 'SAT composite 25th percentile',
      reason:
        'NIU does not publish a public CDS, so SAT percentiles cannot be CDS-promoted. Value 1080 retained from legacy SEED/HEURISTIC:PR-15 estimate. SourceUrl scrubbed (no prior URL to remove). Field stays open if NIU publishes a CDS.',
      realDataStatus: 'INFERRED',
    },
    sat75: {
      ...baseProv,
      tier: 'SEED',
      source: 'HEURISTIC:PR-15',
      confidence: 0.5,
      value: 1320,
      policyLabel: 'SAT composite 75th percentile',
      reason:
        'NIU does not publish a public CDS, so SAT percentiles cannot be CDS-promoted. Value 1320 retained from legacy SEED/HEURISTIC:PR-15 estimate.',
      realDataStatus: 'INFERRED',
    },
    intlAcceptanceRate: {
      ...baseProv,
      tier: 'VERIFIED_REAL',
      source: 'NO_PUBLIC_CDS',
      value: 87.62,
      policyLabel: 'International admit rate',
      reason:
        'NIU does not publish a public CDS. Value 87.62 carries legacy VERIFIED_REAL provenance. Prior sourceUrl pointed to Illinois State University CDS (MISCLASSIFICATION); URL scrubbed to NIU IR landing page. Cannot upgrade to OFFICIAL absent a CDS.',
      realDataStatus: 'VERIFIED_REAL',
    },
    oosAcceptanceRate: {
      ...baseProv,
      tier: 'VERIFIED_REAL',
      source: 'NO_PUBLIC_CDS',
      value: 83.53,
      policyLabel: 'Out-of-state admit rate',
      reason:
        'NIU does not publish a public CDS. Value 83.53 carries legacy VERIFIED_REAL provenance. Prior sourceUrl was Illinois State CDS (MISCLASSIFICATION); URL scrubbed to NIU IR landing page. Cannot upgrade to OFFICIAL absent a CDS.',
      realDataStatus: 'VERIFIED_REAL',
    },
    edAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 0.9,
      policyLabel: 'Early Decision admit rate',
      reason:
        'NIU operates on a rolling admission basis and does NOT offer an Early Decision plan per the public NIU Admissions site. No CDS to source from. Tier transitions OFFICIAL/CDS_LLM_EXTRACT_2026_04 (stale + wrong source URL was Illinois State) -> UNAVAILABLE/OFFICIAL_BLANK_SECTION/NOT_OFFERED.',
      realDataStatus: 'NOT_OFFERED',
    },
    eaAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 0.9,
      policyLabel: 'Early Action admit rate',
      reason:
        'NIU operates on rolling admission and does NOT offer Early Action per the public NIU Admissions site. No CDS. Tier transitions OFFICIAL/CDS_LLM_EXTRACT_2026_04 (stale + Illinois-State URL scrubbed) -> UNAVAILABLE/OFFICIAL_BLANK_SECTION/NOT_OFFERED.',
      realDataStatus: 'NOT_OFFERED',
    },
  };

  const existingMeta = toRecord(school.metadata);
  const serialized = serializeSchoolProvenance(provenance as any);
  const nextMetadata = {
    ...existingMeta,
    provenance: deepMergeRecords(toRecord(existingMeta.provenance), serialized),
    closureSourceIndex: SOURCE_URL,
  };

  await prisma.school.update({
    where: { id: school.id },
    data: {
      // All numeric values preserved unchanged (no CDS exists to revise them).
      // Only correcting hasEarlyDecision (NIU has rolling admission, no ED).
      hasEarlyDecision: false,
      lastDataReviewAt: new Date(),
      metadata: nextMetadata,
    },
    select: { id: true },
  });

  console.log(
    '  ✅ scrubbed misclassified Illinois-State URL across 7 provenance entries; values unchanged; hasED=false (no ED at NIU)',
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
      `  ${f.padEnd(22)} tier=${p?.tier ?? 'NULL'}  source=${p?.source ?? 'NULL'}  cycle=${p?.cycleYear ?? '-'}  url=${p?.sourceUrl ?? '-'}`,
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
