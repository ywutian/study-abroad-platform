/**
 * PR9 — shared `aiAnalysisCache` parser.
 *
 * Extracted from `DebateContextLoaderService.pickParagraphFromCache` so the
 * `DebateBlindEvalService` can also surface prior-commentary to blind raters
 * (the queue endpoint historically only returned essayText + userTurn +
 * aiTurn; PR8's Sarah eval flagged 5 false-N "evidence fabrication" because
 * she had no way to verify `source: 'prior_commentary'` quotes — they live in
 * `AdmissionCase.aiAnalysisCache`, not in `turns[0]`).
 */
import type { Prisma } from '@prisma/client';

/** Shape of one entry in `AdmissionCase.aiAnalysisCache[locale]`. */
export interface CachedAnalysisEntry {
  promptVersion?: string;
  generatedAt?: string;
  payload?: {
    paragraphs?: Array<{
      paragraphIndex?: number;
      score?: number;
      status?: string;
      comment?: string;
      highlights?: string[];
      suggestions?: string[];
    }>;
  };
}

export interface ParsedPriorCommentary {
  paragraphIndex: number;
  score: number;
  status: string;
  comment: string;
  highlights: string[];
  suggestions: string[];
}

/**
 * Resolve `AdmissionCase.aiAnalysisCache[locale].payload.paragraphs[idx]`
 * to the prior-commentary block for the targeted paragraph (or first
 * paragraph if `paragraphIndex` is null).
 *
 * Returns null when the cache is missing, malformed, or doesn't contain
 * the locale. Defensive: never throws on bad JSON shape.
 */
export function pickPriorCommentary(
  cache: Prisma.JsonValue | null | undefined,
  locale: 'zh' | 'en',
  paragraphIndex: number | null,
): ParsedPriorCommentary | null {
  if (!cache || typeof cache !== 'object' || Array.isArray(cache)) return null;
  const blob = (cache as Record<string, unknown>)[locale] as
    | CachedAnalysisEntry
    | undefined;
  const paragraphsCommentary = blob?.payload?.paragraphs;
  if (
    !Array.isArray(paragraphsCommentary) ||
    paragraphsCommentary.length === 0
  ) {
    return null;
  }
  const target =
    paragraphIndex != null
      ? (paragraphsCommentary.find(
          (p) => p?.paragraphIndex === paragraphIndex,
        ) ??
        paragraphsCommentary[paragraphIndex] ??
        paragraphsCommentary[0])
      : paragraphsCommentary[0];
  if (!target) return null;
  return {
    paragraphIndex:
      typeof target.paragraphIndex === 'number'
        ? target.paragraphIndex
        : (paragraphIndex ?? 0),
    score: typeof target.score === 'number' ? target.score : 5,
    status: typeof target.status === 'string' ? target.status : 'good',
    comment: typeof target.comment === 'string' ? target.comment : '',
    highlights: Array.isArray(target.highlights)
      ? target.highlights.filter((h): h is string => typeof h === 'string')
      : [],
    suggestions: Array.isArray(target.suggestions)
      ? target.suggestions.filter((s): s is string => typeof s === 'string')
      : [],
  };
}
