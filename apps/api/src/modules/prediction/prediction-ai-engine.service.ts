import { Injectable, Logger } from '@nestjs/common';
import { LLMService } from '../ai-agent/core/llm.service';
import { extractJsonFromLlm } from '../../common/utils/llm-json.util';
import {
  ProfileInput,
  SchoolInput,
  NationalityStats,
} from './prediction.prompts';
import { buildPredictionPrompt } from './prediction.prompts';
import { PredictionFactor, PredictionComparison } from './dto';
import { calculateSelectivityIndex } from './utils/score-calculator';
import { PredictionTransformerService } from './prediction-transformer.service';

/**
 * Engine 2: AI-powered prediction using LLM expert consultation.
 *
 * Builds a structured prompt with profile and school data, injects the statistical
 * engine's probability as a calibration anchor, and appends memory-sourced user insights.
 * The AI response is parsed as JSON and sanity-checked: probability is clamped to [0.05, 0.95]
 * and must not deviate more than 2.5x from the statistical baseline.
 */
@Injectable()
export class PredictionAiEngine {
  private readonly logger = new Logger(PredictionAiEngine.name);

  constructor(
    private readonly llmService: LLMService,
    private readonly transformer: PredictionTransformerService,
  ) {}

  /**
   * Compute a deterministic seed (FNV-1a hash) so the same profile+school input
   * always produces the same AI output.
   */
  computeSeed(profileId: string, schoolId: string): number {
    const input = `${profileId}:${schoolId}`;
    let hash = 2166136261; // FNV offset basis
    for (let i = 0; i < input.length; i++) {
      hash ^= input.charCodeAt(i);
      hash = (hash * 16777619) >>> 0; // FNV prime, keep uint32
    }
    return hash % 2_147_483_647;
  }

  /**
   * Run the AI prediction engine.
   *
   * @param profile - Normalized profile input
   * @param school - Normalized school input
   * @param statsResult - Statistical engine probability (used as calibration anchor)
   * @param memoryInsights - User context strings from the memory system
   * @param locale - Language locale ('zh' | 'en')
   * @param profileId - Optional profile ID for deterministic seed
   * @returns Parsed AI prediction with probability, factors, suggestions, and comparison; or null on failure
   */
  async predictWithAI(
    profile: ProfileInput,
    school: SchoolInput,
    statsResult: { probability: number },
    memoryInsights: string[],
    locale = 'zh',
    profileId?: string,
    nationalityStats?: NationalityStats,
    dataCompleteness?: number,
  ): Promise<{
    probability: number;
    factors: PredictionFactor[];
    suggestions: string[];
    comparison: PredictionComparison;
  } | null> {
    const prompt = buildPredictionPrompt(
      profile,
      school,
      locale,
      nationalityStats,
    );

    // 注入统计校准锚点和记忆洞察
    let enhancedPrompt = prompt;
    if (locale === 'zh') {
      enhancedPrompt += `\n\n## 统计模型参考（仅供校准，请根据专业判断调整）\n- 统计模型计算的录取概率: ${(statsResult.probability * 100).toFixed(0)}%\n- 请在此基础上结合专业经验给出最终判断，可上下浮动但需有合理依据。`;
    } else {
      enhancedPrompt += `\n\n## Statistical Model Reference (for calibration only)\n- Statistical model probability: ${(statsResult.probability * 100).toFixed(0)}%\n- Adjust based on your professional judgment with reasonable justification.`;
    }

    // International student context injection
    if (profile.isInternational) {
      enhancedPrompt +=
        locale === 'zh'
          ? `\n\n## 国际生评估要点\n如果申请者是国际生，请特别考虑：\n1. 该校对国际生的竞争程度（国际生录取率通常低于整体录取率）\n2. 申请者所在地区（如中国大陆）的竞争强度\n3. 高中背景在该校的认知度\n4. 标化成绩在国际生申请者池中的竞争力（而非整体申请池）\n5. TOEFL/IELTS/Duolingo English Test在该校录取中的门槛作用`
          : `\n\n## International Student Assessment\nFor international applicants, specifically consider:\n1. This school's competitiveness for international students\n2. Regional competition intensity (e.g., mainland China applicant pool)\n3. High school recognition at this specific school\n4. Test score competitiveness within the international applicant pool\n5. TOEFL/IELTS/Duolingo English Test threshold requirements at this school`;
    }

    if (memoryInsights.length > 0) {
      const insightsText = memoryInsights
        .slice(0, 3)
        .map((i) => `- ${i}`)
        .join('\n');
      enhancedPrompt +=
        locale === 'zh'
          ? `\n\n## 用户已知背景信息\n${insightsText}\n\n请将这些额外信息纳入分析。`
          : `\n\n## Known User Background\n${insightsText}\n\nIncorporate this information into your analysis.`;
    }

    if (dataCompleteness !== undefined && dataCompleteness < 70) {
      enhancedPrompt +=
        locale === 'zh'
          ? `\n\n## 数据完整度: ${dataCompleteness}%\n数据不完整。建议中请指出哪些缺失数据最影响预测准确性，并降低 confidence 评级。`
          : `\n\n## Data Completeness: ${dataCompleteness}%\nProfile data is incomplete. Note which missing data most affects prediction accuracy and lower the confidence rating accordingly.`;
    }

    const systemPrompt =
      locale === 'zh'
        ? '你是一位资深美国大学招生顾问，拥有20年经验。请始终用中文回复，且只返回有效的JSON。关键要求：录取概率必须根据学校选拔性显著变化——录取率3%的顶尖学校应远低于录取率25%的学校（同一学生档案）。绝不给不同选拔性的学校相同概率。'
        : 'You are an expert college admissions consultant with 20 years of experience. Always respond in English with valid JSON only. CRITICAL: Your probability estimates MUST vary significantly based on school selectivity — a top-5 school with 3% acceptance rate should have MUCH lower probability than a top-50 school with 25% acceptance rate for the same student profile. Never give the same probability for schools with different selectivity levels.';

    try {
      const response = await this.llmService.chatSimpleGuarded(
        [
          {
            role: 'system',
            content: systemPrompt,
          },
          { role: 'user', content: enhancedPrompt },
        ],
        {
          temperature: 0,
          maxTokens: 2500,
          ...(profileId && { seed: this.computeSeed(profileId, school.id) }),
          providerOptions: {
            response_format: {
              type: 'json_object',
            },
          },
        },
      );

      const parsed = extractJsonFromLlm<{
        probability: number;
        reasoning?: string;
        factors?: Array<{
          name: string;
          impact: string;
          weight: number;
          detail: string;
          improvement?: string;
        }>;
        suggestions?: string[];
        comparison?: Record<string, unknown>;
      }>(response);
      if (!parsed) return null;

      let probability = Number(parsed.probability);

      if (isNaN(probability) || probability < 0 || probability > 1) {
        return null;
      }

      probability = Math.max(0.05, Math.min(0.95, probability));

      // 合理性校验：与统计模型偏差不能超过 2.5 倍 (widened to give AI more room
      // for nuanced international student assessment)
      const statsProb = statsResult.probability;
      if (probability > statsProb * 2.5 && statsProb > 0.05) {
        probability = Math.min(probability, statsProb * 2.5);
      }
      if (probability < statsProb / 2.5 && statsProb < 0.8) {
        probability = Math.max(probability, statsProb / 2.5);
      }

      // 高选拔性学校额外 cap — 防止 AI 对顶尖学校给出过高概率
      const schoolMetrics = this.transformer.extractSchoolMetrics(school);
      const selectivity = calculateSelectivityIndex(schoolMetrics);
      if (selectivity > 0.85) {
        const aiCap = 0.5 - (selectivity - 0.85) * 1.5;
        probability = Math.min(probability, Math.max(0.05, aiCap));
      }

      return {
        probability,
        factors: (parsed.factors || []).map((f: any) => ({
          name: f.name || 'Unknown',
          impact: f.impact || 'neutral',
          weight: f.weight || 0,
          detail: f.detail || '',
          improvement: f.improvement || undefined,
        })),
        suggestions: parsed.suggestions || [],
        comparison: (parsed.comparison as any) || {
          gpaPercentile: 50,
          testScorePercentile: 50,
          activityStrength: 'average',
        },
      };
    } catch (error) {
      this.logger.warn(`AI prediction failed for school ${school.id}`, error);
      return null;
    }
  }

  /**
   * Generate explanation text for an already-computed prediction (v5 ML-Primary).
   * LLM does NOT produce the probability — it only explains why the number is what it is.
   *
   * @param probability - Already computed probability
   * @param baseRate - School base rate used
   * @param hookShifts - Hook adjustments applied
   * @param school - School input data
   * @param locale - Language locale
   * @returns Factors and suggestions, or null on failure
   */
  async generateExplanation(
    probability: number,
    baseRate: number,
    hookShifts: Array<{
      hookType: string;
      logOddsShift: number;
      source: string;
    }>,
    school: SchoolInput,
    locale = 'zh',
  ): Promise<{ factors: PredictionFactor[]; suggestions: string[] } | null> {
    try {
      const hookSummary = hookShifts
        .filter((h) => Math.abs(h.logOddsShift) > 0.01)
        .map(
          (h) =>
            `${h.hookType}: ${h.logOddsShift > 0 ? '+' : ''}${h.logOddsShift.toFixed(2)} (${h.source})`,
        )
        .join('\n');

      const prompt =
        locale === 'zh'
          ? `你是资深美国大学招生顾问。以下是基于数据模型计算的录取评估结果，请用专业视角解释。

## 评估结果
- 学校：${school.name}（录取率 ${(baseRate * 100).toFixed(1)}%）
- 预估概率：${(probability * 100).toFixed(1)}%

## 调整因素
${hookSummary || '无特殊调整'}

## 要求
1. 解释为什么这个概率高于或低于学校平均录取率
2. 列出 3-5 个关键影响因素（正面+负面）
3. 给出 2-3 条可操作改进建议
4. 不要质疑或修改上面的概率数字

只返回 JSON: { "factors": [{"name":"...", "impact":"positive|negative|neutral", "weight":0.3, "detail":"..."}], "suggestions": ["..."] }`
          : `You are a senior US college admissions consultant. Below is a data-model-computed prediction. Explain it professionally.

## Prediction Result
- School: ${school.name} (acceptance rate ${(baseRate * 100).toFixed(1)}%)
- Estimated probability: ${(probability * 100).toFixed(1)}%

## Adjustment Factors
${hookSummary || 'None'}

## Requirements
1. Explain why this probability is above or below the school's average
2. List 3-5 key factors (positive + negative)
3. Give 2-3 actionable suggestions
4. Do NOT question or modify the probability number

Return JSON only: { "factors": [{"name":"...", "impact":"positive|negative|neutral", "weight":0.3, "detail":"..."}], "suggestions": ["..."] }`;

      const response = await this.llmService.chatSimpleGuarded(
        [
          {
            role: 'system',
            content:
              locale === 'zh'
                ? '你是资深招生顾问。只返回有效 JSON。不要修改概率数字。'
                : 'You are a senior admissions consultant. Return valid JSON only. Do NOT modify the probability.',
          },
          { role: 'user', content: prompt },
        ],
        { temperature: 0, maxTokens: 1500 },
      );

      const parsed = extractJsonFromLlm<{
        factors?: Array<{
          name: string;
          impact: string;
          weight: number;
          detail: string;
        }>;
        suggestions?: string[];
      }>(response);

      const VALID_IMPACTS = new Set(['positive', 'negative', 'neutral']);
      return {
        factors: (parsed?.factors || []).map((f) => ({
          name: f.name || 'Unknown',
          // LLM occasionally hallucinates impact values like 'high' / 'important' /
          // localized text. The previous `f.impact || 'neutral'` only caught
          // falsy values; coerce anything outside the enum so the frontend's
          // IMPACT_CONFIG[factor.impact] lookup never returns undefined.
          impact: (VALID_IMPACTS.has(f.impact) ? f.impact : 'neutral') as
            | 'positive'
            | 'negative'
            | 'neutral',
          weight: f.weight || 0,
          detail: f.detail || '',
        })),
        suggestions: parsed?.suggestions || [],
      };
    } catch (error) {
      this.logger.warn('Explanation generation failed', error);
      return null;
    }
  }
}
