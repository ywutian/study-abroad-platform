#!/usr/bin/env ts-node
import { Prisma, PrismaClient } from '@prisma/client';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  buildFieldProvenanceRecord,
  deepMergeRecords,
  toRecord,
} from '../src/modules/school/school-provenance.helpers';

const prisma = new PrismaClient();
const US_COUNTRIES = ['US', 'United States', 'United States of America'];

function parseArgs() {
  const args = process.argv.slice(2);
  const get = (name: string) => {
    const index = args.indexOf(`--${name}`);
    return index >= 0 ? args[index + 1] : undefined;
  };
  const has = (name: string) => args.includes(`--${name}`);
  return {
    live: has('live'),
    forceHeuristic: has('force-heuristic'),
    printChanges: has('print-changes'),
    out: get('out'),
    heuristicLimit: Number(get('heuristic-limit') ?? 500),
    actorUserId:
      get('actor-user-id') ??
      process.env.ADMIN_USER_ID ??
      'system-pr15-pipeline',
  };
}

function toPercent(value: Prisma.Decimal | number | null | undefined) {
  if (value == null) return null;
  const n = value instanceof Prisma.Decimal ? value.toNumber() : Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n > 1 ? n : n * 100;
}

function deriveIntlRate(overallPercent: number, needBlind: boolean) {
  const multiplier =
    overallPercent >= 40
      ? 0.95
      : overallPercent >= 20
        ? needBlind
          ? 0.85
          : 0.7
        : needBlind
          ? 0.7
          : 0.4;
  return Math.max(
    0.1,
    Math.min(98, Math.round(overallPercent * multiplier * 100) / 100),
  );
}

function deriveOosRate(
  overallPercent: number,
  isPrivate: boolean,
  state: string | null | undefined,
) {
  if (isPrivate) return Math.round(overallPercent * 100) / 100;

  const strongResidencyPreference = new Set([
    'CA',
    'MI',
    'NC',
    'VA',
    'TX',
    'FL',
  ]);
  const hasStrongPreference = state
    ? strongResidencyPreference.has(state.trim().toUpperCase())
    : false;
  const multiplier =
    overallPercent >= 50
      ? 1.02
      : overallPercent >= 40
        ? 0.95
        : overallPercent >= 20
          ? hasStrongPreference
            ? 0.75
            : 0.85
          : overallPercent >= 10
            ? hasStrongPreference
              ? 0.6
              : 0.75
            : hasStrongPreference
              ? 0.5
              : 0.7;

  return Math.max(
    0.1,
    Math.min(98, Math.round(overallPercent * multiplier * 100) / 100),
  );
}

function deriveSatBand(overallPercent: number) {
  if (overallPercent <= 5) return { sat25: 1510, satAvg: 1560, sat75: 1590 };
  if (overallPercent <= 10) return { sat25: 1460, satAvg: 1530, sat75: 1570 };
  if (overallPercent <= 20) return { sat25: 1380, satAvg: 1480, sat75: 1540 };
  if (overallPercent <= 40) return { sat25: 1250, satAvg: 1360, sat75: 1450 };
  if (overallPercent <= 70) return { sat25: 1080, satAvg: 1200, sat75: 1320 };
  return { sat25: 950, satAvg: 1080, sat75: 1200 };
}

function deriveActBand(overallPercent: number) {
  if (overallPercent <= 5) return { act25: 34, actAvg: 35, act75: 36 };
  if (overallPercent <= 10) return { act25: 33, actAvg: 34, act75: 35 };
  if (overallPercent <= 20) return { act25: 30, actAvg: 33, act75: 35 };
  if (overallPercent <= 40) return { act25: 27, actAvg: 30, act75: 33 };
  if (overallPercent <= 70) return { act25: 22, actAvg: 25, act75: 29 };
  return { act25: 18, actAvg: 22, act75: 26 };
}

function coverageTotals(schools: any[]) {
  const fields = [
    'acceptanceRate',
    'intlAcceptanceRate',
    'oosAcceptanceRate',
    'sat25',
    'sat75',
    'testOptional',
    'needBlindInternational',
  ];
  return {
    schools: schools.length,
    complete: schools.filter((school) =>
      fields.every((field) =>
        field === 'testOptional'
          ? school.testOptional != null || school.testingPolicy != null
          : school[field] != null,
      ),
    ).length,
    byField: Object.fromEntries(
      fields.map((field) => [
        field,
        schools.filter((school) =>
          field === 'testOptional'
            ? school.testOptional != null || school.testingPolicy != null
            : school[field] != null,
        ).length,
      ]),
    ),
  };
}

async function main() {
  const opts = parseArgs();
  const schools = await prisma.school.findMany({
    where: { country: { in: US_COUNTRIES } },
    select: {
      id: true,
      name: true,
      country: true,
      state: true,
      isPrivate: true,
      acceptanceRate: true,
      intlAcceptanceRate: true,
      oosAcceptanceRate: true,
      sat25: true,
      satAvg: true,
      sat75: true,
      act25: true,
      actAvg: true,
      act75: true,
      testOptional: true,
      testingPolicy: true,
      needBlindInternational: true,
      metadata: true,
    },
    orderBy: [{ usNewsRank: 'asc' }, { name: 'asc' }],
    take: opts.heuristicLimit,
  });

  console.log('Before heuristic fill');
  console.log(JSON.stringify(coverageTotals(schools), null, 2));

  const result = {
    dryRun: !opts.live,
    scanned: schools.length,
    updated: 0,
    skippedNoAnchor: 0,
    skippedNoChange: 0,
    changes: [] as Array<{
      schoolId: string;
      schoolName: string;
      changedFields: string[];
      after: Record<string, number>;
    }>,
  };

  for (const school of schools) {
    const overall = toPercent(school.acceptanceRate);
    if (overall == null) {
      result.skippedNoAnchor += 1;
      continue;
    }

    const updates: Record<string, number> = {};
    const changedFields: string[] = [];
    const canFill = (field: string, value: unknown) =>
      value == null || opts.forceHeuristic;

    if (canFill('intlAcceptanceRate', school.intlAcceptanceRate)) {
      updates.intlAcceptanceRate = deriveIntlRate(
        overall,
        school.needBlindInternational,
      );
      changedFields.push('intlAcceptanceRate');
    }

    if (canFill('oosAcceptanceRate', school.oosAcceptanceRate)) {
      updates.oosAcceptanceRate = deriveOosRate(
        overall,
        school.isPrivate,
        school.state,
      );
      changedFields.push('oosAcceptanceRate');
    }

    if (canFill('sat25', school.sat25) || canFill('sat75', school.sat75)) {
      const sat = deriveSatBand(overall);
      if (canFill('sat25', school.sat25)) {
        updates.sat25 = sat.sat25;
        changedFields.push('sat25');
      }
      if (canFill('satAvg', school.satAvg)) {
        updates.satAvg = sat.satAvg;
        changedFields.push('satAvg');
      }
      if (canFill('sat75', school.sat75)) {
        updates.sat75 = sat.sat75;
        changedFields.push('sat75');
      }
    }

    if (canFill('act25', school.act25) || canFill('act75', school.act75)) {
      const act = deriveActBand(overall);
      if (canFill('act25', school.act25)) {
        updates.act25 = act.act25;
        changedFields.push('act25');
      }
      if (canFill('actAvg', school.actAvg)) {
        updates.actAvg = act.actAvg;
        changedFields.push('actAvg');
      }
      if (canFill('act75', school.act75)) {
        updates.act75 = act.act75;
        changedFields.push('act75');
      }
    }

    if (changedFields.length === 0) {
      result.skippedNoChange += 1;
      continue;
    }

    result.updated += 1;
    result.changes.push({
      schoolId: school.id,
      schoolName: school.name,
      changedFields,
      after: updates,
    });

    if (opts.live) {
      const metadata = toRecord(school.metadata);
      const provenance = buildFieldProvenanceRecord(changedFields, {
        source: 'HEURISTIC:PR-15',
        verifiedBy: opts.actorUserId,
        confidence: 0.55,
        notes:
          'PR-15 heuristic fallback after official/public sources were unavailable. Replace with Scorecard/IPEDS/CDS/manual data when available.',
      });
      const nextMetadata = deepMergeRecords(metadata, {
        provenance: deepMergeRecords(toRecord(metadata.provenance), provenance),
      });
      await prisma.school.update({
        where: { id: school.id },
        data: {
          ...updates,
          metadata: nextMetadata as Prisma.InputJsonValue,
        },
      });
    }
  }

  const report = {
    generatedAt: new Date().toISOString(),
    mode: opts.live ? 'live' : 'dry-run',
    before: coverageTotals(schools),
    heuristicFill: result,
  };
  const out =
    opts.out ??
    path.join(
      process.cwd(),
      'scripts/coverage-reports',
      `data-pipeline-${opts.live ? 'live' : 'dry-run'}-${new Date()
        .toISOString()
        .slice(0, 10)}.json`,
    );
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, `${JSON.stringify(report, null, 2)}\n`);

  console.log('Heuristic fill');
  console.log(
    JSON.stringify(
      {
        dryRun: result.dryRun,
        scanned: result.scanned,
        updated: result.updated,
        skippedNoAnchor: result.skippedNoAnchor,
        skippedNoChange: result.skippedNoChange,
        sampleChanges: result.changes.slice(0, 10),
        fullReport: out,
      },
      null,
      2,
    ),
  );
  if (opts.printChanges) {
    console.log(JSON.stringify(result.changes, null, 2));
  }
  if (!opts.live) {
    console.log(
      'Dry run only. Re-run with --live to write heuristic fallback data.',
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
