#!/usr/bin/env tsx
/**
 * build-prediction-closure-payload.ts
 *
 * Snapshots the CURRENT state of US schools' prediction-critical fields
 * (acceptanceRate, sat25, sat75, intlAR, oosAR, edAR, eaAR, hasEarlyDecision)
 * plus metadata.provenance for those fields, and writes a JSON payload that
 * `seed-prediction-closure.ts` will apply to any target DB.
 *
 * Match strategy across environments (in order):
 *   1. scorecardId (federal, stable across DBs)
 *   2. ipedsId (federal, stable across DBs)
 *   3. name (fallback; should be unique for US schools)
 *
 * Output: apps/api/prisma/seeds/data/prediction-closure-<date>.json
 *
 * Idempotency: each school entry includes all 7 fields + full provenance
 * subtree; running the seed UPSERTs (no append, no merge surprise).
 *
 * Run once per closure cycle:
 *   tsx apps/api/prisma/seeds/build-prediction-closure-payload.ts
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

const US_COUNTRIES = ['US', 'United States', 'United States of America'];

const PRED_FIELDS = [
  'acceptanceRate',
  'sat25',
  'sat75',
  'intlAcceptanceRate',
  'oosAcceptanceRate',
  'edAcceptanceRate',
  'eaAcceptanceRate',
] as const;

function toJsonValue(v: any) {
  if (v == null) return null;
  if (v instanceof Prisma.Decimal) return v.toNumber();
  if (typeof v === 'object') return v;
  return v;
}

async function main() {
  const dateTag = new Date().toISOString().slice(0, 10);
  const outPath = path.join(
    process.cwd(),
    'apps/api/prisma/seeds/data',
    `prediction-closure-${dateTag}.json`,
  );

  const schools = (await prisma.school.findMany({
    where: { country: { in: US_COUNTRIES } },
    select: {
      id: true,
      name: true,
      country: true,
      scorecardId: true,
      ipedsId: true,
      isPrivate: true,
      institutionType: true,
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
    orderBy: [{ usNewsRank: 'asc' }, { name: 'asc' }],
  })) as any[];

  // keys we keep from each field's provenance object — drop search history /
  // candidate blobs to keep payload reviewable in git diffs
  const PROV_KEYS = [
    'tier',
    'source',
    'sourceUrl',
    'cycleYear',
    'fetchedAt',
    'verifiedAt',
    'verifiedBy',
    'confidence',
    'value',
    'policyLabel',
    'reason',
    'notes',
    'realDataStatus',
    'generatedBy',
    'at',
  ];

  const entries = schools.map((s) => {
    // strip provenance to only the 7 prediction-critical fields + essential keys
    const fullProv = (s.metadata as any)?.provenance ?? {};
    const predProv: Record<string, any> = {};
    for (const f of PRED_FIELDS) {
      const fp = fullProv[f];
      if (!fp) continue;
      const slim: Record<string, any> = {};
      for (const k of PROV_KEYS) {
        if (fp[k] !== undefined) slim[k] = fp[k];
      }
      predProv[f] = slim;
    }

    return {
      match: {
        scorecardId: s.scorecardId ?? null,
        ipedsId: s.ipedsId ?? null,
        name: s.name,
      },
      fields: {
        hasEarlyDecision: s.hasEarlyDecision,
        institutionType: s.institutionType, // include for ArtCenter reclassification
        dataReviewStatus: s.dataReviewStatus, // include for duplicate-row REJECTEDs
        acceptanceRate: toJsonValue(s.acceptanceRate),
        sat25: toJsonValue(s.sat25),
        sat75: toJsonValue(s.sat75),
        intlAcceptanceRate: toJsonValue(s.intlAcceptanceRate),
        oosAcceptanceRate: toJsonValue(s.oosAcceptanceRate),
        edAcceptanceRate: toJsonValue(s.edAcceptanceRate),
        eaAcceptanceRate: toJsonValue(s.eaAcceptanceRate),
      },
      provenance: predProv,
    };
  });

  const payload = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    generatedFrom: 'closure-pipeline-phase3-final',
    closureReport:
      'apps/api/scripts/closure-reports/closure-2026-05-16T202021.json',
    fields: PRED_FIELDS,
    schoolCount: entries.length,
    notes: [
      'Generated from local dev DB after Phase 3 closure (227 ledger entries).',
      'Match order: scorecardId → ipedsId → name.',
      'Seed runner upserts fields + deep-merges provenance for the 7 prediction-critical fields.',
      'No other school columns are touched.',
      'Idempotent: safe to re-run.',
    ],
    entries,
  };

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, `${JSON.stringify(payload, null, 2)}\n`);
  console.log(`✅ Wrote ${entries.length} school entries to ${outPath}`);
  console.log(
    `   File size: ${(fs.statSync(outPath).size / 1024).toFixed(1)} KB`,
  );

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
