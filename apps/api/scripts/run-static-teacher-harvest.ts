import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { DistillationService } from '../src/modules/prediction/benchmark/distillation.service';

type Args = {
  sourceKey: string;
  top: number;
  schoolIds?: string[];
};

function parseArgs(): Args {
  const argv = process.argv.slice(2);
  const sourceKey = argv
    .find((arg) => arg.startsWith('--source='))
    ?.split('=')[1];
  const top = argv.find((arg) => arg.startsWith('--top='))?.split('=')[1];
  const schoolIds = argv
    .find((arg) => arg.startsWith('--school-ids='))
    ?.split('=')[1];

  return {
    sourceKey: sourceKey ?? 'campusreel-static',
    top: top ? Number(top) : 50,
    schoolIds: schoolIds
      ?.split(',')
      .map((value) => value.trim())
      .filter(Boolean),
  };
}

async function main() {
  const args = parseArgs();
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  try {
    const service = app.get(DistillationService);
    const result = await service.harvestStaticTeacherSnapshots({
      sourceKey: args.sourceKey,
      top: args.top,
      schoolIds: args.schoolIds,
    });

    console.log(
      `Static teacher harvest complete for ${result.sourceKey}: processed=${result.processed}, success=${result.successCount}, failed=${result.failedCount}`,
    );

    for (const row of result.rows) {
      const status = row.status.padEnd(9);
      const slug = row.slug ?? '—';
      const error = row.errorMsg ? ` | ${row.errorMsg}` : '';
      console.log(`${status} ${row.schoolName} | ${slug}${error}`);
    }
  } finally {
    await app.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
