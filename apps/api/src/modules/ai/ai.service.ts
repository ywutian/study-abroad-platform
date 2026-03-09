import {
  Injectable,
  Inject,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { ILLMProvider } from '../ai-agent/providers/llm-provider.interface';
import { LLM_PROVIDER_TOKEN } from '../ai-agent/providers/llm-provider.interface';
import { extractJsonFromLlm } from '../ai-agent/tools/helpers/llm-json.helper';
import type { ResumeReviewResult } from '@study-abroad/shared';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ProfileAnalysisRequest {
  gpa?: number;
  gpaScale?: number;
  testScores?: Array<{ type: string; score: number }>;
  activities?: Array<{
    name: string;
    category: string;
    role: string;
    description?: string;
    hoursPerWeek?: number;
    weeksPerYear?: number;
    tier?: number;
  }>;
  awards?: Array<{
    name: string;
    level: string;
    competitionCategory?: string;
    tier?: number;
    competitionName?: string;
  }>;
  targetMajor?: string;
  intendedMajor?: string;
  secondMajor?: string;
  targetSchools?: string[];
  grade?: string;
  /** Pre-formatted high school context line (from formatHighSchoolContext) */
  highSchoolContext?: string;
}

export interface ProfileAnalysisResponse {
  overall: string;
  strengths: string[];
  weaknesses: string[];
  suggestions: string[];
}

// P0: 详细档案分析响应（红黄绿评分）
export type SectionStatus = 'green' | 'yellow' | 'red';

export interface SectionAnalysis {
  status: SectionStatus;
  score: number; // 1-10
  feedback: string;
  highlights?: string[]; // 亮点
  improvements?: string[]; // 改进点
}

export interface DetailedProfileAnalysisResponse {
  sections: {
    academic: SectionAnalysis;
    testScores: SectionAnalysis;
    activities: SectionAnalysis;
    awards: SectionAnalysis;
  };
  overallScore: number; // 1-100
  tier: 'top10' | 'top30' | 'top50' | 'top100' | 'other';
  suggestions: {
    majors: string[];
    competitions: string[];
    activities: string[];
    summerPrograms: string[];
    timeline: string[];
  };
  summary: string;
}

export interface EssayReviewRequest {
  prompt: string;
  content: string;
  wordLimit?: number;
}

export interface EssayReviewResponse {
  overallScore: number; // 1-10
  structure: { score: number; feedback: string };
  content: { score: number; feedback: string };
  language: { score: number; feedback: string };
  suggestions: string[];
}

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private readonly model: string;

  constructor(
    private configService: ConfigService,
    @Inject(LLM_PROVIDER_TOKEN) private provider: ILLMProvider,
  ) {
    this.model =
      this.configService.get<string>('OPENAI_MODEL') || 'gpt-4o-mini';
  }

  /**
   * Chat completion via the provider-neutral LLM abstraction.
   *
   * Automatically extracts the system message (if present) and forwards
   * the rest to the injected ILLMProvider.
   */
  async chat(
    messages: ChatMessage[],
    options?: {
      temperature?: number;
      maxTokens?: number;
      seed?: number;
      providerOptions?: Record<string, unknown>;
    },
  ): Promise<string> {
    const systemMsg = messages.find((m) => m.role === 'system');
    const otherMsgs = messages.filter((m) => m.role !== 'system');

    const extraProviderOptions: Record<string, unknown> = {
      ...options?.providerOptions,
    };
    if (options?.seed !== undefined) {
      extraProviderOptions.seed = options.seed;
    }

    const response = await this.provider.chat({
      systemPrompt: systemMsg?.content || '',
      messages: otherMsgs.map((m) => ({ role: m.role, content: m.content })),
      model: this.model,
      temperature: options?.temperature ?? 0.7,
      maxTokens: options?.maxTokens ?? 2000,
      ...(Object.keys(extraProviderOptions).length > 0 && {
        providerOptions: extraProviderOptions,
      }),
    });

    return response.content;
  }

  async analyzeProfile(
    request: ProfileAnalysisRequest,
    locale = 'zh',
  ): Promise<ProfileAnalysisResponse> {
    const isZh = locale === 'zh';
    const na = isZh ? '未提供' : 'Not provided';
    const undecided = isZh ? '未确定' : 'Undecided';

    const systemPrompt = isZh
      ? `你是一位资深的留学申请顾问,专注于美国本科申请。请根据提供的学生档案信息,给出客观、专业的分析和建议。

输出要求:
1. overall: 对申请者整体竞争力的简要评估(100-200字)
2. strengths: 列出3-5个优势点
3. weaknesses: 列出2-4个需要改进的地方
4. suggestions: 提供3-5条具体可行的建议

所有文本字段必须用中文。请用JSON格式返回结果。`
      : `You are an expert US college admissions consultant. Based on the student profile, provide an objective, professional analysis.

Output requirements:
1. overall: Brief assessment of competitiveness (100-200 words)
2. strengths: List 3-5 strengths
3. weaknesses: List 2-4 areas for improvement
4. suggestions: Provide 3-5 actionable suggestions

All text fields must be in English. Return results in JSON format.`;

    const hsLine = request.highSchoolContext
      ? `\n${request.highSchoolContext}`
      : '';

    const userPrompt = isZh
      ? `请分析以下学生档案:

GPA: ${request.gpa ? `${request.gpa}/${request.gpaScale || 4.0}` : na}${hsLine}
标化成绩: ${request.testScores?.map((s) => `${s.type}: ${s.score}`).join(', ') || na}
活动:
${
  request.activities
    ?.map((a) => {
      let line = `- ${a.name}(${a.role}, ${a.category})`;
      if (a.description) line += `: ${a.description.slice(0, 100)}`;
      if (a.hoursPerWeek) line += ` [${a.hoursPerWeek}h/周]`;
      return line;
    })
    .join('\n') || na
}
奖项:
${
  request.awards
    ?.map((a) => {
      let line = `- ${a.name}(${a.level})`;
      if (a.competitionName) line += ` — ${a.competitionName}`;
      if (a.tier) line += ` [Tier ${a.tier}]`;
      return line;
    })
    .join('\n') || na
}
目标专业: ${request.targetMajor || undecided}
目标学校: ${request.targetSchools?.join(', ') || undecided}`
      : `Analyze the following student profile:

GPA: ${request.gpa ? `${request.gpa}/${request.gpaScale || 4.0}` : na}${hsLine}
Test Scores: ${request.testScores?.map((s) => `${s.type}: ${s.score}`).join(', ') || na}
Activities:
${
  request.activities
    ?.map((a) => {
      let line = `- ${a.name}(${a.role}, ${a.category})`;
      if (a.description) line += `: ${a.description.slice(0, 100)}`;
      if (a.hoursPerWeek) line += ` [${a.hoursPerWeek}h/wk]`;
      return line;
    })
    .join('\n') || na
}
Awards:
${
  request.awards
    ?.map((a) => {
      let line = `- ${a.name}(${a.level})`;
      if (a.competitionName) line += ` — ${a.competitionName}`;
      if (a.tier) line += ` [Tier ${a.tier}]`;
      return line;
    })
    .join('\n') || na
}
Target Major: ${request.targetMajor || undecided}
Target Schools: ${request.targetSchools?.join(', ') || undecided}`;

    try {
      const result = await this.chat(
        [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        { temperature: 0.5 },
      );

      const parsed = extractJsonFromLlm<ProfileAnalysisResponse>(result);
      return {
        overall: parsed.overall || result,
        strengths: Array.isArray(parsed.strengths) ? parsed.strengths : [],
        weaknesses: Array.isArray(parsed.weaknesses) ? parsed.weaknesses : [],
        suggestions: Array.isArray(parsed.suggestions)
          ? parsed.suggestions
          : [],
      };
    } catch (error) {
      this.logger.error('Profile analysis failed', error);
      throw new BadRequestException('Failed to analyze profile');
    }
  }

  /**
   * P0: 详细档案分析 - 红黄绿评分系统
   *
   * 评分标准:
   * - 🟢 Green (7-10): 该维度是申请亮点
   * - 🟡 Yellow (4-6): 可接受但有提升空间
   * - 🔴 Red (1-3): 需要重点改进
   */
  async analyzeProfileDetailed(
    request: ProfileAnalysisRequest,
    locale = 'zh',
  ): Promise<DetailedProfileAnalysisResponse> {
    const isZh = locale === 'zh';

    const systemPrompt = isZh
      ? `你是资深美本申请顾问,请对学生档案进行详细评估。

## 评分标准 (1-10分)
- 🟢 green (7-10): 该维度是申请亮点,无需改进
- 🟡 yellow (4-6): 可接受但有明显提升空间
- 🔴 red (1-3): 需要重点改进的短板

## 评估维度

### 1. academic (学术背景)
- GPA 3.9+ unweighted = green
- GPA 3.7-3.89 = yellow
- GPA <3.7 或无数据 = red
- 考虑课程难度(AP/IB数量)

### 2. testScores (标化成绩)
- SAT 1550+ 或 ACT 35+ = green
- SAT 1450-1549 或 ACT 32-34 = yellow
- 无成绩或较低 = red
- TOEFL 110+ = 加分项

### 3. activities (课外活动)
- 有深度+影响力+一致性 = green
- 有活动但缺乏亮点 = yellow
- 活动少/无领导力 = red

### 4. awards (奖项荣誉)
- 国家级/国际级奖项 = green
- 州级/地区级奖项 = yellow
- 校级或无奖项 = red

## 竞争力等级
- top10: 适合冲刺藤校/Top10
- top30: 适合申请Top30
- top50: 适合申请Top50
- top100: 适合申请Top100
- other: 需要更多提升

## 输出格式 (严格JSON)
{
  "sections": {
    "academic": { "status": "green|yellow|red", "score": 1-10, "feedback": "具体评价（中文）", "highlights": ["亮点1"], "improvements": ["改进点1"] },
    "testScores": { "status": "...", "score": ..., "feedback": "...", "highlights": [], "improvements": [] },
    "activities": { "status": "...", "score": ..., "feedback": "...", "highlights": [], "improvements": [] },
    "awards": { "status": "...", "score": ..., "feedback": "...", "highlights": [], "improvements": [] }
  },
  "overallScore": 0-100,
  "tier": "top10|top30|top50|top100|other",
  "suggestions": {
    "majors": ["推荐专业1", "推荐专业2"],
    "competitions": ["推荐竞赛1"],
    "activities": ["推荐活动1"],
    "summerPrograms": ["推荐夏校/项目1"],
    "timeline": ["现在到申请前的规划建议"]
  },
  "summary": "100字总结（中文）"
}

所有文本字段必须用中文。请严格按照JSON格式输出,不要添加其他内容。`
      : `You are an expert US college admissions consultant. Provide a detailed evaluation of the student profile.

## Scoring Criteria (1-10)
- 🟢 green (7-10): This dimension is a strength, no improvement needed
- 🟡 yellow (4-6): Acceptable but room for improvement
- 🔴 red (1-3): Needs significant improvement

## Evaluation Dimensions

### 1. academic (Academic Background)
- GPA 3.9+ unweighted = green
- GPA 3.7-3.89 = yellow
- GPA <3.7 or no data = red
- Consider course rigor (AP/IB count)

### 2. testScores (Standardized Tests)
- SAT 1550+ or ACT 35+ = green
- SAT 1450-1549 or ACT 32-34 = yellow
- No scores or low scores = red
- TOEFL 110+ = bonus

### 3. activities (Extracurricular Activities)
- Depth + impact + consistency = green
- Some activities but lacking highlights = yellow
- Few activities / no leadership = red

### 4. awards (Awards & Honors)
- National/international awards = green
- State/regional awards = yellow
- School-level or none = red

## Competitiveness Tiers
- top10: Competitive for Ivy League/Top 10
- top30: Competitive for Top 30
- top50: Competitive for Top 50
- top100: Competitive for Top 100
- other: Needs more improvement

## Output Format (strict JSON)
{
  "sections": {
    "academic": { "status": "green|yellow|red", "score": 1-10, "feedback": "Detailed feedback (English)", "highlights": ["Highlight 1"], "improvements": ["Improvement 1"] },
    "testScores": { "status": "...", "score": ..., "feedback": "...", "highlights": [], "improvements": [] },
    "activities": { "status": "...", "score": ..., "feedback": "...", "highlights": [], "improvements": [] },
    "awards": { "status": "...", "score": ..., "feedback": "...", "highlights": [], "improvements": [] }
  },
  "overallScore": 0-100,
  "tier": "top10|top30|top50|top100|other",
  "suggestions": {
    "majors": ["Recommended Major 1", "Major 2"],
    "competitions": ["Recommended Competition 1"],
    "activities": ["Recommended Activity 1"],
    "summerPrograms": ["Recommended Program 1"],
    "timeline": ["Planning advice from now to application"]
  },
  "summary": "100-word summary (English)"
}

All text fields must be in English. Return strict JSON only, no other content.`;

    const userPrompt = this.buildDetailedProfilePrompt(request, locale);

    try {
      const result = await this.chat(
        [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        { temperature: 0.4, maxTokens: 2500 },
      );

      const parsed = extractJsonFromLlm(result);
      return this.validateDetailedAnalysis(parsed, locale);
    } catch (error) {
      this.logger.error('Detailed profile analysis failed', error);
      return this.getDefaultDetailedAnalysis(locale);
    }
  }

  private buildDetailedProfilePrompt(
    request: ProfileAnalysisRequest,
    locale = 'zh',
  ): string {
    const isZh = locale === 'zh';
    const parts: string[] = [
      isZh
        ? '请分析以下学生档案:\n'
        : 'Analyze the following student profile:\n',
    ];

    if (request.gpa) {
      parts.push(isZh ? `【学术背景】` : `[Academic Background]`);
      parts.push(`- GPA: ${request.gpa}/${request.gpaScale || 4.0}`);
    } else {
      parts.push(
        isZh
          ? `【学术背景】未提供GPA`
          : `[Academic Background] GPA not provided`,
      );
    }

    parts.push(isZh ? `\n【标化成绩】` : `\n[Test Scores]`);
    if (request.testScores?.length) {
      request.testScores.forEach((s) => {
        parts.push(`- ${s.type}: ${s.score}`);
      });
    } else {
      parts.push(isZh ? `- 未提供标化成绩` : `- No test scores provided`);
    }

    parts.push(isZh ? `\n【课外活动】` : `\n[Extracurricular Activities]`);
    parts.push(
      isZh
        ? '(注: 知名项目如RSI/TASP/Science Olympiad等权重更高；未知活动按描述和投入评估)'
        : '(Note: Well-known programs like RSI/TASP/Science Olympiad carry higher weight; unknown activities evaluated by description and commitment)',
    );
    if (request.activities?.length) {
      request.activities.forEach((a, i) => {
        let line = `${i + 1}. ${a.name} - ${a.role} (${a.category})`;
        if (a.description) line += ` | ${a.description.slice(0, 200)}`;
        if (a.hoursPerWeek && a.weeksPerYear) {
          line += ` | ${a.hoursPerWeek}h/${isZh ? '周' : 'wk'}, ${a.weeksPerYear}${isZh ? '周/年' : 'wk/yr'}`;
        }
        if (a.tier) line += ` | Tier ${a.tier}`;
        parts.push(line);
      });
    } else {
      parts.push(isZh ? `- 未填写活动` : `- No activities listed`);
    }

    parts.push(isZh ? `\n【奖项荣誉】` : `\n[Awards & Honors]`);
    if (request.awards?.length) {
      request.awards.forEach((a, i) => {
        let line = `${i + 1}. ${a.name} (${a.level})`;
        if (a.competitionName) line += ` — ${a.competitionName}`;
        if (a.tier) line += ` [Tier ${a.tier}]`;
        parts.push(line);
      });
    } else {
      parts.push(isZh ? `- 未填写奖项` : `- No awards listed`);
    }

    if (request.targetMajor) {
      parts.push(
        isZh
          ? `\n【目标专业】${request.targetMajor}`
          : `\n[Target Major] ${request.targetMajor}`,
      );
    }

    return parts.join('\n');
  }

  private validateDetailedAnalysis(
    data: any,
    locale = 'zh',
  ): DetailedProfileAnalysisResponse {
    const isZh = locale === 'zh';
    const validateSection = (section: any): SectionAnalysis => ({
      status: ['green', 'yellow', 'red'].includes(section?.status)
        ? section.status
        : 'yellow',
      score:
        typeof section?.score === 'number'
          ? Math.min(10, Math.max(1, section.score))
          : 5,
      feedback:
        section?.feedback || (isZh ? '暂无评价' : 'No evaluation available'),
      highlights: Array.isArray(section?.highlights) ? section.highlights : [],
      improvements: Array.isArray(section?.improvements)
        ? section.improvements
        : [],
    });

    return {
      sections: {
        academic: validateSection(data.sections?.academic),
        testScores: validateSection(data.sections?.testScores),
        activities: validateSection(data.sections?.activities),
        awards: validateSection(data.sections?.awards),
      },
      overallScore:
        typeof data.overallScore === 'number'
          ? Math.min(100, Math.max(0, data.overallScore))
          : 50,
      tier: ['top10', 'top30', 'top50', 'top100', 'other'].includes(data.tier)
        ? data.tier
        : 'top50',
      suggestions: {
        majors: Array.isArray(data.suggestions?.majors)
          ? data.suggestions.majors
          : [],
        competitions: Array.isArray(data.suggestions?.competitions)
          ? data.suggestions.competitions
          : [],
        activities: Array.isArray(data.suggestions?.activities)
          ? data.suggestions.activities
          : [],
        summerPrograms: Array.isArray(data.suggestions?.summerPrograms)
          ? data.suggestions.summerPrograms
          : [],
        timeline: Array.isArray(data.suggestions?.timeline)
          ? data.suggestions.timeline
          : [],
      },
      summary:
        data.summary ||
        (isZh
          ? '请完善档案信息以获取更准确的分析。'
          : 'Please complete your profile for a more accurate analysis.'),
    };
  }

  private getDefaultDetailedAnalysis(
    locale = 'zh',
  ): DetailedProfileAnalysisResponse {
    const isZh = locale === 'zh';
    const defaultSection: SectionAnalysis = {
      status: 'yellow',
      score: 5,
      feedback: isZh
        ? '请补充更多信息以获取准确评估'
        : 'Please provide more information for an accurate assessment',
      highlights: [],
      improvements: [
        isZh ? '请补充此项信息' : 'Please provide this information',
      ],
    };

    return {
      sections: {
        academic: defaultSection,
        testScores: defaultSection,
        activities: defaultSection,
        awards: defaultSection,
      },
      overallScore: 50,
      tier: 'top50',
      suggestions: {
        majors: [],
        competitions: [],
        activities: [],
        summerPrograms: [],
        timeline: [
          isZh
            ? '请先完善档案基本信息'
            : 'Please complete your basic profile information first',
        ],
      },
      summary: isZh
        ? '档案信息不完整,请补充GPA、标化成绩、活动和奖项后重新分析。'
        : 'Profile information is incomplete. Please add GPA, test scores, activities, and awards for a complete analysis.',
    };
  }

  async reviewEssay(
    request: EssayReviewRequest,
    locale = 'zh',
  ): Promise<EssayReviewResponse> {
    const isZh = locale === 'zh';

    const systemPrompt = isZh
      ? `你是一位专业的留学文书顾问,擅长美国本科申请文书修改。请对提供的文书进行全面评估。

评分标准(1-10分):
- 结构(structure): 文章结构是否清晰,有没有明确的开头、主体、结尾
- 内容(content): 故事是否真实感人,是否展现了申请者的独特性
- 语言(language): 语法是否正确,用词是否恰当,是否有表达力

请用JSON格式返回结果,包含:
- overallScore: 总体评分(1-10)
- structure: { score: 数字, feedback: "反馈（中文）" }
- content: { score: 数字, feedback: "反馈（中文）" }
- language: { score: 数字, feedback: "反馈（中文）" }
- suggestions: ["建议1（中文）", "建议2（中文）", ...]

所有文本字段必须用中文。`
      : `You are a professional college admissions essay consultant specializing in US undergraduate applications. Provide a comprehensive evaluation of the essay.

Scoring criteria (1-10):
- structure: Is the essay structure clear with a defined beginning, body, and conclusion?
- content: Is the story authentic and compelling? Does it showcase the applicant's uniqueness?
- language: Is the grammar correct? Are word choices appropriate and expressive?

Return results in JSON format:
- overallScore: overall score (1-10)
- structure: { score: number, feedback: "feedback (English)" }
- content: { score: number, feedback: "feedback (English)" }
- language: { score: number, feedback: "feedback (English)" }
- suggestions: ["Suggestion 1 (English)", "Suggestion 2 (English)", ...]

All text fields must be in English.`;

    const userPrompt = isZh
      ? `题目: ${request.prompt}
${request.wordLimit ? `字数限制: ${request.wordLimit}字` : ''}

文书内容:
${request.content}`
      : `Prompt: ${request.prompt}
${request.wordLimit ? `Word limit: ${request.wordLimit} words` : ''}

Essay content:
${request.content}`;

    try {
      const result = await this.chat(
        [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        { temperature: 0.5 },
      );

      const parsed = extractJsonFromLlm<EssayReviewResponse>(result);
      return {
        overallScore: parsed.overallScore ?? 5,
        structure: parsed.structure ?? { score: 5, feedback: result },
        content: parsed.content ?? { score: 5, feedback: '' },
        language: parsed.language ?? { score: 5, feedback: '' },
        suggestions: Array.isArray(parsed.suggestions)
          ? parsed.suggestions
          : [],
      };
    } catch (error) {
      this.logger.error('Essay review failed', error);
      throw new BadRequestException('Failed to review essay');
    }
  }

  async generateEssayIdeas(
    topic: string,
    background?: string,
    locale = 'zh',
  ): Promise<string[]> {
    const isZh = locale === 'zh';

    const systemPrompt = isZh
      ? `你是一位创意写作顾问,帮助学生为留学文书brainstorm创意点子。
请根据题目和背景,提供5-8个具体、有深度的写作角度或故事线索。
返回JSON数组格式: ["想法1（中文）", "想法2（中文）", ...]
所有文本必须用中文。`
      : `You are a creative writing consultant helping students brainstorm ideas for college application essays.
Based on the prompt and background, provide 5-8 specific, insightful writing angles or story leads.
Return as JSON array: ["Idea 1 (English)", "Idea 2 (English)", ...]
All text must be in English.`;

    const userPrompt = isZh
      ? `题目: ${topic}
${background ? `学生背景: ${background}` : ''}

请提供一些写作思路:`
      : `Prompt: ${topic}
${background ? `Student background: ${background}` : ''}

Please provide some writing ideas:`;

    try {
      const result = await this.chat(
        [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        { temperature: 0.8 },
      );

      const parsed = extractJsonFromLlm<string[]>(result);
      return Array.isArray(parsed) ? parsed : [result];
    } catch (error) {
      this.logger.error('Idea generation failed', error);
      throw new BadRequestException('Failed to generate ideas');
    }
  }

  async schoolMatch(
    profile: ProfileAnalysisRequest,
    locale = 'zh',
  ): Promise<Array<{ name: string; fit: string; reason: string }>> {
    const isZh = locale === 'zh';
    if (!profile.gpa && !profile.testScores?.length) {
      throw new BadRequestException(
        'Please provide GPA or test scores for school matching',
      );
    }

    const na = isZh ? '未提供' : 'Not provided';
    const undecided = isZh ? '未确定' : 'Undecided';

    const systemPrompt = isZh
      ? `你是留学选校顾问。根据学生档案（含学术成绩、课外活动方向、获奖领域、目标专业）,推荐10-15所合适的美国大学,分为冲刺校、匹配校、保底校三类。

重要约束:
- 必须分析学生活动和获奖所属领域（如商科/经济、STEM、人文社科、艺术等），只推荐与该方向匹配的学校
- 绝不推荐与学生背景方向明显不符的学校（如商科背景不推艺术设计类院校，STEM背景不推纯艺术院校）
- 保底校必须是知名度高、录取率>60%的实力院校（如大型州立大学），且在学生目标专业方向有良好项目

返回JSON数组: [{ "name": "学校名", "fit": "reach/match/safety", "reason": "简短原因（中文）" }]
所有文本必须用中文。`
      : `You are a college admissions school-matching consultant. Based on the student profile (academic stats, extracurricular focus, award domains, target major), recommend 10-15 suitable US universities in three categories: reach, match, and safety.

Critical constraints:
- Analyze the student's activity and award domains (e.g., business/economics, STEM, humanities, arts) and ONLY recommend schools matching that focus
- NEVER recommend schools that are a clear mismatch (e.g., do NOT recommend art/design schools for business/STEM profiles)
- Safety schools must be well-known institutions with >60% acceptance rates (e.g., large state universities) that offer strong programs in the student's target major area

Return JSON array: [{ "name": "School Name", "fit": "reach/match/safety", "reason": "Brief reason (English)" }]
All text must be in English.`;

    const hsLine = profile.highSchoolContext
      ? `\n${profile.highSchoolContext}`
      : '';

    const majorLines: string[] = [];
    if (profile.targetMajor) majorLines.push(profile.targetMajor);
    if (profile.intendedMajor && profile.intendedMajor !== profile.targetMajor)
      majorLines.push(profile.intendedMajor);
    if (profile.secondMajor) majorLines.push(profile.secondMajor);
    const majorText = majorLines.length > 0 ? majorLines.join(', ') : undecided;

    const activitiesText = profile.activities?.length
      ? profile.activities
          .slice(0, 8)
          .map((a) => {
            const base = `${a.name}(${a.category}${a.role ? ', ' + a.role : ''})`;
            return a.description
              ? `${base}: ${a.description.slice(0, 80)}`
              : base;
          })
          .join('; ')
      : na;

    const awardsText = profile.awards?.length
      ? profile.awards
          .slice(0, 5)
          .map((a) => {
            const cat = a.competitionCategory
              ? ` [${a.competitionCategory}]`
              : '';
            return `${a.name}(${a.level}${cat})`;
          })
          .join(', ')
      : na;

    const userPrompt = isZh
      ? `学生档案:
GPA: ${profile.gpa ? `${profile.gpa}/${profile.gpaScale || 4.0}` : na}
标化: ${profile.testScores?.map((s) => `${s.type}: ${s.score}`).join(', ') || na}
目标专业: ${majorText}${hsLine}
主要活动: ${activitiesText}
奖项: ${awardsText}

请推荐学校:`
      : `Student Profile:
GPA: ${profile.gpa ? `${profile.gpa}/${profile.gpaScale || 4.0}` : na}
Test Scores: ${profile.testScores?.map((s) => `${s.type}: ${s.score}`).join(', ') || na}
Target Major: ${majorText}${hsLine}
Key Activities: ${activitiesText}
Awards: ${awardsText}

Please recommend schools:`;

    try {
      const result = await this.chat(
        [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        { temperature: 0.5 },
      );

      const parsed =
        extractJsonFromLlm<
          Array<{ name: string; fit: string; reason: string }>
        >(result);
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      this.logger.error('School matching failed', error);
      throw new BadRequestException('Failed to match schools');
    }
  }

  /**
   * AI 文书润色 - 保持原意的同时提升语言质量
   */
  async polishEssay(
    content: string,
    style?: 'formal' | 'vivid' | 'concise',
    locale = 'zh',
  ): Promise<{
    polished: string;
    changes: Array<{ original: string; revised: string; reason: string }>;
  }> {
    const isZh = locale === 'zh';

    const styleGuideZh = {
      formal: '使用更正式、学术化的语言，适合严肃主题',
      vivid: '使用更生动、有画面感的语言，多用具体细节和感官描写',
      concise: '精简冗余表达，每个词都要有意义',
    };
    const styleGuideEn = {
      formal: 'Use more formal, academic language suitable for serious topics',
      vivid:
        'Use more vivid, imagery-rich language with specific details and sensory descriptions',
      concise: 'Eliminate redundancy; every word should count',
    };

    const systemPrompt = isZh
      ? `你是专业的留学文书编辑,擅长英文文书润色。
任务:在保持原文核心内容和作者声音(voice)的前提下,提升语言表达质量。

润色风格: ${styleGuideZh[style || 'formal']}

要求:
1. 保持原文的故事和观点不变
2. 改善语法、用词、句式多样性
3. 增强表达力和可读性
4. 不要过度修改,保持作者个人特色

返回JSON格式:
{
  "polished": "润色后的完整文书",
  "changes": [
    { "original": "原句", "revised": "修改后", "reason": "修改原因（中文）" }
  ]
}
只返回主要修改(5-10处),不需要列出所有小改动。所有reason字段必须用中文。`
      : `You are a professional college essay editor specializing in polishing English essays.
Task: Improve the language quality while preserving the original content and the author's voice.

Polish style: ${styleGuideEn[style || 'formal']}

Requirements:
1. Keep the original story and viewpoints unchanged
2. Improve grammar, word choice, and sentence variety
3. Enhance expressiveness and readability
4. Don't over-edit; preserve the author's personal style

Return JSON format:
{
  "polished": "The fully polished essay",
  "changes": [
    { "original": "Original sentence", "revised": "Revised version", "reason": "Reason for change (English)" }
  ]
}
Only list major changes (5-10), not every small edit. All reason fields must be in English.`;

    try {
      const result = await this.chat(
        [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `请润色以下文书:\n\n${content}` },
        ],
        { temperature: 0.4, maxTokens: 3000 },
      );

      const parsed = extractJsonFromLlm<{
        polished: string;
        changes: Array<{ original: string; revised: string; reason: string }>;
      }>(result);
      return {
        polished: parsed.polished || result,
        changes: Array.isArray(parsed.changes) ? parsed.changes : [],
      };
    } catch (error) {
      this.logger.error('Essay polish failed', error);
      throw new BadRequestException('Failed to polish essay');
    }
  }

  /**
   * AI 段落改写 - 用不同方式表达同一内容
   */
  async rewriteParagraph(
    paragraph: string,
    instruction?: string,
    locale = 'zh',
  ): Promise<{
    versions: Array<{ text: string; style: string }>;
  }> {
    const isZh = locale === 'zh';

    const systemPrompt = isZh
      ? `你是文书写作专家。根据用户提供的段落,生成3个不同风格的改写版本。

${instruction ? `用户特殊要求: ${instruction}` : ''}

返回JSON格式:
{
  "versions": [
    { "text": "改写版本1", "style": "风格描述(如:更具感染力)" },
    { "text": "改写版本2", "style": "风格描述" },
    { "text": "改写版本3", "style": "风格描述" }
  ]
}
style字段必须用中文。`
      : `You are an essay writing expert. Based on the provided paragraph, generate 3 rewritten versions in different styles.

${instruction ? `Special instruction: ${instruction}` : ''}

Return JSON format:
{
  "versions": [
    { "text": "Rewritten version 1", "style": "Style description (e.g., More compelling)" },
    { "text": "Rewritten version 2", "style": "Style description" },
    { "text": "Rewritten version 3", "style": "Style description" }
  ]
}
style field must be in English.`;

    try {
      const result = await this.chat(
        [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: isZh
              ? `请改写以下段落:\n\n${paragraph}`
              : `Please rewrite the following paragraph:\n\n${paragraph}`,
          },
        ],
        { temperature: 0.8, maxTokens: 2000 },
      );

      const parsed = extractJsonFromLlm<{
        versions: Array<{ text: string; style: string }>;
      }>(result);
      return {
        versions: Array.isArray(parsed.versions)
          ? parsed.versions
          : [{ text: result, style: isZh ? '默认' : 'Default' }],
      };
    } catch (error) {
      this.logger.error('Paragraph rewrite failed', error);
      throw new BadRequestException('Failed to rewrite paragraph');
    }
  }

  /**
   * AI 续写 - 根据上下文继续写作
   */
  async continueWriting(
    content: string,
    prompt?: string,
    direction?: string,
    locale = 'zh',
  ): Promise<{ continuation: string; suggestions: string[] }> {
    const isZh = locale === 'zh';

    const systemPrompt = isZh
      ? `你是留学文书写作助手。根据已有内容,帮助用户继续写作。

${prompt ? `文书题目: ${prompt}` : ''}
${direction ? `用户希望的方向: ${direction}` : ''}

要求:
1. 保持与前文一致的语气和风格
2. 自然衔接,不要重复前文内容
3. 生成100-200词的续写内容
4. 提供2-3个后续发展方向建议

返回JSON格式:
{
  "continuation": "续写内容",
  "suggestions": ["方向建议1（中文）", "方向建议2（中文）", "方向建议3（中文）"]
}
suggestions字段必须用中文。`
      : `You are a college essay writing assistant. Based on existing content, help the user continue writing.

${prompt ? `Essay prompt: ${prompt}` : ''}
${direction ? `Desired direction: ${direction}` : ''}

Requirements:
1. Maintain consistent tone and style with the existing text
2. Connect naturally without repeating previous content
3. Generate 100-200 words of continuation
4. Provide 2-3 suggestions for future direction

Return JSON format:
{
  "continuation": "Continuation text",
  "suggestions": ["Direction 1 (English)", "Direction 2 (English)", "Direction 3 (English)"]
}
suggestions field must be in English.`;

    try {
      const result = await this.chat(
        [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: isZh
              ? `请基于以下内容续写:\n\n${content}`
              : `Please continue writing based on the following:\n\n${content}`,
          },
        ],
        { temperature: 0.7, maxTokens: 1500 },
      );

      const parsed = extractJsonFromLlm<{
        continuation: string;
        suggestions: string[];
      }>(result);
      return {
        continuation: parsed.continuation || result,
        suggestions: Array.isArray(parsed.suggestions)
          ? parsed.suggestions
          : [],
      };
    } catch (error) {
      this.logger.error('Continue writing failed', error);
      throw new BadRequestException('Failed to continue writing');
    }
  }

  /**
   * AI 开头生成 - 为文书生成吸引人的开头
   */
  async generateOpening(
    prompt: string,
    background?: string,
    locale = 'zh',
  ): Promise<{
    openings: Array<{ text: string; style: string }>;
  }> {
    const isZh = locale === 'zh';

    const systemPrompt = isZh
      ? `你是留学文书专家。根据题目和背景,生成3个不同风格的文书开头。

好的开头应该:
1. 立即抓住读者注意力
2. 不要用"我"开头
3. 可以用场景、对话、问题、或有力的陈述开始
4. 50-100词

返回JSON格式:
{
  "openings": [
    { "text": "开头1", "style": "风格描述（中文，如:场景描写）" },
    { "text": "开头2", "style": "风格" },
    { "text": "开头3", "style": "风格" }
  ]
}
style字段必须用中文。`
      : `You are a college essay expert. Based on the prompt and background, generate 3 essay openings in different styles.

A good opening should:
1. Immediately grab the reader's attention
2. Avoid starting with "I"
3. Use a scene, dialogue, question, or powerful statement
4. Be 50-100 words

Return JSON format:
{
  "openings": [
    { "text": "Opening 1", "style": "Style description (English, e.g., Scene setting)" },
    { "text": "Opening 2", "style": "Style" },
    { "text": "Opening 3", "style": "Style" }
  ]
}
style field must be in English.`;

    const userPrompt = isZh
      ? `题目: ${prompt}
${background ? `背景信息: ${background}` : ''}

请生成3个吸引人的开头:`
      : `Prompt: ${prompt}
${background ? `Background: ${background}` : ''}

Please generate 3 compelling openings:`;

    try {
      const result = await this.chat(
        [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        { temperature: 0.8, maxTokens: 1500 },
      );

      const parsed = extractJsonFromLlm<{
        openings: Array<{ text: string; style: string }>;
      }>(result);
      return {
        openings: Array.isArray(parsed.openings)
          ? parsed.openings
          : [{ text: result, style: isZh ? '默认' : 'Default' }],
      };
    } catch (error) {
      this.logger.error('Opening generation failed', error);
      throw new BadRequestException('Failed to generate opening');
    }
  }

  /**
   * AI 结尾生成 - 为文书生成有力的结尾
   */
  async generateEnding(
    content: string,
    prompt?: string,
    locale = 'zh',
  ): Promise<{
    endings: Array<{ text: string; style: string }>;
  }> {
    const isZh = locale === 'zh';

    const systemPrompt = isZh
      ? `你是留学文书专家。根据文书内容,生成3个不同风格的结尾。

好的结尾应该:
1. 呼应开头或主题
2. 展望未来或表达决心
3. 给读者留下深刻印象
4. 50-100词

返回JSON格式:
{
  "endings": [
    { "text": "结尾1", "style": "风格描述（中文，如:展望未来）" },
    { "text": "结尾2", "style": "风格" },
    { "text": "结尾3", "style": "风格" }
  ]
}
style字段必须用中文。`
      : `You are a college essay expert. Based on the essay content, generate 3 different-style conclusions.

A good conclusion should:
1. Echo the opening or theme
2. Look to the future or express determination
3. Leave a lasting impression on the reader
4. Be 50-100 words

Return JSON format:
{
  "endings": [
    { "text": "Ending 1", "style": "Style description (English, e.g., Future vision)" },
    { "text": "Ending 2", "style": "Style" },
    { "text": "Ending 3", "style": "Style" }
  ]
}
style field must be in English.`;

    try {
      const result = await this.chat(
        [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: isZh
              ? `${prompt ? `题目: ${prompt}\n\n` : ''}文书内容:\n${content}\n\n请生成3个有力的结尾:`
              : `${prompt ? `Prompt: ${prompt}\n\n` : ''}Essay content:\n${content}\n\nPlease generate 3 strong conclusions:`,
          },
        ],
        { temperature: 0.8, maxTokens: 1500 },
      );

      const parsed = extractJsonFromLlm<{
        endings: Array<{ text: string; style: string }>;
      }>(result);
      return {
        endings: Array.isArray(parsed.endings)
          ? parsed.endings
          : [{ text: result, style: isZh ? '默认' : 'Default' }],
      };
    } catch (error) {
      this.logger.error('Ending generation failed', error);
      throw new BadRequestException('Failed to generate ending');
    }
  }

  /**
   * P1: AI 个性化选校推荐 - Safety/Target/Reach 分类
   */
  async recommendSchools(
    profile: ProfileAnalysisRequest,
    availableSchools: Array<{
      id: string;
      name: string;
      nameZh?: string;
      usNewsRank?: number;
      acceptanceRate?: number;
      satRange?: string;
      actRange?: string;
    }>,
    locale = 'zh',
  ): Promise<SchoolRecommendationResponse> {
    const isZh = locale === 'zh';
    const na = isZh ? '未提供' : 'N/A';
    const undecided = isZh ? '未确定' : 'Undecided';

    const systemPrompt = isZh
      ? `你是资深美本选校顾问。根据学生档案和可选学校列表,将学校分为三类推荐。

## 分类标准
- 🎯 reach (冲刺校): 录取率 <30%,学生背景略低于学校平均
- ✅ target (匹配校): 学生背景与学校要求匹配,录取概率适中
- 🛡️ safety (保底校): 学生背景明显高于学校要求,录取有把握

## 评估依据
- GPA: 与学校录取中位数对比
- 标化: SAT/ACT 与学校录取范围对比
- 活动&奖项: 综合竞争力
- 学校录取率: 越低越难

## 输出格式 (严格JSON)
{
  "reach": [
    { "schoolId": "id", "probability": 10-40, "reason": "简短推荐理由（中文）", "highlights": ["匹配点1（中文）"] }
  ],
  "target": [
    { "schoolId": "id", "probability": 40-70, "reason": "...", "highlights": [] }
  ],
  "safety": [
    { "schoolId": "id", "probability": 70-95, "reason": "...", "highlights": [] }
  ],
  "summary": "整体选校策略建议（中文，50字）"
}

所有文本字段必须用中文。
- reach: 3-5所冲刺校
- target: 4-6所匹配校
- safety: 2-4所保底校
- 每类按推荐度排序
- probability 为估计录取概率(%)`
      : `You are an expert US college admissions consultant. Based on the student profile and available schools, categorize schools into three recommendation tiers.

## Classification
- 🎯 reach: Acceptance rate <30%, student profile slightly below school average
- ✅ target: Student profile matches school requirements, moderate admission probability
- 🛡️ safety: Student profile clearly above requirements, high admission confidence

## Evaluation Criteria
- GPA: Compare with school admission median
- Test Scores: SAT/ACT vs. school admission range
- Activities & Awards: Overall competitiveness
- Acceptance Rate: Lower = harder

## Output Format (strict JSON)
{
  "reach": [
    { "schoolId": "id", "probability": 10-40, "reason": "Brief reason (English)", "highlights": ["Match point (English)"] }
  ],
  "target": [
    { "schoolId": "id", "probability": 40-70, "reason": "...", "highlights": [] }
  ],
  "safety": [
    { "schoolId": "id", "probability": 70-95, "reason": "...", "highlights": [] }
  ],
  "summary": "Overall strategy advice (English, 50 words)"
}

All text fields must be in English.
- reach: 3-5 schools
- target: 4-6 schools
- safety: 2-4 schools
- Sort by recommendation strength
- probability = estimated admission probability (%)`;

    const schoolsInfo = availableSchools
      .slice(0, 50)
      .map(
        (s) =>
          `- ${s.name}${s.nameZh ? `(${s.nameZh})` : ''} | Rank: ${s.usNewsRank || 'N/A'} | AccRate: ${s.acceptanceRate ? `${s.acceptanceRate}%` : 'N/A'} | SAT: ${s.satRange || 'N/A'} | ID: ${s.id}`,
      )
      .join('\n');

    const hsLine = profile.highSchoolContext
      ? `\n${isZh ? '高中背景' : 'High School'}: ${profile.highSchoolContext}`
      : '';
    const activitiesSummary = profile.activities?.length
      ? profile.activities
          .slice(0, 5)
          .map((a) => {
            const base = `${a.name}(${a.category}${a.role ? ', ' + a.role : ''})`;
            return a.description
              ? `${base}: ${a.description.slice(0, 60)}`
              : base;
          })
          .join('; ')
      : isZh
        ? '无'
        : 'None';
    const awardsSummary = profile.awards?.length
      ? profile.awards
          .slice(0, 5)
          .map((a) => `${a.name}(${a.level})`)
          .join(', ')
      : isZh
        ? '无'
        : 'None';

    const userPrompt = isZh
      ? `【学生档案】
GPA: ${profile.gpa ? `${profile.gpa}/${profile.gpaScale || 4.0}` : na}
标化: ${profile.testScores?.map((s) => `${s.type}: ${s.score}`).join(', ') || na}${hsLine}
目标专业: ${profile.targetMajor || undecided}
主要活动(${profile.activities?.length || 0}项): ${activitiesSummary}
奖项(${profile.awards?.length || 0}项): ${awardsSummary}

【可选学校】
${schoolsInfo}

请根据学生背景推荐合适的学校:`
      : `[Student Profile]
GPA: ${profile.gpa ? `${profile.gpa}/${profile.gpaScale || 4.0}` : na}
Test Scores: ${profile.testScores?.map((s) => `${s.type}: ${s.score}`).join(', ') || na}${hsLine}
Target Major: ${profile.targetMajor || undecided}
Key Activities (${profile.activities?.length || 0}): ${activitiesSummary}
Awards (${profile.awards?.length || 0}): ${awardsSummary}

[Available Schools]
${schoolsInfo}

Based on the student's profile, recommend suitable schools:`;

    try {
      const result = await this.chat(
        [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        { temperature: 0.4, maxTokens: 2500 },
      );

      const parsed = extractJsonFromLlm(result);
      return this.validateSchoolRecommendation(
        parsed,
        availableSchools,
        locale,
      );
    } catch (error) {
      this.logger.error('School recommendation failed', error);
      return this.getDefaultSchoolRecommendation(locale);
    }
  }

  private validateSchoolRecommendation(
    data: any,
    schools: Array<{ id: string; name: string }>,
    locale = 'zh',
  ): SchoolRecommendationResponse {
    const schoolIds = new Set(schools.map((s) => s.id));

    const validateCategory = (items: any[]): SchoolRecommendation[] => {
      if (!Array.isArray(items)) return [];
      return items
        .filter((item) => item?.schoolId && schoolIds.has(item.schoolId))
        .map((item) => ({
          schoolId: item.schoolId,
          probability: Math.min(100, Math.max(0, item.probability || 50)),
          reason: item.reason || '',
          highlights: Array.isArray(item.highlights) ? item.highlights : [],
        }));
    };

    return {
      reach: validateCategory(data.reach),
      target: validateCategory(data.target),
      safety: validateCategory(data.safety),
      summary:
        data.summary ||
        (locale === 'zh'
          ? '请完善档案信息以获取更精准的选校建议。'
          : 'Please complete your profile for more accurate school recommendations.'),
    };
  }

  private getDefaultSchoolRecommendation(
    locale = 'zh',
  ): SchoolRecommendationResponse {
    return {
      reach: [],
      target: [],
      safety: [],
      summary:
        locale === 'zh'
          ? '档案信息不完整,请补充GPA和标化成绩后重新获取选校建议。'
          : 'Profile information is incomplete. Please add GPA and test scores for school recommendations.',
    };
  }

  /**
   * P1: 文书逐段点评 - 类似Clastify风格
   */
  async analyzeEssayParagraphs(
    content: string,
    prompt?: string,
    schoolName?: string,
    locale = 'zh',
  ): Promise<EssayParagraphAnalysisResponse> {
    // 分段处理
    const paragraphs = content
      .split(/\n\n+/)
      .map((p) => p.trim())
      .filter((p) => p.length > 20); // 过滤太短的段落

    if (paragraphs.length === 0) {
      return this.getDefaultParagraphAnalysis(locale);
    }

    const isZh = locale === 'zh';

    const systemPrompt = isZh
      ? `你是顶尖大学招生官，请逐段分析以下文书。

${prompt ? `题目: ${prompt}` : ''}
${schoolName ? `目标学校: ${schoolName}` : ''}

## 评分标准
- 🟢 excellent (8-10): 段落出色，展现独特性和深度
- 🟡 good (5-7): 段落合格但可以更好
- 🔴 needs_work (1-4): 需要重点修改

## 输出格式 (严格JSON)
{
  "paragraphs": [
    {
      "paragraphIndex": 0,
      "paragraphText": "段落原文前30字...",
      "score": 8,
      "status": "excellent",
      "comment": "评价（中文）",
      "highlights": ["亮点词句1"],
      "suggestions": ["建议（中文）"]
    }
  ],
  "overallScore": 75,
  "structure": {
    "hasStrongOpening": true,
    "hasClarity": true,
    "hasGoodConclusion": false,
    "feedback": "结构反馈（中文）"
  },
  "summary": "整体评价（中文，100字内）"
}

所有文本字段必须用中文。`
      : `You are a top university admissions officer. Analyze the following essay paragraph by paragraph.

${prompt ? `Prompt: ${prompt}` : ''}
${schoolName ? `Target school: ${schoolName}` : ''}

## Scoring Criteria
- 🟢 excellent (8-10): Outstanding paragraph, shows uniqueness and depth
- 🟡 good (5-7): Adequate but could be better
- 🔴 needs_work (1-4): Needs significant revision

## Output Format (strict JSON)
{
  "paragraphs": [
    {
      "paragraphIndex": 0,
      "paragraphText": "First 30 chars of paragraph...",
      "score": 8,
      "status": "excellent",
      "comment": "Comment (English)",
      "highlights": ["Highlight phrase 1"],
      "suggestions": ["Suggestion (English)"]
    }
  ],
  "overallScore": 75,
  "structure": {
    "hasStrongOpening": true,
    "hasClarity": true,
    "hasGoodConclusion": false,
    "feedback": "Structure feedback (English)"
  },
  "summary": "Overall evaluation (English, under 100 words)"
}

All text fields must be in English.`;

    const userPrompt = paragraphs
      .map((p, i) => `【段落 ${i + 1}】\n${p}`)
      .join('\n\n');

    try {
      const result = await this.chat(
        [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: isZh
              ? `请逐段分析以下文书:\n\n${userPrompt}`
              : `Analyze the following essay paragraph by paragraph:\n\n${userPrompt}`,
          },
        ],
        { temperature: 0.4, maxTokens: 3000 },
      );

      const parsed = extractJsonFromLlm(result);
      return this.validateParagraphAnalysis(parsed, paragraphs, locale);
    } catch (error) {
      this.logger.error('Paragraph analysis failed', error);
      return this.getDefaultParagraphAnalysis(locale);
    }
  }

  private validateParagraphAnalysis(
    data: any,
    originalParagraphs: string[],
    locale = 'zh',
  ): EssayParagraphAnalysisResponse {
    const validateParagraph = (p: any, index: number): ParagraphComment => {
      const score =
        typeof p?.score === 'number' ? Math.min(10, Math.max(1, p.score)) : 5;
      let status: 'excellent' | 'good' | 'needs_work' = 'good';
      if (score >= 8) status = 'excellent';
      else if (score < 5) status = 'needs_work';

      return {
        paragraphIndex: index,
        paragraphText: originalParagraphs[index]?.slice(0, 50) + '...' || '',
        score,
        status: p?.status || status,
        comment:
          p?.comment || (locale === 'zh' ? '暂无评价' : 'No comment available'),
        highlights: Array.isArray(p?.highlights) ? p.highlights : [],
        suggestions: Array.isArray(p?.suggestions) ? p.suggestions : [],
      };
    };

    const paragraphComments = Array.isArray(data.paragraphs)
      ? data.paragraphs.map((p: any, i: number) => validateParagraph(p, i))
      : originalParagraphs.map((_, i) => validateParagraph({}, i));

    return {
      paragraphs: paragraphComments,
      overallScore:
        typeof data.overallScore === 'number'
          ? Math.min(100, Math.max(0, data.overallScore))
          : 60,
      structure: {
        hasStrongOpening: data.structure?.hasStrongOpening ?? false,
        hasClarity: data.structure?.hasClarity ?? true,
        hasGoodConclusion: data.structure?.hasGoodConclusion ?? false,
        feedback:
          data.structure?.feedback ||
          (locale === 'zh'
            ? '请完善文书以获取更详细的结构分析。'
            : 'Please improve your essay for a more detailed structural analysis.'),
      },
      summary:
        data.summary ||
        (locale === 'zh'
          ? '文书分析完成，请查看各段落点评。'
          : 'Essay analysis complete. Please review the paragraph-by-paragraph feedback.'),
    };
  }

  private getDefaultParagraphAnalysis(
    locale = 'zh',
  ): EssayParagraphAnalysisResponse {
    const isZh = locale === 'zh';
    return {
      paragraphs: [],
      overallScore: 0,
      structure: {
        hasStrongOpening: false,
        hasClarity: false,
        hasGoodConclusion: false,
        feedback: isZh
          ? '文书内容不足，请提供更多内容以进行分析。'
          : 'Not enough essay content. Please provide more content for analysis.',
      },
      summary: isZh
        ? '文书内容过短或为空，无法分析。'
        : 'Essay content is too short or empty for analysis.',
    };
  }

  // ============================================
  // Resume AI Features
  // ============================================

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
    const isZh = locale === 'zh';

    const resumeTypeLabel = isZh
      ? resumeData.resumeType === 'COLLEGE_APPLICATION'
        ? '留学申请'
        : resumeData.resumeType === 'INTERNSHIP'
          ? '实习求职'
          : '研究生CV'
      : resumeData.resumeType === 'COLLEGE_APPLICATION'
        ? 'college application'
        : resumeData.resumeType === 'INTERNSHIP'
          ? 'internship/job'
          : 'graduate CV';

    const targetCtx = context.targetSchool
      ? isZh
        ? '和目标学校'
        : ' and target school'
      : '';

    const systemPrompt = isZh
      ? `你是一位资深简历审核专家，使用**标准化评分 Rubric**评估${resumeTypeLabel}简历。你的评分必须基于以下子标准，确保一致性和可复现性。

## 评分 Rubric（每个子标准 0-10 分）

### 1. content 内容质量 (权重30%)
- strong_action_verbs: 10=全部bullet用强动词(Led/Developed/Engineered)开头 5=一半 0=无
- quantified_results: 10=全部bullet含数字指标(百分比/金额/人数) 5=一半 0=无
- star_structure: 10=每条有情境-行动-结果 5=部分有 0=无结构
- specificity: 10=全部具体可验证 5=一半 0=笼统空泛
- bullet_length: 10=全部1-2行适中 5=多数合适 0=过长或过短

### 2. formatting 格式规范 (权重20%)
- consistency: 10=日期/时态/大小写/bullet风格完全统一 5=有少量不一致 0=混乱
- section_ordering: 10=板块顺序最优(本科申请: Education优先) 5=基本合理 0=不合逻辑
- information_density: 10=信息密度均衡无浪费 5=稍有冗余或稀疏 0=过密或过空
- visual_balance: 10=板块篇幅均衡 5=稍有失衡 0=某板块极度膨胀

### 3. impact 影响力 (权重20%)
- achievement_orientation: 10=全部聚焦成果而非职责 5=一半 0=全是职责描述
- leadership_evidence: 10=多处展示主动性/领导力/导师角色 5=少量 0=无
- scope_scale: 10=展示影响范围(团队规模/用户量/预算) 5=少量 0=无
- progression: 10=清晰成长轨迹(责任递增) 5=略有 0=平铺

### 4. completeness 完整性 (权重15%)
- required_sections: 10=简历类型所需板块齐全 5=缺1-2个次要板块 0=缺关键板块
- sufficient_detail: 10=每段经历3-5条bullet 5=2条 0=仅1条或无
- contact_info: 10=姓名+邮箱+电话+链接齐全 5=缺1项 0=缺多项
- date_coverage: 10=时间线无空白 5=有小间隙 0=大段空白

### 5. relevance 相关性 (权重15%)
- type_match: 10=内容完美匹配简历类型 5=基本匹配 0=严重错位
- target_alignment: 10=明确针对目标${context.targetSchool ? '学校/专业' : '方向'}定制 5=部分相关 0=完全无关
- keyword_usage: 10=领域术语丰富恰当 5=少量 0=无专业术语
- recency: 10=最新最相关经历突出 5=基本按时间排 0=过时内容优先

## Section Feedback 规则
对每个板块逐条审查。发现问题时:
- original: 精确复制简历原文(逐字照抄)
- suggestion: 改后版本
- type: weak_verb|no_quantification|too_vague|missing_result|too_long|too_short|formatting|relevance|missing_info|tense_inconsistency|generic_claim
- severity: high(严重影响印象) medium(明显可改) low(锦上添花)
- bulletIndex: 对应的bullet索引(从0开始)
优先报告severity=high的问题，每个section最多报告5个最重要的问题。

## 输出格式 (严格JSON)
{
  "version": 2,
  "overallScore": 0-100,
  "dimensions": [
    {
      "name": "content",
      "score": 0-100,
      "status": "green|yellow|red",
      "feedback": "总结评价",
      "criteria": [
        { "key": "strong_action_verbs", "name": "强动词使用", "score": 0-10, "maxScore": 10, "detail": "具体发现" }
      ],
      "improvements": ["最重要的改进建议"]
    }
  ],
  "sectionFeedback": [
    {
      "sectionType": "WORK_EXPERIENCE",
      "sectionTitle": "工作经历",
      "issues": [
        { "type": "weak_verb", "severity": "high", "original": "原文", "suggestion": "改后", "reason": "原因", "bulletIndex": 0 }
      ]
    }
  ],
  "contentGaps": [
    { "sectionType": "SKILLS", "description": "缺少技能板块", "priority": "high", "example": "建议添加: Python, SQL..." }
  ],
  "bulletQuality": { "actionVerbUsage": 0-100, "quantificationRate": 0-100, "averageLength": 15 },
  "summary": "100字总结"
}

规则:
- dimension.score = round(mean(criteria.score) * 10)
- status: green(≥70) yellow(40-69) red(<40)
- 5个dimensions必须按顺序: content, formatting, impact, completeness, relevance
- sectionFeedback只引用输入中存在的section
- original必须是简历中的精确原文
- 所有文本必须用中文`
      : `You are an expert resume reviewer using a STANDARDIZED RUBRIC to evaluate ${resumeTypeLabel} resumes. Your scores must be based on the sub-criteria below for consistency and reproducibility.

## SCORING RUBRIC (each sub-criterion 0-10)

### 1. content — Content Quality (weight 30%)
- strong_action_verbs: 10=all bullets start with strong verbs(Led/Developed/Engineered) 5=half 0=none
- quantified_results: 10=all bullets have metrics(percentages/dollars/counts) 5=half 0=none
- star_structure: 10=every bullet has Situation-Action-Result 5=some 0=no structure
- specificity: 10=all claims concrete and verifiable 5=half 0=all vague
- bullet_length: 10=all 1-2 lines 5=mostly ok 0=all too long/short

### 2. formatting — Formatting (weight 20%)
- consistency: 10=dates/tense/capitalization/bullet style perfectly uniform 5=minor issues 0=chaotic
- section_ordering: 10=optimal for resume type(Education first for college apps) 5=acceptable 0=illogical
- information_density: 10=well balanced, no wasted space 5=slightly sparse/dense 0=very unbalanced
- visual_balance: 10=sections proportionally sized 5=slightly uneven 0=one section dominates

### 3. impact — Impact (weight 20%)
- achievement_orientation: 10=all outcome-focused 5=half 0=all duty-based
- leadership_evidence: 10=clear initiative/leadership in multiple entries 5=some 0=none
- scope_scale: 10=demonstrates breadth(team size/users/budget) 5=some 0=none
- progression: 10=clear growth trajectory(increasing responsibility) 5=slight 0=flat

### 4. completeness — Completeness (weight 15%)
- required_sections: 10=all expected sections for resume type present 5=missing 1-2 minor 0=missing critical
- sufficient_detail: 10=3-5 bullets per experience 5=2 bullets 0=1 or none
- contact_info: 10=name+email+phone+links all present 5=missing 1 0=missing several
- date_coverage: 10=no timeline gaps 5=small gaps 0=large unexplained gaps

### 5. relevance — Relevance (weight 15%)
- type_match: 10=content perfectly fits resume type 5=mostly fits 0=mismatched
- target_alignment: 10=clearly tailored to target${targetCtx} 5=partially relevant 0=generic
- keyword_usage: 10=rich field-appropriate terminology 5=some 0=no relevant terms
- recency: 10=most recent/relevant experiences emphasized 5=mostly chronological 0=outdated first

## Section Feedback Rules
Review EACH section bullet by bullet. When finding issues:
- original: EXACT quote from the resume (copy verbatim)
- suggestion: the improved version
- type: weak_verb|no_quantification|too_vague|missing_result|too_long|too_short|formatting|relevance|missing_info|tense_inconsistency|generic_claim
- severity: high(major impression impact) medium(noticeable) low(minor polish)
- bulletIndex: the 0-based index of the bullet
Prioritize severity=high issues. Max 5 most important issues per section.

## Output Format (strict JSON)
{
  "version": 2,
  "overallScore": 0-100,
  "dimensions": [
    {
      "name": "content",
      "score": 0-100,
      "status": "green|yellow|red",
      "feedback": "Summary assessment",
      "criteria": [
        { "key": "strong_action_verbs", "name": "Strong Action Verbs", "score": 0-10, "maxScore": 10, "detail": "Specific finding" }
      ],
      "improvements": ["Top improvement suggestion"]
    }
  ],
  "sectionFeedback": [
    {
      "sectionType": "WORK_EXPERIENCE",
      "sectionTitle": "Work Experience",
      "issues": [
        { "type": "weak_verb", "severity": "high", "original": "exact text", "suggestion": "improved text", "reason": "why", "bulletIndex": 0 }
      ]
    }
  ],
  "contentGaps": [
    { "sectionType": "SKILLS", "description": "No technical skills section", "priority": "high", "example": "Add: Python, SQL..." }
  ],
  "bulletQuality": { "actionVerbUsage": 0-100, "quantificationRate": 0-100, "averageLength": 15 },
  "summary": "100-word summary"
}

Rules:
- dimension.score = round(mean(criteria.score) * 10)
- status: green(≥70) yellow(40-69) red(<40)
- All 5 dimensions MUST appear in order: content, formatting, impact, completeness, relevance
- sectionFeedback MUST only reference sections from the input
- original MUST be an exact quote from the resume
- All text in English`;

    const sectionsText = this.serializeResumeSections(resumeData.sections);

    const userPrompt = `${context.targetSchool ? `Target: ${context.targetSchool}` : ''}${context.targetMajor ? ` / ${context.targetMajor}` : ''}
Resume Type: ${resumeData.resumeType}

${sectionsText}`;

    try {
      const result = await this.chat(
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
              Array.isArray(v) ? `${k}: ${v.join(', ')}` : `${k}: ${v}`,
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
    const isZh = locale === 'zh';

    const systemPrompt = isZh
      ? `你是简历 bullet point 优化专家。请按照以下规则优化每一条 bullet:

## 优化规则
1. **强动词开头**: Led, Developed, Conducted, Implemented, Designed, Managed, Organized, Founded, Achieved, Reduced, Increased
2. **STAR 方法**: Situation → Task → Action → Result
3. **量化数据**: 尽可能添加数字、百分比、规模
4. **长度控制**: 每条 1-2 行,不超过 2 行
5. **不加句号**: bullet point 不以句号结尾
6. ${context.resumeType === 'INTERNSHIP' ? '**ATS 友好**: 使用标准行业术语' : '**留学风格**: 强调 leadership, impact, initiative'}

## 输出格式 (严格JSON)
{
  "optimized": [
    { "original": "原文", "improved": "优化后", "reason": "优化理由（中文）" }
  ],
  "newSuggestions": ["建议新增的 bullet（中文提示+英文示例）"]
}

所有 reason 和 newSuggestions 必须用中文。improved 保持英文。`
      : `You are a resume bullet point optimization expert. Optimize each bullet following these rules:

## Rules
1. **Strong action verbs**: Led, Developed, Conducted, Implemented, Designed, etc.
2. **STAR method**: Situation → Task → Action → Result
3. **Quantify**: Add numbers, percentages, scale wherever possible
4. **Length**: 1-2 lines max per bullet
5. **No period**: Bullets should not end with a period
6. ${context.resumeType === 'INTERNSHIP' ? '**ATS-friendly**: Use standard industry terminology' : '**College app style**: Emphasize leadership, impact, initiative'}

## Output Format (strict JSON)
{
  "optimized": [
    { "original": "Original text", "improved": "Optimized text", "reason": "Reason for changes" }
  ],
  "newSuggestions": ["Suggested new bullets to add"]
}`;

    const userPrompt = `Section: ${context.sectionType}${context.role ? ` | Role: ${context.role}` : ''}${context.organization ? ` | Org: ${context.organization}` : ''}

Bullets to optimize:
${bullets.map((b, i) => `${i + 1}. ${b}`).join('\n')}`;

    try {
      const result = await this.chat(
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
    const isZh = locale === 'zh';

    const systemPrompt = isZh
      ? `你是留学简历内容规划顾问。根据学生背景,为 ${sectionType} section 提供内容建议。

## 建议类型
- 具体可添加的内容条目
- 现有内容的改进方向
- 该 section 的最佳实践 tips
- 示例 bullet points

## 输出格式 (严格JSON)
{
  "suggestions": [
    { "text": "建议内容（中文）", "category": "new_item|improve|missing", "priority": "high|medium|low" }
  ],
  "tips": ["Section 编写技巧（中文）"],
  "exampleBullets": ["示例 bullet（英文）"]
}

所有 text 和 tips 必须用中文。exampleBullets 用英文。`
      : `You are a resume content planning consultant. Based on the student's background, suggest content for the ${sectionType} section.

## Suggestion Types
- Specific items to add
- Improvements for existing content
- Best practice tips for this section
- Example bullet points

## Output Format (strict JSON)
{
  "suggestions": [
    { "text": "Suggestion text", "category": "new_item|improve|missing", "priority": "high|medium|low" }
  ],
  "tips": ["Section writing tips"],
  "exampleBullets": ["Example bullet"]
}`;

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
      const result = await this.chat(
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

// P1: 选校推荐类型定义
export interface SchoolRecommendation {
  schoolId: string;
  probability: number;
  reason: string;
  highlights: string[];
}

export interface SchoolRecommendationResponse {
  reach: SchoolRecommendation[];
  target: SchoolRecommendation[];
  safety: SchoolRecommendation[];
  summary: string;
}

// P1: 逐段点评类型定义
export interface ParagraphComment {
  paragraphIndex: number;
  paragraphText: string;
  score: number; // 1-10
  status: 'excellent' | 'good' | 'needs_work';
  comment: string;
  highlights: string[]; // 亮点词句
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
