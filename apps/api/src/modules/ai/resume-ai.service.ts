import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { LLMService } from '../ai-agent/core/llm.service';
import { extractJsonFromLlm } from '../../common/utils/llm-json.util';
import type { ResumeReviewResult } from '@study-abroad/shared';
import {
  buildResumeReviewSystemPrompt,
  buildBulletOptimizeSystemPrompt,
  buildSectionSuggestSystemPrompt,
} from './resume-ai.prompts';

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
        content: any;
      }>;
      templateId: string;
      resumeType: string;
    },
    context: { targetSchool?: string; targetMajor?: string },
    locale = 'zh',
  ): Promise<ResumeReviewResult> {
    const systemPrompt = buildResumeReviewSystemPrompt(
      locale,
      resumeData.resumeType,
      !!context.targetSchool,
    );

    const sectionsText = this.serializeResumeSections(resumeData.sections);

    const userPrompt = `${context.targetSchool ? `Target: ${context.targetSchool}` : ''}${context.targetMajor ? ` / ${context.targetMajor}` : ''}
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

      const parsed = extractJsonFromLlm<any>(result);
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
    sections: Array<{ id: string; type: string; title: string; content: any }>,
  ): string {
    return sections
      .map((s, idx) => {
        const header = `=== SECTION ${idx + 1} [${s.type}] "${s.title}" ===`;
        const content = s.content;

        // Handle sections with items (WORK_EXPERIENCE, ACTIVITIES, etc.)
        if (content?.items && Array.isArray(content.items)) {
          const items = content.items
            .map((item: any) => {
              const titleParts = [item.title || item.role || item.degree || ''];
              if (item.organization || item.school || item.company)
                titleParts.push(
                  `at "${item.organization || item.school || item.company}"`,
                );
              if (item.date || item.startDate)
                titleParts.push(
                  `(${item.startDate || item.date}${item.endDate ? ` - ${item.endDate}` : ''})`,
                );

              const itemHeader = `Item: ${titleParts.join(' ')}`;
              const bullets =
                item.bullets && Array.isArray(item.bullets)
                  ? item.bullets
                      .map((b: string, bi: number) => `  Bullet[${bi}]: "${b}"`)
                      .join('\n')
                  : item.description
                    ? `  Description: "${item.description}"`
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
              Array.isArray(v) ? `${k}: ${v.join(', ')}` : `${k}: ${String(v)}`,
            )
            .join('\n  ');
          return `${header}\n  ${entries}`;
        }

        return `${header}\n  ${String(content)}`;
      })
      .join('\n\n');
  }

  /**
   * Parse and validate LLM review output. Recompute scores server-side.
   */
  private parseReviewResult(
    parsed: any,
    sections: Array<{ id: string; type: string; title: string }>,
  ): ResumeReviewResult {
    const DIMENSION_WEIGHTS: Record<string, number> = {
      content: 0.3,
      formatting: 0.2,
      impact: 0.2,
      completeness: 0.15,
      relevance: 0.15,
    };

    const validIssueTypes = new Set([
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

    // Parse dimensions with criteria
    const dimensions = Array.isArray(parsed.dimensions)
      ? parsed.dimensions.map((d: any) => {
          const criteria = Array.isArray(d.criteria)
            ? d.criteria.map((c: any) => ({
                key: c.key ?? '',
                name: c.name ?? c.key ?? '',
                score: clamp(Number(c.score) || 5, 0, 10),
                maxScore: 10,
                detail: c.detail ?? '',
              }))
            : [];

          // Recompute dimension score from criteria
          const dimScore =
            criteria.length > 0
              ? Math.round(
                  (criteria.reduce((sum: number, c: any) => sum + c.score, 0) /
                    criteria.length) *
                    10,
                )
              : clamp(Number(d.score) || 50, 0, 100);

          const status: 'green' | 'yellow' | 'red' =
            dimScore >= 70 ? 'green' : dimScore >= 40 ? 'yellow' : 'red';

          return {
            name: d.name ?? '',
            score: dimScore,
            status,
            feedback: d.feedback ?? '',
            criteria,
            improvements: Array.isArray(d.improvements) ? d.improvements : [],
          };
        })
      : [];

    // Recompute overall score server-side
    const overallScore = Math.round(
      dimensions.reduce((sum: number, d: any) => {
        const weight = DIMENSION_WEIGHTS[d.name] ?? 0.2;
        return sum + d.score * weight;
      }, 0),
    );

    // Parse section feedback
    const sectionIdMap = new Map(sections.map((s) => [s.type, s.id]));
    const sectionFeedback = Array.isArray(parsed.sectionFeedback)
      ? parsed.sectionFeedback.map((sf: any) => ({
          sectionType: sf.sectionType ?? '',
          sectionTitle: sf.sectionTitle ?? '',
          sectionId: sectionIdMap.get(sf.sectionType),
          issues: Array.isArray(sf.issues)
            ? sf.issues
                .filter(
                  (iss: any) => iss.original && iss.suggestion && iss.reason,
                )
                .map((iss: any) => ({
                  type: validIssueTypes.has(iss.type) ? iss.type : 'too_vague',
                  severity: ['high', 'medium', 'low'].includes(iss.severity)
                    ? iss.severity
                    : 'medium',
                  original: iss.original ?? '',
                  suggestion: iss.suggestion ?? '',
                  reason: iss.reason ?? '',
                  ...(iss.bulletIndex !== undefined && iss.bulletIndex !== null
                    ? { bulletIndex: Number(iss.bulletIndex) }
                    : {}),
                }))
            : [],
        }))
      : [];

    // Parse content gaps
    const contentGaps = Array.isArray(parsed.contentGaps)
      ? parsed.contentGaps.map((g: any) =>
          typeof g === 'string'
            ? { sectionType: '', description: g, priority: 'medium' as const }
            : {
                sectionType: g.sectionType ?? '',
                description: g.description ?? '',
                priority: ['high', 'medium', 'low'].includes(g.priority)
                  ? g.priority
                  : 'medium',
                ...(g.example ? { example: g.example } : {}),
              },
        )
      : [];

    return {
      version: 2,
      overallScore: clamp(overallScore || parsed.overallScore || 50, 0, 100),
      dimensions,
      sectionFeedback,
      contentGaps,
      bulletQuality: {
        actionVerbUsage: parsed.bulletQuality?.actionVerbUsage ?? 0,
        quantificationRate: parsed.bulletQuality?.quantificationRate ?? 0,
        averageLength: parsed.bulletQuality?.averageLength ?? 0,
      },
      summary: parsed.summary ?? '',
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

    const userPrompt = `Section: ${context.sectionType}${context.role ? ` | Role: ${context.role}` : ''}${context.organization ? ` | Org: ${context.organization}` : ''}

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

      const parsed = extractJsonFromLlm<any>(result);
      return {
        optimized: Array.isArray(parsed.optimized)
          ? parsed.optimized.map((o: any) => ({
              original: o.original ?? '',
              improved: o.improved ?? '',
              reason: o.reason ?? '',
            }))
          : [],
        newSuggestions: Array.isArray(parsed.newSuggestions)
          ? parsed.newSuggestions
          : undefined,
      };
    } catch (error) {
      this.logger.error('Bullet optimization failed', error);
      throw new BadRequestException('Failed to optimize bullets');
    }
  }

  async suggestSectionContent(
    sectionType: string,
    context: {
      existingContent: any;
      resumeType: string;
      targetMajor?: string;
      grade?: string;
      profileActivities?: any[];
      profileAwards?: any[];
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

    const userPrompt = `Section: ${sectionType}
Resume Type: ${context.resumeType}
${context.targetMajor ? `Target Major: ${context.targetMajor}` : ''}
${context.grade ? `Grade: ${context.grade}` : ''}
Existing Content: ${JSON.stringify(context.existingContent)}
${
  context.profileActivities?.length
    ? `Profile Activities:\n${context.profileActivities
        .slice(0, 5)
        .map((a: any) => {
          let line = `- ${a.name} (${a.role || ''}, ${a.category || ''})`;
          if (a.description) line += `: ${a.description.slice(0, 100)}`;
          return line;
        })
        .join('\n')}`
    : ''
}
${
  context.profileAwards?.length
    ? `Profile Awards:\n${context.profileAwards
        .slice(0, 5)
        .map((a: any) => {
          let line = `- ${a.name} (${a.level || ''})`;
          if (a.competition?.name) line += ` — ${a.competition.name}`;
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

      const parsed = extractJsonFromLlm<any>(result);
      return {
        suggestions: Array.isArray(parsed.suggestions)
          ? parsed.suggestions.map((s: any) => ({
              text: s.text ?? '',
              category: s.category ?? 'new_item',
              priority: ['high', 'medium', 'low'].includes(s.priority)
                ? s.priority
                : 'medium',
            }))
          : [],
        tips: Array.isArray(parsed.tips) ? parsed.tips : [],
        exampleBullets: Array.isArray(parsed.exampleBullets)
          ? parsed.exampleBullets
          : undefined,
      };
    } catch (error) {
      this.logger.error('Content suggestion failed', error);
      throw new BadRequestException('Failed to suggest content');
    }
  }
}
