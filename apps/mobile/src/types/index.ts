// Re-export shared enums as the single source of truth
export {
  Role,
  Visibility,
  BudgetTier,
  TestType,
  ActivityCategory,
  AwardLevel,
  AdmissionResult,
  CompetitionCategory,
  EssayType,
  ReportTargetType,
  ReportStatus,
  PaymentStatus,
  VerificationStatus,
  ApplicationStatus,
  MemoryType,
} from '@study-abroad/shared/types';

// Import for local use in interfaces (re-export alone doesn't create local binding)
import type { ConversationParticipant } from '@study-abroad/shared/types';

// Re-export shared types
export type {
  AuthTokens,
  Competition,
  Education,
  Essay,
  SchoolDeadline,
  SchoolMetric,
  EssayPrompt,
  Follow,
  Block,
  ConversationParticipant,
  AiChatMessage,
  ToolCall,
  StreamEvent,
  ApiError,
  RankingWeights,
  PredictionFactor,
  PredictionResult,
  Report,
  Review,
  RecommendedSchool,
  RecommendationAnalysis,
  RecommendationResult,
  RecommendationPreflight,
  CaseResult,
} from '@study-abroad/shared/types';

// ============== User ==============
// Mobile User uses string dates (from JSON) and string literal roles
export interface User {
  id: string;
  email: string;
  role: 'USER' | 'VERIFIED' | 'ADMIN';
  emailVerified: boolean;
  locale: string;
  createdAt?: string;
  updatedAt?: string;
}

// ============== Auth ==============
export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: User;
}

export interface LoginDto {
  email: string;
  password: string;
}

export interface RegisterDto {
  email: string;
  password: string;
}

// ============== Profile ==============
// Mobile profile includes nested relations from API
export type SchoolType = 'PUBLIC_SCHOOL' | 'PRIVATE_SCHOOL' | 'INTERNATIONAL';

export interface TestScore {
  id: string;
  profileId: string;
  testType: string;
  totalScore?: number;
  subScores?: Record<string, number>;
  testDate?: string;
}

export interface Activity {
  id: string;
  profileId: string;
  name: string;
  role: string;
  organization?: string;
  description?: string;
  startDate?: string;
  endDate?: string;
  hoursPerWeek?: number;
  weeksPerYear?: number;
}

export interface Award {
  id: string;
  profileId: string;
  name: string;
  level: string;
  date?: string;
  description?: string;
  competitionId?: string;
  competition?: import('@study-abroad/shared/types').Competition;
}

export interface Profile {
  id: string;
  userId: string;
  grade?: string;
  schoolType?: SchoolType;
  currentSchool?: string;
  targetMajor?: string;
  regionPreference?: string[];
  budgetTier?: string;
  visibility: string;
  gpa?: number;
  gpaScale?: number;
  testScores: TestScore[];
  activities: Activity[];
  awards: Award[];
  education: import('@study-abroad/shared/types').Education[];
  essays: import('@study-abroad/shared/types').Essay[];
  createdAt: string;
  updatedAt: string;
}

// ============== School ==============
export interface School {
  id: string;
  name: string;
  nameZh?: string;
  country: string;
  state?: string;
  city?: string;
  type?: string;
  acceptanceRate?: number;
  usNewsRank?: number;
  qsRank?: number;
  tuition?: number;
  avgSalary?: number;
  totalEnrollment?: number;
  satAvg?: number;
  sat25?: number;
  sat75?: number;
  satMath25?: number;
  satMath75?: number;
  satReading25?: number;
  satReading75?: number;
  actAvg?: number;
  act25?: number;
  act75?: number;
  studentCount?: number;
  graduationRate?: number;
  isPrivate?: boolean;
  nicheSafetyGrade?: string;
  nicheLifeGrade?: string;
  nicheFoodGrade?: string;
  nicheOverallGrade?: string;
  website?: string;
  logoUrl?: string;
  description?: string;
  descriptionZh?: string;
  essayPrompts?: import('@study-abroad/shared/types').EssayPrompt[];
  deadlines?: import('@study-abroad/shared/types').SchoolDeadline[];
  metrics?: import('@study-abroad/shared/types').SchoolMetric[];
  createdAt: string;
  updatedAt: string;
}

// ============== Case ==============
export interface Case {
  id: string;
  userId: string;
  schoolId: string;
  school?: School;
  major?: string;
  year: number;
  result: import('@study-abroad/shared/types').CaseResult;
  round?: string;
  gpa?: number;
  gpaScale?: number;
  satScore?: number;
  actScore?: number;
  toeflScore?: number;
  ieltsScore?: number;
  activities?: string;
  awards?: string;
  essays?: string;
  tips?: string;
  visibility: string;
  verified: boolean;
  points?: number;
  createdAt: string;
  updatedAt: string;
}

// ============== Chat ==============
export interface Conversation {
  id: string;
  participants: ConversationParticipant[];
  messages: Message[];
  lastMessageAt: string;
  createdAt: string;
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  sender?: User;
  content: string;
  read: boolean;
  createdAt: string;
}

// ============== Hall ==============
export interface ProfileReview {
  id: string;
  profileId: string;
  reviewerId: string;
  academic: number;
  activity: number;
  essay: number;
  overall: number;
  comment?: string;
  createdAt: string;
}

export interface UserList {
  id: string;
  creatorId: string;
  creator?: User;
  title: string;
  description?: string;
  type: string;
  profiles: Profile[];
  votes: number;
  createdAt: string;
}

// ============== Prediction ==============
export interface PredictionResponse {
  schoolId: string;
  school?: School;
  probability: number;
  factors: {
    positive: string[];
    negative: string[];
  };
  suggestion?: string;
}

// ============== Ranking ==============
export interface RankingWeight {
  usNewsRank: number;
  acceptanceRate: number;
  tuition: number;
  avgSalary: number;
}

export interface RankedSchool extends School {
  score: number;
  rank: number;
}

// ============== API Response ==============
// Matches backend PaginatedResponseDto exactly
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
