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
