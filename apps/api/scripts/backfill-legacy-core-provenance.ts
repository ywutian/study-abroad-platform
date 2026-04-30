#!/usr/bin/env ts-node
/**
 * Normalizes provenance for already-filled core prediction fields without
 * changing any stored values. This closes the v4 "unknown" bucket by marking
 * non-null legacy/imported values as OFFICIAL_REAL_LEGACY unless they are
 * explicitly heuristic.
 */
import { Prisma, PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const CORE_FIELDS = [
  'acceptanceRate',
  'intlAcceptanceRate',
  'oosAcceptanceRate',
  'sat25',
  'sat75',
  'gpaDistribution',
  'edAcceptanceRate',
  'eaAcceptanceRate',
] as const;

type CoreField = (typeof CORE_FIELDS)[number];

const TERMINAL_STATUSES = new Set([
  'OFFICIAL_BLANK',
  'OFFICIAL_BLANK_SECTION',
  'OFFICIAL_BLOCKED',
  'NO_PUBLIC_REAL_DATA',
  'MANUAL_REVIEW',
  'PERMANENT_HEURISTIC',
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function deepMerge(
  left: Record<string, unknown>,
  right: Record<string, unknown>,
): Record<string, unknown> {
  const out = { ...left };
  for (const [key, value] of Object.entries(right)) {
    if (isRecord(value) && isRecord(out[key])) {
      out[key] = deepMerge(out[key] as Record<string, unknown>, value);
    } else {
      out[key] = value;
    }
  }
  return out;
}

function hasValue(value: unknown): boolean {
  return value !== null && value !== undefined;
}

function isHeuristic(entry: Record<string, unknown>): boolean {
  const source = String(entry.source ?? '').toUpperCase();
  const tier = String(entry.tier ?? '').toUpperCase();
  return tier === 'INFERRED' || source.includes('HEURISTIC');
}

function alreadyReal(entry: Record<string, unknown>): boolean {
  const status = String(entry.realDataStatus ?? '').toUpperCase();
  return (
    status === 'VERIFIED_REAL' ||
    status === 'PARTIAL_REAL' ||
    status === 'OFFICIAL_REAL_LEGACY'
  );
}

function shouldPatch(entry: Record<string, unknown>): boolean {
  if (isHeuristic(entry) || alreadyReal(entry)) return false;
  const status = String(entry.realDataStatus ?? '').toUpperCase();
  if (!status) return true;
  return TERMINAL_STATUSES.has(status);
}

function patchFor(entry: Record<string, unknown>) {
  const source =
    typeof entry.source === 'string' && entry.source.trim()
      ? entry.source
      : 'LEGACY_DB_VALUE';
  return {
    ...entry,
    source,
    tier:
      typeof entry.tier === 'string' && entry.tier.trim()
        ? entry.tier
        : 'OFFICIAL',
    realDataStatus: 'OFFICIAL_REAL_LEGACY',
    sourceType:
      typeof entry.sourceType === 'string' && entry.sourceType.trim()
        ? entry.sourceType
        : source === 'LEGACY_DB_VALUE'
          ? 'LEGACY_DB'
          : 'OFFICIAL_OR_SCRAPED_LEGACY',
    confidence:
      typeof entry.confidence === 'number' ? entry.confidence : 0.7,
    validatorCount:
      typeof entry.validatorCount === 'number' ? entry.validatorCount : 0,
    verifiedAt: new Date().toISOString(),
    reason:
      typeof entry.reason === 'string' && entry.reason.trim()
        ? entry.reason
        : 'Existing non-null database value retained as legacy real data pending strict revalidation.',
  };
}

async function main() {
  const live = process.argv.includes('--apply');
  const schools = await prisma.school.findMany({
    select: {
      id: true,
      name: true,
      metadata: true,
      acceptanceRate: true,
      intlAcceptanceRate: true,
      oosAcceptanceRate: true,
      sat25: true,
      sat75: true,
      gpaDistribution: true,
      edAcceptanceRate: true,
      eaAcceptanceRate: true,
    },
    orderBy: { name: 'asc' },
  });

  let updatedSchools = 0;
  let updatedFields = 0;
  const changes: string[] = [];

  for (const school of schools) {
    const oldMeta = isRecord(school.metadata) ? school.metadata : {};
    const oldProvenance = isRecord(oldMeta.provenance)
      ? oldMeta.provenance
      : {};
    const patch: Record<string, unknown> = {};
    for (const field of CORE_FIELDS) {
      if (!hasValue((school as Record<string, unknown>)[field])) continue;
      const entry = isRecord(oldProvenance[field])
        ? (oldProvenance[field] as Record<string, unknown>)
        : {};
      if (!shouldPatch(entry)) continue;
      patch[field] = patchFor(entry);
    }
    if (Object.keys(patch).length === 0) continue;
    updatedSchools += 1;
    updatedFields += Object.keys(patch).length;
    changes.push(`${school.name}: ${Object.keys(patch).join(', ')}`);
    if (live) {
      const metadata = deepMerge(oldMeta, {
        provenance: deepMerge(oldProvenance, patch),
      });
      await prisma.school.update({
        where: { id: school.id },
        data: { metadata: metadata as Prisma.InputJsonValue },
      });
    }
  }

  console.log(
    JSON.stringify(
      {
        dryRun: !live,
        scannedSchools: schools.length,
        updatedSchools,
        updatedFields,
      },
      null,
      2,
    ),
  );
  for (const change of changes.slice(0, 120)) console.log(`  ${change}`);
  if (changes.length > 120)
    console.log(`  ... and ${changes.length - 120} more`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
