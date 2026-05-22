import type React from 'react';
import type { AIAnalysisResult } from '@study-abroad/shared';
import type { SchoolRanking } from '@/lib/utils/ranking';

export enum AgentType {
  ORCHESTRATOR = 'orchestrator',
  ESSAY = 'essay',
  SCHOOL = 'school',
  PROFILE = 'profile',
  TIMELINE = 'timeline',
}

export interface SchoolRecommendation {
  name: string;
  nameZh?: string;
  reason?: string;
  description?: string;
  tier?: string;
  fit?: string;
}

export interface AgentResponseData {
  schools?: SchoolRecommendation[];
  analysis?: {
    strengths?: string[];
    weaknesses?: string[];
    improvements?: string[];
    activities?: string[];
    timeline?: Array<{ date: string; task: string }>;
    improvement?: number;
  };
}

export interface AgentResponse {
  message: string;
  agentType: AgentType;
  toolsUsed?: string[];
  suggestions?: string[];
  data?: AgentResponseData;
}

export interface SchoolListItem {
  id: string;
  schoolId: string;
  /** Effective tier: prediction-derived when tierSource=PREDICTED, else the manual override. */
  tier: 'SAFETY' | 'TARGET' | 'REACH';
  /** Whether `tier` follows the prediction (PREDICTED) or is a manual override (MANUAL). */
  tierSource?: 'PREDICTED' | 'MANUAL';
  /** The tier the latest prediction would assign — for a "predicted: …" hint when overridden. */
  predictedTier?: 'SAFETY' | 'TARGET' | 'REACH';
  /** True when `tier` is an unverified default (PREDICTED but no usable prediction yet). */
  tierIsEstimated?: boolean;
  round?: string;
  school: {
    id: string;
    name: string;
    nameZh?: string;
    usNewsRank?: number;
    rankings?: SchoolRanking[];
    acceptanceRate?: number;
  };
  isAIRecommended: boolean;
  prediction?: {
    probability?: number;
    tier?: string;
    confidence?: string;
    source?: string;
    authority?: 'AUTHORITATIVE' | 'PREVIEW';
    updatedAt?: string | Date;
  };
  essayPromptCount?: number;
  deadlines?: Array<{
    round: string;
    applicationDeadline: string;
    financialAidDeadline?: string;
    interviewRequired?: boolean;
    interviewDeadline?: string;
    interviewFormat?: string;
  }>;
}

export interface Profile {
  id: string;
  realName?: string;
  gpa?: number;
  grade?: string;
  testScores: Array<{ type: string; score: number }>;
  activities: Array<{ id: string; name: string }>;
  awards: Array<{ id: string; name: string }>;
}

export type AIAnalysis = AIAnalysisResult;

export interface TieredRecommendations {
  safety: SchoolRecommendation[];
  target: SchoolRecommendation[];
  reach: SchoolRecommendation[];
}

export type TierKey = 'SAFETY' | 'TARGET' | 'REACH';

export interface TierConfig {
  color: string;
  icon: React.ComponentType<{ className?: string }>;
  border: string;
  iconBg: string;
  iconColor: string;
  badgeClass: string;
}
