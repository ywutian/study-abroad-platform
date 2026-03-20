/**
 * Shared types, constants, and helpers for the Essay Gallery feature.
 */
import { useColors } from '@/utils/theme';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface GallerySchool {
  id: string;
  name: string;
  nameZh?: string;
  usNewsRank?: number;
}

export interface GalleryEssay {
  id: string;
  year: number;
  result: string;
  essayType?: string;
  promptNumber?: number;
  prompt: string | null;
  preview: string | null;
  wordCount: number;
  school: GallerySchool | null;
  tags: string[];
  isVerified: boolean;
}

export interface GalleryStats {
  total: number;
  admitted: number;
  top20: number;
  byType: Record<string, number>;
}

export interface GalleryResponse {
  items: GalleryEssay[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  stats: GalleryStats;
}

export interface EssayDetail {
  id: string;
  year: number;
  round: string;
  result: string;
  prompt: string | null;
  content: string | null;
  wordCount: number;
  gpaRange: string | null;
  satRange: string | null;
  school: GallerySchool | null;
  tags: string[];
  isVerified: boolean;
  isAnonymous: boolean;
}

export interface ParagraphAnalysis {
  paragraphIndex: number;
  paragraphText: string;
  score: number;
  status: 'excellent' | 'good' | 'needs_work';
  comment: string;
  highlights: string[];
  suggestions: string[];
}

export interface AnalysisResult {
  essayId: string;
  paragraphs: ParagraphAnalysis[];
  overallScore: number;
  structure: {
    hasStrongOpening: boolean;
    hasClarity: boolean;
    hasGoodConclusion: boolean;
    feedback: string;
  };
  summary: string;
  tokenUsed: number;
}

export type Colors = ReturnType<typeof useColors>;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const RESULT_COLORS: Record<string, string> = {
  ADMITTED: '#10b981',
  REJECTED: '#ef4444',
  WAITLISTED: '#f59e0b',
  DEFERRED: '#3b82f6',
};

export const STATUS_COLORS: Record<string, string> = {
  excellent: '#10b981',
  good: '#3b82f6',
  needs_work: '#f59e0b',
};

export const ESSAY_TYPES = [
  'ALL',
  'COMMON_APP',
  'UC',
  'SUPPLEMENTAL',
  'WHY_SCHOOL',
  'OTHER',
] as const;
export const RESULTS = ['ALL', 'ADMITTED', 'REJECTED', 'WAITLISTED', 'DEFERRED'] as const;
export const YEARS = [0, 2026, 2025, 2024, 2023, 2022] as const;

export const PAGE_SIZE = 10;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function resultBadgeVariant(result: string) {
  switch (result) {
    case 'ADMITTED':
      return 'success' as const;
    case 'REJECTED':
      return 'error' as const;
    case 'WAITLISTED':
      return 'warning' as const;
    default:
      return 'secondary' as const;
  }
}
