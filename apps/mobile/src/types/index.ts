// ============== User & Auth ==============
export interface User {
  id: string;
  email: string;
  role: 'USER' | 'VERIFIED' | 'ADMIN';
  emailVerified: boolean;
  locale: string;
  createdAt?: string;
  updatedAt?: string;
}

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
export type Visibility = 'PRIVATE' | 'ANONYMOUS' | 'PUBLIC' | 'VERIFIED_ONLY';
export type SchoolType = 'PUBLIC_SCHOOL' | 'PRIVATE_SCHOOL' | 'INTERNATIONAL';
export type BudgetTier = 'UNDER_30K' | 'UNDER_50K' | 'UNDER_70K' | 'ABOVE_70K';

export interface Profile {
  id: string;
  userId: string;
  grade?: string;
  schoolType?: SchoolType;
  currentSchool?: string;
  targetMajor?: string;
  regionPreference?: string[];
  budgetTier?: BudgetTier;
  visibility: Visibility;
  gpa?: number;
  gpaScale?: number;
  testScores: TestScore[];
  activities: Activity[];
  awards: Award[];
  education: Education[];
  essays: Essay[];
  createdAt: string;
  updatedAt: string;
}

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
}

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
  usnewsRank?: number;
  qsRank?: number;
  tuition?: number;
  avgSalary?: number;
  totalStudents?: number;
  website?: string;
  logoUrl?: string;
  description?: string;
  descriptionZh?: string;
  essayPrompts?: EssayPrompt[];
  deadlines?: SchoolDeadline[];
  metrics?: SchoolMetric[];
  createdAt: string;
  updatedAt: string;
}

export interface EssayPrompt {
  prompt: string;
  wordLimit?: number;
  required?: boolean;
}

export interface SchoolDeadline {
  type: string;
  date: string;
  notes?: string;
}

export interface SchoolMetric {
  id: string;
  schoolId: string;
  year: number;
  metricType: string;
  value: number;
}

// ============== Case ==============
export type CaseResult = 'ADMITTED' | 'REJECTED' | 'WAITLISTED' | 'DEFERRED';

export interface Case {
  id: string;
  userId: string;
  schoolId: string;
  school?: School;
  major?: string;
  year: number;
  result: CaseResult;
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
  visibility: Visibility;
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

export interface ConversationParticipant {
  id: string;
  conversationId: string;
  userId: string;
  user?: User;
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

// ============== Social ==============
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

export interface Report {
  id: string;
  reporterId: string;
  reportedId: string;
  reason: string;
  description?: string;
  status: 'PENDING' | 'REVIEWED' | 'RESOLVED' | 'DISMISSED';
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
export interface PredictionResult {
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
  usnewsRank: number;
  acceptanceRate: number;
  tuition: number;
  avgSalary: number;
}

export interface RankedSchool extends School {
  score: number;
  rank: number;
}

// ============== AI ==============
export interface AiChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'tool';
  content: string;
  toolCalls?: ToolCall[];
  toolCallId?: string;
  timestamp: Date;
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
  result?: unknown;
}

export interface StreamEvent {
  type: 'thinking' | 'tool_call' | 'tool_result' | 'content' | 'done' | 'error';
  content?: string;
  toolCall?: ToolCall;
  error?: string;
}

// ============== API Response ==============
export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface ApiError {
  message: string;
  statusCode?: number;
  error?: string;
}









