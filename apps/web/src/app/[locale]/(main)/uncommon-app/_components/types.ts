import type React from 'react';

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
  tier: 'SAFETY' | 'TARGET' | 'REACH';
  school: {
    id: string;
    name: string;
    nameZh?: string;
    usNewsRank?: number;
    acceptanceRate?: number;
  };
  isAIRecommended: boolean;
  essayPromptCount?: number;
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

export interface AIAnalysis {
  overallScore: number;
  admissionPrediction: string;
  strengths: string[];
  weaknesses: string[];
  improvements: string[];
  recommendedActivities: string[];
  timeline: Array<{ date: string; task: string }>;
  projectedImprovement: number;
}

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
