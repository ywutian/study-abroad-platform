// User & Auth
export enum Role {
  USER = 'USER',
  VERIFIED = 'VERIFIED',
  ADMIN = 'ADMIN',
}

export enum Visibility {
  PRIVATE = 'PRIVATE',
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
  activityScore: number;
  essayScore: number;
  overallScore: number;
  comment?: string;
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

