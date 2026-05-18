#!/usr/bin/env tsx
/**
 * closure-v2 — build a deployable prediction-closure seed payload.
 *
 *   pnpm exec tsx prisma/seeds/build-prediction-closure-payload.ts
 *
 * Exports the closure-v2 prediction-input fields (+ provenance) for every
 * School and HighSchool from the connected DB into a versioned JSON payload at
 *   prisma/seeds/data/prediction-closure-<date>.json
 *
 * The payload is environment-portable: `seed-prediction-closure.ts` applies it
 * to any DB (staging / prod / a freshly-reset dev DB) by matching School on
 * nameNorm and HighSchool on (name, country). Only non-null fields are
 * exported, so applying it never wipes data the target already has.
 */
import { PrismaClient } from '@prisma/client';
import fs from 'node:fs';
import path from 'node:path';

const prisma = new PrismaClient();

/** School closure-v2 prediction-input fields. */
const SCHOOL_FIELDS = [
  'acceptanceRate',
  'intlAcceptanceRate',
  'oosAcceptanceRate',
  'transferAcceptanceRate',
  'edAcceptanceRate',
  'eaAcceptanceRate',
  'ed2AcceptanceRate',
  'yieldRate',
  'hasRestrictiveEa',
  'sat25',
  'sat75',
  'satAvg',
  'act25',
  'act75',
  'actAvg',
  'gpaDistribution',
  'needBlindInternational',
  'graduationRate',
  'retentionRate',
  'percentNeedMet',
  'averageNetPrice',
  'studentFacultyRatio',
  'description',
  'descriptionZh',
  'totalEnrollment',
  'nicheOverallGrade',
] as const;

/** HighSchool closure-v2 fields (evaluation dims + curriculum + CN taxonomy). */
const HS_FIELDS = [
  'tier',
  'recognition',
  'academicRigor',
  'placementRecord',
  'studentQuality',
  'resources',
  'curriculumSystem',
  'ncesId',
  'apOfferings',
  'ibOfferings',
  'classSize',
  'cnHsCategory',
  'cnHsCityTier',
  'cnHsProvince',
  'cnHsAlternativeNames',
  'gpaConversionTable',
  'hasGaokaoTrack',
  'hasIntlTrack',
  'intlAdmissionList',
  'schoolProfilePdfUrl',
] as const;

function pickNonNull(row: Record<string, unknown>, fields: readonly string[]) {
  const out: Record<string, unknown> = {};
  for (const f of fields) {
    const v = row[f];
    if (v !== null && v !== undefined) out[f] = v;
  }
  return out;
}

/** Extract only the closure-v2 provenance entries (verifiedBy starts closure-v2). */
function closureProvenance(metadata: unknown): Record<string, unknown> | null {
  if (!metadata || typeof metadata !== 'object') return null;
  const prov = (metadata as Record<string, unknown>).provenance;
  if (!prov || typeof prov !== 'object') return null;
  const out: Record<string, unknown> = {};
  for (const [field, entry] of Object.entries(
    prov as Record<string, unknown>,
  )) {
    const verifiedBy =
      entry && typeof entry === 'object'
        ? (entry as Record<string, unknown>).verifiedBy
        : undefined;
    if (typeof verifiedBy === 'string' && verifiedBy.startsWith('closure-v2')) {
      out[field] = entry;
    }
  }
  return Object.keys(out).length > 0 ? out : null;
}

async function main() {
  const schools = await prisma.school.findMany();
  const highSchools = await prisma.highSchool.findMany();

  const schoolPayload = schools
    .map((s) => {
      const data = pickNonNull(s as Record<string, unknown>, SCHOOL_FIELDS);
      const provenance = closureProvenance(
        (s as Record<string, unknown>).metadata,
      );
      return Object.keys(data).length > 0
        ? { nameNorm: s.nameNorm, name: s.name, data, provenance }
        : null;
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  const hsPayload = highSchools
    .map((h) => {
      const data = pickNonNull(h as Record<string, unknown>, HS_FIELDS);
      return Object.keys(data).length > 0
        ? { name: h.name, country: h.country, state: h.state, data }
        : null;
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  const date = new Date().toISOString().slice(0, 10);
  const payload = {
    schemaVersion: 1,
    cycle: 'closure-v2',
    generatedAt: new Date().toISOString(),
    counts: { schools: schoolPayload.length, highSchools: hsPayload.length },
    schools: schoolPayload,
    highSchools: hsPayload,
  };

  const dir = path.resolve(__dirname, 'data');
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `prediction-closure-${date}.json`);
  fs.writeFileSync(file, JSON.stringify(payload, null, 2));
  // also write a stable "latest" pointer the seeder reads by default
  fs.writeFileSync(
    path.join(dir, 'prediction-closure-latest.json'),
    JSON.stringify(payload, null, 2),
  );

  console.log(
    `payload written: ${file}\n  schools: ${schoolPayload.length}  highSchools: ${hsPayload.length}`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
