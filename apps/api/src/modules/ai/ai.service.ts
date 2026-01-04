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
    this.baseUrl = this.configService.get<string>('OPENAI_BASE_URL') || 'https://api.openai.com/v1';
    this.model = this.configService.get<string>('OPENAI_MODEL') || 'gpt-4o-mini';
  }

  private isConfigured(): boolean {
    return !!this.apiKey;
  }

  async chat(messages: ChatMessage[], options?: { temperature?: number; maxTokens?: number }): Promise<string> {
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

  async analyzeProfile(request: ProfileAnalysisRequest): Promise<ProfileAnalysisResponse> {
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
        { temperature: 0.5 }
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
        { temperature: 0.5 }
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

  async generateEssayIdeas(topic: string, background?: string): Promise<string[]> {
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
        { temperature: 0.8 }
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

  async schoolMatch(profile: ProfileAnalysisRequest): Promise<Array<{ name: string; fit: string; reason: string }>> {
    if (!profile.gpa && !profile.testScores?.length) {
      throw new BadRequestException('Please provide GPA or test scores for school matching');
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
        { temperature: 0.5 }
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
  async polishEssay(content: string, style?: 'formal' | 'vivid' | 'concise'): Promise<{
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
        { temperature: 0.4, maxTokens: 3000 }
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
  async rewriteParagraph(paragraph: string, instruction?: string): Promise<{
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
        { temperature: 0.8, maxTokens: 2000 }
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
    direction?: string
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
        { temperature: 0.7, maxTokens: 1500 }
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
  async generateOpening(prompt: string, background?: string): Promise<{
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
        { temperature: 0.8, maxTokens: 1500 }
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
  async generateEnding(content: string, prompt?: string): Promise<{
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
          { role: 'user', content: `${prompt ? `题目: ${prompt}\n\n` : ''}文书内容:\n${content}\n\n请生成3个有力的结尾:` },
        ],
        { temperature: 0.8, maxTokens: 1500 }
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
}

