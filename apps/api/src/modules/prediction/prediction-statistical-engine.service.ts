import { Injectable } from '@nestjs/common';
import { ProfileInput, SchoolInput } from './prediction.prompts';
import { PredictionFactor, PredictionComparison } from './dto';
import {
  HistoricalDistribution,
  calculateOverallScoreDetailed,
  calculateProbability,
  normalizeGpa,
} from './utils/score-calculator';
import type { HsConfidenceResult } from '@study-abroad/shared/scoring';
import { ROUND_MULTIPLIERS } from '@study-abroad/shared/scoring';
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
    hsConfidence?: {
      level: 'high' | 'medium' | 'low' | 'none';
      dimensionsAvailable: number;
      improvementTip?: string;
    };
  } {
    const isZh = locale === 'zh';
    const profileMetrics = this.transformer.extractProfileMetrics(profile);
    const schoolMetrics = this.transformer.extractSchoolMetrics(school);

    const {
      score: overallScore,
      hsConfidence,
      hsImpact,
    } = calculateOverallScoreDetailed(
      profileMetrics,
      schoolMetrics,
      historicalDistribution,
    );
    const selectivityOpts =
      profile.isInternational && school.intlAcceptanceRate
        ? { useIntlRate: true, intlAcceptanceRate: school.intlAcceptanceRate }
        : undefined;
    let probability = calculateProbability(
      overallScore,
      schoolMetrics,
      selectivityOpts,
    );

    // === Weak-signal base-rate anchor ===
    // The sigmoid in calculateProbability uses (overallScore vs school.threshold)
    // and does NOT use school.acceptanceRate as a Bayesian prior. For applicants
    // with sparse profile data (no test score, no high school tier matched),
    // overallScore collapses below threshold and probability bottoms out near
    // the 0.05 floor regardless of how unselective the school is. That mis-
    // predicts safety schools severely (e.g. UC Merced 90% admit rate -> 0.36
    // for an incomplete profile observed 2026-04-23).
    //
    // Fix: when 2+ critical signals are missing, blend 70% toward the school's
    // published admit rate (intl rate when available for international students),
    // 30% toward the score-based sigmoid. Strong-signal predictions are unchanged.
    const intlBaseRate =
      profile.isInternational && school.intlAcceptanceRate != null
        ? school.intlAcceptanceRate / 100
        : null;
    const overallBaseRate =
      school.acceptanceRate != null ? school.acceptanceRate / 100 : null;
    const baseRate = intlBaseRate ?? overallBaseRate;

    if (baseRate != null && baseRate > 0 && baseRate < 1) {
      const isTestBlindForSignals = school.testingPolicy === 'BLIND';
      const missingCriticalSignals =
        Number(profileMetrics.gpa == null) +
        Number(
          !isTestBlindForSignals &&
            profileMetrics.satScore == null &&
            profileMetrics.actScore == null,
        ) +
        Number(profileMetrics.highSchoolTier == null);
      if (missingCriticalSignals >= 2) {
        probability = 0.3 * probability + 0.7 * baseRate;
      }
    }

    // Apply application round multiplier (ED has higher acceptance rate)
    const roundMultiplier = school.applicationRound
      ? (ROUND_MULTIPLIERS[school.applicationRound] ?? 1.0)
      : 1.0;
    if (roundMultiplier !== 1.0) {
      probability = Math.min(0.95, probability * roundMultiplier);
    }

    // === Hook factors (G3): Legacy & First-Generation boosts ===
    // Legacy boost: only when student's legacy school matches the target school
    if (
      profile.isLegacy &&
      profile.legacySchools?.some(
        (ls) =>
          ls.toLowerCase() === school.name?.toLowerCase() ||
          ls.toLowerCase() === school.nameZh?.toLowerCase(),
      )
    ) {
      probability = Math.min(0.95, probability * 1.5);
    }
    // First-generation boost
    if (profile.isFirstGen) {
      probability = Math.min(0.95, probability * 1.15);
    }

    // === Need-aware financial aid penalty (G4) ===
    if (
      profile.needsFinancialAid &&
      profile.isInternational &&
      !school.needBlindInternational
    ) {
      probability = probability * 0.75;
    }

    // 生成因素分析
    const factors: PredictionFactor[] = [];

    if (profileMetrics.gpa) {
      const normalizedGpa = normalizeGpa(
        profileMetrics.gpa,
        profileMetrics.gpaScale || 4,
        profileMetrics.gpaSystem,
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

    // Test-blind schools (e.g. UC Berkeley) ignore SAT/ACT entirely. We surface
    // a neutral informational factor instead of penalizing absent scores or
    // rewarding strong ones — the school does not see test data at all.
    const isTestBlindSchool = school.testingPolicy === 'BLIND';
    if (isTestBlindSchool) {
      factors.push({
        name: isZh ? '标化成绩' : 'Standardized Test Scores',
        impact: 'neutral',
        weight: 0,
        detail: isZh
          ? '该校实行标化盲审政策，SAT/ACT 成绩不会被招生官查看，不影响录取概率'
          : 'This school is test-blind; SAT/ACT scores are not reviewed and do not affect admissions probability',
      });
    } else if (profileMetrics.satScore) {
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

    if (profileMetrics.essayQualityScore != null) {
      const essayScore =
        profileMetrics.essayQualityScore > 10
          ? profileMetrics.essayQualityScore / 10
          : profileMetrics.essayQualityScore;
      const boundedEssayScore = Math.max(0, Math.min(10, essayScore));
      factors.push({
        name: isZh ? '文书质量' : 'Essay Quality',
        impact:
          boundedEssayScore >= 8
            ? 'positive'
            : boundedEssayScore >= 6.5
              ? 'neutral'
              : 'negative',
        weight: 0.07,
        detail: isZh
          ? `最近一次 AI 文书评审为 ${boundedEssayScore.toFixed(1)}/10，已作为软性申请质量信号纳入概率模型`
          : `Latest AI essay review is ${boundedEssayScore.toFixed(1)}/10 and is included as a soft application-quality signal`,
        improvement:
          boundedEssayScore < 8
            ? isZh
              ? '建议继续强化具体故事、学校匹配度和个人反思深度'
              : 'Strengthen concrete storytelling, school fit, and depth of reflection'
            : undefined,
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

    // 高中背景 — 5-dimension evaluation summary with quantified impact
    if (profileMetrics.highSchoolTier) {
      const tier = profileMetrics.highSchoolTier;
      const recognition = profileMetrics.highSchoolRecognition;
      const rigor = profileMetrics.highSchoolAcademicRigor;
      const placement = profileMetrics.highSchoolPlacementRecord;
      const resources = profileMetrics.highSchoolResources;

      // Quantify impact percentage for transparency
      const impactPct = ((hsImpact - 1.0) * 100).toFixed(1);
      const impactSign = hsImpact >= 1.0 ? '+' : '';

      let detail: string;
      if (recognition && rigor) {
        const recDescZh: Record<number, string> = {
          5: '在顶尖大学招生官中具有很高的认可度',
          4: '在多数大学招生官中具有良好认可度',
          3: '在部分大学招生官中有一定认可度',
          2: '招生官认可度有限',
          1: '招生官认可度较低',
        };
        const recDescEn: Record<number, string> = {
          5: 'highly recognized by top university admissions officers',
          4: 'well recognized by most admissions officers',
          3: 'recognized by some admissions officers',
          2: 'limited recognition among admissions officers',
          1: 'minimal recognition among admissions officers',
        };
        const rigorDescZh: Record<number, string> = {
          5: '学术要求极其严格，GPA含金量很高',
          4: '学术要求严格，GPA含金量较高',
          3: '学术要求适中',
          2: '学术要求偏宽松',
          1: '学术要求较低',
        };
        const rigorDescEn: Record<number, string> = {
          5: 'extremely rigorous academics with highly credible GPA',
          4: 'rigorous academics with credible GPA',
          3: 'moderate academic rigor',
          2: 'relatively lenient academics',
          1: 'low academic rigor',
        };

        const parts: string[] = [];
        if (isZh) {
          parts.push(
            `${recDescZh[recognition] ?? recDescZh[3]}，${rigorDescZh[rigor] ?? rigorDescZh[3]}`,
          );
          if (placement && placement >= 4) parts.push('升学表现突出');
          if (resources && resources >= 4) parts.push('升学资源丰富');
        } else {
          parts.push(
            `${recDescEn[recognition] ?? recDescEn[3]}, ${rigorDescEn[rigor] ?? rigorDescEn[3]}`,
          );
          if (placement && placement >= 4)
            parts.push('strong college placement track record');
          if (resources && resources >= 4)
            parts.push('excellent counseling resources');
        }

        detail = isZh
          ? `你的高中背景（Tier ${tier}/5）为本校预测提供了约${impactSign}${impactPct}%的调整。${parts.join('，')}`
          : `Your school background (Tier ${tier}/5) provides approximately ${impactSign}${impactPct}% adjustment. ${parts.join('; ')}`;
      } else {
        const tierLabelZh: Record<number, string> = {
          5: '顶尖',
          4: '有竞争力',
          3: '标准',
          2: '一般',
          1: '基础',
        };
        const tierLabelEn: Record<number, string> = {
          5: 'Top Feeder',
          4: 'Competitive',
          3: 'Standard',
          2: 'Moderate',
          1: 'Basic',
        };
        detail = isZh
          ? `你的高中背景（Tier ${tier} · ${tierLabelZh[tier] ?? '标准'}）为本校预测提供了约${impactSign}${impactPct}%的调整`
          : `Your school background (Tier ${tier} · ${tierLabelEn[tier] ?? 'Standard'}) provides approximately ${impactSign}${impactPct}% adjustment`;
      }

      // Confidence-based improvement tip
      let improvement: string | undefined;
      if (hsConfidence.level === 'low' || hsConfidence.level === 'medium') {
        improvement = isZh
          ? `当前高中数据置信度为"${hsConfidence.level === 'low' ? '低' : '中'}"（${hsConfidence.dimensionsAvailable}/5维度），补充更多高中信息可提升预测准确度`
          : `HS data confidence is "${hsConfidence.level}" (${hsConfidence.dimensionsAvailable}/5 dimensions). Adding more school details improves accuracy`;
      }

      // Weight reflects actual multiplier impact
      const effectiveWeight = tier >= 4 ? 0.08 : tier <= 2 ? 0.06 : 0.05;

      // Never mark tier 1-2 as "negative" — HS background is immutable,
      // so negative labels cause anxiety without actionable recourse.
      // Tier 4-5 → positive (earned advantage), all others → neutral.
      factors.push({
        name: isZh ? '高中背景' : 'High School Background',
        impact: tier >= 4 ? 'positive' : 'neutral',
        weight: effectiveWeight,
        detail,
        improvement,
      });
    } else {
      factors.push({
        name: isZh ? '高中背景' : 'High School Background',
        impact: 'neutral',
        weight: 0.05,
        detail: isZh
          ? '未提供高中信息，预测仅基于学术数据'
          : 'No high school information provided — prediction based on academic metrics only',
        improvement: isZh
          ? '在个人资料中补充高中信息可提升预测准确度'
          : 'Add your high school in your profile for more accurate predictions',
      });
    }

    // Application round factor
    if (school.applicationRound && roundMultiplier !== 1.0) {
      factors.push({
        name: isZh ? '申请轮次' : 'Application Round',
        impact: roundMultiplier > 1.0 ? 'positive' : 'neutral',
        weight: roundMultiplier - 1.0,
        detail: isZh
          ? `${school.applicationRound} 轮次通常录取率更高`
          : `${school.applicationRound} round typically has higher acceptance rate`,
      });
    }

    // Legacy hook factor (G3)
    if (
      profile.isLegacy &&
      profile.legacySchools?.some(
        (ls) =>
          ls.toLowerCase() === school.name?.toLowerCase() ||
          ls.toLowerCase() === school.nameZh?.toLowerCase(),
      )
    ) {
      factors.push({
        name: isZh ? '校友遗产' : 'Legacy',
        impact: 'positive',
        weight: 0.5,
        detail: isZh
          ? '你在该校有校友遗产关系（Legacy），这在录取中通常是一个显著优势'
          : 'You have a legacy connection at this school, which is typically a significant admissions advantage',
      });
    }

    // First-generation factor (G3)
    if (profile.isFirstGen) {
      factors.push({
        name: isZh ? '第一代大学生' : 'First Generation',
        impact: 'positive',
        weight: 0.15,
        detail: isZh
          ? '作为第一代大学生，许多大学在录取时会给予一定的优势考量'
          : 'As a first-generation college student, many universities give a modest boost in admissions consideration',
      });
    }

    // Need-aware financial aid penalty (G4)
    if (
      profile.needsFinancialAid &&
      profile.isInternational &&
      !school.needBlindInternational
    ) {
      factors.push({
        name: isZh
          ? '助学金需求（Need-aware）'
          : 'Financial Aid Need (Need-aware)',
        impact: 'negative',
        weight: -0.25,
        detail: isZh
          ? '该校对国际生采用 need-aware 录取政策，申请助学金可能降低录取概率'
          : 'This school uses need-aware admissions for international students; requesting financial aid may reduce admission probability',
      });
    }

    // 对比数据
    const comparison: PredictionComparison = {
      gpaPercentile: profileMetrics.gpa
        ? Math.min(
            99,
            Math.round(
              (normalizeGpa(
                profileMetrics.gpa,
                profileMetrics.gpaScale || 4,
                profileMetrics.gpaSystem,
              ) /
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

    // Build HS confidence response
    const hsConfidenceResponse =
      hsConfidence.level !== 'none'
        ? {
            level: hsConfidence.level,
            dimensionsAvailable: hsConfidence.dimensionsAvailable,
            improvementTip:
              hsConfidence.level === 'low' || hsConfidence.level === 'medium'
                ? isZh
                  ? '补充高中信息可获得更准确的预测'
                  : 'Add high school details for more accurate predictions'
                : undefined,
          }
        : {
            level: 'none' as const,
            dimensionsAvailable: 0,
            improvementTip: isZh
              ? '添加高中信息可提升预测准确度'
              : 'Add your high school for more accurate predictions',
          };

    return {
      probability,
      factors,
      comparison,
      hsConfidence: hsConfidenceResponse,
    };
  }
}
