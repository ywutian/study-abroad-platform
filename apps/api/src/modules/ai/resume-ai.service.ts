import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { LLMService } from '../ai-agent/core/llm.service';
import { extractJsonFromLlm } from '../../common/utils/llm-json.util';
import type { ResumeReviewResult, ReviewIssueType } from '@study-abroad/shared';
import {
  buildResumeReviewSystemPrompt,
  buildBulletOptimizeSystemPrompt,
  buildSectionSuggestSystemPrompt,
} from './resume-ai.prompts';

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asRecord(value: unknown): UnknownRecord {
  return isRecord(value) ? value : {};
}

function asRecordArray(value: unknown): UnknownRecord[] {
  return Array.isArray(value) ? value.filter(isRecord) : [];
}

function asText(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function asNumber(value: unknown, fallback: number): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];
}

function formatUnknown(value: unknown): string {
  if (typeof value === 'string') return value;
  if (
    typeof value === 'number' ||
    typeof value === 'boolean' ||
    typeof value === 'bigint'
  )
    return String(value);
  return JSON.stringify(value) ?? '';
}

@Injectable()
export class ResumeAiService {
  private readonly logger = new Logger(ResumeAiService.name);

  constructor(private readonly llmService: LLMService) {}

  async reviewResume(
    resumeData: {
      sections: Array<{
        id: string;
        type: string;
        title: string;
        content: unknown;
      }>;
      templateId: string;
      resumeType: string;
      targetContext?: Record<string, unknown>;
    },
    context: Record<string, unknown> = {},
    locale = 'zh',
  ): Promise<ResumeReviewResult> {
    const systemPrompt = buildResumeReviewSystemPrompt(
      locale,
      resumeData.resumeType,
      Boolean(context.targetSchool),
    );

    const sectionsText = this.serializeResumeSections(resumeData.sections);
    const targetContextText = this.serializeTargetContext(context);

    const userPrompt = `${targetContextText ? `Target Context:\n${targetContextText}\n\n` : ''}
Resume Type: ${resumeData.resumeType}

${sectionsText}`;

    try {
      const result = await this.llmService.chatSimpleGuarded(
        [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        { temperature: 0.3, maxTokens: 4000 },
      );

      const parsed = extractJsonFromLlm<unknown>(result);
      return this.parseReviewResult(parsed, resumeData.sections);
    } catch (error) {
      this.logger.error('Resume review failed', error);
      throw new BadRequestException('Failed to review resume');
    }
  }

  /**
   * Serialize resume sections into a structured format for LLM input.
   * Uses a human-readable format with bullet indices so the LLM can reference them.
   */
  private serializeResumeSections(
    sections: Array<{
      id: string;
      type: string;
      title: string;
      content: unknown;
    }>,
  ): string {
    return sections
      .map((s, idx) => {
        const header = `=== SECTION ${idx + 1} [${s.type}] "${s.title}" ===`;
        const content = s.content;
        const contentRecord = asRecord(content);

        // Handle sections with items (WORK_EXPERIENCE, ACTIVITIES, etc.)
        if (Array.isArray(contentRecord.items)) {
          const items = asRecordArray(contentRecord.items)
            .map((item) => {
              const titleParts = [
                asText(item.title) || asText(item.role) || asText(item.degree),
              ];
              const organization =
                asText(item.organization) ||
                asText(item.school) ||
                asText(item.company);
              if (organization) titleParts.push(`at "${organization}"`);
              const startDate = asText(item.startDate) || asText(item.date);
              const endDate = asText(item.endDate);
              if (startDate)
                titleParts.push(
                  `(${startDate}${endDate ? ` - ${endDate}` : ''})`,
                );

              const itemHeader = `Item: ${titleParts.join(' ')}`;
              const bullets = Array.isArray(item.bullets)
                ? asStringArray(item.bullets)
                    .map((bullet, index) => `  Bullet[${index}]: "${bullet}"`)
                    .join('\n')
                : asText(item.description)
                  ? `  Description: "${asText(item.description)}"`
                  : '';

              return bullets ? `${itemHeader}\n${bullets}` : itemHeader;
            })
            .join('\n');
          return `${header}\n${items}`;
        }

        // Handle simple content (SKILLS, HEADER, etc.)
        if (typeof content === 'object' && content !== null) {
          const entries = Object.entries(content)
            .filter(([, v]) => v !== null && v !== undefined && v !== '')
            .map(([k, v]) =>
              Array.isArray(v)
                ? `${k}: ${v.map(formatUnknown).join(', ')}`
                : `${k}: ${formatUnknown(v)}`,
            )
            .join('\n  ');
          return `${header}\n  ${entries}`;
        }

        return `${header}\n  ${formatUnknown(content)}`;
      })
      .join('\n\n');
  }

  /**
   * Parse and validate LLM review output. Recompute scores server-side.
   */
  private parseReviewResult(
    parsed: unknown,
    sections: Array<{ id: string; type: string; title: string }>,
  ): ResumeReviewResult {
    const DIMENSION_WEIGHTS: Record<string, number> = {
      content: 0.3,
      formatting: 0.2,
      impact: 0.2,
      completeness: 0.15,
      relevance: 0.15,
    };

    const validIssueTypes = new Set<ReviewIssueType>([
      'weak_verb',
      'no_quantification',
      'too_vague',
      'missing_result',
      'too_long',
      'too_short',
      'formatting',
      'relevance',
      'missing_info',
      'tense_inconsistency',
      'generic_claim',
    ]);

    const clamp = (v: number, min: number, max: number) =>
      Math.min(max, Math.max(min, v));

    const root = asRecord(parsed);

    // Parse dimensions with criteria
    const dimensions = asRecordArray(root.dimensions).map((dimension) => {
      const criteria = asRecordArray(dimension.criteria).map((criterion) => ({
        key: asText(criterion.key),
        name: asText(criterion.name) || asText(criterion.key),
        score: clamp(asNumber(criterion.score, 5), 0, 10),
        maxScore: 10,
        detail: asText(criterion.detail),
      }));

      // Recompute dimension score from criteria
      const dimScore =
        criteria.length > 0
          ? Math.round(
              (criteria.reduce((sum, criterion) => sum + criterion.score, 0) /
                criteria.length) *
                10,
            )
          : clamp(asNumber(dimension.score, 50), 0, 100);

      const status: 'green' | 'yellow' | 'red' =
        dimScore >= 70 ? 'green' : dimScore >= 40 ? 'yellow' : 'red';

      return {
        name: asText(dimension.name),
        score: dimScore,
        status,
        feedback: asText(dimension.feedback),
        criteria,
        improvements: asStringArray(dimension.improvements),
      };
    });

    // Recompute overall score server-side
    const overallScore = Math.round(
      dimensions.reduce((sum, dimension) => {
        const weight = DIMENSION_WEIGHTS[dimension.name] ?? 0.2;
        return sum + dimension.score * weight;
      }, 0),
    );

    // Parse section feedback
    const sectionIdMap = new Map(sections.map((s) => [s.type, s.id]));
    const sectionFeedback = asRecordArray(root.sectionFeedback).map(
      (feedback) => {
        const sectionType = asText(feedback.sectionType);
        return {
          sectionType,
          sectionTitle: asText(feedback.sectionTitle),
          sectionId: sectionIdMap.get(sectionType),
          issues: asRecordArray(feedback.issues)
            .filter((issue) =>
              Boolean(
                asText(issue.original) &&
                asText(issue.suggestion) &&
                asText(issue.reason),
              ),
            )
            .map((issue) => ({
              type: validIssueTypes.has(asText(issue.type) as ReviewIssueType)
                ? (asText(issue.type) as ReviewIssueType)
                : 'too_vague',
              severity: ['high', 'medium', 'low'].includes(
                asText(issue.severity),
              )
                ? (asText(issue.severity) as 'high' | 'medium' | 'low')
                : 'medium',
              original: asText(issue.original),
              suggestion: asText(issue.suggestion),
              reason: asText(issue.reason),
              ...(issue.bulletIndex !== undefined && issue.bulletIndex !== null
                ? { bulletIndex: asNumber(issue.bulletIndex, 0) }
                : {}),
            })),
        };
      },
    );

    // Parse content gaps
    const contentGaps = Array.isArray(root.contentGaps)
      ? root.contentGaps.map((gap) =>
          typeof gap === 'string'
            ? { sectionType: '', description: gap, priority: 'medium' as const }
            : {
                sectionType: asText(asRecord(gap).sectionType),
                description: asText(asRecord(gap).description),
                priority: ['high', 'medium', 'low'].includes(
                  asText(asRecord(gap).priority),
                )
                  ? (asText(asRecord(gap).priority) as
                      'high' | 'medium' | 'low')
                  : 'medium',
                ...(asText(asRecord(gap).example)
                  ? { example: asText(asRecord(gap).example) }
                  : {}),
              },
        )
      : [];

    return {
      version: 2,
      overallScore: clamp(
        overallScore || asNumber(root.overallScore, 50),
        0,
        100,
      ),
      dimensions,
      sectionFeedback,
      contentGaps,
      bulletQuality: {
        actionVerbUsage: asNumber(
          asRecord(root.bulletQuality).actionVerbUsage,
          0,
        ),
        quantificationRate: asNumber(
          asRecord(root.bulletQuality).quantificationRate,
          0,
        ),
        averageLength: asNumber(asRecord(root.bulletQuality).averageLength, 0),
      },
      summary: asText(root.summary),
    };
  }

  async optimizeResumeBullets(
    bullets: string[],
    context: {
      sectionType: string;
      role?: string;
      organization?: string;
      targetSchool?: string;
      targetMajor?: string;
      resumeType?: string;
      targetContext?: Record<string, unknown>;
      targetRole?: string;
      company?: string;
      jobDescription?: string;
      keywords?: string[];
    },
    locale = 'zh',
  ): Promise<{
    optimized: Array<{ original: string; improved: string; reason: string }>;
    newSuggestions?: string[];
  }> {
    const systemPrompt = buildBulletOptimizeSystemPrompt(
      locale,
      context.resumeType,
    );

    const targetContextText = this.serializeTargetContext(context);

    const userPrompt = `Section: ${context.sectionType}${context.role ? ` | Role: ${context.role}` : ''}${context.organization ? ` | Org: ${context.organization}` : ''}
${targetContextText ? `Target Context:\n${targetContextText}\n` : ''}

Bullets to optimize:
${bullets.map((b, i) => `${i + 1}. ${b}`).join('\n')}`;

    try {
      const result = await this.llmService.chatSimpleGuarded(
        [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        { temperature: 0.5, maxTokens: 2000 },
      );

      const parsed = asRecord(extractJsonFromLlm<unknown>(result));
      return {
        optimized: asRecordArray(parsed.optimized).map((optimization) => ({
          original: asText(optimization.original),
          improved: asText(optimization.improved),
          reason: asText(optimization.reason),
        })),
        newSuggestions: asStringArray(parsed.newSuggestions),
      };
    } catch (error) {
      this.logger.error('Bullet optimization failed', error);
      throw new BadRequestException('Failed to optimize bullets');
    }
  }

  async suggestSectionContent(
    sectionType: string,
    context: {
      existingContent: unknown;
      resumeType: string;
      targetMajor?: string;
      targetContext?: Record<string, unknown>;
      grade?: string;
      profileActivities?: unknown[];
      profileAwards?: unknown[];
    },
    locale = 'zh',
  ): Promise<{
    suggestions: Array<{
      text: string;
      category: string;
      priority: 'high' | 'medium' | 'low';
    }>;
    tips: string[];
    exampleBullets?: string[];
  }> {
    const systemPrompt = buildSectionSuggestSystemPrompt(locale, sectionType);
    const targetContextText = this.serializeTargetContext(
      context.targetContext ?? {},
    );

    const userPrompt = `Section: ${sectionType}
Resume Type: ${context.resumeType}
${context.targetMajor ? `Target Major: ${context.targetMajor}` : ''}
${targetContextText ? `Target Context:\n${targetContextText}` : ''}
${context.grade ? `Grade: ${context.grade}` : ''}
Existing Content: ${JSON.stringify(context.existingContent)}
${
  context.profileActivities?.length
    ? `Profile Activities:\n${context.profileActivities
        .slice(0, 5)
        .map((value) => {
          const activity = asRecord(value);
          let line = `- ${asText(activity.name)} (${asText(activity.role)}, ${asText(activity.category)})`;
          const description = asText(activity.description);
          if (description) line += `: ${description.slice(0, 100)}`;
          return line;
        })
        .join('\n')}`
    : ''
}
${
  context.profileAwards?.length
    ? `Profile Awards:\n${context.profileAwards
        .slice(0, 5)
        .map((value) => {
          const award = asRecord(value);
          let line = `- ${asText(award.name)} (${asText(award.level)})`;
          const competitionName = asText(asRecord(award.competition).name);
          if (competitionName) line += ` — ${competitionName}`;
          return line;
        })
        .join('\n')}`
    : ''
}`;

    try {
      const result = await this.llmService.chatSimpleGuarded(
        [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        { temperature: 0.7, maxTokens: 2000 },
      );

      const parsed = asRecord(extractJsonFromLlm<unknown>(result));
      const exampleBullets = asStringArray(parsed.exampleBullets);
      return {
        suggestions: asRecordArray(parsed.suggestions).map((suggestion) => ({
          text: asText(suggestion.text),
          category: asText(suggestion.category, 'new_item'),
          priority: ['high', 'medium', 'low'].includes(
            asText(suggestion.priority),
          )
            ? (asText(suggestion.priority) as 'high' | 'medium' | 'low')
            : 'medium',
        })),
        tips: asStringArray(parsed.tips),
        ...(exampleBullets.length > 0 ? { exampleBullets } : {}),
      };
    } catch (error) {
      this.logger.error('Content suggestion failed', error);
      throw new BadRequestException('Failed to suggest content');
    }
  }

  private serializeTargetContext(context: Record<string, unknown>): string {
    const entries = Object.entries(context)
      .filter(([, value]) => {
        if (value === undefined || value === null) return false;
        if (typeof value === 'string') return value.trim().length > 0;
        if (Array.isArray(value)) return value.length > 0;
        return true;
      })
      .map(([key, value]) => {
        if (Array.isArray(value)) {
          return `- ${key}: ${value.map(formatUnknown).join(', ')}`;
        }
        const text = formatUnknown(value);
        const clipped = text.length > 3000 ? `${text.slice(0, 3000)}...` : text;
        return `- ${key}: ${clipped}`;
      });

    return entries.join('\n');
  }
}
