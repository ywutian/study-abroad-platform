import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { resolveMajorToCip } from '@study-abroad/shared/scoring';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { PredictionService } from '../src/modules/prediction/prediction.service';
import { DistillationService } from '../src/modules/prediction/benchmark/distillation.service';
import type { BenchmarkProfileInput } from '@study-abroad/shared';

type Args = {
  cohortTag: string;
  maxProfiles: number;
  limitSchools: number;
  locale: string;
};

type BenchmarkProfileRow = {
  id: string;
  label: string;
  profileJson: BenchmarkProfileInput;
};

function parseArgs(): Args {
  const argv = process.argv.slice(2);
  const cohortTag = argv
    .find((arg) => arg.startsWith('--profile-cohort='))
    ?.split('=')[1];
  const maxProfiles = argv
    .find((arg) => arg.startsWith('--max-profiles='))
    ?.split('=')[1];
  const limitSchools = argv
    .find((arg) => arg.startsWith('--limit-schools='))
    ?.split('=')[1];
  const locale = argv.find((arg) => arg.startsWith('--locale='))?.split('=')[1];

  return {
    cohortTag: cohortTag ?? 'distill-corpus-v1',
    maxProfiles: maxProfiles ? Number(maxProfiles) : 20,
    limitSchools: limitSchools ? Number(limitSchools) : 20,
    locale: locale ?? 'en',
  };
}

async function selectSchoolIdsForProfile(
  prisma: PrismaService,
  profileId: string,
  limitSchools: number,
): Promise<string[]> {
  const competitorRows = await prisma.competitorPrediction.findMany({
    where: {
      profileId,
      schoolId: { not: null },
      probability: { not: null },
      status: 'COMPLETED',
      source: { key: 'collegevine' },
    },
    select: { schoolId: true },
    orderBy: { fetchedAt: 'desc' },
  });

  const uniqueFromCompetitor = Array.from(
    new Set(
      competitorRows
        .map((row) => row.schoolId)
        .filter((schoolId): schoolId is string => Boolean(schoolId)),
    ),
  );

  if (uniqueFromCompetitor.length > 0) {
    return uniqueFromCompetitor.slice(0, limitSchools);
  }

  const fallback = await prisma.staticTeacherSnapshot.findMany({
    where: {
      status: 'COMPLETED',
      source: { key: 'campusreel-static' },
    },
    select: { schoolId: true },
    orderBy: { fetchedAt: 'desc' },
    take: limitSchools,
  });

  return Array.from(new Set(fallback.map((row) => row.schoolId)));
}

async function buildProgramMap(
  prisma: PrismaService,
  profile: BenchmarkProfileInput,
  schoolIds: string[],
): Promise<Map<string, unknown>> {
  const targetCip = profile.targetMajor
    ? resolveMajorToCip(profile.targetMajor)
    : null;

  if (!targetCip) {
    return new Map();
  }

  const programs = await prisma.schoolProgram.findMany({
    where: {
      cipCode: targetCip,
      schoolId: { in: schoolIds },
    },
  });

  return new Map(programs.map((program) => [program.schoolId, program]));
}

async function computePrePlattProbability(
  prediction: PredictionService,
  profile: BenchmarkProfileInput,
  school: Record<string, unknown>,
  dataCompleteness: number,
  programData: unknown,
  locale: string,
): Promise<number> {
  const internal = prediction as any;
  const policyVersionId = internal.policyService
    ? await internal.policyService.resolveServedPolicyVersionId()
    : 'v3-enterprise';
  const profileMetrics = internal.extractProfileMetrics(profile);

  const result = await internal.predictForSchool(
    '',
    profile,
    profileMetrics,
    school,
    {
      previousPredictions: [],
      knownPreferences: [],
      profileInsights: [],
      memoryAdjustments: new Map<string, number>(),
    },
    locale,
    null,
    undefined,
    programData,
    dataCompleteness,
    profile.applicationRound ?? undefined,
    policyVersionId,
    false,
    false,
    false,
    false,
  );

  return result.probability;
}

async function main() {
  const args = parseArgs();
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  try {
    const prisma = app.get(PrismaService);
    const prediction = app.get(PredictionService);
    const distillation = app.get(DistillationService);

    const profiles = await prisma.benchmarkProfile.findMany({
      where: { cohortTag: args.cohortTag },
      orderBy: { label: 'asc' },
      take: args.maxProfiles,
    });

    if (profiles.length === 0) {
      console.error(
        `No benchmark profiles found for cohort ${args.cohortTag}.`,
      );
      process.exit(1);
    }

    let rowCount = 0;
    let signalCount = 0;
    let prePlattDeltaTotal = 0;
    let postPlattDeltaTotal = 0;

    for (const profile of profiles as BenchmarkProfileRow[]) {
      const schoolIds = await selectSchoolIdsForProfile(
        prisma,
        profile.id,
        args.limitSchools,
      );

      if (schoolIds.length === 0) {
        console.log(
          `\nProfile ${profile.label}: no teacher-backed schools found.`,
        );
        continue;
      }

      const schools = await prisma.school.findMany({
        where: { id: { in: schoolIds } },
      });
      const schoolMap = new Map(schools.map((school) => [school.id, school]));
      const programMap = await buildProgramMap(
        prisma,
        profile.profileJson,
        schoolIds,
      );
      const preview = await prediction.previewPredict(
        profile.profileJson,
        schoolIds,
        {
          locale: args.locale,
        },
      );
      const servedBySchoolId = new Map(
        preview.results.map((result) => [result.schoolId, result]),
      );
      const firstSchool = schools[0];
      const internalPrediction = prediction as any;
      const dataCompleteness = firstSchool
        ? internalPrediction.evaluateDataCompleteness(
            profile.profileJson,
            internalPrediction.schoolToInput(firstSchool),
          )
        : 0;

      console.log(`\nProfile ${profile.label}:`);

      for (const schoolId of schoolIds) {
        const school = schoolMap.get(schoolId);
        const served = servedBySchoolId.get(schoolId);
        if (!school || !served) {
          continue;
        }

        const prePlattProbability = await computePrePlattProbability(
          prediction,
          profile.profileJson,
          school,
          dataCompleteness,
          programMap.get(schoolId),
          args.locale,
        );

        const teacherSignals = await distillation.getBenchmarkTeacherSignals(
          profile.id,
          schoolId,
          profile.profileJson,
        );
        const diagnostics = distillation.buildBlendDiagnostics(
          prePlattProbability,
          served.probability,
          teacherSignals,
        );

        rowCount += 1;
        if (teacherSignals.length > 0) {
          signalCount += 1;
        }
        prePlattDeltaTotal += Math.abs(diagnostics.deltaServedPrePlatt);
        postPlattDeltaTotal += Math.abs(diagnostics.deltaServedPostPlatt);

        const ensemble =
          diagnostics.teacherEnsemble != null
            ? diagnostics.teacherEnsemble.toFixed(3)
            : '—';
        const signalList =
          diagnostics.teacherSignals.length > 0
            ? diagnostics.teacherSignals
                .map(
                  (signal) =>
                    `${signal.sourceKey}:${signal.probability.toFixed(3)}@${signal.weight.toFixed(2)}`,
                )
                .join(', ')
            : 'none';

        console.log(
          [
            school.name.padEnd(34),
            `pre=${prePlattProbability.toFixed(3)}`,
            `served=${served.probability.toFixed(3)}`,
            `ensemble=${ensemble}`,
            `w=${diagnostics.effectiveW.toFixed(3)}`,
            `preBlend=${diagnostics.candidateServedPrePlatt.toFixed(3)}`,
            `postBlend=${diagnostics.candidateServedPostPlatt.toFixed(3)}`,
            `Δpre=${diagnostics.deltaServedPrePlatt.toFixed(3)}`,
            `Δpost=${diagnostics.deltaServedPostPlatt.toFixed(3)}`,
            `signals=[${signalList}]`,
          ].join(' | '),
        );
      }
    }

    console.log('\nSummary:');
    console.log(`  profiles:              ${profiles.length}`);
    console.log(`  rows:                  ${rowCount}`);
    console.log(`  rows with signal:      ${signalCount}`);
    console.log(
      `  mean |Δ| pre-Platt:    ${
        rowCount > 0 ? (prePlattDeltaTotal / rowCount).toFixed(4) : '0.0000'
      }`,
    );
    console.log(
      `  mean |Δ| post-Platt:   ${
        rowCount > 0 ? (postPlattDeltaTotal / rowCount).toFixed(4) : '0.0000'
      }`,
    );
  } finally {
    await app.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
