import type {
  LoadedProfile,
  LoadedSchoolListItem,
} from './profile-application-analysis-v2.helpers';
import type {
  ApplicationAnalysisProfileSummary,
  ApplicationAnalysisSchoolResult,
} from '@study-abroad/shared';
import { compactSchoolResult } from './analysis-compact';

export function buildPortfolioPromptInput(
  profileSummary: ApplicationAnalysisProfileSummary,
  schools: ApplicationAnalysisSchoolResult[],
  fallbackPortfolioSummary: unknown,
  fallbackActionPlan: unknown,
  facts?: ReturnType<typeof analysisAcademicFacts>['applicantFacts'],
) {
  return {
    profileSummary,
    schools: facts ? schools.map(compactSchoolResult) : schools,
    ...(facts ? { applicantFacts: facts } : {}),
    fallbackPortfolioSummary,
    fallbackActionPlan,
  };
}

/** Preserve the legacy input shape; compact projection happens only at the call boundary. */
export function buildSchoolPromptInput(
  profileSummary: ApplicationAnalysisProfileSummary,
  identity: { schoolId: string; schoolName: string },
  deterministic: ApplicationAnalysisSchoolResult,
  facts?: ReturnType<typeof analysisAcademicFacts>,
) {
  return {
    profileSummary,
    schoolId: identity.schoolId,
    schoolName: identity.schoolName,
    tier: deterministic.tier,
    round: deterministic.round,
    prediction: deterministic.prediction,
    policyCard: deterministic.policyCard,
    deterministicAssessment: deterministic.assessment,
    allowedEvidenceIds: deterministic.evidenceIds,
    ...facts,
  };
}

/** Only already-loaded, relevant facts. Never include identity, essays or raw metadata. */
export function analysisAcademicFacts(
  profile: LoadedProfile,
  item: LoadedSchoolListItem,
) {
  return {
    applicantFacts: {
      gpa: profile.gpa == null ? null : Number(profile.gpa),
      gpaScale: profile.gpaScale == null ? null : Number(profile.gpaScale),
      testScores: profile.testScores
        .slice(0, 6)
        .map((score) => ({ type: score.type, score: score.score })),
      budgetTier: profile.budgetTier,
      needsFinancialAid: profile.needsFinancialAid,
    },
    schoolFacts: {
      sat25: item.school.sat25,
      sat75: item.school.sat75,
      // A distribution, NOT an admission cutoff. Costs and GPA ranges are not
      // loaded by this workflow; do not invent them from rankings or budgetTier.
      interpretation:
        'SAT distribution is not a minimum requirement. Costs and GPA comparison are unknown.',
    },
  };
}
