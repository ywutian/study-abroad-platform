import * as bcrypt from 'bcrypt';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const GOVERNANCE_ANALYSIS_VERSION = 'application-analysis-v2';
const GOVERNANCE_POLICY_KEY = 'governance-fixture';
const GOVERNANCE_POLICY_VERSION =
  'application-analysis-v2-governance-fixture-v1';
const GOVERNANCE_FIXTURE_PACK = 'application-analysis-governance-v1';
const GOVERNANCE_QA_EMAIL = 'application.analysis.qa@example.com';
const GOVERNANCE_QA_PASSWORD = 'Demo123!';
const FIXTURE_REVIEWED_BY = 'governance-fixture';
const FIXTURE_SOURCE_NAME = 'Application Analysis Governance Fixture Pack';
const FIXTURE_REVIEWED_AT = new Date('2026-04-21T00:00:00.000Z');

type TargetSchool = {
  name: string;
  schoolId?: string;
  tier: 'REACH' | 'TARGET' | 'SAFETY';
  round: string;
  testingPolicy: 'BLIND' | 'OPTIONAL' | 'REQUIRED';
  intlAidPolicy: string;
  probability: string;
  probabilityLow: string;
  probabilityHigh: string;
  predictionTier: 'reach' | 'match' | 'safety';
  confidence: 'low' | 'medium' | 'high';
  testingPolicyValue: string;
};

const TARGET_SCHOOLS: TargetSchool[] = [
  {
    name: 'University of California, Berkeley',
    tier: 'REACH',
    round: 'UC',
    testingPolicy: 'BLIND',
    intlAidPolicy: 'NEED_AWARE',
    probability: '0.3100',
    probabilityLow: '0.2500',
    probabilityHigh: '0.3800',
    predictionTier: 'reach',
    confidence: 'medium',
    testingPolicyValue: 'BLIND',
  },
  {
    name: 'Columbia University',
    tier: 'TARGET',
    round: 'ED',
    testingPolicy: 'OPTIONAL',
    intlAidPolicy: 'NEED_AWARE',
    probability: '0.2200',
    probabilityLow: '0.1700',
    probabilityHigh: '0.2800',
    predictionTier: 'match',
    confidence: 'medium',
    testingPolicyValue: 'OPTIONAL',
  },
  {
    name: 'Massachusetts Institute of Technology',
    tier: 'REACH',
    round: 'RD',
    testingPolicy: 'REQUIRED',
    intlAidPolicy: 'NEED_BLIND',
    probability: '0.1800',
    probabilityLow: '0.1300',
    probabilityHigh: '0.2400',
    predictionTier: 'reach',
    confidence: 'medium',
    testingPolicyValue: 'REQUIRED',
  },
];

function buildEvidenceMetadata(schoolName: string, dimension: string) {
  return {
    governanceSourceMode: 'fixture',
    governanceFixturePack: GOVERNANCE_FIXTURE_PACK,
    provenance: {
      mode: 'fixture',
      pack: GOVERNANCE_FIXTURE_PACK,
      schoolName,
      dimension,
    },
  };
}

async function ensurePolicyVersion() {
  return prisma.applicationAnalysisPolicyVersion.upsert({
    where: {
      policyKey_version: {
        policyKey: GOVERNANCE_POLICY_KEY,
        version: GOVERNANCE_POLICY_VERSION,
      },
    },
    update: {
      analysisVersion: GOVERNANCE_ANALYSIS_VERSION,
      name: 'Application Analysis Governance Fixture Baseline',
      description:
        'Explicit governance fixture policy used only for local, CI, and nightly application-analysis governance runs.',
      status: 'DRAFT',
      monitoringConfig: {
        latestFixturePack: GOVERNANCE_FIXTURE_PACK,
      },
      notes:
        '[governance-fixture] CI/nightly-only baseline. Fixture evidence must not count as production trust.',
    },
    create: {
      policyKey: GOVERNANCE_POLICY_KEY,
      version: GOVERNANCE_POLICY_VERSION,
      analysisVersion: GOVERNANCE_ANALYSIS_VERSION,
      name: 'Application Analysis Governance Fixture Baseline',
      description:
        'Explicit governance fixture policy used only for local, CI, and nightly application-analysis governance runs.',
      status: 'DRAFT',
      monitoringConfig: {
        latestFixturePack: GOVERNANCE_FIXTURE_PACK,
      },
      notes:
        '[governance-fixture] CI/nightly-only baseline. Fixture evidence must not count as production trust.',
    },
  });
}

async function ensureQaApplicant() {
  const passwordHash = await bcrypt.hash(GOVERNANCE_QA_PASSWORD, 12);
  const user = await prisma.user.upsert({
    where: { email: GOVERNANCE_QA_EMAIL },
    update: {
      passwordHash,
      emailVerified: true,
      locale: 'en',
    },
    create: {
      email: GOVERNANCE_QA_EMAIL,
      passwordHash,
      emailVerified: true,
      locale: 'en',
    },
  });

  const profile = await prisma.profile.upsert({
    where: { userId: user.id },
    update: {
      nickname: 'Application Analysis QA',
      onboardingCompleted: true,
      gpa: 3.91,
      gpaScale: 4,
      currentSchool: 'Governance QA High School',
      currentSchoolType: 'INTERNATIONAL',
      grade: 'JUNIOR',
      targetMajor: 'Computer Science',
      intendedMajor: 'Computer Science',
      applicationRound: 'ED',
      nationality: 'China',
      countryOfResidence: 'China',
      citizenship: 'China',
      needsFinancialAid: true,
      educationSystem: 'AP',
    },
    create: {
      userId: user.id,
      nickname: 'Application Analysis QA',
      onboardingCompleted: true,
      gpa: 3.91,
      gpaScale: 4,
      currentSchool: 'Governance QA High School',
      currentSchoolType: 'INTERNATIONAL',
      grade: 'JUNIOR',
      targetMajor: 'Computer Science',
      intendedMajor: 'Computer Science',
      applicationRound: 'ED',
      nationality: 'China',
      countryOfResidence: 'China',
      citizenship: 'China',
      needsFinancialAid: true,
      educationSystem: 'AP',
    },
  });

  await prisma.testScore.upsert({
    where: {
      id: `governance-fixture-sat-${profile.id}`,
    },
    update: {
      type: 'SAT',
      score: 1520,
      subScores: { math: 780, reading: 740 },
      testDate: new Date('2025-10-01T00:00:00.000Z'),
    },
    create: {
      id: `governance-fixture-sat-${profile.id}`,
      profileId: profile.id,
      type: 'SAT',
      score: 1520,
      subScores: { math: 780, reading: 740 },
      testDate: new Date('2025-10-01T00:00:00.000Z'),
    },
  });

  await prisma.activity.upsert({
    where: {
      id: `governance-fixture-activity-${profile.id}`,
    },
    update: {
      name: 'Robotics Research Lab',
      category: 'ACADEMIC',
      role: 'Lead Builder',
      description:
        'Leads robotics design reviews and competition preparation for the school research lab.',
      hoursPerWeek: 6,
      weeksPerYear: 32,
      order: 0,
      isOngoing: true,
    },
    create: {
      id: `governance-fixture-activity-${profile.id}`,
      profileId: profile.id,
      name: 'Robotics Research Lab',
      category: 'ACADEMIC',
      role: 'Lead Builder',
      description:
        'Leads robotics design reviews and competition preparation for the school research lab.',
      hoursPerWeek: 6,
      weeksPerYear: 32,
      order: 0,
      isOngoing: true,
    },
  });

  await prisma.education.upsert({
    where: {
      id: `governance-fixture-education-${profile.id}`,
    },
    update: {
      schoolName: 'Governance QA High School',
      schoolType: 'HIGH_SCHOOL',
      degree: 'High School Diploma',
      startDate: new Date('2023-09-01T00:00:00.000Z'),
      endDate: new Date('2027-06-01T00:00:00.000Z'),
      gpa: 3.91,
      gpaScale: 4,
      gpaSystem: 'SCALE_4_UW',
    },
    create: {
      id: `governance-fixture-education-${profile.id}`,
      profileId: profile.id,
      schoolName: 'Governance QA High School',
      schoolType: 'HIGH_SCHOOL',
      degree: 'High School Diploma',
      startDate: new Date('2023-09-01T00:00:00.000Z'),
      endDate: new Date('2027-06-01T00:00:00.000Z'),
      gpa: 3.91,
      gpaScale: 4,
      gpaSystem: 'SCALE_4_UW',
    },
  });

  return { user, profile };
}

async function ensureFixtureSchools() {
  const schools = await prisma.school.findMany({
    where: {
      name: { in: TARGET_SCHOOLS.map((school) => school.name) },
    },
    select: {
      id: true,
      name: true,
      testingPolicy: true,
      needBlindInternational: true,
      metadata: true,
    },
  });

  if (schools.length !== TARGET_SCHOOLS.length) {
    const foundNames = new Set(schools.map((school) => school.name));
    const missing = TARGET_SCHOOLS.map((school) => school.name).filter(
      (name) => !foundNames.has(name),
    );
    throw new Error(
      `Governance fixture seed is missing school records: ${missing.join(', ')}`,
    );
  }

  return new Map(schools.map((school) => [school.name, school]));
}

async function ensureSchoolListAndPredictions(
  profileId: string,
  userId: string,
) {
  const schoolsByName = await ensureFixtureSchools();

  for (const target of TARGET_SCHOOLS) {
    const school = schoolsByName.get(target.name);
    if (!school) continue;

    await prisma.schoolListItem.upsert({
      where: {
        userId_schoolId: {
          userId,
          schoolId: school.id,
        },
      },
      update: {
        tier: target.tier,
        round: target.round,
        isAIRecommended: true,
      },
      create: {
        userId,
        schoolId: school.id,
        tier: target.tier,
        round: target.round,
        isAIRecommended: true,
      },
    });

    await prisma.predictionResult.upsert({
      where: {
        profileId_schoolId: {
          profileId,
          schoolId: school.id,
        },
      },
      update: {
        probability: target.probability,
        probabilityLow: target.probabilityLow,
        probabilityHigh: target.probabilityHigh,
        factors: [
          {
            name: 'Academics',
            impact: 'positive',
            detail:
              'Governance QA baseline has competitive grades and sustained activities.',
          },
          {
            name: 'Selectivity',
            impact: 'mixed',
            detail: `${target.name} remains highly selective for this profile.`,
          },
        ],
        tier: target.predictionTier,
        confidence: target.confidence,
        suggestions: [
          `Keep the ${target.round} application materials aligned with ${target.name}.`,
        ],
        source: 'governance-fixture',
        confidenceReason:
          'Governance fixture prediction used for deterministic application-analysis runtime checks.',
        applicationRound: target.round,
        selectivityBand: target.predictionTier.toUpperCase(),
      },
      create: {
        profileId,
        schoolId: school.id,
        probability: target.probability,
        probabilityLow: target.probabilityLow,
        probabilityHigh: target.probabilityHigh,
        factors: [
          {
            name: 'Academics',
            impact: 'positive',
            detail:
              'Governance QA baseline has competitive grades and sustained activities.',
          },
          {
            name: 'Selectivity',
            impact: 'mixed',
            detail: `${target.name} remains highly selective for this profile.`,
          },
        ],
        tier: target.predictionTier,
        confidence: target.confidence,
        suggestions: [
          `Keep the ${target.round} application materials aligned with ${target.name}.`,
        ],
        source: 'governance-fixture',
        confidenceReason:
          'Governance fixture prediction used for deterministic application-analysis runtime checks.',
        applicationRound: target.round,
        selectivityBand: target.predictionTier.toUpperCase(),
      },
    });

    const evidenceRows = [
      {
        policyDimension: 'TESTING' as const,
        policyValue: target.testingPolicyValue,
        sourceUrl: `fixture://${school.id}/testing-policy`,
        notes: `Fixture testing policy for ${target.name}.`,
      },
      {
        policyDimension: 'INTL_AID' as const,
        policyValue: target.intlAidPolicy,
        sourceUrl: `fixture://${school.id}/intl-aid-policy`,
        notes: `Fixture international aid policy for ${target.name}.`,
      },
      {
        policyDimension: 'ROUND' as const,
        policyValue: target.round,
        sourceUrl: `fixture://${school.id}/round-policy`,
        notes: `Fixture round context for ${target.name}.`,
      },
    ];

    for (const row of evidenceRows) {
      const existing = await prisma.schoolPolicyEvidence.findFirst({
        where: {
          schoolId: school.id,
          policyDimension: row.policyDimension,
          sourceName: FIXTURE_SOURCE_NAME,
        },
      });

      if (existing) {
        await prisma.schoolPolicyEvidence.update({
          where: { id: existing.id },
          data: {
            policyValue: row.policyValue,
            sourceUrl: row.sourceUrl,
            sourceQuality: 100,
            status: 'APPROVED',
            reviewedAt: FIXTURE_REVIEWED_AT,
            reviewedBy: FIXTURE_REVIEWED_BY,
            expiresAt: null,
            notes: row.notes,
            metadata: buildEvidenceMetadata(target.name, row.policyDimension),
          },
        });
      } else {
        await prisma.schoolPolicyEvidence.create({
          data: {
            schoolId: school.id,
            policyDimension: row.policyDimension,
            policyValue: row.policyValue,
            sourceName: FIXTURE_SOURCE_NAME,
            sourceUrl: row.sourceUrl,
            sourceQuality: 100,
            status: 'APPROVED',
            reviewedAt: FIXTURE_REVIEWED_AT,
            reviewedBy: FIXTURE_REVIEWED_BY,
            expiresAt: null,
            notes: row.notes,
            metadata: buildEvidenceMetadata(target.name, row.policyDimension),
          },
        });
      }
    }
  }
}

async function main() {
  const policy = await ensurePolicyVersion();
  const { user, profile } = await ensureQaApplicant();
  await ensureSchoolListAndPredictions(profile.id, user.id);

  console.log(
    JSON.stringify(
      {
        status: 'ok',
        fixturePack: GOVERNANCE_FIXTURE_PACK,
        policyVersionId: policy.id,
        qaApplicantEmail: GOVERNANCE_QA_EMAIL,
        schoolCount: TARGET_SCHOOLS.length,
      },
      null,
      2,
    ),
  );
}

void main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
