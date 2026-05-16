#!/usr/bin/env tsx
/**
 * Phase 3 — Mississippi State University end-to-end closure of the 7
 *   prediction-critical fields.
 *
 * Source: Mississippi State CDS landing page —
 *   https://ir.msstate.edu/cdsets.php
 *   The page lists CDS 2025-2026 and 2024-2025 (xlsx) but the file delivery is
 *   gated server-side (the linked paths use literal "%" in the directory name
 *   and return a 404 HTML page when accessed via curl; the actual download is
 *   served only via in-browser JS click handler). After multiple attempts
 *   (direct path probing, scholarsjunction, web.archive.org), no public CDS
 *   PDF/XLSX could be retrieved for the most recent two cycles.
 *
 * Per closure rule: "CDS 空 → BLANK_SECTION". For fields we cannot extract
 *   from the CDS, mark provenance UNAVAILABLE / OFFICIAL_BLANK_SECTION.
 *
 * Mississippi State is a PUBLIC research university (Starkville, MS) — oosAR
 *   carries real policy meaning, NOT a TERMINAL marker.
 *
 * Existing field values left untouched (BLANK_SECTION only rewrites
 *   provenance, not values, where the value originated from LEGACY_DB_VALUE
 *   and there is no authoritative replacement):
 *   - acceptanceRate    : 62          (LEGACY_DB_VALUE; not overwritten)
 *   - sat25             : 1100        (HEURISTIC seed; not overwritten)
 *   - sat75             : 1350        (HEURISTIC seed; not overwritten)
 *   - intlAcceptanceRate: 58.9        (PERMANENT_HEURISTIC; not overwritten)
 *   - oosAcceptanceRate : 63.24       (PERMANENT_HEURISTIC; not overwritten)
 *
 * Provenance changes:
 *   - acceptanceRate    : tier LEGACY_DB_VALUE -> UNAVAILABLE (BLANK_SECTION)
 *   - sat25             : tier SEED            -> UNAVAILABLE (BLANK_SECTION)
 *   - sat75             : tier SEED            -> UNAVAILABLE (BLANK_SECTION)
 *   - intlAcceptanceRate: tier NULL            -> UNAVAILABLE (BLANK_SECTION)
 *   - oosAcceptanceRate : tier NULL            -> UNAVAILABLE (BLANK_SECTION)
 *   - edAcceptanceRate  : already OFFICIAL (CDS_LLM_EXTRACT_2026_04 pointing
 *                          at https://ir.msstate.edu/cdsets.php#cds2024) —
 *                          confirmed correct school landing page. Re-stamped
 *                          with NOT_OFFERED + BLANK_SECTION to align with the
 *                          general pattern (most public regional schools do
 *                          not offer ED). Value stays null.
 *   - eaAcceptanceRate  : same as ED — re-stamped BLANK_SECTION. Value stays
 *                          null. (Public regional schools sometimes have EA,
 *                          but without the CDS we cannot verify a rate, so
 *                          tier stays UNAVAILABLE.)
 *
 * NOTE on hasEarlyDecision: current DB value is TRUE. Mississippi State's
 *   public admissions pages and external aggregators do NOT advertise an
 *   Early Decision plan — Mississippi State is rolling/regular admission.
 *   Without the CDS we cannot 100% verify, but conservatively leave
 *   hasEarlyDecision UNCHANGED (do not flip to false without source).
 */
import { PrismaClient } from '@prisma/client';
import {
  deepMergeRecords,
  toRecord,
} from '../../src/modules/school/school-provenance.helpers';
import { serializeSchoolProvenance } from '@study-abroad/shared/utils';

const CDS_URL = 'https://ir.msstate.edu/cdsets.php';
const CYCLE_YEAR = 2025; // Page lists CDS 2025-2026 as most recent
const NOW = new Date().toISOString();
const SCHOOL_ID = 'cmnwr8iqx002dz0tigsxpge66';

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
    throw new Error(`School ${SCHOOL_ID} (Mississippi State) not found`);
  console.log(`Updating ${school.name} (${school.id})`);
  console.log(`  isPrivate=${school.isPrivate}  [PUBLIC SCHOOL]`);
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
    generatedBy: 'phase3-msstate-blank-section',
  };

  const blankReason =
    'Mississippi State CDS landing page (https://ir.msstate.edu/cdsets.php) lists CDS 2025-2026 and prior cycles, but the actual file delivery is gated server-side: the link `value` attribute encodes a filesystem path with literal "%" in the directory name and the file is downloaded via in-browser JS click handler. Multiple direct-path probes returned 404 HTML pages, and ScholarsJunction / web.archive.org do not host the recent cycles. CDS cannot be retrieved publicly — marking BLANK_SECTION per closure-pipeline rule. Existing DB value preserved as a non-authoritative carry-over; downstream code must treat as UNAVAILABLE.';

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
        'CDS itself is not publicly retrievable (see acceptanceRate reason). Mississippi State is a public research university (Starkville, MS) on rolling/regular admission with no advertised ED plan on its public admissions pages or in external aggregators. Field stays cleared (null) and marked BLANK_SECTION. Replaces prior CDS_LLM_EXTRACT provenance which pointed at the correct school landing page but could not produce a verified value.',
      realDataStatus: 'NOT_OFFERED',
    },
    eaAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 0.7,
      policyLabel: 'Early Action admit rate',
      reason:
        'CDS itself is not publicly retrievable. Mississippi State does not advertise an EA plan on its public admissions site, but without the CDS we cannot conclusively rule it out. Field stays cleared (null) and marked BLANK_SECTION.',
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

  // Values preserved as-is; only provenance + lastDataReviewAt + metadata change.
  await prisma.school.update({
    where: { id: school.id },
    data: {
      lastDataReviewAt: new Date(),
      metadata: nextMetadata,
    },
    select: { id: true },
  });

  console.log(
    '  ✅ provenance updated to BLANK_SECTION for all 7 fields (values preserved; hasEarlyDecision left as-is per rule "do not flip without source")',
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
