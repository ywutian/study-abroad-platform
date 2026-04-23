import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { BenchmarkService } from '../src/modules/prediction/benchmark/benchmark.service';
import { PrismaService } from '../src/prisma/prisma.service';

type Args = {
  profileId?: string;
  profileCohort?: string;
  sourceKey: string;
  limit?: number;
  maxProfiles?: number;
  headed?: boolean;
};

function parseArgs(): Args {
  const argv = process.argv.slice(2);
  const profileId = argv
    .find((arg) => arg.startsWith('--profile='))
    ?.split('=')[1];
  const profileCohort = argv
    .find((arg) => arg.startsWith('--profile-cohort='))
    ?.split('=')[1];
  const sourceKey = argv
    .find((arg) => arg.startsWith('--source='))
    ?.split('=')[1];
  const limit = argv.find((arg) => arg.startsWith('--limit='))?.split('=')[1];
  const maxProfiles = argv
    .find((arg) => arg.startsWith('--max-profiles='))
    ?.split('=')[1];
  return {
    profileId,
    profileCohort,
    sourceKey: sourceKey ?? '',
    limit: limit ? Number(limit) : undefined,
    maxProfiles: maxProfiles ? Number(maxProfiles) : undefined,
    headed: argv.includes('--headed'),
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function fmtProbability(value?: number | null): string {
  if (value == null) return '—';
  return `${(value * 100).toFixed(1)}%`;
}

async function runSingleProfile(
  service: BenchmarkService,
  input: {
    profileId: string;
    profileLabel: string;
    sourceKey: string;
    limit?: number;
    headed?: boolean;
  },
) {
  const run = await service.startRun({
    profileId: input.profileId,
    sourceKey: input.sourceKey,
    limit: input.limit,
    headed: input.headed,
  });

  console.log(`\nRun: ${run.id}`);
  console.log(`Profile: ${run.profileLabel}`);
  console.log(`Source: ${run.sourceLabel} (${run.sourceKey})`);

  let detail = await service.getRunDetail(run.id);
  while (detail.status === 'PENDING' || detail.status === 'RUNNING') {
    console.log(
      `Status: ${detail.status} | processed=${detail.processedCount} | success=${detail.successCount} | error=${detail.errorCount}`,
    );
    await sleep(2_000);
    detail = await service.getRunDetail(run.id);
  }

  console.log(
    `Final status: ${detail.status} | processed=${detail.processedCount} | success=${detail.successCount} | error=${detail.errorCount}`,
  );

  const report = await service.buildReport(run.id);
  console.log('\nPer-school comparison:');
  for (const row of report.rows) {
    const schoolLabel = row.school?.name ?? row.rawSchoolName;
    console.log(
      `${schoolLabel.padEnd(42)} ours=${fmtProbability(row.oursProbability)} theirs=${fmtProbability(
        row.theirsProbability,
      )} delta=${row.delta != null ? `${(row.delta * 100).toFixed(1)}pp` : '—'} status=${row.matchStatus}`,
    );
  }

  console.log('\nSummary:');
  console.log(`  matched schools:        ${report.summary.matchedCount}`);
  console.log(
    `  with probabilities:     ${report.summary.matchedProbabilityCount}`,
  );
  console.log(`  tier-only rows:         ${report.summary.tierOnlyCount}`);
  console.log(`  coverage gaps:          ${report.summary.coverageGapCount}`);
  console.log(
    `  MAE:                    ${report.summary.mae != null ? `${(report.summary.mae * 100).toFixed(2)}pp` : '—'}`,
  );
  console.log(
    `  tier agreement:         ${
      report.summary.tierAgreementRate != null
        ? `${(report.summary.tierAgreementRate * 100).toFixed(1)}%`
        : '—'
    }`,
  );

  return detail.status;
}

async function main() {
  const args = parseArgs();
  if ((!args.profileId && !args.profileCohort) || !args.sourceKey) {
    console.error(
      'Usage: pnpm --filter api benchmark:run (--profile=<id> | --profile-cohort=<tag>) --source=<key> [--limit=N] [--max-profiles=N] [--headed]',
    );
    process.exit(1);
  }

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  try {
    const service = app.get(BenchmarkService);
    const prisma = app.get(PrismaService);

    if (args.profileCohort) {
      const profiles = await prisma.benchmarkProfile.findMany({
        where: { cohortTag: args.profileCohort },
        select: { id: true, label: true },
        orderBy: { label: 'asc' },
        take: args.maxProfiles,
      });

      if (profiles.length === 0) {
        console.error(
          `No benchmark profiles found for cohort ${args.profileCohort}.`,
        );
        process.exit(1);
      }

      console.log(
        `Running ${profiles.length} benchmark profile(s) from cohort ${args.profileCohort}.`,
      );

      for (const profile of profiles) {
        const status = await runSingleProfile(service, {
          profileId: profile.id,
          profileLabel: profile.label,
          sourceKey: args.sourceKey,
          limit: args.limit,
          headed: args.headed,
        });
        if (status === 'FAILED') {
          process.exitCode = 1;
        }
      }
    } else if (args.profileId) {
      const status = await runSingleProfile(service, {
        profileId: args.profileId,
        profileLabel: args.profileId,
        sourceKey: args.sourceKey,
        limit: args.limit,
        headed: args.headed,
      });

      if (status === 'FAILED') {
        process.exitCode = 1;
      }
    }
  } finally {
    await app.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
