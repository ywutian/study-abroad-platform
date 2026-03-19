/**
 * Assessment Tools Service
 *
 * Tools: GET_ASSESSMENT_RESULTS, INTERPRET_ASSESSMENT, SUGGEST_ACTIVITIES_FROM_ASSESSMENT
 */

import { Injectable, Logger } from '@nestjs/common';
import { LLMService } from '../core/llm.service';
import { AssessmentService } from '../../assessment/assessment.service';
import { extractJsonFromLlm } from './helpers/llm-json.helper';
import { ToolHandler, IToolHandlerProvider } from './tool-handler.interface';

@Injectable()
export class AssessmentToolsService implements IToolHandlerProvider {
  private readonly logger = new Logger(AssessmentToolsService.name);

  constructor(
    private llmService: LLMService,
    private assessmentService: AssessmentService,
  ) {}

  getHandlers(): Map<string, ToolHandler> {
    return new Map([
      [
        'get_assessment_results',
        (args, userId, _ctx, locale) =>
          this.getAssessmentResults(userId, args.type, locale),
      ],
      [
        'interpret_assessment',
        (args, userId, _ctx, locale) =>
          this.interpretAssessment(userId, args.resultId, locale),
      ],
      [
        'suggest_activities_from_assessment',
        (args, userId, _ctx, locale) =>
          this.suggestActivitiesFromAssessment(
            userId,
            args.resultId,
            args.targetMajor,
            locale,
          ),
      ],
    ]);
  }

  async getAssessmentResults(
    userId: string,
    type?: 'mbti' | 'holland',
    locale = 'zh',
  ) {
    const isZh = locale === 'zh';
    try {
      const history = await this.assessmentService.getHistory(userId);

      if (!history.length) {
        return {
          message: isZh
            ? '暂无测评记录，建议先完成 MBTI 或霍兰德测评'
            : 'No assessment records. Consider taking the MBTI or Holland assessment.',
        };
      }

      const filteredResults = type
        ? history.filter((r) => r.type.toLowerCase() === type.toLowerCase())
        : history;

      if (!filteredResults.length) {
        return {
          message: isZh
            ? `暂无${type?.toUpperCase()}测评记录`
            : `No ${type?.toUpperCase()} assessment records`,
        };
      }

      return {
        count: filteredResults.length,
        results: filteredResults.map((r) => ({
          id: r.id,
          type: r.type,
          completedAt: r.completedAt,
          mbtiResult: r.mbtiResult
            ? {
                type: r.mbtiResult.type,
                title: r.mbtiResult.titleZh || r.mbtiResult.title,
                description:
                  r.mbtiResult.descriptionZh || r.mbtiResult.description,
                strengths: r.mbtiResult.strengths,
                careers: r.mbtiResult.careers,
                majors: r.mbtiResult.majors,
              }
            : undefined,
          hollandResult: r.hollandResult
            ? {
                codes: r.hollandResult.codes,
                types: r.hollandResult.typesZh || r.hollandResult.types,
                fields: r.hollandResult.fieldsZh || r.hollandResult.fields,
                majors: r.hollandResult.majors,
              }
            : undefined,
        })),
      };
    } catch (error) {
      this.logger.error('Failed to get assessment results', error);
      return {
        error: isZh
          ? '获取测评结果失败'
          : 'Failed to retrieve assessment results',
      };
    }
  }

  async interpretAssessment(userId: string, resultId: string, locale = 'zh') {
    const isZh = locale === 'zh';
    try {
      const result = await this.assessmentService.getResult(userId, resultId);

      if (!result) {
        return {
          error: isZh ? '未找到该测评结果' : 'Assessment result not found',
        };
      }

      const systemPrompt = isZh
        ? `你是专业的职业规划顾问和心理咨询师。请根据以下测评结果，提供深度解读和个性化建议。

解读应包括：
1. 性格/兴趣特点分析
2. 适合的学习方式和环境
3. 专业选择建议（考虑留学申请）
4. 职业发展方向
5. 需要注意的潜在挑战

请用中文回复，语气专业但友好。`
        : `You are a professional career planning consultant and counselor. Provide an in-depth interpretation and personalized advice based on the assessment results.

Include:
1. Personality/interest trait analysis
2. Suitable learning styles and environments
3. Major selection advice (considering college applications)
4. Career development directions
5. Potential challenges to be aware of

Please respond in English with a professional yet friendly tone.`;

      const userContent = result.mbtiResult
        ? isZh
          ? `MBTI测评结果：
类型：${result.mbtiResult.type}
描述：${result.mbtiResult.descriptionZh || result.mbtiResult.description}
优势：${result.mbtiResult.strengths?.join('、')}
推荐职业：${result.mbtiResult.careers?.join('、')}
推荐专业：${result.mbtiResult.majors?.join('、')}`
          : `MBTI Assessment Result:
Type: ${result.mbtiResult.type}
Description: ${result.mbtiResult.description}
Strengths: ${result.mbtiResult.strengths?.join(', ')}
Recommended careers: ${result.mbtiResult.careers?.join(', ')}
Recommended majors: ${result.mbtiResult.majors?.join(', ')}`
        : isZh
          ? `霍兰德测评结果：
代码：${result.hollandResult?.codes}
类型：${result.hollandResult?.typesZh?.join('、') || result.hollandResult?.types?.join('、')}
适合领域：${result.hollandResult?.fieldsZh?.join('、') || result.hollandResult?.fields?.join('、')}
推荐专业：${result.hollandResult?.majors?.join('、')}`
          : `Holland Assessment Result:
Code: ${result.hollandResult?.codes}
Types: ${result.hollandResult?.types?.join(', ')}
Suitable fields: ${result.hollandResult?.fields?.join(', ')}
Recommended majors: ${result.hollandResult?.majors?.join(', ')}`;

      const interpretation = await this.llmService.chatSimple(
        [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userContent },
        ],
        { temperature: 0.7 },
      );

      return {
        resultId,
        type: result.type,
        originalResult: result.mbtiResult || result.hollandResult,
        interpretation,
      };
    } catch (error) {
      this.logger.error('Failed to interpret assessment', error);
      return {
        error: isZh
          ? '解读测评结果失败'
          : 'Failed to interpret assessment result',
      };
    }
  }

  async suggestActivitiesFromAssessment(
    userId: string,
    resultId: string,
    targetMajor?: string,
    locale = 'zh',
  ) {
    const isZh = locale === 'zh';
    try {
      const result = await this.assessmentService.getResult(userId, resultId);

      if (!result) {
        return {
          error: isZh ? '未找到该测评结果' : 'Assessment result not found',
        };
      }

      const systemPrompt = isZh
        ? `你是留学申请顾问，擅长活动规划。根据学生的性格测评结果，推荐适合的课外活动、竞赛和项目。

推荐要求：
1. 活动要与学生性格/兴趣匹配
2. 要有助于留学申请（展示领导力、创造力、社会影响等）
3. 区分难度级别（入门级、进阶级、竞争级）
4. 说明每个活动的价值和申请中的作用

返回JSON格式:
{
  "activities": [
    {
      "name": "活动名称",
      "category": "学术/志愿/艺术/体育/领导力",
      "difficulty": "入门/进阶/竞争",
      "description": "活动描述",
      "benefit": "对申请的帮助",
      "timeCommitment": "预计时间投入"
    }
  ],
  "competitions": [
    {
      "name": "竞赛名称",
      "level": "校级/省级/国家级/国际级",
      "relevance": "与专业/兴趣的相关性"
    }
  ],
  "tips": ["活动规划建议"]
}`
        : `You are a college admissions consultant specializing in activity planning. Recommend extracurricular activities, competitions, and projects based on the student's personality assessment results.

Requirements:
1. Activities should match the student's personality/interests
2. Should benefit college applications (demonstrate leadership, creativity, social impact)
3. Categorize by difficulty level (beginner, intermediate, competitive)
4. Explain the value and role of each activity in applications

Return in JSON format:
{
  "activities": [
    {
      "name": "Activity name",
      "category": "Academic/Volunteer/Arts/Sports/Leadership",
      "difficulty": "Beginner/Intermediate/Competitive",
      "description": "Activity description",
      "benefit": "How it helps applications",
      "timeCommitment": "Expected time commitment"
    }
  ],
  "competitions": [
    {
      "name": "Competition name",
      "level": "School/State/National/International",
      "relevance": "Relevance to major/interests"
    }
  ],
  "tips": ["Activity planning advice"]
}`;

      const userContent = isZh
        ? `测评结果：${JSON.stringify(result.mbtiResult || result.hollandResult)}
${targetMajor ? `目标专业：${targetMajor}` : ''}

请推荐适合这位学生的活动和竞赛。`
        : `Assessment results: ${JSON.stringify(result.mbtiResult || result.hollandResult)}
${targetMajor ? `Target major: ${targetMajor}` : ''}

Please recommend suitable activities and competitions for this student.`;

      const response = await this.llmService.chatSimple(
        [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userContent },
        ],
        { temperature: 0.7 },
      );

      return extractJsonFromLlm(response, 'suggestions');
    } catch (error) {
      this.logger.error('Failed to suggest activities', error);
      return { error: isZh ? '推荐活动失败' : 'Failed to suggest activities' };
    }
  }
}
