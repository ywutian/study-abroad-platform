export const APPLICATION_ANALYSIS_DEFAULT_THRESHOLDS = {
  policyCorrectnessRate: 0.95,
  weakStateCorrectnessRate: 0.98,
  fabricatedInsightCount: 0,
  actionabilityMean: 4.3,
  contractParityPass: true,
  webRenderPass: true,
  mobileRenderPass: true,
  journeyPassRate: 1,
  maxUnknownPolicyRate: 0.4,
} as const;

export const APPLICATION_ANALYSIS_EXPERIMENTAL_FLAGS = {
  experimental: 'application-analysis-experimental',
  recourse: 'application-analysis-recourse',
  conformal: 'application-analysis-conformal',
  fairness: 'application-analysis-fairness',
} as const;

export const APPLICATION_ANALYSIS_EXPERIMENT_DEFAULT_THRESHOLDS = {
  RECOURSE: {
    unsafeSuggestionRate: 0,
    immutableFeatureViolation: 0,
    actionabilityMean: 4.4,
    schoolPolicyConsistency: 0.97,
    contractParityPass: true,
    webRenderPass: true,
    mobileRenderPass: true,
    journeyPassRate: 1,
  },
  UNCERTAINTY: {
    empiricalCoverageOverall: 0.87,
    empiricalCoverageKeySubgroup: 0.82,
    medianIntervalWidthDelta: 0.12,
    contractParityPass: true,
    webRenderPass: true,
    mobileRenderPass: true,
    journeyPassRate: 1,
  },
  FAIRNESS: {
    fabricatedInsightCount: 0,
    unknownPolicyRateDelta: 0.1,
    actionabilityMeanDelta: 0.5,
    blockedSubgroupCount: 0,
    disclosurePass: true,
    contractParityPass: true,
    webRenderPass: true,
    mobileRenderPass: true,
    journeyPassRate: 1,
  },
} as const;

export const APPLICATION_ANALYSIS_EXPERIMENT_ROLLOUT_STAGES = {
  RECOURSE: [5, 25, 100],
  UNCERTAINTY: [5, 25, 100],
  FAIRNESS: [5, 25, 100],
} as const;

export const APPLICATION_ANALYSIS_EXPERIMENT_LIVE_THRESHOLDS = {
  unsafeRecourseCount: 0,
  policyMismatchRate: 0.03,
  policyMismatchMinSamples: 20,
  misleadingUncertaintyRate: 0.08,
  misleadingUncertaintyMinSamples: 20,
  fairnessConcernRate: 0.02,
  fairnessConcernMinSamples: 20,
  negativeFeedbackRate: 0.1,
  negativeFeedbackMinSamples: 30,
  outcomeRegressionDelta: 0.15,
  outcomeRegressionMinSamples: 20,
} as const;

export const APPLICATION_ANALYSIS_EXPERIMENT_AUTOMATION = {
  systemActorId: 'system',
  minStageHours: 24,
  hourlyLockTtlSeconds: 60 * 20,
  nightlyLockTtlSeconds: 60 * 45,
  manualLockTtlSeconds: 60 * 30,
} as const;
