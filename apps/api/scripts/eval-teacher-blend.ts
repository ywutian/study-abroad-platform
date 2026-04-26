#!/usr/bin/env tsx
import { NestFactory } from '@nestjs/core';
import { DistillationModule } from '../src/modules/prediction/distillation/distillation.module';
import { CompliantDistillationService } from '../src/modules/prediction/distillation/compliant-distillation.service';
import type { DistillationEvaluationInput } from '../src/modules/prediction/distillation/types';

const CASES: Array<{
  label: string;
  input: DistillationEvaluationInput;
  expectedBand: [number, number];
}> = [
  {
    label: 'UCM strong CA applicant',
    expectedBand: [0.75, 0.95],
    input: buildInput('uc-merced', {
      schoolName: 'University of California Merced',
      schoolState: 'CA',
      acceptanceRate: 89,
      ourProbPrePlatt: 0.49,
      sat: 1550,
      gpaNormalized: 0.98,
      highSchoolLocation: 'CA',
    }),
  },
  {
    label: 'UCB strong CA applicant',
    expectedBand: [0.15, 0.35],
    input: buildInput('uc-berkeley', {
      schoolName: 'University of California Berkeley',
      schoolState: 'CA',
      acceptanceRate: 11,
      ourProbPrePlatt: 0.2,
      sat: 1550,
      gpaNormalized: 0.98,
      highSchoolLocation: 'CA',
    }),
  },
  {
    label: 'UCLA out-of-state applicant',
    expectedBand: [0.05, 0.2],
    input: buildInput('ucla', {
      schoolName: 'University of California Los Angeles',
      schoolState: 'CA',
      acceptanceRate: 9,
      ourProbPrePlatt: 0.18,
      sat: 1500,
      gpaNormalized: 0.96,
      highSchoolLocation: 'NY',
    }),
  },
  {
    label: 'Michigan in-state applicant',
    expectedBand: [0.25, 0.55],
    input: buildInput('umich', {
      schoolName: 'University of Michigan',
      schoolState: 'MI',
      acceptanceRate: 18,
      ourProbPrePlatt: 0.27,
      sat: 1500,
      gpaNormalized: 0.95,
      highSchoolLocation: 'MI',
    }),
  },
  {
    label: 'Private ED applicant',
    expectedBand: [0.12, 0.4],
    input: buildInput('private-ed', {
      schoolName: 'Private ED University',
      schoolState: 'MA',
      acceptanceRate: 8,
      ourProbPrePlatt: 0.18,
      sat: 1530,
      gpaNormalized: 0.97,
      applicationRound: 'ED',
    }),
  },
];

function buildInput(
  schoolId: string,
  params: {
    schoolName: string;
    schoolState?: string;
    acceptanceRate: number;
    ourProbPrePlatt: number;
    sat: number;
    gpaNormalized: number;
    highSchoolLocation?: string;
    applicationRound?: string;
  },
): DistillationEvaluationInput {
  return {
    profileId: `eval-${schoolId}`,
    schoolId,
    schoolCountry: 'US',
    profile: {
      gpa: params.gpaNormalized * 4,
      gpaScale: 4,
      targetMajor: 'Computer Science',
      isInternational: false,
      nationality: 'US',
      highSchoolLocation: params.highSchoolLocation,
      testScores: [{ type: 'SAT', score: params.sat }],
      activities: [],
      awards: [],
    },
    profileMetrics: { satScore: params.sat } as any,
    school: {
      id: schoolId,
      name: params.schoolName,
      acceptanceRate: params.acceptanceRate,
      satAvg: 1400,
      sat25: 1300,
      sat75: 1500,
      hasEarlyDecision: params.applicationRound === 'ED' ? true : undefined,
      applicationRound: params.applicationRound ?? 'RD',
    },
    ourProbPrePlatt: params.ourProbPrePlatt,
    servedProbability: params.ourProbPrePlatt,
    cohortKey: 'US__US_HS',
    applicationRound: params.applicationRound ?? 'RD',
    selectivityBand: null,
    inputSummary: {
      sat: params.sat,
      act: null,
      gpaNormalized: params.gpaNormalized,
      nationality: 'US',
      curriculumType: null,
      highSchoolType: 'US_HS',
      isInternational: false,
    },
  };
}

async function main() {
  const app = await NestFactory.createApplicationContext(DistillationModule, {
    logger: false,
  });
  try {
    const service = app.get(CompliantDistillationService);
    const rows = [];
    for (const item of CASES) {
      const result = await service.evaluatePrediction(item.input, {
        shadowEnabled: true,
        liveEnabled: false,
      });
      rows.push({
        case: item.label,
        expected: `${item.expectedBand[0]}-${item.expectedBand[1]}`,
        blendedPrePlatt: result?.decision.blendedPrePlatt ?? null,
        totalEffectiveWeight: result?.decision.totalEffectiveWeight ?? 0,
        activeTeacherKeys:
          result?.decision.teacherSignals
            .filter((signal) => signal.active)
            .map((signal) => signal.key)
            .join(',') ?? '',
      });
    }
    console.table(rows);
  } finally {
    await app.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
