export interface ApplicationAnalysisGoldCase {
  id: string;
  category:
    | 'noTargetSchools'
    | 'noPredictions'
    | 'insufficientProfileData'
    | 'analysisError'
    | 'ucTestBlind'
    | 'internationalNeedAid'
    | 'roundMismatch'
    | 'fullEvidenceMultiSchool';
  label: string;
  requiredSignals: string[];
}

const buildCases = (
  category: ApplicationAnalysisGoldCase['category'],
  labels: string[],
  requiredSignals: string[],
): ApplicationAnalysisGoldCase[] =>
  labels.map((label, index) => ({
    id: `${category}-${index + 1}`,
    category,
    label,
    requiredSignals,
  }));

export const APPLICATION_ANALYSIS_GOLD_SET: ApplicationAnalysisGoldCase[] = [
  ...buildCases(
    'noTargetSchools',
    ['profile-only-cn', 'profile-only-us', 'profile-only-gap-year'],
    ['portfolio.noTargetSchools', 'actionPlan.now'],
  ),
  ...buildCases(
    'noPredictions',
    [
      'list-no-predictions-cn',
      'list-no-predictions-us',
      'list-no-predictions-stem',
    ],
    ['portfolio.noPredictions', 'weakState.noFabricatedInsights'],
  ),
  ...buildCases(
    'insufficientProfileData',
    ['thin-profile-1', 'thin-profile-2', 'thin-profile-3'],
    ['profile.insufficient', 'weakState.insufficientProfileData'],
  ),
  ...buildCases(
    'analysisError',
    ['llm-degraded-1', 'llm-degraded-2', 'llm-degraded-3'],
    ['degraded.summary', 'degraded.actionPlan'],
  ),
  ...buildCases(
    'ucTestBlind',
    ['uc-berkeley', 'uc-los-angeles', 'uc-san-diego'],
    ['policy.testing.BLIND', 'policy.round.UC'],
  ),
  ...buildCases(
    'internationalNeedAid',
    ['intl-need-aid-1', 'intl-need-aid-2', 'intl-need-aid-3'],
    ['policy.intlAid', 'profile.applicantType.international'],
  ),
  ...buildCases(
    'roundMismatch',
    ['round-mismatch-ed', 'round-mismatch-ea', 'round-mismatch-rd'],
    ['prediction.staleRefresh', 'policy.round'],
  ),
  ...buildCases(
    'fullEvidenceMultiSchool',
    [
      'multi-school-balanced',
      'multi-school-reach-heavy',
      'multi-school-undermatch',
    ],
    ['portfolio.balance', 'targetSchoolInsights', 'actionability'],
  ),
];
