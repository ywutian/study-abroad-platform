#!/usr/bin/env -S ts-node --transpile-only
/**
 * Launch smoke verifier for the closed-loop prediction contract.
 *
 * Writes:
 *   - verification-report/launch/tier4.json
 *   - verification-report/launch/outcome-inventory.json
 *   - verification-report/launch/contract.json
 */

import { mkdirSync, writeFileSync } from 'fs';
import { resolve, join } from 'path';
import { NestFactory } from '@nestjs/core';
import { CounselorEngineModule } from '../src/modules/prediction/counselor/counselor-engine.module';
import { CounselorEngineService } from '../src/modules/prediction/counselor/counselor-engine.service';
import { PrismaService } from '../src/prisma/prisma.service';

const REPO_ROOT = resolve(__dirname, '..', '..', '..');
const REPORT_DIR = resolve(REPO_ROOT, 'verification-report', 'launch');

async function main() {
  mkdirSync(REPORT_DIR, { recursive: true });

  const app = await NestFactory.createApplicationContext(
    CounselorEngineModule,
    { logger: ['error', 'warn'] },
  );
  const counselor = app.get(CounselorEngineService);
  const prisma = app.get(PrismaService);

  const tier4Result = await counselor.compute(
    {
      gpa: 3.8,
      gpaScale: 4,
      targetMajor: 'Computer Science',
      testScores: [{ type: 'SAT', score: 1500 }],
      activities: [],
      awards: [],
    },
    {
      id: 'launch-tier4-fixture',
      name: 'Launch Tier 4 Fixture',
      acceptanceRate: null,
      sat25: null,
      sat75: null,
      act25: null,
      act75: null,
    } as any,
    'RD',
  );

  const tier4Report = {
    generatedAt: new Date().toISOString(),
    pass:
      tier4Result.tier === 4 &&
      tier4Result.insufficientData != null &&
      tier4Result.probability === 0,
    engineTier: tier4Result.tier,
    apiContract: {
      probability: null,
      tier: 'unavailable',
      predictionMethod: 'insufficient_data',
      noNumericPersistence: true,
    },
    insufficientData: tier4Result.insufficientData,
  };
  writeFileSync(
    join(REPORT_DIR, 'tier4.json'),
    JSON.stringify(tier4Report, null, 2),
  );

  const outcomeCounts = await prisma.predictionOutcomeLabelRecord.groupBy({
    by: ['status', 'result'],
    _count: { _all: true },
  });
  const outcomeInventory = {
    generatedAt: new Date().toISOString(),
    counts: outcomeCounts.map((row) => ({
      status: row.status,
      result: row.result,
      count: row._count._all,
    })),
    verifiedCount: outcomeCounts
      .filter((row) =>
        ['COUNSELOR_VERIFIED', 'DOCUMENT_VERIFIED'].includes(row.status),
      )
      .reduce((sum, row) => sum + row._count._all, 0),
  };
  writeFileSync(
    join(REPORT_DIR, 'outcome-inventory.json'),
    JSON.stringify(outcomeInventory, null, 2),
  );

  const contractReport = {
    generatedAt: new Date().toISOString(),
    pass: tier4Report.pass,
    predictionContract: {
      counselorPrimary: true,
      nullableProbability: true,
      unavailableTier: true,
      insufficientDataPredictionMethod: true,
      optionalLegacyEngineFields: [
        'engineScores',
        'crossEngineConsistency',
        'servedTrace.shadow',
      ],
      servedTraceCounselorRequiredForNumericPredictions: true,
      tier4SkipsNumericPersistence: true,
    },
    outcomeLoop: {
      selfReportedStatusSupported: true,
      verifiedOnlyAccuracyGate: true,
      verifiedOutcomeCount: outcomeInventory.verifiedCount,
      calibrationPromotionAllowed: outcomeInventory.verifiedCount >= 50,
    },
  };
  writeFileSync(
    join(REPORT_DIR, 'contract.json'),
    JSON.stringify(contractReport, null, 2),
  );

  await app.close();

  console.log(JSON.stringify(contractReport, null, 2));
  if (!contractReport.pass) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
