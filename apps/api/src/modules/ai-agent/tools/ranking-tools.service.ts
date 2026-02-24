/**
 * Ranking Tools Service
 *
 * Tools: ANALYZE_PROFILE_RANKING, SUGGEST_PROFILE_IMPROVEMENTS,
 *        COMPARE_WITH_ADMITTED_PROFILES
 */

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { AiService } from '../../ai/ai.service';
import { HallService } from '../../hall/hall.service';
import { ProfileLoaderHelper } from './helpers/profile-loader.helper';
import { SchoolLookupHelper } from './helpers/school-lookup.helper';
import { extractJsonFromLlm } from './helpers/llm-json.helper';
import { ToolHandler, IToolHandlerProvider } from './tool-handler.interface';

@Injectable()
export class RankingToolsService implements IToolHandlerProvider {
  private readonly logger = new Logger(RankingToolsService.name);

  constructor(
    private prisma: PrismaService,
    private aiService: AiService,
    private hallService: HallService,
    private profileLoader: ProfileLoaderHelper,
    private schoolLookup: SchoolLookupHelper,
  ) {}

  getHandlers(): Map<string, ToolHandler> {
    return new Map([
      [
        'analyze_profile_ranking',
        (args, userId, _ctx, locale) =>
          this.analyzeProfileRanking(
            userId,
            args.schoolId,
            args.schoolName,
            locale,
          ),
      ],
      [
        'suggest_profile_improvements',
        (args, userId, _ctx, locale) =>
          this.suggestProfileImprovements(userId, args.targetTier, locale),
      ],
      [
        'compare_with_admitted_profiles',
        (args, userId, _ctx, locale) =>
          this.compareWithAdmittedProfiles(
            userId,
            args.schoolId,
            args.schoolName,
            locale,
          ),
      ],
    ]);
  }

  async analyzeProfileRanking(
    userId: string,
    schoolId?: string,
    schoolName?: string,
    locale = 'zh',
  ) {
    const isZh = locale === 'zh';
    try {
      let targetSchoolId = schoolId;
      if (!targetSchoolId && schoolName) {
        const school = await this.schoolLookup.findSchool(
          undefined,
          schoolName,
        );
        targetSchoolId = school?.id;
      }

      if (!targetSchoolId) {
        const ranking = await this.hallService.getProfileRanking(
          userId,
          'overall',
        );
        return {
          type: isZh ? '总体排名' : 'Overall Ranking',
          rank: ranking.rank,
          total: ranking.total,
          percentile: ranking.percentile,
          message: isZh
            ? `您在所有用户中排名第 ${ranking.rank}/${ranking.total}，超过了 ${ranking.percentile}% 的用户`
            : `You rank ${ranking.rank} out of ${ranking.total} users, surpassing ${ranking.percentile}% of users`,
        };
      }

      const ranking = await this.hallService.getProfileRanking(
        userId,
        targetSchoolId,
      );
      const school = await this.prisma.school.findUnique({
        where: { id: targetSchoolId },
      });

      const displayName = school
        ? this.schoolLookup.displayName(school, locale)
        : '';
      return {
        school: displayName,
        rank: ranking.rank,
        total: ranking.total,
        percentile: ranking.percentile,
        message: isZh
          ? `在申请 ${displayName} 的用户中，您排名第 ${ranking.rank}/${ranking.total}，超过了 ${ranking.percentile}% 的用户`
          : `Among applicants to ${displayName}, you rank ${ranking.rank} out of ${ranking.total}, surpassing ${ranking.percentile}% of users`,
      };
    } catch (error) {
      this.logger.error('Failed to analyze profile ranking', error);
      return { error: isZh ? '获取排名失败' : 'Failed to retrieve ranking' };
    }
  }

  async suggestProfileImprovements(
    userId: string,
    targetTier?: string,
    locale = 'zh',
  ) {
    const isZh = locale === 'zh';
    try {
      const profile = await this.profileLoader.loadProfile(userId, locale);

      if (!profile) {
        return {
          error: isZh
            ? '请先完善档案信息'
            : 'Please complete your profile first',
        };
      }

      const notFilled = isZh ? '未填' : 'Not provided';
      const none = isZh ? '无' : 'None';
      const undecided = isZh ? '未定' : 'Undecided';

      const systemPrompt = isZh
        ? `你是资深留学顾问。根据学生档案，提供具体的改进建议以提升竞争力。

分析维度：
1. 学术成绩（GPA、课程选择）
2. 标化考试（SAT/ACT、托福）
3. 课外活动（深度、广度、领导力）
4. 奖项荣誉（级别、相关性）
5. 申请材料（文书主题、推荐信）

请针对${targetTier ? `申请${targetTier}学校` : '整体申请'}给出具体可执行的建议。

返回JSON格式:
{
  "currentStrengths": ["优势1", "优势2"],
  "areasToImprove": [
    { "area": "领域", "currentStatus": "现状", "suggestion": "建议", "priority": "高/中/低" }
  ],
  "actionItems": [
    { "task": "具体任务", "timeline": "建议时间", "impact": "预期效果" }
  ]
}`
        : `You are a senior admissions consultant. Based on the student's profile, provide specific improvement suggestions to enhance competitiveness.

Analysis dimensions:
1. Academics (GPA, course selection)
2. Standardized tests (SAT/ACT, TOEFL)
3. Extracurriculars (depth, breadth, leadership)
4. Awards (level, relevance)
5. Application materials (essay topics, recommendations)

Provide specific, actionable advice for ${targetTier ? `${targetTier} schools` : 'overall applications'}.

Return in JSON format:
{
  "currentStrengths": ["Strength 1", "Strength 2"],
  "areasToImprove": [
    { "area": "Area", "currentStatus": "Current status", "suggestion": "Suggestion", "priority": "High/Medium/Low" }
  ],
  "actionItems": [
    { "task": "Specific task", "timeline": "Suggested timeline", "impact": "Expected impact" }
  ]
}`;

      const response = await this.aiService.chat(
        [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: isZh
              ? `
学生档案：
- GPA：${profile.gpa || notFilled}/${profile.gpaScale || 4.0}
- 年级：${profile.grade || notFilled}
- 标化成绩：${profile.testScores?.map((s: any) => `${s.type}: ${s.score}`).join(', ') || notFilled}
- 活动数量：${profile.activities?.length || 0}
- 活动详情：${
                  profile.activities
                    ?.slice(0, 3)
                    .map((a: any) => `${a.name}(${a.role})`)
                    .join(', ') || none
                }
- 奖项数量：${profile.awards?.length || 0}
- 奖项详情：${
                  profile.awards
                    ?.slice(0, 3)
                    .map((a: any) => `${a.name}(${a.level})`)
                    .join(', ') || none
                }
- 目标专业：${profile.targetMajor || undecided}
- 预算：${profile.budgetTier || undecided}
${targetTier ? `目标学校层次：${targetTier}` : ''}`
              : `
Student profile:
- GPA: ${profile.gpa || notFilled}/${profile.gpaScale || 4.0}
- Grade: ${profile.grade || notFilled}
- Test scores: ${profile.testScores?.map((s: any) => `${s.type}: ${s.score}`).join(', ') || notFilled}
- Activities: ${profile.activities?.length || 0}
- Activity details: ${
                  profile.activities
                    ?.slice(0, 3)
                    .map((a: any) => `${a.name} (${a.role})`)
                    .join(', ') || none
                }
- Awards: ${profile.awards?.length || 0}
- Award details: ${
                  profile.awards
                    ?.slice(0, 3)
                    .map((a: any) => `${a.name} (${a.level})`)
                    .join(', ') || none
                }
- Target major: ${profile.targetMajor || undecided}
- Budget: ${profile.budgetTier || undecided}
${targetTier ? `Target school tier: ${targetTier}` : ''}`,
          },
        ],
        { temperature: 0.6 },
      );

      return extractJsonFromLlm(response, 'suggestions');
    } catch (error) {
      this.logger.error('Failed to suggest improvements', error);
      return {
        error: isZh
          ? '生成改进建议失败'
          : 'Failed to generate improvement suggestions',
      };
    }
  }

  async compareWithAdmittedProfiles(
    userId: string,
    schoolId?: string,
    schoolName?: string,
    locale = 'zh',
  ) {
    const isZh = locale === 'zh';
    try {
      let school;
      if (schoolId) {
        school = await this.prisma.school.findUnique({
          where: { id: schoolId },
        });
      } else if (schoolName) {
        school = await this.schoolLookup.findSchool(undefined, schoolName);
        // Need full school data for rank
        if (school) {
          school = await this.prisma.school.findUnique({
            where: { id: school.id },
          });
        }
      }

      if (!school) {
        return {
          error: isZh
            ? '请指定要对比的学校'
            : 'Please specify a school to compare',
        };
      }

      const displayName = this.schoolLookup.displayName(school, locale);

      const admittedCases = await this.prisma.admissionCase.findMany({
        where: {
          schoolId: school.id,
          result: 'ADMITTED',
          visibility: { in: ['ANONYMOUS', 'VERIFIED_ONLY'] },
        },
        take: 20,
        orderBy: { createdAt: 'desc' },
      });

      if (!admittedCases.length) {
        return {
          school: displayName,
          message: isZh
            ? '暂无该学校的录取案例数据'
            : 'No admission case data available for this school',
        };
      }

      const profile = await this.profileLoader.loadProfile(userId, locale);
      if (!profile) {
        return {
          error: isZh
            ? '请先完善档案信息'
            : 'Please complete your profile first',
        };
      }

      const gpaRanges = admittedCases.map((c) => c.gpaRange).filter(Boolean);
      const satRanges = admittedCases.map((c) => c.satRange).filter(Boolean);
      const notFilled = isZh ? '未填' : 'Not provided';
      const insufficient = isZh ? '数据不足' : 'Insufficient data';

      const systemPrompt = isZh
        ? `你是留学数据分析师。请对比学生档案与该校录取学生的整体情况。`
        : `You are an admissions data analyst. Compare the student's profile with the overall admitted student data for this school.`;

      const analysis = await this.aiService.chat(
        [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: isZh
              ? `
目标学校：${displayName} (排名 #${school.usNewsRank})

录取学生情况（${admittedCases.length}个案例）：
- GPA范围分布：${gpaRanges.join(', ') || insufficient}
- SAT范围分布：${satRanges.join(', ') || insufficient}
- 常见标签：${[...new Set(admittedCases.flatMap((c) => c.tags || []))].slice(0, 10).join(', ')}

您的档案：
- GPA：${profile.gpa || notFilled}/${profile.gpaScale || 4.0}
- 标化：${profile.testScores?.map((s: any) => `${s.type}: ${s.score}`).join(', ') || notFilled}
- 活动：${profile.activities?.length || 0}个
- 奖项：${profile.awards?.length || 0}个

请分析差距并给出建议。`
              : `
Target school: ${displayName} (Rank #${school.usNewsRank})

Admitted student data (${admittedCases.length} cases):
- GPA range distribution: ${gpaRanges.join(', ') || insufficient}
- SAT range distribution: ${satRanges.join(', ') || insufficient}
- Common tags: ${[...new Set(admittedCases.flatMap((c) => c.tags || []))].slice(0, 10).join(', ')}

Your profile:
- GPA: ${profile.gpa || notFilled}/${profile.gpaScale || 4.0}
- Test scores: ${profile.testScores?.map((s: any) => `${s.type}: ${s.score}`).join(', ') || notFilled}
- Activities: ${profile.activities?.length || 0}
- Awards: ${profile.awards?.length || 0}

Analyze the gaps and provide recommendations.`,
          },
        ],
        { temperature: 0.5 },
      );

      return {
        school: displayName,
        admittedCasesCount: admittedCases.length,
        analysis,
      };
    } catch (error) {
      this.logger.error('Failed to compare with admitted profiles', error);
      return { error: isZh ? '对比分析失败' : 'Failed to compare profiles' };
    }
  }
}
