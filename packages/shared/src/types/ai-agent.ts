// AI Agent

import type {
  ConfidenceLevel,
  PolicySourceQuality,
  PredictionOutcomeLabel,
  SchoolPolicyContext,
  SchoolIntlAidPolicy,
  SchoolRoundContext,
  SchoolTestingPolicy,
  PredictionSourceSummary,
  TierType,
} from './prediction';

export enum AgentType {
  ORCHESTRATOR = 'orchestrator',
  ESSAY = 'essay',
  SCHOOL = 'school',
  PROFILE = 'profile',
  TIMELINE = 'timeline',
  RESUME = 'resume',
}

export interface AgentChatPredictionSchoolMeta {
  usNewsRank?: number;
  acceptanceRate?: number;
  intlAcceptanceRate?: number;
  intlStudentPct?: number;
  needBlindInternational?: boolean | null;
  graduationRate?: number;
  satAvg?: number;
  sat25?: number;
  sat75?: number;
}

export interface AgentChatPredictionResultItem {
  schoolId?: string;
  schoolName: string;
  probability?: number;
  tier?: TierType;
  confidence?: ConfidenceLevel;
  actualResult?: string | null;
  source?: string;
  modelVersion?: string;
  cohortKey?: string | null;
  roundContext?: string | null;
  sourceSummary?: PredictionSourceSummary[] | null;
  uncertaintyReasons?: string[] | null;
  confidenceReason?: string | null;
  latestOutcomeLabel?: PredictionOutcomeLabel | null;
  schoolMeta?: AgentChatPredictionSchoolMeta;
}

export interface AgentChatPredictionSummary {
  total: number;
  reach: number;
  match: number;
  safety: number;
  avgProbability?: number;
}

export interface AgentChatSelectedSchoolItem {
  id: string;
  name: string;
  nameZh?: string;
  usNewsRank?: number;
  acceptanceRate?: number;
  prediction?: {
    probability?: number;
    tier?: TierType;
    confidence?: ConfidenceLevel;
    source?: string;
    modelVersion?: string;
    updatedAt?: string;
  };
}

export interface AgentChatContextBase {
  source?:
    | 'prediction_page'
    | 'prediction_result_card'
    | 'school_detail'
    | 'profile_school_list'
    | 'floating_chat'
    | string;
  createdAt?: string;
}

export interface PredictionResultsChatContext extends AgentChatContextBase {
  type: 'prediction-results';
  results: AgentChatPredictionResultItem[];
  summary?: AgentChatPredictionSummary;
}

export interface SelectedSchoolsChatContext extends AgentChatContextBase {
  type: 'selected-schools';
  schools: AgentChatSelectedSchoolItem[];
}

export type AgentChatContext = PredictionResultsChatContext | SelectedSchoolsChatContext;

export interface AiChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  agentType?: AgentType;
  toolCalls?: ToolCall[];
  toolCallId?: string;
  timestamp: Date;
}

export interface ToolCall {
  id?: string;
  name: string;
  arguments?: Record<string, unknown>;
  result?: unknown;
  status?: string;
}

export interface ActionButton {
  label: string;
  action: string;
  variant?: 'default' | 'outline' | 'ghost';
}

export interface AgentResponse {
  message: string;
  agentType: AgentType;
  toolsUsed?: string[];
  suggestions?: string[];
  actions?: ActionButton[];
  data?: Record<string, unknown>;
}

export interface StreamEvent {
  type: 'start' | 'content' | 'tool_start' | 'tool_end' | 'agent_switch' | 'done' | 'error';
  agent?: AgentType;
  conversationId?: string;
  title?: string;
  content?: string;
  tool?: string;
  toolResult?: unknown;
  response?: AgentResponse;
  error?: string;
  memoryContext?: {
    recentMemories: number;
    relevantFacts: number;
    entities: string[];
  };
}

// AI Analysis (Profile)
export type SectionStatus = 'green' | 'yellow' | 'red';

export interface SectionAnalysis {
  status: SectionStatus;
  score: number;
  feedback: string;
  highlights?: string[];
  improvements?: string[];
}

export type ApplicationAnalysisStatus = 'fresh' | 'cached' | 'degraded';

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

export type ApplicationAnalysisExperimentCapability = 'RECOURSE' | 'UNCERTAINTY' | 'FAIRNESS';

export type ExperimentalVersionStatus = 'CANARY' | 'ACTIVE';

export interface ExperimentalVersionSummary {
  capability: ApplicationAnalysisExperimentCapability;
  version: string;
  status: ExperimentalVersionStatus;
}

export interface AnalysisMeta {
  analysisVersion: string;
  state: AnalysisState;
  dataQuality: AnalysisDataQuality;
  targetSchoolCount: number;
  focusSchoolCount: number;
  schoolsWithPredictions: number;
  generatedAt: string;
  runId?: string;
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

export interface ApplicationAnalysisSourceRef {
  evidenceId?: string;
  dimension: 'TESTING' | 'INTL_AID' | 'ROUND' | 'DEADLINE' | 'OTHER';
  label: string;
  value: string;
  sourceName?: string;
  sourceUrl?: string;
  sourcePublishedAt?: string;
}

export interface ApplicationAnalysisPolicyCard {
  testingPolicy: SchoolTestingPolicy;
  intlAidPolicy: SchoolIntlAidPolicy;
  roundContext: SchoolRoundContext;
  policySourceQuality: PolicySourceQuality;
  standardDeadline?: string;
  earlyDeadlinePolicy?: string;
  evidenceIds: string[];
  sources: ApplicationAnalysisSourceRef[];
  unknowns: string[];
}

export interface ApplicationAnalysisAssessment {
  summary: string;
  whyThisIsHard: string[];
  compensatingStrengths: string[];
  topGaps: string[];
  nextActions: string[];
  historicalSignals: string[];
  hardStopRisks: string[];
}

export interface ApplicationAnalysisProfileSummary {
  applicantType: AnalysisApplicantType;
  intendedMajors: string[];
  testStrategy?: 'submit' | 'testOptional' | 'unknown';
  contextFlags: AnalysisContextFlag[];
  constraints: string[];
  grade?: string;
  educationSystem?: string;
  nationality?: string;
  citizenship?: string;
  countryOfResidence?: string;
  highSchoolContext?: string;
}

export interface ApplicationAnalysisPortfolioSummary {
  verdict: string;
  balance: PortfolioBalance;
  keyReasons: string[];
  riskBoundaries: string[];
}

export interface ApplicationAnalysisSchoolResult {
  schoolId: string;
  schoolName: string;
  tier: 'REACH' | 'TARGET' | 'SAFETY';
  round?: string;
  prediction?: TargetSchoolPredictionSnapshot;
  policyCard: ApplicationAnalysisPolicyCard;
  assessment: ApplicationAnalysisAssessment;
  recourse?: RecourseGuidance;
  uncertainty?: StrategyUncertainty;
  evidenceIds: string[];
  unknowns: string[];
}

export interface ApplicationAnalysisDebugInfo {
  stepIds: string[];
  stepTimingsMs: Record<string, number>;
  validationErrors: string[];
  promptHashes: Record<string, string>;
}

export type ApplicationAnalysisEvidenceKind =
  | 'PREDICTION_FACT'
  | 'POLICY_EVIDENCE'
  | 'DERIVED_JUDGMENT'
  | 'UNKNOWN';

export interface ApplicationAnalysisEvidenceSummaryItem {
  type: ApplicationAnalysisEvidenceKind;
  label: string;
  detail: string;
  schoolId?: string;
  schoolName?: string;
  sourceName?: string;
  sourceUrl?: string;
  sourcePublishedAt?: string;
}

export interface ApplicationAnalysisConfidenceSummary {
  level: 'low' | 'medium' | 'high';
  summary: string;
  signals: string[];
}

export interface ApplicationAnalysisFreshnessSummary {
  status: ApplicationAnalysisStatus;
  summary: string;
  generatedAt: string;
}

export interface AIAnalysisResult {
  status?: ApplicationAnalysisStatus;
  meta: AnalysisMeta & {
    traceId: string;
    degradedReason?: string;
    debugEnabled?: boolean;
    exposureId?: string;
  };
  profileSummary: ApplicationAnalysisProfileSummary;
  portfolioSummary: ApplicationAnalysisPortfolioSummary;
  overallVerdict: string;
  schools: ApplicationAnalysisSchoolResult[];
  schoolCards: ApplicationAnalysisSchoolResult[];
  topReasons: string[];
  topRisks: string[];
  actionPlan: AnalysisActionPlan;
  nextActions: string[];
  unknowns: string[];
  evidenceSummary: ApplicationAnalysisEvidenceSummaryItem[];
  confidenceSummary: ApplicationAnalysisConfidenceSummary;
  freshnessSummary: ApplicationAnalysisFreshnessSummary;
  fairnessDisclosure?: FairnessDisclosure;
  debug?: ApplicationAnalysisDebugInfo;
}
