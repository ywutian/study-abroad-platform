import { PrismaClient } from '@prisma/client';
import { serializeSchoolProvenance, toSchoolFieldSource } from '../packages/shared/src/utils';
import {
  SCHOOL_TOP_LEVEL_PROVENANCE_FIELDS,
  buildNormalizedSchoolProvenance,
  toRecord,
} from '../apps/api/src/modules/school/school-provenance.helpers';

const prisma = new PrismaClient();

interface CliOptions {
  apply: boolean;
  json: boolean;
  limit?: number;
  schoolId?: string;
}

interface BackfillReport {
  dryRun: boolean;
  scannedSchools: number;
  changedSchools: number;
  updatedSchools: number;
  fieldCount: number;
  tierCounts: Record<string, number>;
  sourceCounts: Record<string, number>;
  stalenessCounts: Record<string, number>;
  changedSchoolIds: string[];
}

function readOption(args: string[], key: string): string | undefined {
  const inline = args.find((arg) => arg.startsWith(`--${key}=`));
  if (inline) return inline.slice(key.length + 3);

  const index = args.indexOf(`--${key}`);
  if (index >= 0) {
    return args[index + 1];
  }

  return undefined;
}

function parseArgs(): CliOptions {
  const args = process.argv.slice(2);
  const limitRaw = readOption(args, 'limit');
  const schoolId = readOption(args, 'school-id');

  return {
    apply: args.includes('--apply'),
    json: args.includes('--json'),
    ...(limitRaw ? { limit: Number(limitRaw) } : {}),
    ...(schoolId ? { schoolId } : {}),
  };
}

function incrementCounter(counters: Record<string, number>, key: string | undefined): void {
  if (!key) return;
  counters[key] = (counters[key] ?? 0) + 1;
}

async function main(): Promise<void> {
  const options = parseArgs();
  const select = SCHOOL_TOP_LEVEL_PROVENANCE_FIELDS.reduce<Record<string, true>>(
    (acc, field) => {
      acc[field] = true;
      return acc;
    },
    {
      id: true,
      metadata: true,
      updatedAt: true,
      scorecardId: true,
      ipedsId: true,
    }
  );

  const schools = await prisma.school.findMany({
    where: options.schoolId ? { id: options.schoolId } : undefined,
    select,
    orderBy: { updatedAt: 'desc' },
    take: options.limit,
  });

  const report: BackfillReport = {
    dryRun: !options.apply,
    scannedSchools: schools.length,
    changedSchools: 0,
    updatedSchools: 0,
    fieldCount: 0,
    tierCounts: {},
    sourceCounts: {},
    stalenessCounts: {},
    changedSchoolIds: [],
  };

  for (const school of schools) {
    const metadata = toRecord(school.metadata);
    const nextProvenance = serializeSchoolProvenance(buildNormalizedSchoolProvenance(school));
    const currentProvenance = serializeSchoolProvenance(toRecord(metadata.provenance));
    const changed = JSON.stringify(nextProvenance) !== JSON.stringify(currentProvenance);

    if (changed) {
      report.changedSchools += 1;
      report.changedSchoolIds.push(school.id);
    }

    for (const entry of Object.values(nextProvenance)) {
      if (!entry) continue;
      const fieldSource = toSchoolFieldSource(entry);
      report.fieldCount += 1;
      incrementCounter(report.tierCounts, fieldSource.tier);
      incrementCounter(report.sourceCounts, fieldSource.source);
      incrementCounter(report.stalenessCounts, fieldSource.staleness);
    }

    if (!options.apply || !changed) {
      continue;
    }

    await prisma.school.update({
      where: { id: school.id },
      data: {
        metadata: {
          ...metadata,
          provenance: nextProvenance,
        },
      },
    });
    report.updatedSchools += 1;
  }

  if (options.json) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  console.log(`${options.apply ? 'APPLY' : 'DRY RUN'} school provenance backfill`);
  console.log(`Scanned schools: ${report.scannedSchools}`);
  console.log(`Changed schools: ${report.changedSchools}`);
  console.log(`Updated schools: ${report.updatedSchools}`);
  console.log(`Tracked fields: ${report.fieldCount}`);

  console.log('\nTier counts');
  for (const [tier, count] of Object.entries(report.tierCounts).sort()) {
    console.log(`  ${tier}: ${count}`);
  }

  console.log('\nSource counts');
  for (const [source, count] of Object.entries(report.sourceCounts).sort()) {
    console.log(`  ${source}: ${count}`);
  }

  console.log('\nStaleness counts');
  for (const [staleness, count] of Object.entries(report.stalenessCounts).sort()) {
    console.log(`  ${staleness}: ${count}`);
  }

  if (!options.apply) {
    console.log('\nDry run complete. Re-run with --apply to persist provenance.');
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
