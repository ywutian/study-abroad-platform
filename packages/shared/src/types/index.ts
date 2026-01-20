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
  acceptanceRate?: number;
  tuition?: number;
  avgSalary?: number;
}

// Ranking
export interface RankingWeights {
  usNewsRank: number;
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
export interface PredictionRequest {
  profileId: string;
  targetSchools: string[];
}

export interface PredictionFactor {
  name: string;
  impact: 'positive' | 'negative' | 'neutral';
  detail: string;
}

export interface PredictionResult {
  schoolId: string;
  probability: number;
  factors: PredictionFactor[];
}

export interface PredictionResponse {
  results: PredictionResult[];
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
  SUPPLEMENT = 'SUPPLEMENT',
  WHY_SCHOOL = 'WHY_SCHOOL',
  WHY_US = 'WHY_US',
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
  type: string;
  date: string;
  notes?: string;
}

export interface SchoolMetric {
  id: string;
  schoolId: string;
  year: number;
  metricKey: string;
  value: number;
}

export interface EssayPrompt {
  prompt: string;
  wordLimit?: number;
  required?: boolean;
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
export interface AiChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'tool';
  content: string;
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

export interface StreamEvent {
  type: 'start' | 'content' | 'tool_start' | 'tool_end' | 'agent_switch' | 'done' | 'error';
  agent?: string;
  content?: string;
  tool?: string;
  toolResult?: unknown;
  response?: { message: string; agentType: string };
  error?: string;
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
