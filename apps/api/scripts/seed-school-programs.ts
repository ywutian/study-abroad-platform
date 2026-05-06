#!/usr/bin/env tsx
/**
 * Seed broad-discipline SchoolProgram rows for schools without program data.
 *
 * These rows are explicitly heuristic fallback data, not real program admit
 * rates. They make counselor major modifiers serviceable while official
 * program-level admit rates continue to override them when available.
 */
import 'dotenv/config';

import { Prisma, PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface ProgramSeed {
  cipCode: string;
  programName: string;
  bandRates: {
    verySelective: number;
    selective: number;
    broadAccess: number;
  };
}

const CORE_PROGRAMS: ProgramSeed[] = [
  {
    cipCode: '11.0101',
    programName: 'Computer Science',
    bandRates: { verySelective: 50, selective: 60, broadAccess: 80 },
  },
  {
    cipCode: '52.0201',
    programName: 'Business Administration',
    bandRates: { verySelective: 70, selective: 80, broadAccess: 90 },
  },
  {
    cipCode: '14.0101',
    programName: 'Engineering',
    bandRates: { verySelective: 60, selective: 70, broadAccess: 85 },
  },
  {
    cipCode: '26.0101',
    programName: 'Biology / Pre-Med Track',
    bandRates: { verySelective: 75, selective: 85, broadAccess: 95 },
  },
  {
    cipCode: '42.0101',
    programName: 'Psychology / Liberal Arts',
    bandRates: { verySelective: 90, selective: 95, broadAccess: 100 },
  },
  {
    cipCode: '51.3801',
    programName: 'Nursing',
    bandRates: { verySelective: 40, selective: 50, broadAccess: 70 },
  },
  {
    cipCode: '50.0701',
    programName: 'Fine and Studio Arts',
    bandRates: { verySelective: 80, selective: 90, broadAccess: 100 },
  },
];

function parseArgs() {
  const args = process.argv.slice(2);
  const get = (name: string, fallback?: string) => {
    const index = args.indexOf(`--${name}`);
    if (index >= 0 && args[index + 1]) return args[index + 1];
    const inline = args.find((arg) => arg.startsWith(`--${name}=`));
    return inline ? inline.slice(name.length + 3) : fallback;
  };
  return {
    dryRun: args.includes('--dry-run'),
    overwriteHeuristic: args.includes('--overwrite-heuristic'),
    limit: Number(get('limit', '120')),
    includeAll: args.includes('--all'),
  };
}

async function main() {
  const args = parseArgs();
  const schools = await prisma.school.findMany({
    where: { country: { in: ['US', 'United States'] } },
    orderBy: [{ usNewsRank: { sort: 'asc', nulls: 'last' } }, { name: 'asc' }],
    take: args.includeAll ? undefined : args.limit,
    select: {
      id: true,
      name: true,
      acceptanceRate: true,
      metadata: true,
      _count: { select: { programs: true } },
      programs: {
        select: {
          cipCode: true,
          acceptanceRateEstimate: true,
          medianEarnings: true,
        },
      },
    },
  });

  let created = 0;
  let updated = 0;
  let skippedOfficial = 0;
  let schoolsTouched = 0;

  for (const school of schools) {
    const provenance = provenanceFor(school.metadata);
    const hasOfficialProgramRates =
      provenance?.realDataStatus === 'VERIFIED_REAL' ||
      provenance?.realDataStatus === 'OFFICIAL_REAL_LEGACY';
    if (hasOfficialProgramRates && !args.overwriteHeuristic) {
      skippedOfficial += 1;
      continue;
    }

    const existing = new Set(school.programs.map((program) => program.cipCode));
    const rows = CORE_PROGRAMS.filter(
      (program) => args.overwriteHeuristic || !existing.has(program.cipCode),
    );
    if (!rows.length) continue;

    schoolsTouched += 1;
    const admitRate = decimal(school.acceptanceRate);
    const band = selectivityBand(admitRate);

    if (!args.dryRun) {
      for (const program of rows) {
        const relativeRate = program.bandRates[band];
        const effectiveRate =
          admitRate == null
            ? null
            : Math.max(1, Math.min(95, (admitRate * relativeRate) / 100));
        const data = {
          schoolId: school.id,
          cipCode: program.cipCode,
          programName: program.programName,
          competitiveness: competitivenessFor(relativeRate),
          acceptanceRateEstimate:
            effectiveRate == null
              ? null
              : new Prisma.Decimal(round2(effectiveRate)),
        };
        const result = await prisma.schoolProgram.upsert({
          where: {
            schoolId_cipCode: {
              schoolId: school.id,
              cipCode: program.cipCode,
            },
          },
          create: data,
          update: args.overwriteHeuristic
            ? {
                programName: data.programName,
                competitiveness: data.competitiveness,
                acceptanceRateEstimate: data.acceptanceRateEstimate,
              }
            : {},
        });
        if (existing.has(result.cipCode)) updated += 1;
        else created += 1;
      }

      await prisma.school.update({
        where: { id: school.id },
        data: {
          metadata: await mergedMetadata(school.id, {
            provenance: {
              programRates: {
                realDataStatus: 'HEURISTIC_FILL',
                source: 'HEURISTIC_PROGRAM_SELECTIVITY_TABLE',
                confidence: 'LOW',
                tier: 'INFERRED',
                reason:
                  'No official program-level admit rates available; broad-discipline selectivity multipliers seeded for counselor fallback.',
                programCount: CORE_PROGRAMS.length,
                selectivityBand: band,
                formula:
                  'program acceptanceRateEstimate = school acceptanceRate × broad-discipline relative selectivity factor',
                verifiedAt: new Date().toISOString(),
                generatedBy: 'seed-school-programs',
              },
            },
          }),
        },
      });
    } else {
      created += rows.filter(
        (program) => !existing.has(program.cipCode),
      ).length;
      updated += args.overwriteHeuristic
        ? rows.filter((program) => existing.has(program.cipCode)).length
        : 0;
    }

    console.log(
      `${school.name}: ${rows.length} heuristic program rows (${band})`,
    );
  }

  console.log('\nSchoolProgram heuristic seeding');
  console.log('───────────────────────────────');
  console.log(`mode: ${args.dryRun ? 'DRY-RUN' : 'LIVE'}`);
  console.log(`schools touched: ${schoolsTouched}`);
  console.log(`created: ${created}`);
  console.log(`updated: ${updated}`);
  console.log(`skipped official: ${skippedOfficial}`);
}

function selectivityBand(
  admitRate: number | null,
): keyof ProgramSeed['bandRates'] {
  if (admitRate == null) return 'selective';
  if (admitRate < 10) return 'verySelective';
  if (admitRate < 30) return 'selective';
  return 'broadAccess';
}

function competitivenessFor(relativeRate: number) {
  if (relativeRate <= 50) return 5;
  if (relativeRate <= 70) return 4;
  if (relativeRate <= 85) return 3;
  if (relativeRate <= 95) return 2;
  return 1;
}

function provenanceFor(metadata: Prisma.JsonValue | null) {
  if (!isRecord(metadata) || !isRecord(metadata.provenance)) return null;
  const entry = metadata.provenance.programRates;
  return isRecord(entry) ? entry : null;
}

async function mergedMetadata(
  schoolId: string,
  patch: Record<string, unknown>,
) {
  const school = await prisma.school.findUnique({
    where: { id: schoolId },
    select: { metadata: true },
  });
  return deepMerge(isRecord(school?.metadata) ? school.metadata : {}, patch);
}

function deepMerge(
  base: Record<string, unknown>,
  patch: Record<string, unknown>,
): Prisma.JsonObject {
  const out: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(patch)) {
    if (isRecord(out[key]) && isRecord(value)) {
      out[key] = deepMerge(out[key] as Record<string, unknown>, value);
    } else {
      out[key] = value;
    }
  }
  return out as Prisma.JsonObject;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function decimal(value: Prisma.Decimal | null) {
  return value == null ? null : value.toNumber();
}

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
