// User & Auth
export enum Role {
  USER = 'USER',
  VERIFIED = 'VERIFIED',
  ADMIN = 'ADMIN',
}

export enum Visibility {
  PRIVATE = 'PRIVATE',
  PUBLIC = 'PUBLIC',
  ANONYMOUS = 'ANONYMOUS',
  VERIFIED_ONLY = 'VERIFIED_ONLY',
}

export interface User {
  id: string;
  email: string;
  role: Role;
  emailVerified: boolean;
  locale: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

// Profile
export interface Profile {
  id: string;
  userId: string;
  realName?: string;
  gpa?: number;
  gpaScale: number;
  currentSchool?: string;
  grade?: string;
  targetMajor?: string;
  regionPref: string[];
  budgetTier?: BudgetTier;
  visibility: Visibility;
  createdAt: Date;
  updatedAt: Date;
}

export enum BudgetTier {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  UNLIMITED = 'UNLIMITED',
}

export enum TestType {
  SAT = 'SAT',
  ACT = 'ACT',
  TOEFL = 'TOEFL',
  IELTS = 'IELTS',
  AP = 'AP',
  IB = 'IB',
}

export interface TestScore {
  id: string;
  profileId: string;
  type: TestType;
  score: number;
  subScores?: Record<string, number>;
  testDate?: Date;
}

export interface Activity {
  id: string;
  profileId: string;
  name: string;
  category: ActivityCategory;
  role: string;
  description?: string;
  startDate?: Date;
  endDate?: Date;
  hoursPerWeek?: number;
  weeksPerYear?: number;
}

export enum ActivityCategory {
  ACADEMIC = 'ACADEMIC',
  ARTS = 'ARTS',
  ATHLETICS = 'ATHLETICS',
  COMMUNITY_SERVICE = 'COMMUNITY_SERVICE',
  LEADERSHIP = 'LEADERSHIP',
  WORK = 'WORK',
  RESEARCH = 'RESEARCH',
  OTHER = 'OTHER',
}

export interface Award {
  id: string;
  profileId: string;
  name: string;
  level: AwardLevel;
  year?: number;
  description?: string;
}

export enum AwardLevel {
  SCHOOL = 'SCHOOL',
  REGIONAL = 'REGIONAL',
  STATE = 'STATE',
  NATIONAL = 'NATIONAL',
  INTERNATIONAL = 'INTERNATIONAL',
}

// School
export interface School {
  id: string;
  name: string;
  nameZh?: string;
  country: string;
  state?: string;
  usNewsRank?: number;
  /** 0–100 percentage (e.g. 4.0 means 4%) */
  acceptanceRate?: number;
  tuition?: number;
  avgSalary?: number;
}

// Ranking
export interface RankingWeights {
  usNewsRank: number;
  /** Weight for acceptanceRate (0–100 scale) */
  acceptanceRate: number;
  tuition: number;
  avgSalary: number;
}

export interface CustomRanking {
  id: string;
  userId: string;
  name: string;
  weights: RankingWeights;
  isPublic: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Prediction

/**
 * Standardized model version hierarchy for PredictionResult.
 * Higher-quality sources never get overwritten by lower-quality ones.
 */
export enum ProbabilitySource {
  /** Rule-based scoring only (calculateOverallScore + logistic sigmoid) */
  STATS_ONLY = 'v1-stats',
  /** AI recommendation anchored to statistical baseline */
  RECOMMENDATION = 'v2-recommendation-anchored',
  /** Full multi-engine ensemble (Stats + AI + Historical + ML) */
  ENSEMBLE = 'v3-enterprise',
}

export interface PredictionRequest {
  profileId: string;
  targetSchools: string[];
}

export type TierType = 'reach' | 'match' | 'safety';
export type ConfidenceLevel = 'low' | 'medium' | 'high';

export interface PredictionFactor {
  name: string;
  impact: 'positive' | 'negative' | 'neutral';
  weight?: number;
  detail: string;
  improvement?: string;
}

export interface PredictionComparison {
  gpaPercentile: number;
  testScorePercentile: number;
  activityStrength: 'weak' | 'average' | 'strong';
}

export interface EngineScores {
  stats: number;
  ai?: number;
  historical?: number;
  memoryAdjustment?: number;
  weights: Record<string, number>;
  fusionMethod: string;
  crossEngineConsistency?: number;
}

export interface PredictionResult {
  schoolId: string;
  schoolName: string;
  probability: number;
  probabilityLow?: number;
  probabilityHigh?: number;
  confidence: ConfidenceLevel;
  tier: TierType;
  factors: PredictionFactor[];
  suggestions: string[];
  comparison?: PredictionComparison;
  engineScores?: EngineScores;
  fromCache?: boolean;
  cachedAt?: string;
  modelVersion?: string;
  source?: string;
  actualResult?: string;
  schoolMeta?: {
    usNewsRank?: number;
    /** 0–100 percentage (e.g. 4.0 means 4%) */
    acceptanceRate?: number;
    /** 0–100 percentage — international-specific acceptance rate */
    intlAcceptanceRate?: number;
    /** 0–100 percentage — share of international students */
    intlStudentPct?: number;
    needBlindInternational?: boolean;
    /** 0–100 percentage */
    graduationRate?: number;
    satAvg?: number;
    sat25?: number;
    sat75?: number;
  };
  majorBreakdown?: MajorBreakdown;
  communityInsight?: {
    /** 0–1 ratio (e.g. 0.35 means 35% admit rate) — convert to % for display */
    majorAdmitRate: number;
    totalCases: number;
    major: string;
  };
  crossEngineConsistency?: number;
}

export interface MajorBreakdown {
  majorName: string;
  majorNameZh?: string;
  cipCode: string;
  competitiveness: number;
  /** 0–100 percentage — estimated acceptance rate for this major */
  acceptanceRateEstimate?: number;
  modifier: number;
  /** 0–1 probability (e.g. 0.35 means 35% chance) */
  adjustedProbability: number;
}

export interface PredictionResponse {
  results: PredictionResult[];
  processingTime?: number;
  dataCompleteness?: number;
  memoryContext?: {
    previousPredictions: number;
    knownPreferences: string[];
    dataPoints: number;
  };
  validationSummary?: {
    violations: string[];
    warnings: string[];
  };
  /** Set when user selected any UC school and backend expanded to all 9 UC campuses */
  ucComparisonExpanded?: boolean;
}

// Chat
export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  createdAt: Date;
}

export interface Conversation {
  id: string;
  participantIds: string[];
  lastMessage?: Message;
  unreadCount: number;
  createdAt: Date;
  updatedAt: Date;
}

// Report
export enum ReportTargetType {
  USER = 'USER',
  MESSAGE = 'MESSAGE',
  CASE = 'CASE',
  REVIEW = 'REVIEW',
}

export enum ReportStatus {
  PENDING = 'PENDING',
  REVIEWED = 'REVIEWED',
  RESOLVED = 'RESOLVED',
}

export interface Report {
  id: string;
  reporterId: string;
  targetType: ReportTargetType;
  targetId: string;
  reason: string;
  detail?: string;
  status: ReportStatus;
  createdAt: Date;
}

// Hall - Review
export interface Review {
  id: string;
  reviewerId: string;
  profileId: string;
  academicScore: number;
  testScore: number;
  activityScore: number;
  awardScore: number;
  overallScore: number;
  comment?: string;
  academicComment?: string;
  testComment?: string;
  activityComment?: string;
  awardComment?: string;
  status: 'DRAFT' | 'PUBLISHED' | 'HIDDEN';
  tags: string[];
  helpfulCount: number;
  createdAt: Date;
}

// Admission Case
export enum AdmissionResult {
  ADMITTED = 'ADMITTED',
  REJECTED = 'REJECTED',
  WAITLISTED = 'WAITLISTED',
  DEFERRED = 'DEFERRED',
}

export interface AdmissionCase {
  id: string;
  userId: string;
  schoolId: string;
  school?: School;
  year: number;
  round?: string;
  result: AdmissionResult;
  major?: string;
  gpaRange?: string;
  satRange?: string;
  tags: string[];
  visibility: Visibility;
  isVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// API Response
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// API Request Types
export interface LoginRequest {
  email: string;
  password: string;
}
export interface RegisterRequest {
  email: string;
  password: string;
  locale?: string;
}
export interface LoginResponse {
  user: User;
  tokens: AuthTokens;
}
export interface RegisterResponse {
  user: User;
  message: string;
} // Recommendation
export interface SchoolMeta {
  nameZh?: string;
  usNewsRank?: number;
  /** 0–100 percentage (e.g. 4.0 means 4%) */
  acceptanceRate?: number;
  city?: string;
  state?: string;
  tuition?: number;
  isPrivate?: boolean;
}

export interface RecommendedSchool {
  schoolId?: string;
  schoolName: string;
  tier: 'reach' | 'match' | 'safety';
  estimatedProbability: number;
  fitScore: number;
  reasons: string[];
  concerns?: string[];
  schoolMeta?: SchoolMeta;
}

export interface RecommendationAnalysis {
  strengths: string[];
  weaknesses: string[];
  improvementTips: string[];
}

export interface RecommendationResult {
  id: string;
  recommendations: RecommendedSchool[];
  analysis: RecommendationAnalysis;
  summary: string;
  tokenUsed: number;
  createdAt: string;
}

export interface RecommendationPreflight {
  canGenerate: boolean;
  points: number;
  profileComplete: boolean;
  missingFields: string[];
  profileSummary?: {
    gpa?: number;
    testCount: number;
    activityCount: number;
  };
}

// Health Check
export interface HealthStatus {
  status: 'ok' | 'error';
  timestamp: string;
  uptime: number;
  checks: {
    database: 'ok' | 'error';
  };
}

// Competition
export enum CompetitionCategory {
  MATH = 'MATH',
  BIOLOGY = 'BIOLOGY',
  PHYSICS = 'PHYSICS',
  CHEMISTRY = 'CHEMISTRY',
  COMPUTER_SCIENCE = 'COMPUTER_SCIENCE',
  ENGINEERING_RESEARCH = 'ENGINEERING_RESEARCH',
  ECONOMICS_BUSINESS = 'ECONOMICS_BUSINESS',
  DEBATE_SPEECH = 'DEBATE_SPEECH',
  WRITING_ESSAY = 'WRITING_ESSAY',
  GENERAL_ACADEMIC = 'GENERAL_ACADEMIC',
  ARTS_MUSIC = 'ARTS_MUSIC',
  OTHER = 'OTHER',
}

export interface Competition {
  id: string;
  name: string;
  abbreviation: string;
  nameZh?: string;
  category: CompetitionCategory;
  level: string;
  tier: number;
  description?: string;
  descriptionZh?: string;
  website?: string;
  isActive: boolean;
}

// Education
export interface Education {
  id: string;
  profileId: string;
  schoolName: string;
  degree?: string;
  major?: string;
  startDate?: string;
  endDate?: string;
  gpa?: number;
  gpaScale?: number;
}

// Essay
export enum EssayType {
  COMMON_APP = 'COMMON_APP',
  UC = 'UC',
  MAIN = 'MAIN',
  SUPPLEMENTAL = 'SUPPLEMENTAL',
  WHY_SCHOOL = 'WHY_SCHOOL',
  SHORT_ANSWER = 'SHORT_ANSWER',
  ACTIVITY = 'ACTIVITY',
  OPTIONAL = 'OPTIONAL',
  OTHER = 'OTHER',
}

export interface Essay {
  id: string;
  profileId: string;
  title: string;
  content: string;
  wordCount?: number;
  schoolId?: string;
  promptType?: string;
  status: 'DRAFT' | 'IN_REVIEW' | 'FINAL';
  createdAt: string;
  updatedAt: string;
}

// School extended fields
export interface SchoolDeadline {
  id: string;
  schoolId: string;
  year: number;
  round: string;
  applicationDeadline: string;
  financialAidDeadline?: string;
  decisionDate?: string;
  notes?: string;
  applicationFee?: number;
}

export interface SchoolMetric {
  id: string;
  schoolId: string;
  year: number;
  metricKey: string;
  value: number;
}

export interface EssayPrompt {
  id: string;
  schoolId?: string;
  type?: string;
  status?: string;
  year?: number;
  prompt: string;
  promptZh?: string;
  wordLimit?: number;
  isRequired?: boolean;
  sortOrder?: number;
}

// Social
export interface Follow {
  id: string;
  followerId: string;
  followingId: string;
  follower?: User;
  following?: User;
  createdAt: string;
}

export interface Block {
  id: string;
  blockerId: string;
  blockedId: string;
  createdAt: string;
}

// Chat extended
export interface ConversationParticipant {
  id: string;
  conversationId: string;
  userId: string;
  user?: User;
}

// AI Agent

export enum AgentType {
  ORCHESTRATOR = 'orchestrator',
  ESSAY = 'essay',
  SCHOOL = 'school',
  PROFILE = 'profile',
  TIMELINE = 'timeline',
  RESUME = 'resume',
}

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

export interface AIAnalysisResult {
  sections: {
    academic: SectionAnalysis;
    testScores: SectionAnalysis;
    activities: SectionAnalysis;
    awards: SectionAnalysis;
  };
  overallScore: number;
  tier: 'top10' | 'top30' | 'top50' | 'top100' | 'other';
  suggestions: {
    majors: string[];
    competitions: string[];
    activities: string[];
    summerPrograms: string[];
    timeline: string[];
  };
  summary: string;
}

// API Error
export interface ApiError {
  message: string;
  statusCode?: number;
  error?: string;
}

// Additional enums from Prisma schema
export enum PaymentStatus {
  PENDING = 'PENDING',
  SUCCESS = 'SUCCESS',
  FAILED = 'FAILED',
  REFUNDED = 'REFUNDED',
}

export enum VerificationStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

export enum ApplicationStatus {
  NOT_STARTED = 'NOT_STARTED',
  IN_PROGRESS = 'IN_PROGRESS',
  SUBMITTED = 'SUBMITTED',
  ACCEPTED = 'ACCEPTED',
  REJECTED = 'REJECTED',
  WAITLISTED = 'WAITLISTED',
  WITHDRAWN = 'WITHDRAWN',
}

export enum MemoryType {
  FACT = 'FACT',
  PREFERENCE = 'PREFERENCE',
  DECISION = 'DECISION',
  SUMMARY = 'SUMMARY',
  FEEDBACK = 'FEEDBACK',
}

// Type alias for backward compatibility
export type CaseResult = 'ADMITTED' | 'REJECTED' | 'WAITLISTED' | 'DEFERRED';

// Resume System
export enum ResumeStatus {
  DRAFT = 'DRAFT',
  ACTIVE = 'ACTIVE',
  ARCHIVED = 'ARCHIVED',
}

export enum ResumeType {
  COLLEGE_APPLICATION = 'COLLEGE_APPLICATION',
  INTERNSHIP = 'INTERNSHIP',
  GRADUATE_CV = 'GRADUATE_CV',
}

export enum ResumeSectionType {
  HEADER = 'HEADER',
  EDUCATION = 'EDUCATION',
  TEST_SCORES = 'TEST_SCORES',
  RESEARCH = 'RESEARCH',
  WORK_EXPERIENCE = 'WORK_EXPERIENCE',
  PROJECTS = 'PROJECTS',
  ACTIVITIES = 'ACTIVITIES',
  COMMUNITY_SERVICE = 'COMMUNITY_SERVICE',
  AWARDS = 'AWARDS',
  SKILLS = 'SKILLS',
  PUBLICATIONS = 'PUBLICATIONS',
  TEACHING = 'TEACHING',
  CERTIFICATIONS = 'CERTIFICATIONS',
  CUSTOM = 'CUSTOM',
}

export interface Resume {
  id: string;
  userId: string;
  title: string;
  status: ResumeStatus;
  type: ResumeType;
  templateId: string;
  language: string;
  settings: ResumeSettings;
  sections: ResumeSection[];
  version: number;
  lastImportedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ResumeSummary {
  id: string;
  title: string;
  status: ResumeStatus;
  type: ResumeType;
  templateId: string;
  language: string;
  version: number;
  updatedAt: string;
  createdAt: string;
  _count: { sections: number };
}

export interface ResumeSection {
  id: string;
  resumeId: string;
  type: ResumeSectionType;
  title: string;
  content: Record<string, unknown>;
  isVisible: boolean;
  order: number;
  createdAt: string;
  updatedAt: string;
}

export interface ResumeSnapshot {
  id: string;
  resumeId: string;
  version: number;
  description?: string;
  createdAt: string;
}

// ─── Resume Customization Settings ───
// Stored in Resume.settings JSON field
// All fields optional — undefined means "use template default"

export interface ResumeColorSettings {
  primary?: string;
  text?: string;
  textLight?: string;
  background?: string;
  border?: string;
  sidebarBg?: string;
  sidebarText?: string;
  headerBg?: string;
  headerText?: string;
}

export interface ResumeFontSettings {
  heading?: string;
  body?: string;
}

export interface ResumeFontSizeSettings {
  name?: number;
  sectionTitle?: number;
  body?: number;
  small?: number;
}

export interface ResumeSpacingSettings {
  pageMarginX?: number;
  pageMarginY?: number;
  sectionGap?: number;
  itemGap?: number;
  lineHeight?: number;
}

export interface ResumeDecorationSettings {
  sectionDivider?: 'line' | 'double-line' | 'dots' | 'none';
  headingStyle?: 'underline' | 'background' | 'border-left' | 'uppercase' | 'plain';
  bulletStyle?: 'disc' | 'dash' | 'arrow' | 'square';
  pageSize?: 'LETTER' | 'A4';
  dateFormat?: 'MMM YYYY' | 'MM/YYYY' | 'YYYY';
}

export interface ResumeSettings {
  colors?: ResumeColorSettings;
  fonts?: ResumeFontSettings;
  fontSize?: ResumeFontSizeSettings;
  spacing?: ResumeSpacingSettings;
  decorations?: ResumeDecorationSettings;
}

// Resume Section Content Types
export interface HeaderContent {
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  linkedIn?: string;
  github?: string;
  website?: string;
  targetMajor?: string;
}

export interface EducationItem {
  id: string;
  schoolName: string;
  location?: string;
  degree?: string;
  major?: string;
  gpa?: number;
  gpaScale?: number;
  startDate: string;
  endDate?: string;
  coursework?: string[];
  honors?: string[];
  description?: string;
}

export interface TestScoreItem {
  id: string;
  type: string;
  score: number;
  subScores?: Record<string, number>;
  testDate?: string;
}

export interface ExperienceItem {
  id: string;
  title: string;
  company?: string;
  institution?: string;
  advisor?: string;
  location?: string;
  startDate?: string;
  endDate?: string;
  isCurrent?: boolean;
  bullets: string[];
}

export interface ProjectItem {
  id: string;
  name: string;
  techStack?: string[];
  url?: string;
  startDate?: string;
  endDate?: string;
  bullets: string[];
}

export interface ActivityItem {
  id: string;
  name: string;
  role: string;
  organization?: string;
  category?: string;
  startDate?: string;
  endDate?: string;
  isOngoing?: boolean;
  bullets: string[];
  hoursPerWeek?: number;
  weeksPerYear?: number;
}

export interface AwardItem {
  id: string;
  name: string;
  level: string;
  issuer?: string;
  year?: number;
  description?: string;
}

export interface SkillCategory {
  name: string;
  items: string[];
}

export interface PublicationItem {
  id: string;
  title: string;
  authors?: string;
  venue?: string;
  date?: string;
  doi?: string;
  status?: string;
}

export interface CertificationItem {
  id: string;
  name: string;
  issuer: string;
  date?: string;
  url?: string;
}

// Resume AI Review Types — v1 (legacy, for backward compat with old DB records)
export interface ResumeReviewResultV1 {
  overallScore: number;
  dimensions: Array<{
    name: string;
    score: number;
    status: 'green' | 'yellow' | 'red';
    feedback: string;
    improvements: string[];
  }>;
  bulletQuality: {
    actionVerbUsage: number;
    quantificationRate: number;
    averageLength: number;
  };
  contentGaps: string[];
  summary: string;
}

// Resume AI Review Types — v2 (standardized rubric + section-linked feedback)
export type ReviewIssueType =
  | 'weak_verb'
  | 'no_quantification'
  | 'too_vague'
  | 'missing_result'
  | 'too_long'
  | 'too_short'
  | 'formatting'
  | 'relevance'
  | 'missing_info'
  | 'tense_inconsistency'
  | 'generic_claim';

export type ReviewSeverity = 'high' | 'medium' | 'low';

export interface ReviewCriterion {
  key: string;
  name: string;
  score: number;
  maxScore: number;
  detail: string;
}

export interface SectionIssue {
  type: ReviewIssueType;
  severity: ReviewSeverity;
  original: string;
  suggestion: string;
  reason: string;
  bulletIndex?: number;
}

export interface SectionFeedback {
  sectionType: string;
  sectionTitle: string;
  sectionId?: string;
  issues: SectionIssue[];
}

export interface ContentGap {
  sectionType: string;
  description: string;
  priority: ReviewSeverity;
  example?: string;
}

export interface ResumeReviewResult {
  version: 2;
  overallScore: number;
  dimensions: Array<{
    name: string;
    score: number;
    status: 'green' | 'yellow' | 'red';
    feedback: string;
    criteria: ReviewCriterion[];
    improvements: string[];
  }>;
  sectionFeedback: SectionFeedback[];
  contentGaps: ContentGap[];
  bulletQuality: {
    actionVerbUsage: number;
    quantificationRate: number;
    averageLength: number;
  };
  summary: string;
}

export interface BulletOptimizeResult {
  optimized: Array<{
    original: string;
    improved: string;
    reason: string;
  }>;
  newSuggestions?: string[];
}

export interface ContentSuggestionResult {
  suggestions: Array<{
    text: string;
    category: string;
    priority: 'high' | 'medium' | 'low';
  }>;
  tips: string[];
  exampleBullets?: string[];
}
