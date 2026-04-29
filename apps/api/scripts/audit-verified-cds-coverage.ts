#!/usr/bin/env ts-node
import * as fs from 'node:fs';
import * as path from 'node:path';
import { Prisma, PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const US_COUNTRIES = ['US', 'United States', 'United States of America'];
const DEFAULT_FIELDS = ['intlAcceptanceRate', 'oosAcceptanceRate'];

function parseArgs() {
  const args = process.argv.slice(2);
  const get = (name: string) => {
    const index = args.indexOf(`--${name}`);
    return index >= 0 ? args[index + 1] : undefined;
  };
  return {
    out: get('out'),
    fields: (get('fields') ?? DEFAULT_FIELDS.join(','))
      .split(',')
      .map((field) => field.trim())
      .filter(Boolean),
  };
}

function valueFor(school: Record<string, unknown>, field: string) {
  const value = school[field];
  if (value instanceof Prisma.Decimal) return value.toNumber();
  return value ?? null;
}

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function fieldBucket(provenance: Record<string, unknown> | null) {
  const source = String(provenance?.source ?? '').toUpperCase();
  const tier = String(provenance?.tier ?? '').toUpperCase();
  const realDataStatus = String(provenance?.realDataStatus ?? '').toUpperCase();
  const validatorCount = Number(provenance?.validatorCount ?? 0);

  if (
    realDataStatus === 'VERIFIED_REAL' &&
    validatorCount >= 2 &&
    tier === 'OFFICIAL'
  ) {
    return 'verifiedReal';
  }
  if (
    realDataStatus === 'PARTIAL_REAL' &&
    validatorCount >= 2 &&
    tier === 'OFFICIAL'
  ) {
    return 'partialReal';
  }
  if (
    realDataStatus === 'OFFICIAL_BLANK' ||
    realDataStatus === 'NO_PUBLIC_REAL_DATA' ||
    source === 'PERMANENT_HEURISTIC' ||
    Boolean(provenance?.permanent)
  ) {
    return 'noPublicRealData';
  }
  if (
    realDataStatus === 'OFFICIAL_BLOCKED' ||
    source.includes('CLOUDFLARE') ||
    source.includes('SHAREPOINT')
  ) {
    return 'blocked';
  }
  if (realDataStatus === 'MANUAL_REVIEW') return 'manualReview';
  if (tier === 'INFERRED' || source.includes('HEURISTIC')) return 'heuristic';
  if (tier === 'OFFICIAL' && source) return 'legacyOfficialUnverified';
  return 'unknown';
}

async function main() {
  const args = parseArgs();
  const schools = await prisma.school.findMany({
    where: { country: { in: US_COUNTRIES } },
    select: {
      id: true,
      name: true,
      country: true,
      usNewsRank: true,
      acceptanceRate: true,
      intlAcceptanceRate: true,
      oosAcceptanceRate: true,
      metadata: true,
    },
    orderBy: [{ usNewsRank: 'asc' }, { name: 'asc' }],
  });

  const fieldTotals: Record<string, Record<string, number>> = {};
  const items = schools.map((school) => {
    const meta = record(school.metadata);
    const provenance = record(meta.provenance);
    const fields = args.fields.map((field) => {
      const prov = record(provenance[field]);
      const bucket = fieldBucket(prov);
      fieldTotals[field] ??= {
        verifiedReal: 0,
        partialReal: 0,
        legacyOfficialUnverified: 0,
        heuristic: 0,
        noPublicRealData: 0,
        blocked: 0,
        manualReview: 0,
        unknown: 0,
        missing: 0,
      };
      const filled = valueFor(school as Record<string, unknown>, field) != null;
      if (!filled) fieldTotals[field].missing += 1;
      fieldTotals[field][bucket] += 1;
      return {
        field,
        value: valueFor(school as Record<string, unknown>, field),
        bucket,
        source: prov.source ?? null,
        tier: prov.tier ?? null,
        realDataStatus: prov.realDataStatus ?? null,
        validatorCount: prov.validatorCount ?? null,
        sourceUrl: prov.sourceUrl ?? null,
        originalFormula: prov.originalFormula ?? null,
      };
    });
    return {
      schoolId: school.id,
      schoolName: school.name,
      usNewsRank: school.usNewsRank,
      fields,
    };
  });

  const report = {
    generatedAt: new Date().toISOString(),
    scope: 'us-freshman-real-cds-only',
    fields: args.fields,
    totals: {
      schools: schools.length,
      fieldTotals,
    },
    lists: Object.fromEntries(
      args.fields.map((field) => [
        field,
        {
          verifiedReal: items
            .filter((item) =>
              item.fields.some(
                (f) => f.field === field && f.bucket === 'verifiedReal',
              ),
            )
            .map((item) => item.schoolName),
          partialReal: items
            .filter((item) =>
              item.fields.some(
                (f) => f.field === field && f.bucket === 'partialReal',
              ),
            )
            .map((item) => item.schoolName),
          noPublicRealData: items
            .filter((item) =>
              item.fields.some(
                (f) => f.field === field && f.bucket === 'noPublicRealData',
              ),
            )
            .map((item) => item.schoolName),
          blocked: items
            .filter((item) =>
              item.fields.some(
                (f) => f.field === field && f.bucket === 'blocked',
              ),
            )
            .map((item) => item.schoolName),
          manualReview: items
            .filter((item) =>
              item.fields.some(
                (f) => f.field === field && f.bucket === 'manualReview',
              ),
            )
            .map((item) => item.schoolName),
        },
      ]),
    ),
    items,
  };

  const out =
    args.out ??
    path.join(
      process.cwd(),
      'scripts/coverage-reports',
      `verified-cds-coverage-${new Date().toISOString().slice(0, 10)}.json`,
    );
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, `${JSON.stringify(report, null, 2)}\n`);

  console.log(`Verified CDS coverage: ${out}`);
  console.log(`Schools: ${schools.length}`);
  for (const field of args.fields) {
    const totals = fieldTotals[field];
    console.log(
      `${field}: verified=${totals.verifiedReal} partial=${totals.partialReal} legacyOfficialUnverified=${totals.legacyOfficialUnverified} heuristic=${totals.heuristic} noPublic=${totals.noPublicRealData} blocked=${totals.blocked} review=${totals.manualReview} unknown=${totals.unknown}`,
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
