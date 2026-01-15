import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ProfileAnalysisRequest {
  gpa?: number;
  gpaScale?: number;
  testScores?: Array<{ type: string; score: number }>;
  activities?: Array<{ name: string; category: string; role: string }>;
  awards?: Array<{ name: string; level: string }>;
  targetMajor?: string;
  targetSchools?: string[];
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
  private readonly apiKey: string | undefined;
  private readonly baseUrl: string;
  private readonly model: string;

  constructor(private configService: ConfigService) {
    this.apiKey = this.configService.get<string>('OPENAI_API_KEY');
    this.baseUrl =
      this.configService.get<string>('OPENAI_BASE_URL') ||
      'https://api.openai.com/v1';
    this.model =
      this.configService.get<string>('OPENAI_MODEL') || 'gpt-4o-mini';
  }

  private isConfigured(): boolean {
    return !!this.apiKey;
  }

  async chat(
    messages: ChatMessage[],
    options?: { temperature?: number; maxTokens?: number },
  ): Promise<string> {
    if (!this.isConfigured()) {
      throw new BadRequestException('AI service not configured');
    }

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        messages,
        temperature: options?.temperature ?? 0.7,
        max_tokens: options?.maxTokens ?? 2000,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      this.logger.error(`OpenAI API error: ${error}`);
      throw new BadRequestException('AI service error');
    }

    const data = await response.json();
    return data.choices[0]?.message?.content || '';
  }

  async analyzeProfile(
    request: ProfileAnalysisRequest,
  ): Promise<ProfileAnalysisResponse> {
    const systemPrompt = `你是一位资深的留学申请顾问,专注于美国本科申请。请根据提供的学生档案信息,给出客观、专业的分析和建议。

输出要求:
1. overall: 对申请者整体竞争力的简要评估(100-200字)
2. strengths: 列出3-5个优势点
3. weaknesses: 列出2-4个需要改进的地方
4. suggestions: 提供3-5条具体可行的建议

请用JSON格式返回结果。`;

    const userPrompt = `请分析以下学生档案:

GPA: ${request.gpa ? `${request.gpa}/${request.gpaScale || 4.0}` : '未提供'}
标化成绩: ${request.testScores?.map((s) => `${s.type}: ${s.score}`).join(', ') || '未提供'}
活动: ${request.activities?.map((a) => `${a.name}(${a.role})`).join(', ') || '未提供'}
奖项: ${request.awards?.map((a) => `${a.name}(${a.level})`).join(', ') || '未提供'}
目标专业: ${request.targetMajor || '未确定'}
目标学校: ${request.targetSchools?.join(', ') || '未确定'}`;

    try {
      const result = await this.chat(
        [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        { temperature: 0.5 },
      );

      // Parse JSON from response
      const jsonMatch = result.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }

      // Fallback if JSON parsing fails
      return {
        overall: result,
        strengths: [],
        weaknesses: [],
        suggestions: [],
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
  ): Promise<DetailedProfileAnalysisResponse> {
    const systemPrompt = `你是资深美本申请顾问,请对学生档案进行详细评估。

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
    "academic": { "status": "green|yellow|red", "score": 1-10, "feedback": "具体评价", "highlights": ["亮点1"], "improvements": ["改进点1"] },
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
  "summary": "100字总结"
}

请严格按照JSON格式输出,不要添加其他内容。`;

    const userPrompt = this.buildDetailedProfilePrompt(request);

    try {
      const result = await this.chat(
        [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        { temperature: 0.4, maxTokens: 2500 },
      );

      const jsonMatch = result.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return this.validateDetailedAnalysis(parsed);
      }

      return this.getDefaultDetailedAnalysis();
    } catch (error) {
      this.logger.error('Detailed profile analysis failed', error);
      // 返回默认响应而非抛出错误,保证用户体验
      return this.getDefaultDetailedAnalysis();
    }
  }

  private buildDetailedProfilePrompt(request: ProfileAnalysisRequest): string {
    const parts: string[] = ['请分析以下学生档案:\n'];

    // 学术
    if (request.gpa) {
      parts.push(`【学术背景】`);
      parts.push(`- GPA: ${request.gpa}/${request.gpaScale || 4.0}`);
    } else {
      parts.push(`【学术背景】未提供GPA`);
    }

    // 标化
    parts.push(`\n【标化成绩】`);
    if (request.testScores?.length) {
      request.testScores.forEach((s) => {
        parts.push(`- ${s.type}: ${s.score}`);
      });
    } else {
      parts.push(`- 未提供标化成绩`);
    }

    // 活动
    parts.push(`\n【课外活动】`);
    if (request.activities?.length) {
      request.activities.forEach((a, i) => {
        parts.push(`${i + 1}. ${a.name} - ${a.role} (${a.category})`);
      });
    } else {
      parts.push(`- 未填写活动`);
    }

    // 奖项
    parts.push(`\n【奖项荣誉】`);
    if (request.awards?.length) {
      request.awards.forEach((a, i) => {
        parts.push(`${i + 1}. ${a.name} (${a.level}级)`);
      });
    } else {
      parts.push(`- 未填写奖项`);
    }

    // 目标
    if (request.targetMajor) {
      parts.push(`\n【目标专业】${request.targetMajor}`);
    }

    return parts.join('\n');
  }

  private validateDetailedAnalysis(data: any): DetailedProfileAnalysisResponse {
    const validateSection = (section: any): SectionAnalysis => ({
      status: ['green', 'yellow', 'red'].includes(section?.status)
        ? section.status
        : 'yellow',
      score:
        typeof section?.score === 'number'
          ? Math.min(10, Math.max(1, section.score))
          : 5,
      feedback: section?.feedback || '暂无评价',
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
      summary: data.summary || '请完善档案信息以获取更准确的分析。',
    };
  }

  private getDefaultDetailedAnalysis(): DetailedProfileAnalysisResponse {
    const defaultSection: SectionAnalysis = {
      status: 'yellow',
      score: 5,
      feedback: '请补充更多信息以获取准确评估',
      highlights: [],
      improvements: ['请补充此项信息'],
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
        timeline: ['请先完善档案基本信息'],
      },
      summary: '档案信息不完整,请补充GPA、标化成绩、活动和奖项后重新分析。',
    };
  }

  async reviewEssay(request: EssayReviewRequest): Promise<EssayReviewResponse> {
    const systemPrompt = `你是一位专业的留学文书顾问,擅长美国本科申请文书修改。请对提供的文书进行全面评估。

评分标准(1-10分):
- 结构(structure): 文章结构是否清晰,有没有明确的开头、主体、结尾
- 内容(content): 故事是否真实感人,是否展现了申请者的独特性
- 语言(language): 语法是否正确,用词是否恰当,是否有表达力

请用JSON格式返回结果,包含:
- overallScore: 总体评分(1-10)
- structure: { score: 数字, feedback: "反馈" }
- content: { score: 数字, feedback: "反馈" }
- language: { score: 数字, feedback: "反馈" }
- suggestions: ["建议1", "建议2", ...]`;

    const userPrompt = `题目: ${request.prompt}
${request.wordLimit ? `字数限制: ${request.wordLimit}字` : ''}

文书内容:
${request.content}`;

    try {
      const result = await this.chat(
        [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        { temperature: 0.5 },
      );

      const jsonMatch = result.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }

      return {
        overallScore: 5,
        structure: { score: 5, feedback: result },
        content: { score: 5, feedback: '' },
        language: { score: 5, feedback: '' },
        suggestions: [],
      };
    } catch (error) {
      this.logger.error('Essay review failed', error);
      throw new BadRequestException('Failed to review essay');
    }
  }

  async generateEssayIdeas(
    topic: string,
    background?: string,
  ): Promise<string[]> {
    const systemPrompt = `你是一位创意写作顾问,帮助学生为留学文书brainstorm创意点子。
请根据题目和背景,提供5-8个具体、有深度的写作角度或故事线索。
返回JSON数组格式: ["想法1", "想法2", ...]`;

    const userPrompt = `题目: ${topic}
${background ? `学生背景: ${background}` : ''}

请提供一些写作思路:`;

    try {
      const result = await this.chat(
        [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        { temperature: 0.8 },
      );

      const jsonMatch = result.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }

      return [result];
    } catch (error) {
      this.logger.error('Idea generation failed', error);
      throw new BadRequestException('Failed to generate ideas');
    }
  }

  async schoolMatch(
    profile: ProfileAnalysisRequest,
  ): Promise<Array<{ name: string; fit: string; reason: string }>> {
    if (!profile.gpa && !profile.testScores?.length) {
      throw new BadRequestException(
        'Please provide GPA or test scores for school matching',
      );
    }

    const systemPrompt = `你是留学选校顾问。根据学生档案,推荐10-15所合适的美国大学,分为冲刺校、匹配校、保底校三类。
返回JSON数组: [{ "name": "学校名", "fit": "reach/match/safety", "reason": "简短原因" }]`;

    const userPrompt = `学生档案:
GPA: ${profile.gpa ? `${profile.gpa}/${profile.gpaScale || 4.0}` : '未提供'}
标化: ${profile.testScores?.map((s) => `${s.type}: ${s.score}`).join(', ') || '未提供'}
目标专业: ${profile.targetMajor || '未确定'}

请推荐学校:`;

    try {
      const result = await this.chat(
        [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        { temperature: 0.5 },
      );

      const jsonMatch = result.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }

      return [];
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
  ): Promise<{
    polished: string;
    changes: Array<{ original: string; revised: string; reason: string }>;
  }> {
    const styleGuide = {
      formal: '使用更正式、学术化的语言，适合严肃主题',
      vivid: '使用更生动、有画面感的语言，多用具体细节和感官描写',
      concise: '精简冗余表达，每个词都要有意义',
    };

    const systemPrompt = `你是专业的留学文书编辑,擅长英文文书润色。
任务:在保持原文核心内容和作者声音(voice)的前提下,提升语言表达质量。

润色风格: ${styleGuide[style || 'formal']}

要求:
1. 保持原文的故事和观点不变
2. 改善语法、用词、句式多样性
3. 增强表达力和可读性
4. 不要过度修改,保持作者个人特色

返回JSON格式:
{
  "polished": "润色后的完整文书",
  "changes": [
    { "original": "原句", "revised": "修改后", "reason": "修改原因" }
  ]
}
只返回主要修改(5-10处),不需要列出所有小改动。`;

    try {
      const result = await this.chat(
        [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `请润色以下文书:\n\n${content}` },
        ],
        { temperature: 0.4, maxTokens: 3000 },
      );

      const jsonMatch = result.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }

      return { polished: result, changes: [] };
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
  ): Promise<{
    versions: Array<{ text: string; style: string }>;
  }> {
    const systemPrompt = `你是文书写作专家。根据用户提供的段落,生成3个不同风格的改写版本。

${instruction ? `用户特殊要求: ${instruction}` : ''}

返回JSON格式:
{
  "versions": [
    { "text": "改写版本1", "style": "风格描述(如:更具感染力)" },
    { "text": "改写版本2", "style": "风格描述" },
    { "text": "改写版本3", "style": "风格描述" }
  ]
}`;

    try {
      const result = await this.chat(
        [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `请改写以下段落:\n\n${paragraph}` },
        ],
        { temperature: 0.8, maxTokens: 2000 },
      );

      const jsonMatch = result.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }

      return { versions: [{ text: result, style: '默认' }] };
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
  ): Promise<{ continuation: string; suggestions: string[] }> {
    const systemPrompt = `你是留学文书写作助手。根据已有内容,帮助用户继续写作。

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
  "suggestions": ["方向建议1", "方向建议2", "方向建议3"]
}`;

    try {
      const result = await this.chat(
        [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `请基于以下内容续写:\n\n${content}` },
        ],
        { temperature: 0.7, maxTokens: 1500 },
      );

      const jsonMatch = result.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }

      return { continuation: result, suggestions: [] };
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
  ): Promise<{
    openings: Array<{ text: string; style: string }>;
  }> {
    const systemPrompt = `你是留学文书专家。根据题目和背景,生成3个不同风格的文书开头。

好的开头应该:
1. 立即抓住读者注意力
2. 不要用"我"开头
3. 可以用场景、对话、问题、或有力的陈述开始
4. 50-100词

返回JSON格式:
{
  "openings": [
    { "text": "开头1", "style": "风格(如:场景描写)" },
    { "text": "开头2", "style": "风格" },
    { "text": "开头3", "style": "风格" }
  ]
}`;

    const userPrompt = `题目: ${prompt}
${background ? `背景信息: ${background}` : ''}

请生成3个吸引人的开头:`;

    try {
      const result = await this.chat(
        [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        { temperature: 0.8, maxTokens: 1500 },
      );

      const jsonMatch = result.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }

      return { openings: [{ text: result, style: '默认' }] };
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
  ): Promise<{
    endings: Array<{ text: string; style: string }>;
  }> {
    const systemPrompt = `你是留学文书专家。根据文书内容,生成3个不同风格的结尾。

好的结尾应该:
1. 呼应开头或主题
2. 展望未来或表达决心
3. 给读者留下深刻印象
4. 50-100词

返回JSON格式:
{
  "endings": [
    { "text": "结尾1", "style": "风格(如:展望未来)" },
    { "text": "结尾2", "style": "风格" },
    { "text": "结尾3", "style": "风格" }
  ]
}`;

    try {
      const result = await this.chat(
        [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: `${prompt ? `题目: ${prompt}\n\n` : ''}文书内容:\n${content}\n\n请生成3个有力的结尾:`,
          },
        ],
        { temperature: 0.8, maxTokens: 1500 },
      );

      const jsonMatch = result.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }

      return { endings: [{ text: result, style: '默认' }] };
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
  ): Promise<SchoolRecommendationResponse> {
    const systemPrompt = `你是资深美本选校顾问。根据学生档案和可选学校列表,将学校分为三类推荐。

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
    { "schoolId": "id", "probability": 10-40, "reason": "简短推荐理由", "highlights": ["匹配点1"] }
  ],
  "target": [
    { "schoolId": "id", "probability": 40-70, "reason": "...", "highlights": [] }
  ],
  "safety": [
    { "schoolId": "id", "probability": 70-95, "reason": "...", "highlights": [] }
  ],
  "summary": "整体选校策略建议(50字)"
}

要求:
- reach: 3-5所冲刺校
- target: 4-6所匹配校
- safety: 2-4所保底校
- 每类按推荐度排序
- probability 为估计录取概率(%)`;

    const schoolsInfo = availableSchools
      .slice(0, 50)
      .map(
        (s) =>
          `- ${s.name}${s.nameZh ? `(${s.nameZh})` : ''} | Rank: ${s.usNewsRank || 'N/A'} | AccRate: ${s.acceptanceRate ? `${s.acceptanceRate}%` : 'N/A'} | SAT: ${s.satRange || 'N/A'} | ID: ${s.id}`,
      )
      .join('\n');

    const userPrompt = `【学生档案】
GPA: ${profile.gpa ? `${profile.gpa}/${profile.gpaScale || 4.0}` : '未提供'}
标化: ${profile.testScores?.map((s) => `${s.type}: ${s.score}`).join(', ') || '未提供'}
活动: ${profile.activities?.length || 0}项 ${
      profile.activities
        ?.slice(0, 3)
        .map((a) => a.name)
        .join(', ') || ''
    }
奖项: ${profile.awards?.length || 0}项 ${
      profile.awards
        ?.slice(0, 3)
        .map((a) => `${a.name}(${a.level})`)
        .join(', ') || ''
    }
目标专业: ${profile.targetMajor || '未确定'}

【可选学校】
${schoolsInfo}

请根据学生背景推荐合适的学校:`;

    try {
      const result = await this.chat(
        [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        { temperature: 0.4, maxTokens: 2500 },
      );

      const jsonMatch = result.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return this.validateSchoolRecommendation(parsed, availableSchools);
      }

      return this.getDefaultSchoolRecommendation();
    } catch (error) {
      this.logger.error('School recommendation failed', error);
      return this.getDefaultSchoolRecommendation();
    }
  }

  private validateSchoolRecommendation(
    data: any,
    schools: Array<{ id: string; name: string }>,
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
      summary: data.summary || '请完善档案信息以获取更精准的选校建议。',
    };
  }

  private getDefaultSchoolRecommendation(): SchoolRecommendationResponse {
    return {
      reach: [],
      target: [],
      safety: [],
      summary: '档案信息不完整,请补充GPA和标化成绩后重新获取选校建议。',
    };
  }

  /**
   * P1: 文书逐段点评 - 类似Clastify风格
   */
  async analyzeEssayParagraphs(
    content: string,
    prompt?: string,
    schoolName?: string,
  ): Promise<EssayParagraphAnalysisResponse> {
    // 分段处理
    const paragraphs = content
      .split(/\n\n+/)
      .map((p) => p.trim())
      .filter((p) => p.length > 20); // 过滤太短的段落

    if (paragraphs.length === 0) {
      return this.getDefaultParagraphAnalysis();
    }

    const systemPrompt = `你是顶尖大学招生官，请逐段分析以下文书。

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
      "comment": "这段开头非常吸引人，用具体场景带入...",
      "highlights": ["亮点词句1", "亮点词句2"],
      "suggestions": ["可以考虑..."]
    }
  ],
  "overallScore": 75,
  "structure": {
    "hasStrongOpening": true,
    "hasClarity": true,
    "hasGoodConclusion": false,
    "feedback": "开头很棒，但结尾略显仓促，建议..."
  },
  "summary": "整体评价（100字内）"
}`;

    const userPrompt = paragraphs
      .map((p, i) => `【段落 ${i + 1}】\n${p}`)
      .join('\n\n');

    try {
      const result = await this.chat(
        [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `请逐段分析以下文书:\n\n${userPrompt}` },
        ],
        { temperature: 0.4, maxTokens: 3000 },
      );

      const jsonMatch = result.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return this.validateParagraphAnalysis(parsed, paragraphs);
      }

      return this.getDefaultParagraphAnalysis();
    } catch (error) {
      this.logger.error('Paragraph analysis failed', error);
      return this.getDefaultParagraphAnalysis();
    }
  }

  private validateParagraphAnalysis(
    data: any,
    originalParagraphs: string[],
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
        comment: p?.comment || '暂无评价',
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
          data.structure?.feedback || '请完善文书以获取更详细的结构分析。',
      },
      summary: data.summary || '文书分析完成，请查看各段落点评。',
    };
  }

  private getDefaultParagraphAnalysis(): EssayParagraphAnalysisResponse {
    return {
      paragraphs: [],
      overallScore: 0,
      structure: {
        hasStrongOpening: false,
        hasClarity: false,
        hasGoodConclusion: false,
        feedback: '文书内容不足，请提供更多内容以进行分析。',
      },
      summary: '文书内容过短或为空，无法分析。',
    };
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
