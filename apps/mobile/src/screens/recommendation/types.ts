import { useColors } from '@/utils/theme';
import type { SchoolRanking } from '@study-abroad/shared/ranking';
import type { SchoolPublicMedia } from '@study-abroad/shared/types';

// ============================================================
// Types
// ============================================================

export interface RecommendedSchool {
  schoolId?: string;
  schoolName: string;
  tier: 'reach' | 'match' | 'safety';
  estimatedProbability: number;
  fitScore: number;
  reasons: string[];
  concerns?: string[];
  schoolMeta?: {
    nameZh?: string;
    usNewsRank?: number;
    rankings?: SchoolRanking[];
    acceptanceRate?: number;
    city?: string;
    state?: string;
    tuition?: number;
    isPrivate?: boolean;
    testOptional?: boolean;
    hasEarlyDecision?: boolean;
    retentionRate?: number;
    logoUrl?: string;
    media?: SchoolPublicMedia;
    website?: string;
  };
}

export interface RecommendationResult {
  id: string;
  recommendations: RecommendedSchool[];
  analysis: {
    strengths: string[];
    weaknesses: string[];
    improvementTips: string[];
  };
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

export interface GenerateRecommendationDto {
  preferredRegions?: string[];
  preferredMajors?: string[];
  budget?: string;
  schoolCount?: number;
  additionalPreferences?: string;
}

// ============================================================
// Constants
// ============================================================

export const POINT_COST = 25;

export const REGION_OPTIONS = [
  'California',
  'New York',
  'Massachusetts',
  'Pennsylvania',
  'Illinois',
  'Texas',
  'Virginia',
  'Georgia',
  'Michigan',
  'North Carolina',
  'Washington',
  'Connecticut',
  'New Jersey',
  'Ohio',
  'Florida',
];

export const MAJOR_OPTIONS = [
  'Computer Science',
  'Engineering',
  'Business',
  'Economics',
  'Mathematics',
  'Biology',
  'Physics',
  'Chemistry',
  'Psychology',
  'Political Science',
  'Communications',
  'Data Science',
  'Finance',
  'Pre-Med',
  'Architecture',
];

export const BUDGET_OPTIONS = [
  { key: 'low', label: '< $30k/yr' },
  { key: 'medium', label: '$30k-50k/yr' },
  { key: 'high', label: '$50k-70k/yr' },
  { key: 'unlimited', label: 'No Limit' },
];

export const TIER_CONFIG = {
  reach: { color: '#ef4444', icon: 'rocket-outline' as const, labelKey: 'tierReach' },
  match: { color: '#f59e0b', icon: 'checkmark-circle-outline' as const, labelKey: 'tierMatch' },
  safety: { color: '#6f7b58', icon: 'shield-checkmark-outline' as const, labelKey: 'tierSafety' },
} as const;

// ============================================================
// Query Key Factory
// ============================================================

export const recommendationKeys = {
  all: ['recommendation'] as const,
  preflight: () => [...recommendationKeys.all, 'preflight'] as const,
  history: () => [...recommendationKeys.all, 'history'] as const,
};

// ============================================================
// Helpers
// ============================================================

export function getTierBadgeVariant(
  tier: 'reach' | 'match' | 'safety'
): 'error' | 'warning' | 'success' | 'secondary' {
  const map: Record<string, 'error' | 'warning' | 'success'> = {
    reach: 'error',
    match: 'warning',
    safety: 'success',
  };
  return map[tier] || 'secondary';
}

export function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export function formatCurrency(amount: number) {
  return `$${(amount / 1000).toFixed(0)}k`;
}

// ============================================================
// Shared prop types
// ============================================================

export type ColorsType = ReturnType<typeof useColors>;
