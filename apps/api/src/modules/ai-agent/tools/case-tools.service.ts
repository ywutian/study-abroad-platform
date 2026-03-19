/**
 * Case & Game Tools Service
 *
 * Tools: SEARCH_CASES, EXPLAIN_CASE_RESULT, ANALYZE_PREDICTION_ACCURACY,
 *        COMPARE_CASE_WITH_PROFILE
 */

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { clampPercentRate } from '../../../common/utils/percent.util';
import { LLMService } from '../core/llm.service';
import { SwipeService } from '../../hall/swipe.service';
import { ProfileLoaderHelper } from './helpers/profile-loader.helper';
import { SchoolLookupHelper } from './helpers/school-lookup.helper';
import { formatHighSchoolContext } from './helpers/education-context.helper';
import { ToolHandler, IToolHandlerProvider } from './tool-handler.interface';

@Injectable()
export class CaseToolsService implements IToolHandlerProvider {
  private readonly logger = new Logger(CaseToolsService.name);

  constructor(
    private prisma: PrismaService,
    private llmService: LLMService,
    private swipeService: SwipeService,
    private profileLoader: ProfileLoaderHelper,
    private schoolLookup: SchoolLookupHelper,
  ) {}

  getHandlers(): Map<string, ToolHandler> {
    return new Map<string, ToolHandler>([
      [
        'search_cases',
        (args, _userId, _ctx, locale) => this.searchCases(args, locale),
      ],
      [
        'explain_case_result',
        (args, _userId, _ctx, locale) =>
          this.explainCaseResult(args.caseId, locale),
      ],
      [
        'analyze_prediction_accuracy',
        (_args, userId, _ctx, locale) =>
          this.analyzePredictionAccuracy(userId, locale),
      ],
      [
        'compare_case_with_profile',
        (args, userId, _ctx, locale) =>
          this.compareCaseWithProfile(userId, args.caseId, locale),
      ],
    ]);
  }

  async searchCases(
    args: {
      schoolName?: string;
      major?: string;
      year?: number;
      gpaRange?: string;
    },
    locale = 'zh',
  ) {
    const where: any = {};

    if (args.schoolName) {
      const searchTerm = args.schoolName.trim();
      where.school = {
        OR: [
          { name: { contains: searchTerm, mode: 'insensitive' } },
          { nameZh: { contains: searchTerm, mode: 'insensitive' } },
          { aliases: { has: searchTerm } },
          {
            aliases: {
              hasSome: [
                searchTerm,
                searchTerm.toUpperCase(),
                searchTerm.toLowerCase(),
              ],
            },
          },
        ],
      };
    }

    if (args.major) {
      where.major = { contains: args.major, mode: 'insensitive' };
    }

    if (args.year) {
      where.year = args.year;
    }

    if (args.gpaRange) {
      where.gpaRange = args.gpaRange;
    }

    where.visibility = { in: ['ANONYMOUS', 'PUBLIC'] };

    const cases = await this.prisma.admissionCase.findMany({
      where,
      take: 10,
      orderBy: { createdAt: 'desc' },
      include: { school: { select: { name: true, nameZh: true } } },
    });

    if (!cases.length) {
      return {
        message:
          locale === 'zh' ? '未找到匹配的案例' : 'No matching cases found',
      };
    }

    return {
      count: cases.length,
      cases: cases.map((c) => ({
        school: this.schoolLookup.displayName(c.school, locale),
        year: c.year,
        round: c.round,
        result: c.result,
        gpaRange: c.gpaRange,
        satRange: c.satRange,
        tags: c.tags,
      })),
    };
  }

  async explainCaseResult(caseId: string, locale = 'zh') {
    const isZh = locale === 'zh';
    try {
      const admissionCase = await this.prisma.admissionCase.findUnique({
        where: { id: caseId },
        include: { school: true },
      });

      if (!admissionCase) {
        return { error: isZh ? '未找到该案例' : 'Case not found' };
      }

      const resultLabel = isZh
        ? admissionCase.result === 'ADMITTED'
          ? '录取'
          : admissionCase.result === 'REJECTED'
            ? '拒绝'
            : '放入候补名单'
        : admissionCase.result === 'ADMITTED'
          ? 'admitted'
          : admissionCase.result === 'REJECTED'
            ? 'rejected'
            : 'waitlisted';

      const systemPrompt = isZh
        ? `你是资深招生官和留学顾问。请分析这个录取案例，解释为什么申请者被${resultLabel}。

分析要点：
1. 学术背景评估（GPA、标化成绩）
2. 软实力分析（活动、奖项的暗示）
3. 学校匹配度
4. 可能的录取/拒绝因素
5. 对类似背景学生的建议

请用中文回答，分析要客观专业。`
        : `You are a senior admissions officer and consultant. Analyze this admission case and explain why the applicant was ${resultLabel}.

Key points:
1. Academic background assessment (GPA, test scores)
2. Extracurricular analysis (activities, awards implications)
3. School fit
4. Likely admission/rejection factors
5. Advice for students with similar backgrounds

Provide an objective and professional analysis.`;

      const schoolName = this.schoolLookup.displayName(
        admissionCase.school,
        locale,
      );
      const unknown = isZh ? '未知' : 'Unknown';
      const none = isZh ? '无' : 'None';
      const caseInfo = isZh
        ? `
学校：${schoolName} (排名 #${admissionCase.school.usNewsRank || 'N/A'})
申请年份：${admissionCase.year}
申请轮次：${admissionCase.round || unknown}
专业：${admissionCase.major || unknown}
GPA范围：${admissionCase.gpaRange || unknown}
SAT范围：${admissionCase.satRange || unknown}
ACT范围：${admissionCase.actRange || unknown}
托福范围：${admissionCase.toeflRange || unknown}
标签：${admissionCase.tags?.join('、') || none}
结果：${admissionCase.result}
录取率：${clampPercentRate(admissionCase.school.acceptanceRate) != null ? clampPercentRate(admissionCase.school.acceptanceRate) + '%' : unknown}`
        : `
School: ${schoolName} (Rank #${admissionCase.school.usNewsRank || 'N/A'})
Application year: ${admissionCase.year}
Round: ${admissionCase.round || unknown}
Major: ${admissionCase.major || unknown}
GPA range: ${admissionCase.gpaRange || unknown}
SAT range: ${admissionCase.satRange || unknown}
ACT range: ${admissionCase.actRange || unknown}
TOEFL range: ${admissionCase.toeflRange || unknown}
Tags: ${admissionCase.tags?.join(', ') || none}
Result: ${admissionCase.result}
Acceptance rate: ${clampPercentRate(admissionCase.school.acceptanceRate) != null ? clampPercentRate(admissionCase.school.acceptanceRate) + '%' : unknown}`;

      const analysis = await this.llmService.chatSimple(
        [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: caseInfo },
        ],
        { temperature: 0.5 },
      );

      return {
        caseId,
        school: schoolName,
        result: admissionCase.result,
        analysis,
      };
    } catch (error) {
      this.logger.error('Failed to explain case result', error);
      return { error: isZh ? '分析案例失败' : 'Failed to analyze case' };
    }
  }

  async analyzePredictionAccuracy(userId: string, locale = 'zh') {
    const isZh = locale === 'zh';
    try {
      const stats = await this.swipeService.getStats(userId);

      const systemPrompt = isZh
        ? `你是数据分析师。根据用户的案例预测游戏统计数据，分析其预测能力和改进建议。`
        : `You are a data analyst. Analyze the user's prediction game statistics and provide insights and improvement suggestions.`;

      const analysis = await this.llmService.chatSimple(
        [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: isZh
              ? `
用户预测统计：
- 总预测次数：${stats.totalSwipes}
- 正确次数：${stats.correctCount}
- 准确率：${stats.accuracy}%
- 当前连胜：${stats.currentStreak}
- 最佳连胜：${stats.bestStreak}
- 等级：${stats.badge}

请分析用户的预测能力特点，并给出提高准确率的建议。`
              : `
User prediction statistics:
- Total predictions: ${stats.totalSwipes}
- Correct: ${stats.correctCount}
- Accuracy: ${stats.accuracy}%
- Current streak: ${stats.currentStreak}
- Best streak: ${stats.bestStreak}
- Badge: ${stats.badge}

Analyze the user's prediction strengths and provide tips to improve accuracy.`,
          },
        ],
        { temperature: 0.5 },
      );

      return {
        stats: {
          totalSwipes: stats.totalSwipes,
          accuracy: stats.accuracy,
          bestStreak: stats.bestStreak,
          badge: stats.badge,
        },
        analysis,
      };
    } catch (error) {
      this.logger.error('Failed to analyze prediction accuracy', error);
      return {
        error: isZh
          ? '分析预测准确度失败'
          : 'Failed to analyze prediction accuracy',
      };
    }
  }

  async compareCaseWithProfile(userId: string, caseId: string, locale = 'zh') {
    const isZh = locale === 'zh';
    try {
      const [admissionCase, profile] = await Promise.all([
        this.prisma.admissionCase.findUnique({
          where: { id: caseId },
          include: { school: true },
        }),
        this.profileLoader.loadProfile(userId, locale),
      ]);

      if (!admissionCase) {
        return { error: isZh ? '未找到该案例' : 'Case not found' };
      }

      if (!profile) {
        return {
          error: isZh
            ? '请先完善您的档案信息'
            : 'Please complete your profile first',
        };
      }

      const schoolName = this.schoolLookup.displayName(
        admissionCase.school,
        locale,
      );
      const unknown = isZh ? '未知' : 'Unknown';
      const none = isZh ? '无' : 'None';
      const notFilled = isZh ? '未填' : 'Not provided';
      const undecided = isZh ? '未定' : 'Undecided';

      const systemPrompt = isZh
        ? `你是留学顾问。请对比分析申请者档案与录取案例，找出差距和优势。

分析要点：
1. 学术成绩对比
2. 软实力对比（活动、奖项）
3. 相似点和差异点
4. 具体改进建议
5. 录取可能性评估

请用中文回答，给出具体可操作的建议。`
        : `You are an admissions consultant. Compare the applicant's profile with the admission case to identify gaps and strengths.

Key points:
1. Academic comparison
2. Extracurricular comparison (activities, awards)
3. Similarities and differences
4. Specific improvement suggestions
5. Admission likelihood assessment

Provide specific, actionable advice.`;

      const comparison = await this.llmService.chatSimple(
        [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: (() => {
              const hsCtx = formatHighSchoolContext(
                profile.education,
                profile.highSchool,
                locale,
              );
              const hsLine = hsCtx ? `\n- ${hsCtx}` : '';
              return isZh
                ? `
录取案例：
- 学校：${schoolName}
- 结果：${admissionCase.result}
- GPA范围：${admissionCase.gpaRange || unknown}
- SAT范围：${admissionCase.satRange || unknown}
- 标签：${admissionCase.tags?.join('、') || none}

您的档案：
- GPA：${profile.gpa || notFilled}/${profile.gpaScale || 4.0}${hsLine}
- 标化：${profile.testScores?.map((s: any) => `${s.type}: ${s.score}`).join(', ') || notFilled}
- 活动(${profile.activities?.length || 0}项):
${
  profile.activities
    ?.slice(0, 5)
    .map((a: any) => {
      let line = `  · ${a.name}(${a.role})`;
      if (a.description) line += `: ${(a.description as string).slice(0, 60)}`;
      return line;
    })
    .join('\n') || none
}
- 奖项(${profile.awards?.length || 0}项):
${
  profile.awards
    ?.slice(0, 5)
    .map((a: any) => {
      let line = `  · ${a.name}(${a.level})`;
      if (a.competition?.name) line += ` — ${a.competition.name}`;
      return line;
    })
    .join('\n') || none
}
- 目标专业：${profile.targetMajor || undecided}`
                : `
Admission case:
- School: ${schoolName}
- Result: ${admissionCase.result}
- GPA range: ${admissionCase.gpaRange || unknown}
- SAT range: ${admissionCase.satRange || unknown}
- Tags: ${admissionCase.tags?.join(', ') || none}

Your profile:
- GPA: ${profile.gpa || notFilled}/${profile.gpaScale || 4.0}${hsLine}
- Test scores: ${profile.testScores?.map((s: any) => `${s.type}: ${s.score}`).join(', ') || notFilled}
- Activities (${profile.activities?.length || 0}):
${
  profile.activities
    ?.slice(0, 5)
    .map((a: any) => {
      let line = `  · ${a.name} (${a.role})`;
      if (a.description) line += `: ${(a.description as string).slice(0, 60)}`;
      return line;
    })
    .join('\n') || none
}
- Awards (${profile.awards?.length || 0}):
${
  profile.awards
    ?.slice(0, 5)
    .map((a: any) => {
      let line = `  · ${a.name} (${a.level})`;
      if (a.competition?.name) line += ` — ${a.competition.name}`;
      return line;
    })
    .join('\n') || none
}
- Target major: ${profile.targetMajor || undecided}`;
            })(),
          },
        ],
        { temperature: 0.5 },
      );

      return {
        caseSchool: schoolName,
        caseResult: admissionCase.result,
        comparison,
      };
    } catch (error) {
      this.logger.error('Failed to compare case with profile', error);
      return { error: isZh ? '对比分析失败' : 'Failed to compare profiles' };
    }
  }
}
