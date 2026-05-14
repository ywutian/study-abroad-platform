import {
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import type { SupportedLocale } from '@study-abroad/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { LLMService } from '../ai-agent/core/llm.service';
import { buildPredictionPublicExplanation } from './prediction-public-explanation';

type PredictionStreamEvent =
  | { type: 'start'; cached?: boolean; mode: 'single' | 'portfolio' }
  | { type: 'delta'; text: string }
  | { type: 'done'; text: string; cached?: boolean }
  | { type: 'error'; error: string };

interface StreamSingleParams {
  userId: string;
  predictionResultId: string;
  locale: SupportedLocale;
  refresh?: boolean;
}

interface StreamPortfolioParams {
  userId: string;
  locale: SupportedLocale;
  predictionResultIds?: string[];
  refresh?: boolean;
}

@Injectable()
export class PredictionExplanationService {
  private readonly logger = new Logger(PredictionExplanationService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly llm?: LLMService,
  ) {}

  async *streamPredictionExplanation({
    userId,
    predictionResultId,
    locale,
    refresh,
  }: StreamSingleParams): AsyncGenerator<PredictionStreamEvent> {
    const row = await this.loadUserPrediction(userId, predictionResultId);
    const school = await this.prisma.school.findUnique({
      where: { id: row.schoolId },
      select: { name: true, nameZh: true, acceptanceRate: true },
    });
    const publicExplanation = buildPredictionPublicExplanation({
      locale,
      schoolName:
        locale === 'zh' ? school?.nameZh || school?.name : school?.name,
      probability: row.probability == null ? null : Number(row.probability),
      probabilityLow:
        row.probabilityLow == null ? undefined : Number(row.probabilityLow),
      probabilityHigh:
        row.probabilityHigh == null ? undefined : Number(row.probabilityHigh),
      tier: row.tier,
      confidence: row.confidence,
      factors: Array.isArray(row.factors) ? (row.factors as any) : [],
      suggestions: Array.isArray(row.suggestions)
        ? (row.suggestions as any)
        : [],
      sourceSummary: Array.isArray(row.sourceSummary)
        ? (row.sourceSummary as any)
        : [],
      uncertaintyReasons: Array.isArray(row.uncertaintyReasons)
        ? (row.uncertaintyReasons as string[])
        : [],
      predictionMethod:
        (row.servedTrace as any)?.engine === 'counselor'
          ? 'counselor'
          : 'fusion',
      schoolAcceptanceRate:
        school?.acceptanceRate != null
          ? Number(school.acceptanceRate)
          : undefined,
    });
    const cached = (row.servedTrace as any)?.publicExplanation?.llm?.text;

    yield {
      type: 'start',
      mode: 'single',
      cached: Boolean(cached && !refresh),
    };

    if (cached && !refresh) {
      yield { type: 'delta', text: cached };
      yield { type: 'done', text: cached, cached: true };
      return;
    }

    if (!this.llm) {
      const fallback = this.formatRuleExplanation(publicExplanation, locale);
      yield { type: 'delta', text: fallback };
      yield { type: 'done', text: fallback };
      return;
    }

    const prompt = this.buildSinglePrompt({
      locale,
      schoolName:
        locale === 'zh' ? school?.nameZh || school?.name : school?.name,
      row,
      publicExplanation,
    });

    let text = '';
    for await (const chunk of this.llm.callStream(
      this.singleSystemPrompt(locale),
      [
        {
          id: `prediction_explanation_${row.id}`,
          role: 'user',
          content: prompt,
          timestamp: new Date(),
        },
      ],
      {
        temperature: 0.35,
        maxTokens: 650,
        userId,
        agentType: 'prediction_explanation',
      },
    )) {
      if (chunk.type === 'content' && chunk.content) {
        text += chunk.content;
        yield { type: 'delta', text: chunk.content };
      } else if (chunk.type === 'error') {
        yield { type: 'error', error: chunk.error ?? 'Stream failed' };
        return;
      }
    }

    const finalText =
      text.trim() || this.formatRuleExplanation(publicExplanation, locale);
    await this.cacheLlmExplanation(row.id, finalText, publicExplanation).catch(
      (error) => {
        this.logger.warn(
          `Failed to cache prediction explanation ${row.id}`,
          error,
        );
      },
    );
    yield { type: 'done', text: finalText };
  }

  async *streamPortfolioSummary({
    userId,
    locale,
    predictionResultIds,
  }: StreamPortfolioParams): AsyncGenerator<PredictionStreamEvent> {
    const profile = await this.prisma.profile.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (!profile) {
      throw new NotFoundException('Profile not found');
    }

    const idFilter = predictionResultIds?.filter(Boolean).slice(0, 100);
    const rows = await this.prisma.predictionResult.findMany({
      where: {
        profileId: profile.id,
        authority: 'AUTHORITATIVE',
        ...(idFilter?.length ? { id: { in: idFilter } } : {}),
      },
      orderBy: { updatedAt: 'desc' },
      take: 100,
    });
    const schools = await this.prisma.school.findMany({
      where: { id: { in: [...new Set(rows.map((row) => row.schoolId))] } },
      select: { id: true, name: true, nameZh: true, acceptanceRate: true },
    });
    const schoolMap = new Map(schools.map((school) => [school.id, school]));
    const summaries = rows.map((row) => {
      const school = schoolMap.get(row.schoolId);
      return {
        school: locale === 'zh' ? school?.nameZh || school?.name : school?.name,
        probability: Math.round(Number(row.probability) * 100),
        tier: row.tier,
        range:
          row.probabilityLow != null && row.probabilityHigh != null
            ? `${Math.round(Number(row.probabilityLow) * 100)}-${Math.round(Number(row.probabilityHigh) * 100)}%`
            : undefined,
        dataSupport: buildPredictionPublicExplanation({
          locale,
          schoolName: school?.name,
          probability: Number(row.probability),
          probabilityLow:
            row.probabilityLow == null ? undefined : Number(row.probabilityLow),
          probabilityHigh:
            row.probabilityHigh == null
              ? undefined
              : Number(row.probabilityHigh),
          tier: row.tier,
          confidence: row.confidence,
          factors: Array.isArray(row.factors) ? (row.factors as any) : [],
          suggestions: Array.isArray(row.suggestions)
            ? (row.suggestions as any)
            : [],
        }).dataSupportLabel,
      };
    });

    yield { type: 'start', mode: 'portfolio' };

    if (!summaries.length) {
      const empty =
        locale === 'zh'
          ? '还没有可总结的正式预测。'
          : 'No formal predictions to summarize yet.';
      yield { type: 'delta', text: empty };
      yield { type: 'done', text: empty };
      return;
    }

    if (!this.llm) {
      const fallback = this.formatPortfolioFallback(summaries, locale);
      yield { type: 'delta', text: fallback };
      yield { type: 'done', text: fallback };
      return;
    }

    let text = '';
    for await (const chunk of this.llm.callStream(
      this.portfolioSystemPrompt(locale),
      [
        {
          id: `prediction_portfolio_${profile.id}_${Date.now()}`,
          role: 'user',
          content: JSON.stringify({ predictions: summaries.slice(0, 80) }),
          timestamp: new Date(),
        },
      ],
      {
        temperature: 0.35,
        maxTokens: 700,
        userId,
        agentType: 'prediction_portfolio_summary',
      },
    )) {
      if (chunk.type === 'content' && chunk.content) {
        text += chunk.content;
        yield { type: 'delta', text: chunk.content };
      } else if (chunk.type === 'error') {
        yield { type: 'error', error: chunk.error ?? 'Stream failed' };
        return;
      }
    }

    const finalText =
      text.trim() || this.formatPortfolioFallback(summaries, locale);
    yield { type: 'done', text: finalText };
  }

  private async loadUserPrediction(userId: string, predictionResultId: string) {
    const profile = await this.prisma.profile.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (!profile) {
      throw new NotFoundException('Profile not found');
    }

    const row = await this.prisma.predictionResult.findFirst({
      where: {
        id: predictionResultId,
        profileId: profile.id,
        authority: 'AUTHORITATIVE',
      },
    });
    if (!row) {
      throw new NotFoundException('Prediction result not found');
    }
    return row;
  }

  private singleSystemPrompt(locale: SupportedLocale): string {
    return locale === 'zh'
      ? '你是留学顾问式的预测解释器。只解释给定预测，不重新计算概率，不改变概率/区间/档位，不声称能保证录取。不要使用“置信度”这个词，改用“数据支持/信息完整度”。输出简短 Markdown，最多 5 条要点。'
      : 'You are an admissions-counselor-style prediction explainer. Explain only the given estimate; do not recalculate or change probability, range, or tier; never imply guaranteed admission. Avoid the word confidence; use data support/completeness instead. Output concise Markdown with at most 5 bullets.';
  }

  private portfolioSystemPrompt(locale: SupportedLocale): string {
    return locale === 'zh'
      ? '你是选校组合顾问。只基于给定预测列表总结组合风险，不重新计算概率。不要逐校长篇解释。输出 4-6 条简短 Markdown：组合是否平衡、最大风险、最值得补强的资料、下一步。'
      : 'You are a school-list portfolio counselor. Summarize risk only from the provided prediction list; do not recalculate probabilities. Do not explain every school. Output 4-6 concise Markdown bullets: balance, biggest risk, profile gaps to improve, next steps.';
  }

  private buildSinglePrompt(params: {
    locale: SupportedLocale;
    schoolName?: string | null;
    row: any;
    publicExplanation: ReturnType<typeof buildPredictionPublicExplanation>;
  }): string {
    const { locale, schoolName, row, publicExplanation } = params;
    return JSON.stringify({
      language: locale,
      schoolName,
      probability:
        row.probability == null
          ? null
          : `${Math.round(Number(row.probability) * 100)}%`,
      range:
        row.probabilityLow != null && row.probabilityHigh != null
          ? `${Math.round(Number(row.probabilityLow) * 100)}-${Math.round(Number(row.probabilityHigh) * 100)}%`
          : null,
      tier: row.tier,
      dataSupport: publicExplanation.dataSupportLabel,
      ruleHeadline: publicExplanation.headline,
      ruleReasons: publicExplanation.reasons,
      nextAction: publicExplanation.nextAction,
      caveats: publicExplanation.caveats,
      instruction:
        locale === 'zh'
          ? '请把这些内容改写成用户友好的预测解释，先讲结论，再讲原因，再讲下一步。'
          : 'Rewrite this as a user-friendly estimate explanation: conclusion, reasons, then next step.',
    });
  }

  private formatRuleExplanation(
    explanation: ReturnType<typeof buildPredictionPublicExplanation>,
    locale: SupportedLocale,
  ): string {
    const next = explanation.nextAction
      ? locale === 'zh'
        ? `\n\n**下一步**：${explanation.nextAction}`
        : `\n\n**Next step:** ${explanation.nextAction}`
      : '';
    const caveats = explanation.caveats.length
      ? `\n\n${explanation.caveats.map((item) => `- ${item}`).join('\n')}`
      : '';
    return `**${explanation.headline}**\n\n${explanation.reasons
      .map((item) => `- ${item}`)
      .join('\n')}${next}${caveats}`;
  }

  private formatPortfolioFallback(
    summaries: Array<{ tier?: string | null; probability: number }>,
    locale: SupportedLocale,
  ): string {
    const count = summaries.length;
    const reach = summaries.filter((item) => item.tier === 'reach').length;
    const match = summaries.filter((item) => item.tier === 'match').length;
    const safety = summaries.filter((item) => item.tier === 'safety').length;
    const avg = Math.round(
      summaries.reduce((sum, item) => sum + item.probability, 0) /
        Math.max(count, 1),
    );
    return locale === 'zh'
      ? `- 共 ${count} 条正式预测，平均个人预估约 ${avg}%。\n- 当前组合结构：冲刺 ${reach} / 匹配 ${match} / 保底 ${safety}。\n- 下一步：优先确认冲刺校数量不要过高，并补齐会影响预测的信息。`
      : `- ${count} formal predictions, with an average personal estimate of about ${avg}%.\n- Current mix: reach ${reach} / match ${match} / likely ${safety}.\n- Next step: make sure reach schools are not overweighted and complete profile details that affect estimates.`;
  }

  private async cacheLlmExplanation(
    predictionResultId: string,
    text: string,
    publicExplanation: ReturnType<typeof buildPredictionPublicExplanation>,
  ) {
    const current = await this.prisma.predictionResult.findUnique({
      where: { id: predictionResultId },
      select: { servedTrace: true },
    });
    const servedTrace = ((current?.servedTrace as any) ?? {}) as Record<
      string,
      unknown
    >;
    await this.prisma.predictionResult.update({
      where: { id: predictionResultId },
      data: {
        servedTrace: {
          ...servedTrace,
          publicExplanation: {
            ...((servedTrace.publicExplanation as object | undefined) ?? {}),
            llm: {
              text,
              publicExplanation: {
                ...publicExplanation,
                source: 'llm',
                generatedAt: new Date().toISOString(),
              },
              generatedAt: new Date().toISOString(),
            },
          },
        },
      },
    });
  }
}
