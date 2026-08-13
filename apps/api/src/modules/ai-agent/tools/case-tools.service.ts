/**
 * Case & Game Tools Service
 *
 * Tools: SEARCH_CASES, FIND_SIMILAR_CASES, EXPLAIN_CASE_RESULT,
 *        ANALYZE_PREDICTION_ACCURACY, COMPARE_CASE_WITH_PROFILE
 */

import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { clampPercentRate } from '../../../common/utils/percent.util';
import {
  CASE_REVIEW_APPROVED_WHERE,
  caseVisibilityWhereForRole,
} from '../../../common/constants/prisma-selects';
import { getCurrentUserRole } from '../infrastructure/context/request-context';
import {
  parseCaseActivities,
  parseCaseAwards,
  parseCaseTestScores,
} from '../../../common/constants/data-formats';
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
          this.explainCaseResult(args.caseId ?? '', locale),
      ],
      [
        'analyze_prediction_accuracy',
        (_args, userId, _ctx, locale) =>
          this.analyzePredictionAccuracy(userId, locale),
      ],
      [
        'compare_case_with_profile',
        (args, userId, _ctx, locale) =>
          this.compareCaseWithProfile(userId, args.caseId ?? '', locale),
      ],
      [
        'find_similar_cases',
        (args, userId, _ctx, locale) =>
          this.findSimilarCases(userId, args, locale),
      ],
      [
        'analyze_intl_competitiveness',
        (args, _userId, _ctx, locale) =>
          this.analyzeIntlCompetitiveness(
            args as { schoolId: string; nationality: string },
            locale,
          ),
      ],
    ]);
  }

  async searchCases(
    args: {
      schoolName?: string;
      major?: string;
      year?: number;
      gpaRange?: string;
      nationality?: string;
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

    if (args.nationality) {
      where.nationality = { equals: args.nationality, mode: 'insensitive' };
    }

    Object.assign(where, caseVisibilityWhereForRole(getCurrentUserRole()));

    // governance: public-feed — the pin assigned above is the whole access control here, and grants this caller exactly what GET /cases would
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
        id: c.id,
        school: this.schoolLookup.displayName(c.school, locale),
        year: c.year,
        round: c.round,
        result: c.result,
        gpaRange: c.gpaRange,
        satRange: c.satRange,
        tags: c.tags,
        activitySummary: parseCaseActivities(c.activities).map((a) => ({
          category: a.category,
          description: a.description,
          role: a.role,
          tier: a.tier,
        })),
        awardSummary: parseCaseAwards(c.awards).map((a) => ({
          name: a.name,
          level: a.level,
          tier: a.tier,
        })),
        testScoreSummary: parseCaseTestScores(c.testScores).map((t) => ({
          type: t.type,
          score: t.score,
        })),
        highSchoolType: c.highSchoolType,
        curriculumType: c.curriculumType,
        demographicTags: c.demographicTags,
        nationality: c.nationality,
      })),
    };
  }

  async explainCaseResult(caseId: string, locale = 'zh') {
    const isZh = locale === 'zh';
    try {
      // governance: public-feed — CASE_PUBLIC_VISIBILITY_WHERE; caseId is an LLM arg, so review status alone was not access control (see backend.md)
      const admissionCase = await this.prisma.admissionCase.findFirst({
        where: {
          id: caseId,
          ...caseVisibilityWhereForRole(getCurrentUserRole()),
        },
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
学校：${schoolName} (US News legacy #${admissionCase.school.usNewsRank || 'N/A'})
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
School: ${schoolName} (US News legacy #${admissionCase.school.usNewsRank || 'N/A'})
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
        ? `你是数据分析师。根据用户的录取案例判断校准统计，分析其判断能力和改进建议。`
        : `You are a data analyst. Analyze the user's admission-case calibration statistics and provide insights and improvement suggestions.`;

      const analysis = await this.llmService.chatSimple(
        [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: isZh
              ? `
用户判断校准统计：
- 总判断次数：${stats.totalSwipes}
- 正确次数：${stats.correctCount}
- 准确率：${stats.accuracy}%

请分析用户的判断能力特点，并给出提高准确率的建议。`
              : `
User calibration statistics:
- Total judgements: ${stats.totalSwipes}
- Correct: ${stats.correctCount}
- Accuracy: ${stats.accuracy}%

Analyze the user's judgement strengths and provide tips to improve accuracy.`,
          },
        ],
        { temperature: 0.5 },
      );

      return {
        stats: {
          totalSwipes: stats.totalSwipes,
          correctCount: stats.correctCount,
          accuracy: stats.accuracy,
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
        // governance: public-feed — same role-scoped pin as explainCaseResult
        this.prisma.admissionCase.findFirst({
          where: {
            id: caseId,
            ...caseVisibilityWhereForRole(getCurrentUserRole()),
          },
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

      // Parse structured case data for dimension-by-dimension comparison
      const caseActivities = parseCaseActivities(admissionCase.activities);
      const caseAwards = parseCaseAwards(admissionCase.awards);
      const caseTestScores = parseCaseTestScores(admissionCase.testScores);

      const systemPrompt = isZh
        ? `你是留学顾问。请对比分析申请者档案与录取案例，按以下维度逐项对比并给出差距评估：

维度对比：
1. **学术成绩**：GPA、标化考试分数逐项对比
2. **课外活动**：活动数量、质量等级(tier)、角色级别对比
3. **学术竞赛与奖项**：奖项级别(校级/地区/州级/国家/国际)对比
4. **背景特征**：高中类型、课程体系、国籍/身份、人口统计标签对比
5. **综合评估**：整体竞争力差距和录取可能性

每个维度请给出：案例数据 → 用户数据 → 差距评估（领先/持平/落后）

请用中文回答，给出具体可操作的建议。`
        : `You are an admissions consultant. Compare the applicant's profile with the admission case dimension by dimension:

Dimensions:
1. **Academics**: GPA and test scores item-by-item comparison
2. **Extracurriculars**: Activity count, quality tier, role level comparison
3. **Awards & Competitions**: Award level (school/regional/state/national/international) comparison
4. **Background**: High school type, curriculum, nationality/identity, demographic tags comparison
5. **Overall Assessment**: Competitiveness gap and admission likelihood

For each dimension provide: Case data → User data → Gap assessment (ahead/even/behind)

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
              const caseActivitiesZh = caseActivities.length
                ? caseActivities
                    .slice(0, 5)
                    .map(
                      (a) =>
                        `  · ${a.description}${a.role ? `(${a.role})` : ''}${a.tier ? ` [Tier ${a.tier}]` : ''}`,
                    )
                    .join('\n')
                : none;
              const caseActivitiesEn = caseActivitiesZh; // Same format works for both
              const caseAwardsZh = caseAwards.length
                ? caseAwards
                    .slice(0, 5)
                    .map(
                      (a) =>
                        `  · ${a.name}(${a.level})${a.tier ? ` [Tier ${a.tier}]` : ''}`,
                    )
                    .join('\n')
                : none;
              const caseAwardsEn = caseAwardsZh;
              const caseScoresStr = caseTestScores.length
                ? caseTestScores.map((t) => `${t.type}: ${t.score}`).join(', ')
                : unknown;

              return isZh
                ? `
录取案例：
- 学校：${schoolName}
- 结果：${admissionCase.result}
- GPA范围：${admissionCase.gpaRange || unknown}
- SAT范围：${admissionCase.satRange || unknown}
- 结构化成绩：${caseScoresStr}
- 高中类型：${admissionCase.highSchoolType || unknown}
- 课程体系：${admissionCase.curriculumType || unknown}
- 国籍：${admissionCase.nationality || unknown}
- 人口标签：${admissionCase.demographicTags?.join('、') || none}
- 活动(${caseActivities.length}项):
${caseActivitiesZh}
- 奖项(${caseAwards.length}项):
${caseAwardsZh}
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
- 国籍：${profile.nationality || notFilled}
- 目标专业：${profile.targetMajor || undecided}`
                : `
Admission case:
- School: ${schoolName}
- Result: ${admissionCase.result}
- GPA range: ${admissionCase.gpaRange || unknown}
- SAT range: ${admissionCase.satRange || unknown}
- Structured scores: ${caseScoresStr}
- High school type: ${admissionCase.highSchoolType || unknown}
- Curriculum: ${admissionCase.curriculumType || unknown}
- Nationality: ${admissionCase.nationality || unknown}
- Demographic tags: ${admissionCase.demographicTags?.join(', ') || none}
- Activities (${caseActivities.length}):
${caseActivitiesEn}
- Awards (${caseAwards.length}):
${caseAwardsEn}
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
- Nationality: ${profile.nationality || notFilled}
- Target major: ${profile.targetMajor || undecided}`;
            })(),
          },
        ],
        { temperature: 0.5 },
      );

      return {
        caseSchool: schoolName,
        caseResult: admissionCase.result,
        dimensions: {
          caseGpaRange: admissionCase.gpaRange,
          caseSatRange: admissionCase.satRange,
          caseTestScores: caseTestScores.map((t) => ({
            type: t.type,
            score: t.score,
          })),
          caseActivityCount: caseActivities.length,
          caseTopActivityTier: caseActivities.reduce(
            (best, a) => Math.min(best, a.tier ?? 4),
            4,
          ),
          caseAwardCount: caseAwards.length,
          caseBestAwardLevel: caseAwards[0]?.level ?? null,
          caseHighSchoolType: admissionCase.highSchoolType,
          caseCurriculumType: admissionCase.curriculumType,
          caseDemographicTags: admissionCase.demographicTags,
          caseNationality: admissionCase.nationality,
          profileGpa: profile.gpa,
          profileGpaScale: profile.gpaScale,
          profileTestScoreCount: profile.testScores?.length ?? 0,
          profileActivityCount: profile.activities?.length ?? 0,
          profileAwardCount: profile.awards?.length ?? 0,
          profileNationality: profile.nationality,
        },
        comparison,
      };
    } catch (error) {
      this.logger.error('Failed to compare case with profile', error);
      return { error: isZh ? '对比分析失败' : 'Failed to compare profiles' };
    }
  }

  async findSimilarCases(
    userId: string,
    args: { schoolName?: string; limit?: number },
    locale = 'zh',
  ) {
    const isZh = locale === 'zh';
    try {
      const profile = await this.profileLoader.loadProfile(userId, locale);

      if (!profile) {
        return {
          error: isZh
            ? '请先完善您的档案信息'
            : 'Please complete your profile first',
        };
      }

      const take = Math.min(args.limit ?? 10, 20);
      // #533 converted this file's other three case reads to
      // `caseVisibilityWhereForRole` and missed this one, which kept a
      // hand-written copy of the public set. Same file, same question, two
      // rules — which is how the next divergence starts.
      const where: Prisma.AdmissionCaseWhereInput = {
        ...caseVisibilityWhereForRole(getCurrentUserRole()),
      };

      // Match by GPA range if available
      if (profile.gpa) {
        const gpaVal = Number(profile.gpa);
        if (!isNaN(gpaVal)) {
          const low = Math.max(0, gpaVal - 0.3).toFixed(1);
          const high = Math.min(
            Number(profile.gpaScale) || 4.0,
            gpaVal + 0.3,
          ).toFixed(1);
          where.OR = [
            { gpaRange: { contains: low, mode: 'insensitive' } },
            { gpaRange: { contains: high, mode: 'insensitive' } },
          ];
        }
      }

      // Filter by target major if set
      if (profile.targetMajor) {
        where.major = { contains: profile.targetMajor, mode: 'insensitive' };
      }

      // Optionally restrict to a specific school
      if (args.schoolName) {
        const searchTerm = args.schoolName.trim();
        where.school = {
          OR: [
            { name: { contains: searchTerm, mode: 'insensitive' } },
            { nameZh: { contains: searchTerm, mode: 'insensitive' } },
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

      // Nationality-aware matching: prefer same-nationality cases, fallback to all
      // governance: public-feed — all three queries below spread the base `where` (visibility in (ANONYMOUS, PUBLIC) + approved reviewStatus), only adding filters
      let cases: Prisma.AdmissionCaseGetPayload<{
        include: { school: { select: { name: true; nameZh: true } } };
      }>[];
      let nationalityMatched = false;

      if (profile.nationality) {
        const nationalityWhere = {
          ...where,
          nationality: {
            equals: profile.nationality,
            mode: 'insensitive' as const,
          },
        };
        cases = await this.prisma.admissionCase.findMany({
          where: nationalityWhere,
          take,
          orderBy: { createdAt: 'desc' },
          include: { school: { select: { name: true, nameZh: true } } },
        });

        if (cases.length >= take) {
          nationalityMatched = true;
        } else {
          // Not enough same-nationality cases — fill remaining slots with any cases
          const remaining = take - cases.length;
          const sameIds = cases.map((item) => item.id);
          // governance: public-feed — spreads the same base `where` (visibility in (ANONYMOUS, PUBLIC) + approved reviewStatus)
          const fallbackCases = await this.prisma.admissionCase.findMany({
            where: {
              ...where,
              id: { notIn: sameIds },
            },
            take: remaining,
            orderBy: { createdAt: 'desc' },
            include: { school: { select: { name: true, nameZh: true } } },
          });
          cases = [...cases, ...fallbackCases];
          nationalityMatched = cases.length > 0 && sameIds.length > 0;
        }
      } else {
        // governance: public-feed — spreads the same base `where` (visibility in (ANONYMOUS, PUBLIC) + approved reviewStatus)
        cases = await this.prisma.admissionCase.findMany({
          where,
          take,
          orderBy: { createdAt: 'desc' },
          include: { school: { select: { name: true, nameZh: true } } },
        });
      }

      if (!cases.length) {
        return {
          message: isZh
            ? '未找到与您背景相似的案例'
            : 'No similar cases found for your profile',
        };
      }

      return {
        count: cases.length,
        matchCriteria: {
          gpa: profile.gpa,
          targetMajor: profile.targetMajor,
          nationality: profile.nationality ?? null,
          nationalityMatched,
          schoolFilter: args.schoolName ?? null,
        },
        cases: cases.map((c) => ({
          id: c.id,
          school: this.schoolLookup.displayName(c.school, locale),
          year: c.year,
          round: c.round,
          result: c.result,
          gpaRange: c.gpaRange,
          satRange: c.satRange,
          tags: c.tags,
          activitySummary: parseCaseActivities(c.activities).map((a) => ({
            category: a.category,
            description: a.description,
            role: a.role,
            tier: a.tier,
          })),
          awardSummary: parseCaseAwards(c.awards).map((a) => ({
            name: a.name,
            level: a.level,
            tier: a.tier,
          })),
          testScoreSummary: parseCaseTestScores(c.testScores).map((t) => ({
            type: t.type,
            score: t.score,
          })),
          highSchoolType: c.highSchoolType,
          curriculumType: c.curriculumType,
          demographicTags: c.demographicTags,
          nationality: c.nationality,
        })),
      };
    } catch (error) {
      this.logger.error('Failed to find similar cases', error);
      return {
        error: isZh ? '查找相似案例失败' : 'Failed to find similar cases',
      };
    }
  }

  /**
   * Smallest cohort whose outcomes may be reported. Counts still go out; the
   * breakdown and the rate do not. See `.claude/rules/backend.md`.
   */
  private static readonly MIN_REPORTABLE_COHORT = 5;

  private summarizeOutcomes(cases: Array<{ result: string }>) {
    const totalCases = cases.length;
    if (totalCases < CaseToolsService.MIN_REPORTABLE_COHORT) {
      return {
        totalCases,
        insufficientData: true as const,
        minimumRequired: CaseToolsService.MIN_REPORTABLE_COHORT,
      };
    }
    const admitted = cases.filter((c) => c.result === 'ADMITTED').length;
    const rejected = cases.filter((c) => c.result === 'REJECTED').length;
    return {
      totalCases,
      admitted,
      rejected,
      waitlistedOrDeferred: totalCases - admitted - rejected,
      admitRate: `${((admitted / totalCases) * 100).toFixed(1)}%`,
    };
  }

  async analyzeIntlCompetitiveness(
    args: { schoolId: string; nationality: string },
    locale = 'zh',
  ) {
    const isZh = locale === 'zh';
    try {
      const { schoolId, nationality } = args;

      // Query cases for the specific nationality at this school
      // governance: aggregate-only — select is `{ result: true }`; only counts
      // leave, and outcomes are withheld below MIN_REPORTABLE_COHORT. One caveat
      // stated not hidden: no visibility filter, so PRIVATE cases count.
      const nationalityCases = await this.prisma.admissionCase.findMany({
        where: {
          schoolId,
          nationality: { equals: nationality, mode: 'insensitive' },
          ...CASE_REVIEW_APPROVED_WHERE,
        },
        select: { result: true },
      });

      const nat = this.summarizeOutcomes(nationalityCases);

      // Query all international student cases at this school
      // governance: aggregate-only — same shape and same caveat as the
      // nationality query above; same cohort floor applies.
      const intlCases = await this.prisma.admissionCase.findMany({
        where: {
          schoolId,
          demographicTags: { has: 'international' },
          ...CASE_REVIEW_APPROVED_WHERE,
        },
        select: { result: true },
      });

      const intl = this.summarizeOutcomes(intlCases);

      if (nat.totalCases === 0 && intl.totalCases === 0) {
        return {
          message: isZh
            ? `未找到该学校的国际生录取案例数据`
            : `No international student admission case data found for this school`,
        };
      }

      // The summary is prose fed to the LLM, so it has to honour the floor too —
      // withholding the fields and then restating the rate here would leak it.
      const describe = (
        label: string,
        s: ReturnType<typeof this.summarizeOutcomes>,
      ) =>
        'insufficientData' in s
          ? isZh
            ? `${label}: ${s.totalCases}例，样本不足${s.minimumRequired}例，不报录取结果`
            : `${label}: ${s.totalCases} cases, below the ${s.minimumRequired}-case reporting floor, outcomes withheld`
          : isZh
            ? `${label}: ${s.totalCases}例, 录取${s.admitted}例(${s.admitRate})`
            : `${label}: ${s.totalCases} cases, ${s.admitted} admitted (${s.admitRate})`;

      return {
        nationality: { country: nationality, ...nat },
        allInternational: intl,
        summary: [
          describe(
            isZh ? `${nationality}申请者` : `${nationality} applicants`,
            nat,
          ),
          describe(isZh ? '全部国际生' : 'All international', intl),
        ].join('; '),
      };
    } catch (error) {
      this.logger.error('Failed to analyze intl competitiveness', error);
      return {
        error: isZh
          ? '分析国际生竞争力失败'
          : 'Failed to analyze international competitiveness',
      };
    }
  }
}
