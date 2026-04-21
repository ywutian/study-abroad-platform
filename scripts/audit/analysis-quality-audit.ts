import { PrismaClient } from '@prisma/client';
import { loadApiEnv } from './utils';
import type {
  AgentAuditNote,
  AgentFinding,
  AnalysisQualityArtifact,
  AnalysisQualityRecord,
} from './types';

type AuditProfile = {
  id: string;
  updatedAt: Date;
  gpa: string | null;
  targetMajor: string | null;
  applicationRound: string | null;
  needsFinancialAid: boolean | null;
  citizenship: string | null;
  countryOfResidence: string | null;
  activityCount: number;
  testScoreCount: number;
  awardCount: number;
  essayCount: number;
  targetSchools: string[];
};

function isInternational(profile: AuditProfile): boolean {
  return Boolean(
    profile.citizenship &&
    profile.countryOfResidence &&
    profile.citizenship !== 'US' &&
    profile.countryOfResidence !== 'US'
  );
}

function completenessBucket(profile: AuditProfile): 'high' | 'low' {
  const completeSignals = [
    Boolean(profile.gpa),
    Boolean(profile.targetMajor),
    profile.activityCount > 0,
    profile.targetSchools.length > 0,
  ].filter(Boolean).length;

  return completeSignals >= 3 ? 'high' : 'low';
}

function buildSyntheticCases(): AnalysisQualityRecord[] {
  const archetypes = [
    ['synthetic-01', ['Harvard University', 'Yale University']],
    [
      'synthetic-02',
      ['University of California, Berkeley', 'University of California, Los Angeles'],
    ],
    ['synthetic-03', ['Stanford University']],
    ['synthetic-04', ['Massachusetts Institute of Technology']],
    ['synthetic-05', ['Princeton University']],
    ['synthetic-06', []],
    ['synthetic-07', ['University of California, San Diego']],
    ['synthetic-08', ['University of California, Irvine']],
    ['synthetic-09', ['Amherst College']],
    ['synthetic-10', ['Harvard University', 'Princeton University']],
    ['synthetic-11', ['University of California, Santa Barbara']],
    ['synthetic-12', ['Stanford University', 'Massachusetts Institute of Technology']],
  ] as const;

  return archetypes.map(([caseId, schoolNames]) => ({
    caseId,
    sourceType: 'synthetic',
    profileId: null,
    schoolNames: [...schoolNames],
    status: 'environment_blocked',
    factSupportPass: null,
    policyConsistencyPass: null,
    probabilityConsistencyPass: null,
    actionabilityScore: null,
    fabricatedInsightPass: null,
    overconfidence: null,
    note: 'Synthetic archetype prepared, but no deterministic ai-analysis harness was available for execution in this audit run.',
  }));
}

async function probeAiAnalysisEndpoint(
  baseUrl: string,
  token?: string
): Promise<AnalysisQualityArtifact['endpointProbe']> {
  const headers = new Headers();
  if (token) headers.set('Authorization', `Bearer ${token}`);

  try {
    const response = await fetch(`${baseUrl}/profiles/me/ai-analysis`, {
      method: 'GET',
      headers,
    });

    if (response.status === 401 || response.status === 403) {
      return {
        baseUrl,
        reachability: 'auth_blocked',
        detail: `Endpoint reachable but blocked by auth (HTTP ${response.status}).`,
      };
    }

    return {
      baseUrl,
      reachability: response.ok ? 'reachable' : 'auth_blocked',
      detail: response.ok
        ? 'Endpoint reachable, but sampled profile replay harness was not implemented in this audit run.'
        : `Endpoint returned HTTP ${response.status}.`,
    };
  } catch (error) {
    return {
      baseUrl,
      reachability: 'unreachable',
      detail: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function runAnalysisQualityAudit(
  realSampleSize: number,
  baseUrl: string,
  token?: string
): Promise<{
  artifact: AnalysisQualityArtifact;
  note: AgentAuditNote;
}> {
  loadApiEnv();
  const prisma = new PrismaClient();

  try {
    const profiles = await prisma.profile.findMany({
      where: {
        onboardingCompleted: true,
      },
      orderBy: { updatedAt: 'desc' },
      take: Math.max(realSampleSize * 4, 60),
      select: {
        id: true,
        updatedAt: true,
        gpa: true,
        targetMajor: true,
        applicationRound: true,
        needsFinancialAid: true,
        citizenship: true,
        countryOfResidence: true,
        activities: { select: { id: true } },
        testScores: { select: { id: true } },
        awards: { select: { id: true } },
        essays: { select: { id: true } },
      },
    });

    const profileIds = profiles.map((profile) => profile.id);
    const targetSchoolRows = profileIds.length
      ? await prisma.profileTargetSchool.findMany({
          where: { profileId: { in: profileIds } },
          select: {
            profileId: true,
            school: { select: { name: true } },
          },
        })
      : [];

    const targetSchoolMap = new Map<string, string[]>();
    for (const row of targetSchoolRows) {
      const current = targetSchoolMap.get(row.profileId) ?? [];
      current.push(row.school.name);
      targetSchoolMap.set(row.profileId, current);
    }

    const normalizedProfiles: AuditProfile[] = profiles.map((profile) => ({
      id: profile.id,
      updatedAt: profile.updatedAt,
      gpa: profile.gpa?.toString() ?? null,
      targetMajor: profile.targetMajor,
      applicationRound: profile.applicationRound,
      needsFinancialAid: profile.needsFinancialAid,
      citizenship: profile.citizenship,
      countryOfResidence: profile.countryOfResidence,
      activityCount: profile.activities.length,
      testScoreCount: profile.testScores.length,
      awardCount: profile.awards.length,
      essayCount: profile.essays.length,
      targetSchools: targetSchoolMap.get(profile.id) ?? [],
    }));

    const buckets = new Map<string, AuditProfile[]>();
    for (const profile of normalizedProfiles) {
      const bucket = [
        isInternational(profile) ? 'international' : 'domestic',
        profile.needsFinancialAid === true
          ? 'aid'
          : profile.needsFinancialAid === false
            ? 'no-aid'
            : 'aid-unknown',
        completenessBucket(profile),
        profile.applicationRound ? 'round-present' : 'round-missing',
      ].join('|');
      const current = buckets.get(bucket) ?? [];
      current.push(profile);
      buckets.set(bucket, current);
    }

    const selected: AuditProfile[] = [];
    const seen = new Set<string>();
    for (const bucketProfiles of buckets.values()) {
      const first = bucketProfiles[0];
      if (!first) continue;
      selected.push(first);
      seen.add(first.id);
      if (selected.length >= realSampleSize) break;
    }

    for (const profile of normalizedProfiles) {
      if (selected.length >= realSampleSize) break;
      if (seen.has(profile.id)) continue;
      selected.push(profile);
      seen.add(profile.id);
    }

    const endpointProbe = await probeAiAnalysisEndpoint(baseUrl, token);
    const executionStatus =
      endpointProbe.reachability === 'unreachable' || endpointProbe.reachability === 'auth_blocked'
        ? 'environment_blocked'
        : 'evidence_insufficient';

    const realRecords: AnalysisQualityRecord[] = selected.map((profile) => ({
      caseId: `real-${profile.id}`,
      sourceType: 'real',
      profileId: profile.id,
      schoolNames: profile.targetSchools,
      status: executionStatus,
      factSupportPass: null,
      policyConsistencyPass: null,
      probabilityConsistencyPass: null,
      actionabilityScore: null,
      fabricatedInsightPass: null,
      overconfidence: null,
      note:
        executionStatus === 'environment_blocked'
          ? `Sampled profile is ready, but /profiles/me/ai-analysis could not be replayed for audit. ${endpointProbe.detail}`
          : 'Endpoint is reachable, but this repository does not yet expose a deterministic offline replay harness for sampled profiles.',
    }));

    const syntheticRecords = buildSyntheticCases();
    const records = [...realRecords, ...syntheticRecords];

    const findings: AgentFinding[] = [
      {
        agent: 'Analysis Quality Auditor',
        severity: 'P1',
        category: 'missing_harness',
        summary: 'No deterministic replay harness exists for /profiles/me/ai-analysis',
        evidence:
          'The audit can sample real and synthetic cases, but it cannot safely execute and grade them without authenticated per-user replay or an offline harness.',
        affectedSurface: 'application-analysis content audit',
        file: `${process.cwd()}/apps/api/src/modules/profile/profile.controller.ts`,
        line: 97,
      },
    ];

    return {
      artifact: {
        status: executionStatus,
        realSampleCount: realRecords.length,
        syntheticSampleCount: syntheticRecords.length,
        executedCaseCount: 0,
        realPassRate: null,
        syntheticPassRate: null,
        fabricatedInsightCount: null,
        overconfidenceCount: null,
        records,
        endpointProbe,
      },
      note: {
        agent: 'Analysis Quality Auditor',
        summary:
          'Real and synthetic samples were assembled, but application-analysis content accuracy remains unverified because the audit could not execute a deterministic replay harness.',
        findings,
        notes: [
          'Synthetic cases were created for robustness coverage only and were not allowed to contribute to headline accuracy.',
          'Without replayable outputs, fact support, policy consistency, fabricated insight count, and overconfidence remain unmeasured.',
        ],
      },
    };
  } finally {
    await prisma.$disconnect();
  }
}
