#!/usr/bin/env ts-node
/**
 * Import official school-level program / broad-discipline admit rates.
 *
 * Current primary source: UCOP Freshman admission by discipline dashboard.
 * These rows power the counselor major-selectivity modifier through
 * SchoolProgram.acceptanceRateEstimate.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { Prisma, PrismaClient } from '@prisma/client';

function loadDotEnv() {
  for (const file of [
    path.join(process.cwd(), '.env'),
    path.join(process.cwd(), 'apps/api/.env'),
  ]) {
    if (!fs.existsSync(file)) continue;
    for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const match = /^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/.exec(trimmed);
      if (!match || process.env[match[1]] != null) continue;
      process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, '');
    }
  }
}

loadDotEnv();
const prisma = new PrismaClient();

interface ProgramRateRecord {
  schoolName: string;
  campusCode?: string;
  cycleYear?: number;
  source: string;
  sourceUrl: string;
  tableauUrl?: string;
  officialNote?: string;
  broadDiscipline?: string;
  programName: string;
  cipCode: string;
  applicants?: number;
  admits?: number;
  acceptanceRateEstimate: number;
  formula?: string;
  admitGpaRange25To75?: string;
  enrolleeGpaRange25To75?: string;
  yieldRate?: number | null;
  verification?: {
    realDataStatus?: string;
    sourceType?: string;
    validatorCount?: number;
    validators?: string[];
    verifiedAt?: string;
  };
}

interface ProgramRateFile {
  _meta?: Record<string, unknown>;
  programRates?: ProgramRateRecord[];
}

function parseArgs() {
  const args = process.argv.slice(2);
  const get = (name: string) => {
    const index = args.indexOf(`--${name}`);
    return index >= 0 ? args[index + 1] : undefined;
  };
  const has = (name: string) => args.includes(`--${name}`);
  return {
    input:
      get('input') ??
      'scripts/cds-data/program-rates-official-ucop-2026-04-30.json',
    live: has('live'),
  };
}

function normalizeName(value: string) {
  return value
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function deepMerge(
  left: Record<string, unknown>,
  right: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...left };
  for (const [key, value] of Object.entries(right)) {
    if (isRecord(value) && isRecord(out[key])) {
      out[key] = deepMerge(out[key] as Record<string, unknown>, value);
    } else {
      out[key] = value;
    }
  }
  return out;
}

function normalizePct(value: number) {
  if (!Number.isFinite(value) || value <= 0 || value > 100) return null;
  return Math.round(value * 100) / 100;
}

function competitivenessForRate(ratePct: number) {
  if (ratePct < 10) return 5;
  if (ratePct < 20) return 4;
  if (ratePct < 40) return 3;
  if (ratePct < 70) return 2;
  return 1;
}

function loadRows(input: string): ProgramRateRecord[] {
  const fullPath = path.isAbsolute(input)
    ? input
    : path.join(process.cwd(), input);
  const parsed = JSON.parse(
    fs.readFileSync(fullPath, 'utf8'),
  ) as ProgramRateFile;
  if (!Array.isArray(parsed.programRates)) {
    throw new Error(`No programRates array found in ${fullPath}`);
  }
  return parsed.programRates;
}

async function main() {
  const args = parseArgs();
  const rows = loadRows(args.input);
  const schools = await prisma.school.findMany({
    select: { id: true, name: true, metadata: true },
  });
  const byName = new Map(
    schools.map((school) => [normalizeName(school.name), school]),
  );

  let matched = 0;
  let notFound = 0;
  let upserts = 0;
  const errors: string[] = [];
  const bySchoolPatch = new Map<
    string,
    {
      school: (typeof schools)[number];
      records: ProgramRateRecord[];
    }
  >();

  for (const row of rows) {
    const school = byName.get(normalizeName(row.schoolName));
    if (!school) {
      notFound += 1;
      errors.push(`School not found: ${row.schoolName}`);
      continue;
    }
    const rate = normalizePct(row.acceptanceRateEstimate);
    if (rate == null) {
      errors.push(
        `Invalid rate for ${row.schoolName} / ${row.programName}: ${row.acceptanceRateEstimate}`,
      );
      continue;
    }
    if (!row.cipCode || !row.programName || !row.sourceUrl) {
      errors.push(
        `Missing required fields for ${row.schoolName} / ${row.programName}`,
      );
      continue;
    }
    matched += 1;
    upserts += 1;

    if (args.live) {
      await prisma.schoolProgram.upsert({
        where: {
          schoolId_cipCode: {
            schoolId: school.id,
            cipCode: row.cipCode,
          },
        },
        create: {
          schoolId: school.id,
          cipCode: row.cipCode,
          programName: row.programName,
          competitiveness: competitivenessForRate(rate),
          acceptanceRateEstimate: new Prisma.Decimal(rate),
        },
        update: {
          programName: row.programName,
          competitiveness: competitivenessForRate(rate),
          acceptanceRateEstimate: new Prisma.Decimal(rate),
        },
      });
    }

    const patch = bySchoolPatch.get(school.id) ?? { school, records: [] };
    patch.records.push(row);
    bySchoolPatch.set(school.id, patch);
  }

  if (args.live) {
    for (const { school, records } of bySchoolPatch.values()) {
      const oldMeta = isRecord(school.metadata) ? school.metadata : {};
      const oldProvenance = isRecord(oldMeta.provenance)
        ? oldMeta.provenance
        : {};
      const recordSummary = Object.fromEntries(
        records.map((record) => [
          record.cipCode,
          {
            programName: record.programName,
            broadDiscipline: record.broadDiscipline ?? null,
            acceptanceRateEstimate: normalizePct(record.acceptanceRateEstimate),
            applicants: record.applicants ?? null,
            admits: record.admits ?? null,
            formula: record.formula ?? null,
          },
        ]),
      );
      const first = records[0];
      const metadata = deepMerge(oldMeta, {
        provenance: deepMerge(oldProvenance, {
          programRates: {
            source: first.source,
            tier: 'OFFICIAL',
            realDataStatus:
              first.verification?.realDataStatus ?? 'VERIFIED_REAL',
            sourceType:
              first.verification?.sourceType ?? 'OFFICIAL_PROGRAM_DASHBOARD',
            confidence: 0.9,
            validatorCount: first.verification?.validatorCount ?? 2,
            validators: first.verification?.validators ?? [
              'official_source_url',
              'admits_div_applicants_formula',
            ],
            cycleYear: first.cycleYear ?? null,
            sourceUrl: first.sourceUrl,
            tableauUrl: first.tableauUrl ?? null,
            verifiedAt:
              first.verification?.verifiedAt ?? new Date().toISOString(),
            reason:
              first.officialNote ??
              'Official program or broad-discipline admit rates imported for major selectivity.',
            records: recordSummary,
          },
        }),
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
        dryRun: !args.live,
        input: args.input,
        rows: rows.length,
        matched,
        notFound,
        upserts,
        schoolsWithProgramRates: bySchoolPatch.size,
        errors: errors.slice(0, 30),
      },
      null,
      2,
    ),
  );
  if (errors.length > 30)
    console.log(`... and ${errors.length - 30} more errors`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
