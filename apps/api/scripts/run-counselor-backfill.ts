#!/usr/bin/env ts-node
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import {
  CounselorBackfillResult,
  CounselorBackfillService,
} from '../src/modules/prediction/counselor/counselor-backfill.service';
import { CounselorEngineModule } from '../src/modules/prediction/counselor/counselor-engine.module';

function parseArgs() {
  const args = process.argv.slice(2);
  const get = (name: string) => {
    const index = args.indexOf(`--${name}`);
    return index >= 0 ? args[index + 1] : undefined;
  };
  const has = (name: string) => args.includes(`--${name}`);

  return {
    dryRun: !has('live'),
    forceRecompute: has('force-recompute') || has('forceRecompute'),
    batchSize: Number(get('batch-size') ?? get('batchSize') ?? 1000),
    cursor: get('cursor') ?? null,
    maxBatches: Number(get('max-batches') ?? get('maxBatches') ?? 100),
  };
}

function emptyAggregate(dryRun: boolean): CounselorBackfillResult {
  return {
    dryRun,
    scanned: 0,
    updated: 0,
    skippedAlreadyCounselor: 0,
    skippedTier4: 0,
    skippedMissingProfile: 0,
    errors: [],
    cacheKeysDeleted: 0,
    nextCursor: null,
    durationMs: 0,
  };
}

function addResult(
  aggregate: CounselorBackfillResult,
  result: CounselorBackfillResult,
) {
  aggregate.scanned += result.scanned;
  aggregate.updated += result.updated;
  aggregate.skippedAlreadyCounselor += result.skippedAlreadyCounselor;
  aggregate.skippedTier4 += result.skippedTier4;
  aggregate.skippedMissingProfile += result.skippedMissingProfile;
  aggregate.errors.push(...result.errors);
  aggregate.cacheKeysDeleted += result.cacheKeysDeleted;
  aggregate.nextCursor = result.nextCursor;
  aggregate.durationMs += result.durationMs;
}

async function main() {
  const args = parseArgs();
  const app = await NestFactory.createApplicationContext(
    CounselorEngineModule,
    {
      logger: ['error', 'warn', 'log'],
    },
  );

  try {
    const service = app.get(CounselorBackfillService);
    const aggregate = emptyAggregate(args.dryRun);
    let cursor = args.cursor;
    let batch = 0;

    do {
      batch += 1;
      const result = await service.runBackfill({
        dryRun: args.dryRun,
        batchSize: args.batchSize,
        cursor,
        forceRecompute: args.forceRecompute,
      });
      addResult(aggregate, result);
      cursor = result.nextCursor;

      console.log(
        JSON.stringify(
          {
            batch,
            ...result,
          },
          null,
          2,
        ),
      );

      if (batch >= args.maxBatches && cursor) {
        aggregate.nextCursor = cursor;
        aggregate.errors.push({
          predictionResultId: '__backfill_cli__',
          reason: `Stopped after --max-batches=${args.maxBatches}; resume with --cursor ${cursor}`,
        });
        break;
      }
    } while (cursor);

    console.log('Counselor backfill aggregate:');
    console.log(JSON.stringify(aggregate, null, 2));

    if (aggregate.errors.length > 0) process.exitCode = 1;
  } finally {
    await app.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
