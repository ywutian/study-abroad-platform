import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { DistillationStatsRollupService } from '../src/modules/prediction/distillation/distillation-stats-rollup.service';

function parseArgs(argv: string[]) {
  const args = new Map<string, string>();
  for (const value of argv) {
    if (!value.startsWith('--')) continue;
    const [key, raw] = value.slice(2).split('=');
    args.set(key, raw ?? 'true');
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  try {
    const rollups = app.get(DistillationStatsRollupService);
    const endDate = args.get('end') ? new Date(args.get('end')!) : new Date();
    const startDate = args.get('start')
      ? new Date(args.get('start')!)
      : args.get('days')
        ? new Date(
            endDate.getTime() - Number(args.get('days')) * 24 * 60 * 60 * 1000,
          )
        : new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000);

    const result = await rollups.recomputeWindow({
      startDate,
      endDate,
      schoolId: args.get('schoolId') ?? undefined,
      cohortKey: args.get('cohortKey') ?? undefined,
    });

    console.log(
      JSON.stringify(
        {
          success: true,
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          schoolId: args.get('schoolId') ?? null,
          cohortKey: args.get('cohortKey') ?? null,
          ...result,
        },
        null,
        2,
      ),
    );
  } finally {
    await app.close();
  }
}

void main();
