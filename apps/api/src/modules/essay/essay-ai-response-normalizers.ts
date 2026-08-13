import type {
  EssayDimension,
  GalleryLearningHighlight,
} from '@study-abroad/shared';
import type { EssayIdeaDto } from './dto';

export type EssayReviewLlmResult = {
  overallScore: number;
  scores: {
    clarity: number;
    uniqueness: number;
    storytelling: number;
    authenticity: number;
    language: number;
  };
  strengths: string[];
  weaknesses: string[];
  suggestions: string[];
  cliches?: unknown;
  verdict?: string;
};

export type EssayBrainstormLlmResult = {
  ideas?: unknown;
  overallAdvice?: string;
};

function record(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];
}

export function normalizeEssayIdeas(value: unknown): EssayIdeaDto[] {
  return Array.isArray(value)
    ? value.flatMap((item) => {
        const idea = record(item);
        if (
          typeof idea.title !== 'string' ||
          typeof idea.description !== 'string'
        ) {
          return [];
        }
        return [
          {
            title: idea.title,
            description: idea.description,
            ...(typeof idea.suitableFor === 'string'
              ? { suitableFor: idea.suitableFor }
              : {}),
          },
        ];
      })
    : [];
}

const ESSAY_DIMENSIONS: readonly EssayDimension[] = [
  'hook',
  'structure',
  'voice',
  'insight',
  'fit',
  'detail',
];

function essayDimension(value: unknown): EssayDimension {
  return typeof value === 'string' &&
    (ESSAY_DIMENSIONS as readonly string[]).includes(value)
    ? (value as EssayDimension)
    : 'detail';
}

export function normalizeLearningHighlights(
  value: unknown,
): GalleryLearningHighlight[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item): GalleryLearningHighlight | null => {
      if (typeof item === 'string') {
        const text = item.trim();
        return text ? { text, dimension: 'detail' } : null;
      }
      const object = record(item);
      const text = typeof object.text === 'string' ? object.text.trim() : '';
      return text
        ? { text, dimension: essayDimension(object.dimension) }
        : null;
    })
    .filter((item): item is GalleryLearningHighlight => item !== null)
    .slice(0, 6);
}

export interface ParagraphComment {
  paragraphIndex: number;
  paragraphText: string;
  score: number;
  status: 'excellent' | 'good' | 'needs_work';
  comment: string;
  highlights: GalleryLearningHighlight[];
  suggestions: string[];
}

export interface EssayParagraphAnalysisResponse {
  paragraphs: ParagraphComment[];
  overallScore: number;
  structure: {
    hasStrongOpening: boolean;
    hasClarity: boolean;
    hasGoodConclusion: boolean;
    feedback: string;
  };
  summary: string;
}

export function validateParagraphAnalysis(
  data: unknown,
  originalParagraphs: string[],
  locale = 'zh',
): EssayParagraphAnalysisResponse {
  const root = record(data);
  const structure = record(root.structure);
  const validateParagraph = (
    value: unknown,
    index: number,
  ): ParagraphComment => {
    const paragraph = record(value);
    const score =
      typeof paragraph.score === 'number'
        ? Math.min(10, Math.max(1, paragraph.score))
        : 5;
    const fallbackStatus =
      score >= 8 ? 'excellent' : score < 5 ? 'needs_work' : 'good';
    const status =
      paragraph.status === 'excellent' ||
      paragraph.status === 'good' ||
      paragraph.status === 'needs_work'
        ? paragraph.status
        : fallbackStatus;
    return {
      paragraphIndex: index,
      paragraphText: originalParagraphs[index]?.slice(0, 50) + '...' || '',
      score,
      status,
      comment:
        typeof paragraph.comment === 'string'
          ? paragraph.comment
          : locale === 'zh'
            ? '暂无评价'
            : 'No comment available',
      highlights: normalizeLearningHighlights(paragraph.highlights),
      suggestions: stringArray(paragraph.suggestions),
    };
  };
  const paragraphs = Array.isArray(root.paragraphs)
    ? root.paragraphs.map(validateParagraph)
    : originalParagraphs.map((_, index) => validateParagraph({}, index));
  return {
    paragraphs,
    overallScore:
      typeof root.overallScore === 'number'
        ? Math.min(100, Math.max(0, root.overallScore))
        : 60,
    structure: {
      hasStrongOpening:
        typeof structure.hasStrongOpening === 'boolean'
          ? structure.hasStrongOpening
          : false,
      hasClarity:
        typeof structure.hasClarity === 'boolean' ? structure.hasClarity : true,
      hasGoodConclusion:
        typeof structure.hasGoodConclusion === 'boolean'
          ? structure.hasGoodConclusion
          : false,
      feedback:
        typeof structure.feedback === 'string'
          ? structure.feedback
          : locale === 'zh'
            ? '请完善文书以获取更详细的结构分析。'
            : 'Please improve your essay for a more detailed structural analysis.',
    },
    summary:
      typeof root.summary === 'string'
        ? root.summary
        : locale === 'zh'
          ? '文书分析完成，请查看各段落点评。'
          : 'Essay analysis complete. Please review the paragraph-by-paragraph feedback.',
  };
}

export function defaultParagraphAnalysis(
  locale = 'zh',
): EssayParagraphAnalysisResponse {
  return {
    paragraphs: [],
    overallScore: 0,
    structure: {
      hasStrongOpening: false,
      hasClarity: false,
      hasGoodConclusion: false,
      feedback:
        locale === 'zh'
          ? '文书内容不足，请提供更多内容以进行分析。'
          : 'Not enough essay content. Please provide more content for analysis.',
    },
    summary:
      locale === 'zh'
        ? '文书内容过短或为空，无法分析。'
        : 'Essay content is too short or empty for analysis.',
  };
}
