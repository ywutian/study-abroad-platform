import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { ProfileBankService } from '../src/modules/prediction/benchmark/profile-bank.service';

type Args = {
  count: number;
  cohortTag: string;
  seed: number;
};

function parseArgs(): Args {
  const argv = process.argv.slice(2);
  const count = argv.find((arg) => arg.startsWith('--n='))?.split('=')[1];
  const cohortTag = argv
    .find((arg) => arg.startsWith('--cohort='))
    ?.split('=')[1];
  const seed = argv.find((arg) => arg.startsWith('--seed='))?.split('=')[1];

  return {
    count: count ? Number(count) : 200,
    cohortTag: cohortTag ?? 'distill-corpus-v1',
    seed: seed ? Number(seed) : 20260422,
  };
}

function printCounts(title: string, counts: Record<string, number>): void {
  console.log(`\n${title}:`);
  for (const [key, value] of Object.entries(counts).sort(([a], [b]) =>
    a.localeCompare(b),
  )) {
    console.log(`  ${key.padEnd(18)} ${value}`);
  }
}

async function main() {
  const args = parseArgs();
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  try {
    const service = app.get(ProfileBankService);
    const result = await service.syncProfiles({
      count: args.count,
      cohortTag: args.cohortTag,
      seed: args.seed,
    });

    const regimeCounts: Record<string, number> = {};
    const nationalityCounts: Record<string, number> = {};
    const gpaBucketCounts: Record<string, number> = {};

    for (const profile of result.profiles) {
      const testTypes = profile.profileJson.testScores
        .filter((score) => score.type === 'SAT' || score.type === 'ACT')
        .map((score) => score.type);
      const regime = testTypes[0] ?? 'TEST_OPTIONAL';
      regimeCounts[regime] = (regimeCounts[regime] ?? 0) + 1;

      const nationality = profile.profileJson.nationality ?? 'UNKNOWN';
      nationalityCounts[nationality] =
        (nationalityCounts[nationality] ?? 0) + 1;

      const gpa = profile.profileJson.gpa ?? 0;
      const bucketStart = Math.floor((gpa - 2.5) / 0.3) * 0.3 + 2.5;
      const bucketEnd = bucketStart + 0.3;
      const bucketLabel = `${bucketStart.toFixed(1)}-${bucketEnd.toFixed(1)}`;
      gpaBucketCounts[bucketLabel] = (gpaBucketCounts[bucketLabel] ?? 0) + 1;
    }

    console.log(
      `Synced ${result.profiles.length} profiles to cohort ${args.cohortTag} (created=${result.createdCount}, updated=${result.updatedCount}, deleted=${result.deletedCount}).`,
    );
    printCounts('Test regimes', regimeCounts);
    printCounts('Nationalities', nationalityCounts);
    printCounts('GPA buckets', gpaBucketCounts);
  } finally {
    await app.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
