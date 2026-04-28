#!/usr/bin/env ts-node
import * as fs from 'node:fs';
import * as path from 'node:path';
import { Prisma, PrismaClient } from '@prisma/client';
import {
  buildNormalizedSchoolProvenance,
  toRecord,
} from '../src/modules/school/school-provenance.helpers';
import { toSchoolFieldSource } from '@study-abroad/shared/utils';

const prisma = new PrismaClient();

const US_COUNTRIES = ['US', 'United States', 'United States of America'];
const DEFAULT_REQUIRED = [
  'acceptanceRate',
  'intlAcceptanceRate',
  'sat25',
  'sat75',
  'testOptional',
  'needBlindInternational',
];
const OPTIONAL_FIELDS = [
  'oosAcceptanceRate',
  'satAvg',
  'act25',
  'actAvg',
  'act75',
];

function parseArgs() {
  const args = process.argv.slice(2);
  const get = (name: string) => {
    const index = args.indexOf(`--${name}`);
    return index >= 0 ? args[index + 1] : undefined;
  };
  const has = (name: string) => args.includes(`--${name}`);
  return {
    json: has('json'),
    includeAllCountries: has('include-all-countries'),
    allowMissing: has('allow-missing'),
    out: get('out'),
    required: (get('required') ?? DEFAULT_REQUIRED.join(','))
      .split(',')
      .map((field) => field.trim())
      .filter(Boolean),
  };
}

function valueFor(school: Record<string, any>, field: string) {
  if (field === 'testOptional') {
    if (school.testOptional != null) return school.testOptional;
    return school.testingPolicy !== 'UNKNOWN' ? school.testingPolicy : null;
  }
  const value = school[field];
  if (value instanceof Prisma.Decimal) return value.toNumber();
  return value ?? null;
}

async function main() {
  const opts = parseArgs();
  const schools = await prisma.school.findMany({
    where: opts.includeAllCountries
      ? undefined
      : { country: { in: US_COUNTRIES } },
    select: {
      id: true,
      name: true,
      nameZh: true,
      country: true,
      state: true,
      usNewsRank: true,
      scorecardId: true,
      ipedsId: true,
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
      updatedAt: true,
    },
    orderBy: [{ usNewsRank: 'asc' }, { name: 'asc' }],
  });

  const fields = [...new Set([...opts.required, ...OPTIONAL_FIELDS])];
  const fieldTotals: Record<
    string,
    { filled: number; missing: number; heuristic: number }
  > = {};
  for (const field of fields)
    fieldTotals[field] = { filled: 0, missing: 0, heuristic: 0 };

  const items = schools.map((school) => {
    const provenance = buildNormalizedSchoolProvenance(school as any);
    const missing: string[] = [];
    const heuristic: string[] = [];
    const fieldStatus = fields.map((field) => {
      const value = valueFor(school as any, field);
      const explicitUnknown =
        field === 'testOptional' &&
        value == null &&
        (school as any).testingPolicy === 'UNKNOWN';
      const filled = value != null || explicitUnknown;
      const source = provenance[field]
        ? toSchoolFieldSource(provenance[field]!)
        : null;
      if (filled) fieldTotals[field].filled += 1;
      else fieldTotals[field].missing += 1;
      const isHeuristic =
        source?.tier === 'INFERRED' ||
        Boolean(source?.source?.toUpperCase().includes('HEURISTIC'));
      if (isHeuristic) {
        fieldTotals[field].heuristic += 1;
        heuristic.push(field);
      }
      if (!filled && opts.required.includes(field)) missing.push(field);
      return {
        field,
        filled,
        value,
        source: source?.source ?? null,
        tier: source?.tier ?? null,
        staleness: source?.staleness ?? null,
        confidence: source?.confidence ?? null,
      };
    });
    return {
      schoolId: school.id,
      schoolName: school.name,
      country: school.country,
      usNewsRank: school.usNewsRank,
      missingRequired: missing,
      heuristicFields: heuristic,
      fields: fieldStatus,
    };
  });

  const report = {
    generatedAt: new Date().toISOString(),
    scope: opts.includeAllCountries ? 'all-schools' : 'us-freshman',
    requiredFields: opts.required,
    totals: {
      schools: schools.length,
      complete: items.filter((item) => item.missingRequired.length === 0)
        .length,
      missingRequired: items.filter((item) => item.missingRequired.length > 0)
        .length,
      heuristicSchools: items.filter((item) => item.heuristicFields.length > 0)
        .length,
    },
    fieldTotals,
    items,
  };

  const defaultOut = path.join(
    process.cwd(),
    'scripts/coverage-reports',
    `coverage-${new Date().toISOString().slice(0, 10)}.json`,
  );
  const out = opts.out ?? defaultOut;
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, `${JSON.stringify(report, null, 2)}\n`);

  if (opts.json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(`School data coverage (${report.scope})`);
    console.log(`Schools:          ${report.totals.schools}`);
    console.log(`Complete:         ${report.totals.complete}`);
    console.log(`Missing required: ${report.totals.missingRequired}`);
    console.log(`Heuristic-only:   ${report.totals.heuristicSchools}`);
    console.log(`Report:           ${out}`);
    for (const [field, total] of Object.entries(fieldTotals)) {
      const pct =
        schools.length > 0
          ? Math.round((total.filled / schools.length) * 1000) / 10
          : 0;
      console.log(
        `${field.padEnd(28)} ${String(total.filled).padStart(4)}/${schools.length} (${pct}%)  heuristic=${total.heuristic}`,
      );
    }
  }

  if (!opts.allowMissing && report.totals.missingRequired > 0) {
    console.error(
      `Coverage gate failed: ${report.totals.missingRequired} schools missing required fields.`,
    );
    process.exit(1);
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
