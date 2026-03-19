import { Injectable } from '@nestjs/common';
import { ProfileInput, SchoolInput } from './prediction.prompts';
import { PredictionFactor, PredictionComparison } from './dto';
import {
  HistoricalDistribution,
  calculateOverallScore,
  calculateProbability,
  normalizeGpa,
} from './utils/score-calculator';
import { PredictionTransformerService } from './prediction-transformer.service';

/**
 * Engine 1: Statistical prediction algorithm.
 *
 * Computes admission probability from a data-driven score combining GPA (weight 0.3),
 * standardized test scores (0.25), activities (0.25), and awards (0.2). Generates
 * per-factor impact analysis and applicant-vs-school comparison percentiles.
 * Optionally incorporates historical distribution data for percentile adjustments.
 */
@Injectable()
export class PredictionStatisticalEngine {
  constructor(private readonly transformer: PredictionTransformerService) {}

  /**
   * Run the statistical prediction engine.
   *
   * @param profile - Normalized profile input
   * @param school - Normalized school input
   * @param historicalDistribution - Optional historical admit score distributions for the school
   * @param locale - Language locale ('zh' | 'en')
   * @returns Object containing probability (0-1), detailed factors, and comparison data
   */
  predictWithStats(
    profile: ProfileInput,
    school: SchoolInput,
    historicalDistribution?: HistoricalDistribution,
    locale = 'zh',
  ): {
    probability: number;
    factors: PredictionFactor[];
    comparison: PredictionComparison;
  } {
    const isZh = locale === 'zh';
    const profileMetrics = this.transformer.extractProfileMetrics(profile);
    const schoolMetrics = this.transformer.extractSchoolMetrics(school);

    const overallScore = calculateOverallScore(
      profileMetrics,
      schoolMetrics,
      historicalDistribution,
    );
    const selectivityOpts =
      profile.isInternational && school.intlAcceptanceRate
        ? { useIntlRate: true, intlAcceptanceRate: school.intlAcceptanceRate }
        : undefined;
    const probability = calculateProbability(
      overallScore,
      schoolMetrics,
      selectivityOpts,
    );

    // 生成因素分析
    const factors: PredictionFactor[] = [];

    if (profileMetrics.gpa) {
      const normalizedGpa = normalizeGpa(
        profileMetrics.gpa,
        profileMetrics.gpaScale || 4,
      );
      const isGood = normalizedGpa >= 3.7;
      factors.push({
        name: 'GPA',
        impact: isGood
          ? 'positive'
          : normalizedGpa >= 3.3
            ? 'neutral'
            : 'negative',
        weight: 0.3,
        detail: isGood
          ? isZh
            ? `GPA ${normalizedGpa.toFixed(2)} 具有较强竞争力`
            : `GPA of ${normalizedGpa.toFixed(2)} is competitive for ${school.name || school.nameZh}`
          : isZh
            ? `GPA ${normalizedGpa.toFixed(2)} 需要其他方面弥补`
            : `GPA of ${normalizedGpa.toFixed(2)} needs support from other areas`,
        improvement: !isGood
          ? isZh
            ? '建议在剩余学期提高GPA，选修有把握的课程'
            : 'Consider improving GPA in remaining semesters by taking courses you can excel in'
          : undefined,
      });
    } else {
      factors.push({
        name: 'GPA',
        impact: 'negative',
        weight: 0.3,
        detail: isZh
          ? '未提供GPA信息，无法评估学术水平'
          : 'GPA not provided — unable to assess academic standing',
        improvement: isZh
          ? '请在个人档案中填写GPA信息以获得更准确的预测'
          : 'Add your GPA to your profile for a more accurate prediction',
      });
    }

    if (profileMetrics.satScore) {
      const isGood = profileMetrics.satScore >= (schoolMetrics.satAvg || 1400);
      factors.push({
        name: isZh ? '标化成绩' : 'Standardized Test Scores',
        impact: isGood ? 'positive' : 'negative',
        weight: 0.25,
        detail: isGood
          ? isZh
            ? `SAT ${profileMetrics.satScore} 达到或超过学校平均水平`
            : `SAT ${profileMetrics.satScore} meets or exceeds the school average`
          : isZh
            ? `SAT ${profileMetrics.satScore} 略低于学校平均水平`
            : `SAT ${profileMetrics.satScore} is below the school average`,
        improvement: !isGood
          ? isZh
            ? '建议考虑重考SAT或提交ACT成绩'
            : 'Consider retaking the SAT or submitting ACT scores'
          : undefined,
      });
    } else if (!profileMetrics.actScore) {
      factors.push({
        name: isZh ? '标化成绩' : 'Standardized Test Scores',
        impact: 'negative',
        weight: 0.25,
        detail: isZh
          ? '未提供标化成绩，可能会影响整体竞争力'
          : 'No standardized test scores provided, which may reduce competitiveness',
        improvement: isZh
          ? '建议在个人档案中添加SAT/ACT成绩，或说明是否选择test-optional'
          : 'Provide SAT or ACT scores to strengthen your application',
      });
    }

    if (profileMetrics.activityCount > 0) {
      const isGood = profileMetrics.activityCount >= 5;
      factors.push({
        name: isZh ? '活动经历' : 'Extracurricular Activities',
        impact: isGood ? 'positive' : 'neutral',
        weight: 0.25,
        detail: isGood
          ? isZh
            ? `${profileMetrics.activityCount}项活动展示了多元化兴趣`
            : `${profileMetrics.activityCount} activities demonstrate diverse interests`
          : isZh
            ? `${profileMetrics.activityCount}项活动，建议增加深度参与`
            : `${profileMetrics.activityCount} activities — consider deepening your involvement`,
        improvement: !isGood
          ? isZh
            ? '建议在现有活动中发挥领导作用'
            : 'Take on leadership roles in your current activities'
          : undefined,
      });
    } else {
      factors.push({
        name: isZh ? '活动经历' : 'Extracurricular Activities',
        impact: 'negative',
        weight: 0.25,
        detail: isZh
          ? '缺乏课外活动经历，可能会使申请者在综合评估中处于劣势'
          : 'No extracurricular activities may weaken the overall application',
        improvement: isZh
          ? '建议添加课外活动信息，展示学术外的能力和兴趣'
          : 'Add extracurricular activities to showcase skills and interests beyond academics',
      });
    }

    if (profileMetrics.awardCount > 0) {
      const hasTopAwards =
        profileMetrics.nationalAwardCount > 0 ||
        profileMetrics.internationalAwardCount > 0;
      factors.push({
        name: isZh ? '获奖情况' : 'Awards & Honors',
        impact: hasTopAwards ? 'positive' : 'neutral',
        weight: 0.2,
        detail: hasTopAwards
          ? isZh
            ? '拥有国家级或国际级奖项，增强竞争力'
            : 'National or international awards strengthen competitiveness'
          : isZh
            ? `${profileMetrics.awardCount}项奖项，建议争取更高级别奖项`
            : `${profileMetrics.awardCount} awards — aim for higher-level recognition`,
        improvement: !hasTopAwards
          ? isZh
            ? '建议参加含金量较高的学科竞赛'
            : 'Participate in prestigious academic competitions'
          : undefined,
      });
    } else {
      factors.push({
        name: isZh ? '获奖情况' : 'Awards & Honors',
        impact: 'negative',
        weight: 0.2,
        detail: isZh
          ? '没有获奖经历，可能会影响申请的竞争力'
          : 'No awards may affect application competitiveness',
        improvement: isZh
          ? '建议参加学科竞赛或其他有影响力的比赛'
          : 'Participate in academic competitions or other impactful contests',
      });
    }

    // 目标专业竞争力 (data-driven from SchoolProgram when available)
    if (profile.targetMajor && profile.majorCompetitiveness) {
      const compLevel = profile.majorCompetitiveness.level;
      factors.push({
        name: isZh ? '专业竞争度' : 'Major Competitiveness',
        impact:
          compLevel >= 4 ? 'negative' : compLevel <= 2 ? 'positive' : 'neutral',
        weight: 0.1,
        detail: isZh
          ? `${profile.majorCompetitiveness.name}在该校竞争度: ${compLevel}/5${profile.majorCompetitiveness.schoolEstimate ? `，预估专业录取率 ~${profile.majorCompetitiveness.schoolEstimate}%` : ''}`
          : `${profile.majorCompetitiveness.name} competitiveness at this school: ${compLevel}/5${profile.majorCompetitiveness.schoolEstimate ? `, estimated major acceptance ~${profile.majorCompetitiveness.schoolEstimate}%` : ''}`,
        improvement:
          compLevel >= 4
            ? isZh
              ? '建议在专业相关活动和研究上展现深度'
              : 'Demonstrate depth in major-related activities and research'
            : undefined,
      });
    } else if (profile.targetMajor) {
      // Fallback: simple text-match competitive major check
      const competitiveMajors = [
        'computer science',
        'engineering',
        'business',
        'pre-med',
        '计算机科学',
        '工程',
        '商科',
        '医学预科',
      ];
      const isCompetitive = competitiveMajors.some((m) =>
        profile.targetMajor!.toLowerCase().includes(m),
      );
      if (isCompetitive) {
        factors.push({
          name: isZh ? '目标专业竞争力' : 'Target Major Competitiveness',
          impact: 'neutral',
          weight: 0.0,
          detail: isZh
            ? `${profile.targetMajor}专业竞争激烈，申请者需要在各方面表现突出`
            : `${profile.targetMajor} is a highly competitive major — strong performance across all areas is needed`,
        });
      }
    }

    // 国际生身份
    if (profile.isInternational) {
      const intlRate = school.intlAcceptanceRate;
      const overallRate = school.acceptanceRate;
      factors.push({
        name: isZh ? '国际生身份' : 'International Applicant',
        impact:
          intlRate && overallRate && intlRate < overallRate
            ? 'negative'
            : 'neutral',
        weight: 0.15,
        detail: intlRate
          ? isZh
            ? `国际生录取率 ${intlRate}% vs 整体 ${overallRate}%`
            : `International rate ${intlRate}% vs overall ${overallRate}%`
          : isZh
            ? '暂无该校国际生录取率数据'
            : 'International rate data not available for this school',
      });
      if (school.needBlindInternational) {
        factors.push({
          name: isZh ? 'Need-Blind政策' : 'Need-Blind Policy',
          impact: 'positive',
          weight: 0.0,
          detail: isZh
            ? '该校对国际生实行Need-Blind录取'
            : 'This school is need-blind for international students',
        });
      }
    }

    // 对比数据
    const comparison: PredictionComparison = {
      gpaPercentile: profileMetrics.gpa
        ? Math.min(
            99,
            Math.round(
              (normalizeGpa(profileMetrics.gpa, profileMetrics.gpaScale || 4) /
                4) *
                100,
            ),
          )
        : 50,
      testScorePercentile: profileMetrics.satScore
        ? Math.max(
            1,
            Math.min(
              99,
              Math.round(((profileMetrics.satScore - 1000) / 600) * 100),
            ),
          )
        : 50,
      activityStrength:
        profileMetrics.activityCount >= 7
          ? 'strong'
          : profileMetrics.activityCount >= 4
            ? 'average'
            : 'weak',
    };

    return { probability, factors, comparison };
  }
}
