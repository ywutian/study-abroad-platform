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
          ? `\n\n## 国际生评估要点\n如果申请者是国际生，请特别考虑：\n1. 该校对国际生的竞争程度（国际生录取率通常低于整体录取率）\n2. 申请者所在地区（如中国大陆）的竞争强度\n3. 高中背景在该校的认知度\n4. 标化成绩在国际生申请者池中的竞争力（而非整体申请池）\n5. TOEFL/IELTS在该校录取中的门槛作用`
          : `\n\n## International Student Assessment\nFor international applicants, specifically consider:\n1. This school's competitiveness for international students\n2. Regional competition intensity (e.g., mainland China applicant pool)\n3. High school recognition at this specific school\n4. Test score competitiveness within the international applicant pool\n5. TOEFL/IELTS threshold requirements at this school`;
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
      const response = await this.llmService.chatSimple(
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
}
