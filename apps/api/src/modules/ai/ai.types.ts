export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ProfileAnalysisRequest {
  gpa?: number;
  gpaScale?: number;
  testScores?: Array<{ type: string; score: number }>;
  activities?: Array<{
    name: string;
    category: string;
    role: string;
    description?: string;
    hoursPerWeek?: number;
    weeksPerYear?: number;
    tier?: number;
  }>;
  awards?: Array<{
    name: string;
    level: string;
    competitionCategory?: string;
    tier?: number;
    competitionName?: string;
  }>;
  targetMajor?: string;
  intendedMajor?: string;
  secondMajor?: string;
  targetSchools?: string[];
  grade?: string;
  /** Pre-formatted high school context line (from formatHighSchoolContext) */
  highSchoolContext?: string;
}

// P0: 详细档案分析响应（红黄绿评分）
export type SectionStatus = 'green' | 'yellow' | 'red';

export interface SectionAnalysis {
  status: SectionStatus;
  score: number; // 1-10
  feedback: string;
  highlights?: string[]; // 亮点
  improvements?: string[]; // 改进点
}

export interface DetailedProfileAnalysisResponse {
  sections: {
    academic: SectionAnalysis;
    testScores: SectionAnalysis;
    activities: SectionAnalysis;
    awards: SectionAnalysis;
  };
  overallScore: number; // 1-100
  tier: 'top10' | 'top30' | 'top50' | 'top100' | 'other';
  suggestions: {
    majors: string[];
    competitions: string[];
    activities: string[];
    summerPrograms: string[];
    timeline: string[];
  };
  summary: string;
  status?: ApplicationAnalysisStatus;
  meta?: AnalysisMeta;
  profileContext?: AnalysisProfileContext;
  portfolioAnalysis?: PortfolioAnalysis;
  targetSchoolInsights?: TargetSchoolInsight[];
  actionPlan?: AnalysisActionPlan;
  recommendedPrograms?: AnalysisRecommendations;
  fairnessDisclosure?: FairnessDisclosure;
}

export type ApplicationAnalysisStatus = 'fresh' | 'cached' | 'degraded';

export type SchoolTestingPolicy = 'REQUIRED' | 'OPTIONAL' | 'BLIND' | 'UNKNOWN';
export type SchoolIntlAidPolicy = 'NEED_BLIND' | 'NEED_AWARE' | 'UNKNOWN';
export type SchoolRoundContext =
  | 'ED'
  | 'ED2'
  | 'EA'
  | 'REA'
  | 'SCEA'
  | 'RD'
  | 'UC'
  | 'UNKNOWN';
export type PolicySourceQuality = 'REVIEWED' | 'DERIVED' | 'UNKNOWN';
export type ApplicationAnalysisExperimentCapability =
  | 'RECOURSE'
  | 'UNCERTAINTY'
  | 'FAIRNESS';
export type ExperimentalVersionStatus = 'CANARY' | 'ACTIVE';

export interface SchoolPolicyContext {
  testingPolicy: SchoolTestingPolicy;
  intlAidPolicy: SchoolIntlAidPolicy;
  roundContext: SchoolRoundContext;
  policySourceQuality: PolicySourceQuality;
}

export interface ExperimentalVersionSummary {
  capability: ApplicationAnalysisExperimentCapability;
  version: string;
  status: ExperimentalVersionStatus;
}

export type AnalysisState =
  | 'ready'
  | 'noTargetSchools'
  | 'noPredictions'
  | 'insufficientProfileData'
  | 'analysisError';

export type AnalysisDataQuality = 'high' | 'medium' | 'low' | 'insufficient';

export type PortfolioBalance =
  | 'balanced'
  | 'reachHeavy'
  | 'safetyHeavy'
  | 'undermatch'
  | 'insufficient';

export type AnalysisApplicantType = 'domestic' | 'international' | 'unknown';

export type AnalysisContextFlag =
  | 'needAid'
  | 'firstGeneration'
  | 'legacy'
  | 'gapYear'
  | 'testSubmit'
  | 'testOptional';

export interface AnalysisMeta {
  analysisVersion: string;
  state: AnalysisState;
  dataQuality: AnalysisDataQuality;
  targetSchoolCount: number;
  focusSchoolCount: number;
  schoolsWithPredictions: number;
  generatedAt: string;
  exposureId?: string;
  experimentalVersions?: ExperimentalVersionSummary[];
}

export interface AnalysisProfileContext {
  targetMajor?: string;
  intendedMajor?: string;
  secondMajor?: string;
  applicantType: AnalysisApplicantType;
  contextFlags: AnalysisContextFlag[];
  grade?: string;
  educationSystem?: string;
  nationality?: string;
  citizenship?: string;
  countryOfResidence?: string;
  highSchoolContext?: string;
  testStrategy?: 'submit' | 'testOptional' | 'unknown';
}

export interface PortfolioAnalysis {
  strategyStatus: AnalysisState;
  balance: PortfolioBalance;
  verdict: string;
  reasons: string[];
  riskBoundaries: string[];
  missingPredictionSchoolNames: string[];
  missingRoundSchoolNames: string[];
}

export interface TargetSchoolPredictionSnapshot {
  probability: number;
  probabilityLow?: number;
  probabilityHigh?: number;
  tier?: 'reach' | 'match' | 'safety';
  confidence?: 'low' | 'medium' | 'high';
  updatedAt?: string;
  roundContext?: string;
  confidenceReason?: string;
}

export type RecourseEffort = 'low' | 'medium' | 'high';
export type RecourseTimeHorizon = 'now' | 'next90Days' | 'beforeSubmission';

export interface RecourseRecommendedChange {
  action: string;
  rationale: string;
  effort: RecourseEffort;
  timeHorizon: RecourseTimeHorizon;
  blockedBy?: string[];
}

export interface RecourseGuidance {
  goal: string;
  recommendedChanges: RecourseRecommendedChange[];
  estimatedDirection: 'upside' | 'stabilize' | 'mixed';
  constraints: string[];
  whyNotGuaranteed: string;
}

export interface StrategyUncertainty {
  probabilityLow?: number;
  probabilityHigh?: number;
  intervalLabel: 'tight' | 'balanced' | 'wide';
  reasons: string[];
}

export interface FairnessDisclosure {
  status: 'clear' | 'limited' | 'blocked';
  notes: string[];
  appliesTo: string[];
}

export interface TargetSchoolInsight {
  schoolId: string;
  schoolName: string;
  tier: 'REACH' | 'TARGET' | 'SAFETY';
  round?: string;
  predictionSnapshot?: TargetSchoolPredictionSnapshot;
  policyContext?: SchoolPolicyContext;
  whyThisIsHard: string[];
  compensatingStrengths: string[];
  topGaps: string[];
  nextActions: string[];
  historicalSignals: string[];
  hardStopRisks?: string[];
  recourseGuidance?: RecourseGuidance;
  strategyUncertainty?: StrategyUncertainty;
}

export interface AnalysisActionPlan {
  now: string[];
  next90Days: string[];
  beforeSubmission: string[];
}

export interface AnalysisRecommendations {
  majors: string[];
  competitions: string[];
  activities: string[];
  summerPrograms: string[];
  timeline: string[];
}

export interface EssayReviewRequest {
  prompt: string;
  content: string;
  wordLimit?: number;
}

export interface EssayReviewResponse {
  overallScore: number; // 1-10
  structure: { score: number; feedback: string };
  content: { score: number; feedback: string };
  language: { score: number; feedback: string };
  suggestions: string[];
}
