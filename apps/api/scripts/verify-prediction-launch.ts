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
import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { InstitutionType } from '@prisma/client';
import { RedisService } from '../src/common/redis/redis.service';
import { FeatureFlagService } from '../src/common/feature-flags/feature-flag.service';
import { PointsService } from '../src/modules/points/incentive.service';
import { CounselorEngineModule } from '../src/modules/prediction/counselor/counselor-engine.module';
import { CounselorEngineService } from '../src/modules/prediction/counselor/counselor-engine.service';
import { CompliantDistillationService } from '../src/modules/prediction/distillation/compliant-distillation.service';
import { DistillationObservationService } from '../src/modules/prediction/distillation/distillation-observation.service';
import { PredictionAiEngine } from '../src/modules/prediction/prediction-ai-engine.service';
import { PredictionCacheService } from '../src/modules/prediction/prediction-cache.service';
import { PredictionCalibrationService } from '../src/modules/prediction/prediction-calibration.service';
import { PredictionFusionEngine } from '../src/modules/prediction/prediction-fusion-engine.service';
import { PredictionHistoricalService } from '../src/modules/prediction/prediction-historical.service';
import { PredictionMemoryService } from '../src/modules/prediction/prediction-memory.service';
import { PredictionService } from '../src/modules/prediction/prediction.service';
import { PredictionPersistenceService } from '../src/modules/prediction/prediction-persistence.service';
import { PredictionPolicyService } from '../src/modules/prediction/prediction-policy.service';
import { PredictionReportingService } from '../src/modules/prediction/prediction-reporting.service';
import { PredictionStatisticalEngine } from '../src/modules/prediction/prediction-statistical-engine.service';
import { PredictionTransformerService } from '../src/modules/prediction/prediction-transformer.service';
import { PrismaService } from '../src/prisma/prisma.service';

const REPO_ROOT = resolve(__dirname, '..', '..', '..');
const REPORT_DIR = resolve(REPO_ROOT, 'verification-report', 'launch');
const AUDITION_OR_PORTFOLIO_TYPES = [
  InstitutionType.ART_DESIGN,
  InstitutionType.MUSIC_CONSERVATORY,
];

async function main() {
  mkdirSync(REPORT_DIR, { recursive: true });

  // IMPORTANT: this script must be run via `ts-node --transpile-only` (the
  // npm alias `pnpm --filter api verify:prediction-launch`). Running it via
  // `tsx` strips constructor parameter metadata, so PredictionService gets
  // `private prisma: PrismaService` injected as `undefined` and previewPredict
  // crashes on `this.prisma.school.findMany`. PrismaModule is `@Global()`
  // and pulled in transitively by CounselorEngineModule under ts-node.
  const moduleRef = await Test.createTestingModule({
    imports: [CounselorEngineModule],
    providers: [
      PredictionService,
      PredictionTransformerService,
      PredictionPersistenceService,
      PredictionPolicyService,
      PredictionReportingService,
      {
        provide: RedisService,
        useValue: { setNX: async () => true, del: async () => undefined },
      },
      {
        provide: PredictionStatisticalEngine,
        useValue: { predictWithStats: async () => null },
      },
      {
        provide: PredictionAiEngine,
        useValue: { predictWithAI: async () => null },
      },
      {
        provide: PredictionFusionEngine,
        useValue: { fusePredictions: async () => null },
      },
      {
        provide: PredictionCacheService,
        useValue: {
          hashProfileData: () => 'launch-smoke-profile-hash',
          getFromCache: async () => null,
          saveToCache: async () => undefined,
          invalidateUserCache: async () => undefined,
        },
      },
      {
        provide: PredictionCalibrationService,
        useValue: {
          getPlattCalibration: async () => null,
          getSchoolCalibrations: async () => ({}),
          invalidateCalibrationCache: async () => undefined,
          applyPlattCalibration: (probability: number) => probability,
        },
      },
      {
        provide: PredictionHistoricalService,
        useValue: {
          getSchoolDistribution: async () => null,
          getHistoricalProbability: async () => null,
          getNationalityStats: async () => null,
          getFeederSignal: async () => null,
        },
      },
      {
        provide: PredictionMemoryService,
        useValue: {
          getMemoryContext: async () => ({
            previousPredictions: [],
            knownPreferences: [],
            profileInsights: [],
            memoryAdjustments: new Map(),
          }),
          recordPredictionToMemory: async () => undefined,
          recordBridgePredictionToMemory: async () => undefined,
        },
      },
      {
        provide: PointsService,
        useValue: { charge: async () => ({ success: true }) },
      },
      {
        provide: FeatureFlagService,
        useValue: { isEnabled: async () => false },
      },
      { provide: CompliantDistillationService, useValue: {} },
      {
        provide: DistillationObservationService,
        useValue: { record: async () => undefined },
      },
    ],
  }).compile();

  const prisma = moduleRef.get(PrismaService);
  const prediction = moduleRef.get(PredictionService);
  const reporting = moduleRef.get(PredictionReportingService);
  const persistence = moduleRef.get(PredictionPersistenceService);

  const numericSchool = await prisma.school.findFirst({
    where: {
      country: 'US',
      acceptanceRate: { not: null },
      OR: [
        { institutionType: null },
        { institutionType: { notIn: AUDITION_OR_PORTFOLIO_TYPES } },
      ],
    },
    orderBy: { name: 'asc' },
  });
  if (!numericSchool) {
    throw new Error('No numeric US school fixture available for launch smoke');
  }

  const numericPreview = await prediction.previewPredict(
    {
      gpa: 3.8,
      gpaScale: 4,
      targetMajor: 'Computer Science',
      testScores: [{ type: 'SAT', score: 1500 }],
      activities: [
        { name: 'Research', category: 'ACADEMIC', role: 'Researcher' },
        { name: 'Robotics', category: 'STEM', role: 'Team member' },
      ],
      awards: [],
    },
    [numericSchool.id],
    {
      applicationRound: 'RD',
      counselorMode: true,
      includeServedTrace: true,
      locale: 'en',
    },
  );
  const numericResult = numericPreview.results[0] as any;
  const numericFixture = {
    schoolId: numericSchool.id,
    schoolName: numericSchool.name,
    pass:
      numericResult != null &&
      Number.isFinite(numericResult.probability) &&
      numericResult.predictionMethod === 'counselor' &&
      numericResult.engineScores == null &&
      numericResult.crossEngineConsistency == null &&
      numericResult.servedTrace?.engine === 'counselor' &&
      numericResult.servedTrace?.shadow == null,
    probability: numericResult?.probability ?? null,
    predictionMethod: numericResult?.predictionMethod,
    hasEngineScores: numericResult?.engineScores != null,
    hasCrossEngineConsistency: numericResult?.crossEngineConsistency != null,
    hasServedTraceShadow: numericResult?.servedTrace?.shadow != null,
  };

  let createdTier4FixtureId: string | null = null;
  let artOrMusicSchool = await prisma.school.findFirst({
    where: {
      country: 'US',
      institutionType: { in: AUDITION_OR_PORTFOLIO_TYPES },
    },
    orderBy: { name: 'asc' },
  });
  if (!artOrMusicSchool) {
    artOrMusicSchool = await prisma.school.upsert({
      where: { nameNorm: 'launch smoke art portfolio fixture' },
      update: {
        institutionType: InstitutionType.ART_DESIGN,
        acceptanceRate: 19,
        country: 'US',
      },
      create: {
        name: 'Launch Smoke Art Portfolio Fixture',
        nameNorm: 'launch smoke art portfolio fixture',
        country: 'US',
        institutionType: InstitutionType.ART_DESIGN,
        acceptanceRate: 19,
      },
    });
    createdTier4FixtureId = artOrMusicSchool.id;
  }

  const tier4Preview = await prediction.previewPredict(
    {
      gpa: 3.8,
      gpaScale: 4,
      targetMajor: 'Computer Science',
      testScores: [{ type: 'SAT', score: 1500 }],
      activities: [],
      awards: [],
    },
    [artOrMusicSchool.id],
    {
      applicationRound: 'RD',
      counselorMode: true,
      includeServedTrace: true,
      locale: 'en',
    },
  );
  const tier4Result = tier4Preview.results[0] as any;

  const skippedRefs = await persistence.savePrediction(
    'launch-tier4-profile-fixture',
    'launch-tier4-school-fixture',
    {
      schoolId: 'launch-tier4-school-fixture',
      schoolName: 'Launch Tier 4 Fixture',
      probability: null,
      confidence: 'low',
      tier: 'unavailable',
      factors: [],
      suggestions: [],
      modelVersion: 'launch-smoke',
      predictionMethod: 'insufficient_data',
      sourceSummary: [{ label: 'Insufficient data' }],
      uncertaintyReasons: ['Limited public data'],
      insufficientData: { tier: 4, reason: 'launch_smoke' },
    } as any,
  );
  const skippedPersistenceRow = await prisma.predictionResult.findFirst({
    where: {
      profileId: 'launch-tier4-profile-fixture',
      schoolId: 'launch-tier4-school-fixture',
    },
  });

  const persistenceFixture = {
    pass:
      skippedRefs.predictionResultId == null &&
      skippedRefs.predictionSnapshotId == null &&
      skippedPersistenceRow == null,
    skippedRefs,
    rowExists: skippedPersistenceRow != null,
  };

  const tier4Report = {
    generatedAt: new Date().toISOString(),
    schoolId: artOrMusicSchool.id,
    schoolName: artOrMusicSchool.name,
    pass:
      tier4Result != null &&
      tier4Result.probability === null &&
      tier4Result.tier === 'unavailable' &&
      tier4Result.predictionMethod === 'insufficient_data' &&
      tier4Result.insufficientData != null &&
      persistenceFixture.pass,
    apiContract: {
      probability: tier4Result?.probability,
      tier: tier4Result?.tier,
      predictionMethod: tier4Result?.predictionMethod,
      noNumericPersistence: persistenceFixture.pass,
    },
    insufficientData: tier4Result?.insufficientData,
    persistenceFixture,
  };
  writeFileSync(
    join(REPORT_DIR, 'tier4.json'),
    JSON.stringify(tier4Report, null, 2),
  );

  const outcomeCounts = await prisma.predictionOutcomeLabelRecord.groupBy({
    by: ['status', 'result'],
    _count: { _all: true },
  });
  const verifiedCount = outcomeCounts
    .filter((row) =>
      ['COUNSELOR_VERIFIED', 'DOCUMENT_VERIFIED'].includes(row.status),
    )
    .reduce((sum, row) => sum + row._count._all, 0);
  const outcomeInventory = {
    generatedAt: new Date().toISOString(),
    counts: outcomeCounts.map((row) => ({
      status: row.status,
      result: row.result,
      count: row._count._all,
    })),
    verifiedCount,
    calibrationPromotionAllowed: verifiedCount >= 50,
    externalAccuracyClaimAllowed: verifiedCount >= 200,
  };
  writeFileSync(
    join(REPORT_DIR, 'outcome-inventory.json'),
    JSON.stringify(outcomeInventory, null, 2),
  );

  const launchId = `launch-smoke-${Date.now()}`;
  const userId = `${launchId}-user`;
  const profileId = `${launchId}-profile`;
  const predictionResultId = `${launchId}-prediction`;
  let outcomeFixture = {
    pass: false,
    createSelfReport: false,
    duplicateUpdatesExisting: false,
    verifiedOverridesSelfReport: false,
    missingNumericPredictionRejected: false,
  };

  try {
    await prisma.user.create({
      data: {
        id: userId,
        email: `${launchId}@launch.local`,
        passwordHash: 'launch-smoke',
      },
    });
    await prisma.profile.create({
      data: {
        id: profileId,
        userId,
        gpa: 3.8,
        gpaScale: 4,
        targetMajor: 'Computer Science',
      },
    });
    await prisma.predictionResult.create({
      data: {
        id: predictionResultId,
        profileId,
        schoolId: numericSchool.id,
        probability: 0.42,
        probabilityLow: 0.35,
        probabilityHigh: 0.49,
        factors: [],
        suggestions: [],
        modelVersion: 'launch-smoke',
        tier: 'match',
        confidence: 'medium',
        source: 'prediction',
        authority: 'AUTHORITATIVE',
        servedTrace: { engine: 'counselor' },
        sourceSummary: [{ label: 'Launch smoke' }],
        uncertaintyReasons: [],
      },
    });

    await reporting.reportActualResult(
      profileId,
      numericSchool.id,
      'ADMITTED',
      {
        round: 'RD',
        isFinal: true,
        notes: 'launch smoke create',
      },
    );
    const afterCreate = await prisma.predictionOutcomeLabelRecord.findMany({
      where: { predictionResultId, status: 'SELF_REPORTED' },
      orderBy: { createdAt: 'asc' },
    });
    const createSelfReport =
      afterCreate.length === 1 &&
      afterCreate[0].result === 'ADMITTED' &&
      afterCreate[0].round === 'RD' &&
      afterCreate[0].isFinal === true;

    await reporting.reportActualResult(
      profileId,
      numericSchool.id,
      'WAITLISTED',
      {
        round: 'EA',
        isFinal: false,
        notes: 'launch smoke update',
      },
    );
    const afterUpdate = await prisma.predictionOutcomeLabelRecord.findMany({
      where: { predictionResultId, status: 'SELF_REPORTED' },
      orderBy: { createdAt: 'asc' },
    });
    const duplicateUpdatesExisting =
      afterUpdate.length === 1 &&
      afterUpdate[0].id === afterCreate[0].id &&
      afterUpdate[0].result === 'WAITLISTED' &&
      afterUpdate[0].round === 'EA';

    await prisma.predictionOutcomeLabelRecord.create({
      data: {
        predictionResultId,
        result: 'REJECTED',
        status: 'DOCUMENT_VERIFIED',
        round: 'RD',
        isFinal: true,
        reportedBy: profileId,
        resolvedAt: new Date(),
      },
    });
    const allLabels = await prisma.predictionOutcomeLabelRecord.findMany({
      where: { predictionResultId },
      orderBy: { createdAt: 'desc' },
    });
    const canonical = reporting.resolveCanonicalOutcome(allLabels);
    const verifiedOverridesSelfReport =
      canonical.canonicalRecord?.status === 'DOCUMENT_VERIFIED' &&
      canonical.canonicalRecord?.result === 'REJECTED' &&
      canonical.canonicalOutcomeLabel === 'REJECTED' &&
      canonical.eligibleForCalibration === true;

    let missingNumericPredictionRejected = false;
    try {
      await reporting.reportActualResult(
        profileId,
        `${launchId}-missing-school`,
        'ADMITTED',
      );
    } catch (error) {
      missingNumericPredictionRejected =
        error instanceof NotFoundException ||
        /Numeric prediction not found/.test((error as Error).message);
    }

    outcomeFixture = {
      pass:
        createSelfReport &&
        duplicateUpdatesExisting &&
        verifiedOverridesSelfReport &&
        missingNumericPredictionRejected,
      createSelfReport,
      duplicateUpdatesExisting,
      verifiedOverridesSelfReport,
      missingNumericPredictionRejected,
    };
  } finally {
    await prisma.user.delete({ where: { id: userId } }).catch(() => undefined);
    if (createdTier4FixtureId) {
      await prisma.school
        .delete({ where: { id: createdTier4FixtureId } })
        .catch(() => undefined);
    }
  }

  const contractReport = {
    generatedAt: new Date().toISOString(),
    pass:
      numericFixture.pass &&
      tier4Report.pass &&
      outcomeFixture.pass &&
      persistenceFixture.pass,
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
    fixtures: {
      numeric: numericFixture,
      tier4: {
        pass: tier4Report.pass,
        schoolId: artOrMusicSchool.id,
        schoolName: artOrMusicSchool.name,
      },
      outcome: outcomeFixture,
    },
    outcomeLoop: {
      selfReportedStatusSupported: true,
      verifiedOnlyAccuracyGate: true,
      verifiedOutcomeCount: outcomeInventory.verifiedCount,
      calibrationPromotionAllowed: outcomeInventory.verifiedCount >= 50,
      externalAccuracyClaimAllowed: outcomeInventory.verifiedCount >= 200,
    },
  };
  writeFileSync(
    join(REPORT_DIR, 'contract.json'),
    JSON.stringify(contractReport, null, 2),
  );

  await moduleRef.close();

  console.log(JSON.stringify(contractReport, null, 2));
  if (!contractReport.pass) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
