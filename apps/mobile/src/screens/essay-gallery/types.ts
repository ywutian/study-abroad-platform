/**
 * Shared types, constants, and helpers for the Essay Gallery feature.
 */
import { useColors } from '@/utils/theme';
import type { SchoolRanking } from '@study-abroad/shared/ranking';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface GallerySchool {
  id: string;
  name: string;
  nameZh?: string;
  usNewsRank?: number;
  rankings?: SchoolRanking[];
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

export type EssayDimension = 'hook' | 'structure' | 'voice' | 'insight' | 'fit' | 'detail';

export interface EssayHighlight {
  text: string;
  dimension: EssayDimension;
}

export interface ParagraphAnalysis {
  paragraphIndex: number;
  paragraphText: string;
  score: number;
  status: 'excellent' | 'good' | 'needs_work';
  comment: string;
  // v2 (2026-06-18): objects with a dimension tag (was `string[]`). Render
  // defensively — offline-persisted results may still hold the legacy shape.
  highlights: EssayHighlight[];
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

/**
 * Admission-result accent colors, derived from the theme's semantic tokens so
 * they render correctly in both light and dark (Nocturne). Call inside a
 * component to get the live values for the current color scheme.
 */
export function useResultColors(): Record<string, string> {
  const c = useColors();
  return {
    ADMITTED: c.success,
    REJECTED: c.error,
    WAITLISTED: c.warning,
    DEFERRED: c.info,
  };
}

/**
 * Paragraph quality-status accent colors, derived from theme tokens.
 */
export function useStatusColors(): Record<string, string> {
  const c = useColors();
  return {
    excellent: c.success,
    good: c.info,
    needs_work: c.warning,
  };
}

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
