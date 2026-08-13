import type { Ionicons } from '@expo/vector-icons';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AgentType = 'orchestrator' | 'essay' | 'school' | 'profile' | 'timeline';
export type AgentMode = 'auto' | AgentType;

export interface QuotaData {
  used: number;
  limit: number;
  remaining: number;
  resetAt?: string;
}

export interface AgentChip {
  key: AgentMode;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}

export interface QuickAction {
  agent: AgentType;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  titleKey: string;
  descKey: string;
  prompt: string;
}

export interface SchoolListItem {
  id: string;
  tier: 'REACH' | 'TARGET' | 'SAFETY';
  essayPromptCount?: number;
}

export interface ProfileSummary {
  gpa?: number | null;
  testScores?: unknown[];
  activities?: unknown[];
  awards?: unknown[];
}

export interface PredictionDashboard {
  totalSchools?: number;
  predictions?: Array<{
    schoolId: string;
    tier: 'reach' | 'match' | 'safety' | 'unavailable';
    probability: number | null;
  }>;
}
