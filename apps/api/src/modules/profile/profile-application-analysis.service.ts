import { Injectable, Logger } from '@nestjs/common';
import { Prisma, SchoolPolicyDimension, SchoolTier } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../common/redis/redis.service';
import { REDIS_TTL } from '../../common/redis/redis-ttl.constants';
import { PredictionService } from '../prediction/prediction.service';
import { resolveEffectiveTier } from '../school-list/school-list.constants';
import {
  CaseComparisonResult,
  PredictionHistoricalService,
} from '../prediction/prediction-historical.service';
import { LLMService } from '../ai-agent/core/llm.service';
import { extractJsonFromLlm } from '../../common/utils/llm-json.util';
import { formatHighSchoolContext } from '../ai-agent/tools/helpers/education-context.helper';
import { resolveSchoolTestingPolicyValue } from '@study-abroad/shared/utils';
import {
  AnalysisActionPlan,
  AnalysisApplicantType,
  AnalysisContextFlag,
  ApplicationAnalysisResponseV2,
  ExperimentalVersionSummary,
  FairnessDisclosure,
  AnalysisMeta,
  RecourseGuidance,
  SchoolPolicyContext,
  AnalysisProfileContext,
  AnalysisRecommendations,
  AnalysisState,
  DetailedProfileAnalysisResponse,
  PortfolioAnalysis,
  PortfolioBalance,
  SectionAnalysis,
  SectionStatus,
  StrategyUncertainty,
  TargetSchoolInsight,
  TargetSchoolPredictionSnapshot,
} from '../ai/ai.types';
import type { SubmitApplicationAnalysisFeedbackDto } from './dto';
import {
  buildApplicationAnalysisSystemPrompt,
  buildApplicationAnalysisUserPrompt,
} from './profile-application-analysis.prompts';
import {
  MAJOR_CATEGORY_PROGRAMS,
  classifyMajor,
} from '../prediction/prediction.constants';
import { ApplicationAnalysisWorkflowService } from './application-analysis-workflow.service';
import { ProfileApplicationAnalysisV2Service } from './profile-application-analysis-v2.service';

const DEFAULT_ANALYSIS_VERSION = 'application-analysis-v1';
const ANALYSIS_CACHE_TTL_SECONDS = REDIS_TTL.ANALYSIS_CACHE;
const MAX_FOCUS_SCHOOLS = 5;
const ANALYSIS_SCHOOL_SELECT = {
  id: true,
  name: true,
  nameZh: true,
  usNewsRank: true,
  acceptanceRate: true,
  sat25: true,
  sat75: true,
  satAvg: true,
  testingPolicy: true,
  testOptional: true,
  needBlindInternational: true,
  intlAcceptanceRate: true,
} satisfies Prisma.SchoolSelect;

type LoadedProfile = Prisma.ProfileGetPayload<{
  include: {
    testScores: { orderBy: { createdAt: 'desc' } };
    activities: {
      orderBy: { order: 'asc' };
      include: { activityTemplate: true };
    };
    awards: {
      orderBy: { order: 'asc' };
      include: { competition: true };
    };
    education: { include: { highSchool: true } };
    essays: true;
    semesterGpas: { orderBy: { order: 'asc' } };
  };
}>;

type LoadedSchoolListItem = Prisma.SchoolListItemGetPayload<{
  include: {
    school: { select: typeof ANALYSIS_SCHOOL_SELECT };
  };
}>;

type LoadedPrediction = Prisma.PredictionResultGetPayload<{
  select: {
    schoolId: true;
    probability: true;
    probabilityLow: true;
    probabilityHigh: true;
    tier: true;
    confidence: true;
    factors: true;
    suggestions: true;
    confidenceReason: true;
    applicationRound: true;
    updatedAt: true;
  };
}>;

type ApprovedPolicyEvidence = Prisma.SchoolPolicyEvidenceGetPayload<{
  select: {
    schoolId: true;
    policyDimension: true;
    policyValue: true;
    sourceName: true;
    sourceUrl: true;
    sourcePublishedAt: true;
    updatedAt: true;
  };
}>;

type SchoolEvidenceByDimension = Partial<
  Record<SchoolPolicyDimension, ApprovedPolicyEvidence>
>;
type SchoolEvidenceMap = Map<string, SchoolEvidenceByDimension>;
type RuntimeExperiment = {
  id: string;
  capability: 'RECOURSE' | 'UNCERTAINTY' | 'FAIRNESS';
  version: string;
  status: 'CANARY' | 'ACTIVE';
  updatedAt: Date;
  evaluationRuns: Array<{
    metrics?: Prisma.JsonValue | null;
  }>;
};

interface AnalysisSynthesisResponse {
  summary?: string;
  portfolioAnalysis?: {
    verdict?: string;
    reasons?: string[];
    riskBoundaries?: string[];
  };
  targetSchoolInsights?: Array<{
    schoolId?: string;
    whyThisIsHard?: string[];
    compensatingStrengths?: string[];
    topGaps?: string[];
    nextActions?: string[];
    historicalSignals?: string[];
    hardStopRisks?: string[];
  }>;
  actionPlan?: AnalysisActionPlan;
  recommendedPrograms?: AnalysisRecommendations;
}

interface AnalysisSynthesisResult {
  degraded: boolean;
  response: AnalysisSynthesisResponse | null;
}

@Injectable()
export class ProfileApplicationAnalysisService {
  private readonly logger = new Logger(ProfileApplicationAnalysisService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly predictionService: PredictionService,
    private readonly predictionHistoricalService: PredictionHistoricalService,
    private readonly llmService: LLMService,
    private readonly applicationAnalysisWorkflowService: ApplicationAnalysisWorkflowService,
    private readonly profileApplicationAnalysisV2Service: ProfileApplicationAnalysisV2Service,
  ) {}

  async getAnalysisForUser(
    userId: string,
    locale = 'zh',
    options?: {
      debug?: boolean;
      role?: string;
    },
  ): Promise<ApplicationAnalysisResponseV2 | DetailedProfileAnalysisResponse> {
    if (this.isV2Enabled()) {
      return this.profileApplicationAnalysisV2Service.getAnalysisForUser(
        userId,
        locale,
        {
          debug: Boolean(options?.debug),
        },
      );
    }

    return this.getLegacyAnalysisForUser(userId, locale);
  }

  private isV2Enabled(): boolean {
    return process.env.APPLICATION_ANALYSIS_V2_ENABLED !== 'false';
  }

  private async getLegacyAnalysisForUser(
    userId: string,
    locale = 'zh',
  ): Promise<DetailedProfileAnalysisResponse> {
    const cacheKey = await this.buildCacheKey(userId, locale);
    const cached =
      await this.redis.getJSON<DetailedProfileAnalysisResponse>(cacheKey);
    if (cached) {
      return { ...cached, status: 'cached' };
    }

    try {
      const analysis = await this.generateAnalysis(userId, locale);
      if (analysis.status !== 'degraded') {
        await this.redis.setJSON(
          cacheKey,
          analysis,
          ANALYSIS_CACHE_TTL_SECONDS,
        );
      }
      return analysis.status ? analysis : { ...analysis, status: 'fresh' };
    } catch (error) {
      this.logger.error(
        `Application analysis failed for user ${userId}: ${String(error instanceof Error ? error.message : error)}`,
      );
      return {
        ...this.buildInsufficientAnalysis(locale),
        meta: {
          ...this.buildBaseMeta('analysisError', 'insufficient', 0, 0, 0),
          generatedAt: new Date().toISOString(),
        },
        portfolioAnalysis: {
          strategyStatus: 'analysisError',
          balance: 'insufficient',
          verdict:
            locale === 'zh'
              ? '本次申请分析未能完成，请稍后重试。'
              : 'Application analysis could not be completed. Please try again shortly.',
          reasons: [],
          riskBoundaries: [],
          missingPredictionSchoolNames: [],
          missingRoundSchoolNames: [],
        },
        status: 'degraded',
      };
    }
  }

  private async buildCacheKey(userId: string, locale: string): Promise<string> {
    const [profile, schoolList, activePolicy, runtimeExperiments] =
      await Promise.all([
        this.prisma.profile.findUnique({
          where: { userId },
          select: { updatedAt: true },
        }),
        this.prisma.schoolListItem.aggregate({
          where: { userId },
          _count: { _all: true },
          _max: { updatedAt: true },
        }),
        this.applicationAnalysisWorkflowService.getActivePolicyVersion(),
        this.applicationAnalysisWorkflowService.getRuntimeExperiments(userId),
      ]);

    const profileStamp = profile?.updatedAt.getTime() ?? 0;
    const schoolListStamp = schoolList._max.updatedAt?.getTime() ?? 0;
    const schoolCount = schoolList._count._all ?? 0;
    const policyStamp = activePolicy?.updatedAt.getTime() ?? 0;
    const experimentStamp = runtimeExperiments
      .map(
        (item) =>
          `${item.capability}:${item.version}:${item.updatedAt.getTime()}`,
      )
      .sort()
      .join('|');

    return `ai:profile-analysis:${userId}:${locale}:${activePolicy?.analysisVersion ?? DEFAULT_ANALYSIS_VERSION}:${policyStamp}:${profileStamp}:${schoolListStamp}:${schoolCount}:${experimentStamp}`;
  }

  private async generateAnalysis(
    userId: string,
    locale: string,
  ): Promise<DetailedProfileAnalysisResponse> {
    const [profile, schoolListItems, activePolicy] = await Promise.all([
      this.loadProfile(userId),
      this.prisma.schoolListItem.findMany({
        where: { userId },
        include: { school: { select: ANALYSIS_SCHOOL_SELECT } },
      }),
      this.applicationAnalysisWorkflowService.getActivePolicyVersion(),
    ]);

    if (!profile) {
      const result = this.buildInsufficientAnalysis(locale);
      return {
        ...result,
        meta: {
          ...this.buildBaseMeta(
            'insufficientProfileData',
            'insufficient',
            0,
            0,
            0,
          ),
          generatedAt: new Date().toISOString(),
        },
      };
    }

    const focusSchools = this.selectFocusSchools(schoolListItems);
    const analysisVersion =
      activePolicy?.analysisVersion ?? DEFAULT_ANALYSIS_VERSION;
    const approvedEvidence =
      await this.applicationAnalysisWorkflowService.listApprovedEvidenceBySchool(
        focusSchools.map((item) => item.schoolId),
      );
    const evidenceMap = buildEvidenceMap(approvedEvidence);
    const staleSchoolIds = await this.resolveStaleFocusSchoolIds(
      profile,
      focusSchools,
    );

    if (staleSchoolIds.length > 0) {
      try {
        await this.predictionService.predictForApplicationAnalysis(
          profile.id,
          staleSchoolIds,
          locale,
        );
      } catch (error) {
        this.logger.warn(
          `Prediction refresh skipped for user ${userId}: ${String(error instanceof Error ? error.message : error)}`,
        );
      }
    }

    const [predictions, totalPredictions, recommendationLetterCount] =
      await Promise.all([
        this.loadPredictions(
          profile.id,
          focusSchools.map((item) => item.schoolId),
        ),
        schoolListItems.length
          ? this.prisma.predictionResult.count({
              where: {
                profileId: profile.id,
                schoolId: { in: schoolListItems.map((item) => item.schoolId) },
              },
            })
          : Promise.resolve(0),
        this.prisma.recommendationLetter.count({ where: { userId } }),
      ]);

    const predictionMap = new Map(
      predictions.map((prediction) => [prediction.schoolId, prediction]),
    );
    const historyResults = await Promise.all(
      focusSchools.map(async (item) => ({
        schoolId: item.schoolId,
        comparison: await this.predictionHistoricalService.getCaseComparison(
          item.schoolId,
          profile.nationality ?? undefined,
        ),
      })),
    );
    const historyMap = new Map(
      historyResults.map((entry) => [entry.schoolId, entry.comparison]),
    );

    const dataQuality = resolveDataQuality(profile, schoolListItems.length);
    const state = this.resolveAnalysisState(
      profile,
      schoolListItems,
      focusSchools,
      predictions,
      dataQuality,
    );

    const sections = buildLegacySections(profile, locale);
    const overallScore = resolveOverallScore(sections, state);
    const tier = resolveLegacyTier(overallScore);
    const profileContext = buildProfileContext(profile, locale);
    const deterministicPortfolio = buildPortfolioAnalysis(
      locale,
      state,
      schoolListItems,
      focusSchools,
      predictionMap,
    );
    const deterministicInsights =
      state === 'ready'
        ? focusSchools.map((item) =>
            buildTargetSchoolInsight(
              item,
              predictionMap.get(item.schoolId),
              historyMap.get(item.schoolId) ?? null,
              profile,
              locale,
              evidenceMap.get(item.schoolId),
            ),
          )
        : [];
    const fallbackRecommendations = buildFallbackRecommendations(
      profile,
      locale,
    );
    const fallbackActionPlan = buildFallbackActionPlan(
      profile,
      state,
      schoolListItems,
      deterministicInsights,
      locale,
    );

    const synthesisResult =
      state === 'ready' && focusSchools.length > 0
        ? await this.runSynthesis(
            {
              meta: {
                analysisVersion,
                state,
                dataQuality,
                targetSchoolCount: schoolListItems.length,
                focusSchoolCount: focusSchools.length,
                schoolsWithPredictions: totalPredictions,
                generatedAt: new Date().toISOString(),
              },
              governanceContext: activePolicy
                ? {
                    policyVersionId: activePolicy.id,
                    policyVersion: activePolicy.version,
                    promptVersion: activePolicy.promptVersion ?? undefined,
                    ruleBundleVersion:
                      activePolicy.ruleBundleVersion ?? undefined,
                  }
                : {
                    policyVersionId: 'v1-fallback',
                    policyVersion: DEFAULT_ANALYSIS_VERSION,
                  },
              profileContext,
              profileSnapshot: {
                gpa: toNumber(profile.gpa),
                gpaScale: toNumber(profile.gpaScale) ?? 4,
                testScores: profile.testScores.map((score) => ({
                  type: score.type,
                  score: score.score,
                })),
                activityCount: profile.activities.length,
                awardCount: profile.awards.length,
                essayCount: profile.essays.length,
                recommendationLetterCount,
              },
              portfolioAnalysis: deterministicPortfolio,
              targetSchoolInsights: deterministicInsights.map((item) => ({
                schoolId: item.schoolId,
                schoolName: item.schoolName,
                tier: item.tier,
                round: item.round,
                predictionSnapshot: item.predictionSnapshot,
                policyContext: item.policyContext,
                whyThisIsHard: item.whyThisIsHard,
                compensatingStrengths: item.compensatingStrengths,
                topGaps: item.topGaps,
                nextActions: item.nextActions,
                historicalSignals: item.historicalSignals,
                hardStopRisks: item.hardStopRisks,
              })),
            },
            focusSchools.map((item) => item.schoolId),
            locale,
          )
        : { degraded: false, response: null };

    if (synthesisResult.degraded) {
      return {
        sections,
        overallScore: resolveOverallScore(sections, 'analysisError'),
        tier: resolveLegacyTier(resolveOverallScore(sections, 'analysisError')),
        suggestions: fallbackRecommendations,
        summary:
          locale === 'zh'
            ? '学校级申请分析暂时不可用，本次先返回基础判断和下一步行动。'
            : 'School-level application analysis is temporarily unavailable, so this response falls back to foundational guidance and next steps.',
        meta: {
          ...this.buildBaseMeta(
            'analysisError',
            dataQuality,
            schoolListItems.length,
            focusSchools.length,
            totalPredictions,
            analysisVersion,
          ),
          generatedAt: new Date().toISOString(),
        },
        profileContext,
        portfolioAnalysis: {
          ...deterministicPortfolio,
          strategyStatus: 'analysisError',
          verdict:
            locale === 'zh'
              ? '本次学校级申请分析未能完成，请稍后重试。'
              : 'The school-level application analysis did not complete. Please retry shortly.',
          reasons: [
            locale === 'zh'
              ? '基础证据仍然保留，但顾问式综合归因本次生成失败。'
              : 'The base evidence is still available, but the consultant-style synthesis failed in this run.',
          ],
        },
        targetSchoolInsights: [],
        actionPlan: buildDegradedActionPlan(fallbackActionPlan, locale),
        recommendedPrograms: fallbackRecommendations,
        status: 'degraded',
      };
    }

    const synthesis = synthesisResult.response;

    const recommendedPrograms = mergeRecommendations(
      fallbackRecommendations,
      synthesis?.recommendedPrograms,
    );
    const actionPlan = mergeActionPlan(
      fallbackActionPlan,
      synthesis?.actionPlan,
    );
    const targetSchoolInsights = mergeTargetSchoolInsights(
      deterministicInsights,
      synthesis?.targetSchoolInsights,
    );
    const portfolioAnalysis = mergePortfolioAnalysis(
      deterministicPortfolio,
      synthesis?.portfolioAnalysis,
    );
    const runtimeExperiments =
      state === 'ready'
        ? await this.applicationAnalysisWorkflowService.getRuntimeExperiments(
            userId,
          )
        : [];
    const experimentSummaries = runtimeExperiments.map((experiment) => ({
      capability: experiment.capability,
      version: experiment.version,
      status: experiment.status,
    })) as ExperimentalVersionSummary[];
    const enrichedInsights = targetSchoolInsights.map((school) =>
      attachExperimentalGuidance(
        school,
        profileContext,
        locale,
        runtimeExperiments as RuntimeExperiment[],
      ),
    );
    const fairnessDisclosure =
      state === 'ready'
        ? buildFairnessDisclosure(
            runtimeExperiments as RuntimeExperiment[],
            locale,
          )
        : undefined;
    const exposureId =
      state === 'ready' && runtimeExperiments.length > 0
        ? await this.applicationAnalysisWorkflowService.recordRuntimeExposure({
            userId,
            profileId: profile.id,
            locale,
            analysisVersion,
            experiments: runtimeExperiments.map((experiment) => ({
              id: experiment.id,
              capability: experiment.capability,
              version: experiment.version,
              status: experiment.status as RuntimeExperiment['status'],
            })),
            focusSchools: enrichedInsights.map((school) => ({
              schoolId: school.schoolId,
              schoolName: school.schoolName,
              round: school.round,
              predictionSnapshot: school.predictionSnapshot,
              policyContext: school.policyContext as
                | Record<string, unknown>
                | undefined,
              recourseGuidance: school.recourseGuidance as
                | Record<string, unknown>
                | undefined,
              strategyUncertainty: school.strategyUncertainty as
                | Record<string, unknown>
                | undefined,
            })),
            fairnessDisclosure: fairnessDisclosure as
              | Record<string, unknown>
              | undefined,
          })
        : null;

    return {
      sections,
      overallScore,
      tier,
      suggestions: recommendedPrograms,
      summary:
        synthesis?.summary?.trim() ||
        buildSummary(profileContext, state, focusSchools.length, locale),
      meta: {
        ...this.buildBaseMeta(
          state,
          dataQuality,
          schoolListItems.length,
          focusSchools.length,
          totalPredictions,
          analysisVersion,
        ),
        generatedAt: new Date().toISOString(),
        exposureId: exposureId ?? undefined,
        experimentalVersions:
          experimentSummaries.length > 0 ? experimentSummaries : undefined,
      },
      profileContext,
      portfolioAnalysis,
      targetSchoolInsights: enrichedInsights,
      actionPlan,
      recommendedPrograms,
      fairnessDisclosure,
    };
  }

  async submitFeedback(
    userId: string,
    dto: SubmitApplicationAnalysisFeedbackDto,
  ) {
    return this.applicationAnalysisWorkflowService.submitApplicantFeedback(
      userId,
      {
        runId: dto.runId,
        exposureId: dto.exposureId,
        capability: dto.capability,
        sentiment: dto.sentiment,
        schoolId: dto.schoolId,
        category: dto.category,
        notes: dto.notes,
      },
    );
  }

  private async loadProfile(userId: string): Promise<LoadedProfile | null> {
    return this.prisma.profile.findUnique({
      where: { userId },
      include: {
        testScores: { orderBy: { createdAt: 'desc' } },
        activities: {
          orderBy: { order: 'asc' },
          include: { activityTemplate: true },
        },
        awards: {
          orderBy: { order: 'asc' },
          include: { competition: true },
        },
        education: { include: { highSchool: true } },
        essays: true,
        semesterGpas: { orderBy: { order: 'asc' } },
      },
    });
  }

  private selectFocusSchools(
    items: LoadedSchoolListItem[],
  ): LoadedSchoolListItem[] {
    return [...items]
      .sort((a, b) => {
        const roundRank = Number(Boolean(b.round)) - Number(Boolean(a.round));
        if (roundRank !== 0) return roundRank;

        const tierRank =
          resolveSchoolListTierRank(a.tier) - resolveSchoolListTierRank(b.tier);
        if (tierRank !== 0) return tierRank;

        return b.updatedAt.getTime() - a.updatedAt.getTime();
      })
      .slice(0, MAX_FOCUS_SCHOOLS);
  }

  private async resolveStaleFocusSchoolIds(
    profile: LoadedProfile,
    focusSchools: LoadedSchoolListItem[],
  ): Promise<string[]> {
    if (focusSchools.length === 0) return [];

    const existingPredictions = await this.loadPredictions(
      profile.id,
      focusSchools.map((item) => item.schoolId),
    );
    const predictionMap = new Map(
      existingPredictions.map((prediction) => [
        prediction.schoolId,
        prediction,
      ]),
    );

    return focusSchools
      .filter((item) => {
        const prediction = predictionMap.get(item.schoolId);
        if (!prediction) return true;
        if (prediction.updatedAt.getTime() < profile.updatedAt.getTime())
          return true;
        if (prediction.updatedAt.getTime() < item.updatedAt.getTime())
          return true;

        const requestedRound = normalizeRound(
          item.round ?? profile.applicationRound ?? undefined,
        );
        const predictionRound = normalizeRound(
          prediction.applicationRound ?? undefined,
        );
        return Boolean(requestedRound && requestedRound !== predictionRound);
      })
      .map((item) => item.schoolId);
  }

  private async loadPredictions(
    profileId: string,
    schoolIds: string[],
  ): Promise<LoadedPrediction[]> {
    if (schoolIds.length === 0) return [];

    return this.prisma.predictionResult.findMany({
      where: {
        profileId,
        schoolId: { in: schoolIds },
        authority: 'AUTHORITATIVE',
      },
      select: {
        schoolId: true,
        probability: true,
        probabilityLow: true,
        probabilityHigh: true,
        tier: true,
        confidence: true,
        factors: true,
        suggestions: true,
        confidenceReason: true,
        applicationRound: true,
        updatedAt: true,
      },
    });
  }

  private resolveAnalysisState(
    profile: LoadedProfile,
    schoolListItems: LoadedSchoolListItem[],
    focusSchools: LoadedSchoolListItem[],
    predictions: LoadedPrediction[],
    dataQuality: AnalysisMeta['dataQuality'],
  ): AnalysisState {
    if (!hasMinimumProfileEvidence(profile) || dataQuality === 'insufficient') {
      return 'insufficientProfileData';
    }
    if (schoolListItems.length === 0) {
      return 'noTargetSchools';
    }
    if (focusSchools.length > 0 && predictions.length === 0) {
      return 'noPredictions';
    }
    return 'ready';
  }

  private async runSynthesis(
    evidence: Record<string, unknown>,
    schoolIds: string[],
    locale: string,
  ): Promise<AnalysisSynthesisResult> {
    if (schoolIds.length === 0) {
      return { degraded: false, response: null };
    }

    try {
      const result = await this.llmService.chatSimpleGuarded(
        [
          {
            role: 'system',
            content: buildApplicationAnalysisSystemPrompt(locale),
          },
          {
            role: 'user',
            content: buildApplicationAnalysisUserPrompt(evidence, locale),
          },
        ],
        { temperature: 0.2, maxTokens: 3000 },
      );

      const parsed = extractJsonFromLlm<AnalysisSynthesisResponse>(result);
      return {
        degraded: false,
        response: validateSynthesis(parsed, schoolIds),
      };
    } catch (error) {
      this.logger.warn(
        `Application analysis synthesis failed: ${String(error instanceof Error ? error.message : error)}`,
      );
      return { degraded: true, response: null };
    }
  }

  private buildBaseMeta(
    state: AnalysisState,
    dataQuality: AnalysisMeta['dataQuality'],
    targetSchoolCount: number,
    focusSchoolCount: number,
    schoolsWithPredictions: number,
    analysisVersion = DEFAULT_ANALYSIS_VERSION,
  ): AnalysisMeta {
    return {
      analysisVersion,
      state,
      dataQuality,
      targetSchoolCount,
      focusSchoolCount,
      schoolsWithPredictions,
      generatedAt: new Date().toISOString(),
    };
  }

  private buildInsufficientAnalysis(
    locale: string,
  ): DetailedProfileAnalysisResponse {
    const isZh = locale === 'zh';
    const feedback = isZh
      ? '请先补充 GPA、标化、活动或奖项，再生成更完整的申请分析。'
      : 'Add GPA, testing, activities, or awards before generating a fuller application analysis.';
    const section = buildSection(
      'yellow',
      4,
      feedback,
      [],
      [isZh ? '先补齐基础档案信息' : 'Complete the core profile fields first'],
    );
    const recommendations = {
      majors: [],
      competitions: [],
      activities: [],
      summerPrograms: [],
      timeline: [
        isZh
          ? '先补齐基础档案和目标校清单。'
          : 'Complete the core profile and target-school list first.',
      ],
    };

    return {
      sections: {
        academic: section,
        testScores: section,
        activities: section,
        awards: section,
      },
      overallScore: 45,
      tier: 'other',
      suggestions: recommendations,
      summary: feedback,
      actionPlan: {
        now: recommendations.timeline,
        next90Days: [],
        beforeSubmission: [],
      },
      recommendedPrograms: recommendations,
      targetSchoolInsights: [],
      profileContext: {
        applicantType: 'unknown',
        contextFlags: [],
        testStrategy: 'unknown',
      },
      portfolioAnalysis: {
        strategyStatus: 'insufficientProfileData',
        balance: 'insufficient',
        verdict: feedback,
        reasons: [],
        riskBoundaries: [],
        missingPredictionSchoolNames: [],
        missingRoundSchoolNames: [],
      },
    };
  }
}

function resolveSchoolListTierRank(tier: SchoolTier): number {
  switch (tier) {
    case 'REACH':
      return 0;
    case 'TARGET':
      return 1;
    case 'SAFETY':
      return 2;
    default:
      return 3;
  }
}

function buildLegacySections(
  profile: LoadedProfile,
  locale: string,
): DetailedProfileAnalysisResponse['sections'] {
  const academicScore = resolveAcademicScore(profile);
  const testScore = resolveTestingScore(profile);
  const activityScore = resolveActivitiesScore(profile);
  const awardScore = resolveAwardsScore(profile);

  return {
    academic: buildSection(
      resolveStatus(academicScore),
      academicScore,
      buildAcademicFeedback(profile, locale),
      buildAcademicHighlights(profile, locale),
      buildAcademicImprovements(profile, locale),
    ),
    testScores: buildSection(
      resolveStatus(testScore),
      testScore,
      buildTestingFeedback(profile, locale),
      buildTestingHighlights(profile, locale),
      buildTestingImprovements(profile, locale),
    ),
    activities: buildSection(
      resolveStatus(activityScore),
      activityScore,
      buildActivitiesFeedback(profile, locale),
      buildActivitiesHighlights(profile, locale),
      buildActivitiesImprovements(profile, locale),
    ),
    awards: buildSection(
      resolveStatus(awardScore),
      awardScore,
      buildAwardsFeedback(profile, locale),
      buildAwardsHighlights(profile, locale),
      buildAwardsImprovements(profile, locale),
    ),
  };
}

function buildSection(
  status: SectionStatus,
  score: number,
  feedback: string,
  highlights: string[],
  improvements: string[],
): SectionAnalysis {
  return {
    status,
    score,
    feedback,
    highlights,
    improvements,
  };
}

function resolveStatus(score: number): SectionStatus {
  if (score >= 8) return 'green';
  if (score >= 5) return 'yellow';
  return 'red';
}

function resolveAcademicScore(profile: LoadedProfile): number {
  const rawGpa = resolvePrimaryGpa(profile);
  if (rawGpa == null) return 4;
  const gpa = normalizeGpaTo4Scale(rawGpa, toNumber(profile.gpaScale) ?? 4);
  if (gpa >= 3.9) return 9;
  if (gpa >= 3.8) return 8;
  if (gpa >= 3.65) return 7;
  if (gpa >= 3.45) return 6;
  if (gpa >= 3.2) return 5;
  return 4;
}

/** Normalize GPA from any scale to 4.0 scale for scoring. */
function normalizeGpaTo4Scale(gpa: number, scale: number): number {
  if (scale <= 0) return gpa;
  if (scale === 4 || scale === 4.0) return gpa;
  if (scale === 4.3) return (gpa / 4.3) * 4.0;
  if (scale === 5) return (gpa / 5) * 4.0;
  if (scale === 100)
    return gpa >= 95
      ? 3.95
      : gpa >= 90
        ? 3.8
        : gpa >= 85
          ? 3.6
          : gpa >= 80
            ? 3.4
            : gpa >= 75
              ? 3.0
              : 2.5;
  if (scale === 45) return (gpa / 45) * 4.0; // IB scale
  // Fallback: proportional mapping
  return (gpa / scale) * 4.0;
}

function resolveTestingScore(profile: LoadedProfile): number {
  const sat =
    profile.testScores.find((score) => score.type === 'SAT')?.score ?? null;
  const act =
    profile.testScores.find((score) => score.type === 'ACT')?.score ?? null;
  const toefl =
    profile.testScores.find((score) => score.type === 'TOEFL')?.score ?? null;

  if (sat != null) {
    if (sat >= 1550) return 9;
    if (sat >= 1490) return 8;
    if (sat >= 1430) return 7;
    if (sat >= 1360) return 6;
    return 5;
  }
  if (act != null) {
    if (act >= 35) return 9;
    if (act >= 33) return 8;
    if (act >= 31) return 7;
    if (act >= 29) return 6;
    return 5;
  }
  if (toefl != null) {
    if (toefl >= 110) return 7;
    if (toefl >= 100) return 6;
    return 5;
  }
  return 4;
}

function resolveActivitiesScore(profile: LoadedProfile): number {
  const count = profile.activities.length;
  const leadershipCount = profile.activities.filter((activity) =>
    /(president|founder|captain|lead|chair|director|主席|创始|队长|负责人)/i.test(
      activity.role,
    ),
  ).length;
  const highTierCount = profile.activities.filter(
    (activity) => (activity.activityTemplate?.tier ?? 5) <= 2,
  ).length;

  if (count >= 8 && leadershipCount >= 2 && highTierCount >= 1) return 9;
  if (count >= 6 && leadershipCount >= 1) return 8;
  if (count >= 4) return 7;
  if (count >= 2) return 5;
  return 4;
}

function resolveAwardsScore(profile: LoadedProfile): number {
  const count = profile.awards.length;
  const topAwards = profile.awards.filter((award) =>
    ['INTERNATIONAL', 'NATIONAL'].includes(String(award.level)),
  ).length;
  const regionalAwards = profile.awards.filter((award) =>
    ['STATE', 'REGIONAL'].includes(String(award.level)),
  ).length;

  if (topAwards >= 2) return 9;
  if (topAwards >= 1 || regionalAwards >= 2) return 8;
  if (count >= 2) return 6;
  if (count >= 1) return 5;
  return 4;
}

function resolveOverallScore(
  sections: DetailedProfileAnalysisResponse['sections'],
  state: AnalysisState,
): number {
  const weighted =
    sections.academic.score * 0.35 +
    sections.testScores.score * 0.2 +
    sections.activities.score * 0.25 +
    sections.awards.score * 0.2;
  const baseScore = Math.round(weighted * 10);

  if (state === 'ready') return baseScore;
  if (state === 'noTargetSchools' || state === 'noPredictions') {
    return Math.max(55, baseScore - 5);
  }
  if (state === 'insufficientProfileData') {
    return Math.min(baseScore, 55);
  }
  return Math.max(45, baseScore - 10);
}

function resolveLegacyTier(
  overallScore: number,
): DetailedProfileAnalysisResponse['tier'] {
  if (overallScore >= 90) return 'top10';
  if (overallScore >= 82) return 'top30';
  if (overallScore >= 72) return 'top50';
  if (overallScore >= 60) return 'top100';
  return 'other';
}

function buildProfileContext(
  profile: LoadedProfile,
  locale: string,
): AnalysisProfileContext {
  const isInternational = Boolean(
    profile.citizenship &&
    profile.countryOfResidence &&
    profile.citizenship !== 'US' &&
    profile.countryOfResidence !== 'US',
  );

  const contextFlags: AnalysisContextFlag[] = [];
  if (profile.needsFinancialAid) contextFlags.push('needAid');
  if (profile.firstGeneration) contextFlags.push('firstGeneration');
  if ((profile.legacy?.length ?? 0) > 0) contextFlags.push('legacy');
  if (profile.grade === 'GAP_YEAR') contextFlags.push('gapYear');
  if (hasCoreStandardizedTest(profile)) {
    contextFlags.push('testSubmit');
  } else {
    contextFlags.push('testOptional');
  }

  const highSchool = profile.education.find(
    (education) => education.schoolType === 'HIGH_SCHOOL',
  )?.highSchool;
  const educationEntries = profile.education.map((education) => ({
    school: education.schoolName,
    schoolType: education.schoolType,
    highSchoolId: education.highSchoolId,
  }));
  const highSchoolInfo = highSchool
    ? {
        name: highSchool.name,
        tier: highSchool.tier,
        type: highSchool.type,
        country: highSchool.country,
        state: highSchool.state,
      }
    : null;

  return {
    targetMajor: profile.targetMajor ?? undefined,
    intendedMajor: profile.intendedMajor ?? undefined,
    secondMajor: profile.secondMajor ?? undefined,
    applicantType: resolveApplicantType(isInternational, profile),
    contextFlags,
    grade: profile.grade ?? undefined,
    educationSystem: profile.educationSystem ?? undefined,
    nationality: profile.nationality ?? undefined,
    citizenship: profile.citizenship ?? undefined,
    countryOfResidence: profile.countryOfResidence ?? undefined,
    highSchoolContext:
      formatHighSchoolContext(educationEntries, highSchoolInfo, locale) ??
      undefined,
    testStrategy: hasCoreStandardizedTest(profile) ? 'submit' : 'testOptional',
  };
}

function resolveApplicantType(
  isInternational: boolean,
  profile: LoadedProfile,
): AnalysisApplicantType {
  if (isInternational) return 'international';
  if (profile.citizenship === 'US' || profile.countryOfResidence === 'US') {
    return 'domestic';
  }
  return 'unknown';
}

function buildPortfolioAnalysis(
  locale: string,
  state: AnalysisState,
  schoolListItems: LoadedSchoolListItem[],
  focusSchools: LoadedSchoolListItem[],
  predictionMap: Map<string, LoadedPrediction>,
): PortfolioAnalysis {
  const missingPredictionSchoolNames = focusSchools
    .filter((item) => !predictionMap.has(item.schoolId))
    .map((item) => item.school.nameZh || item.school.name);
  const missingRoundSchoolNames = schoolListItems
    .filter((item) => !item.round)
    .map((item) => item.school.nameZh || item.school.name)
    .slice(0, 5);
  const balance = resolvePortfolioBalance(schoolListItems, predictionMap);
  const isZh = locale === 'zh';

  if (state === 'noTargetSchools') {
    return {
      strategyStatus: state,
      balance: 'insufficient',
      verdict: isZh
        ? '你还没有目标校清单，当前分析只能停留在档案层面。'
        : 'You do not have a target-school list yet, so the analysis can only stay at profile level.',
      reasons: [
        isZh
          ? '先补 3-5 所目标校并绑定申请轮次，顾问分析才会有学校级判断。'
          : 'Add 3-5 target schools with rounds before expecting school-level strategy guidance.',
      ],
      riskBoundaries: [],
      missingPredictionSchoolNames,
      missingRoundSchoolNames,
    };
  }

  if (state === 'noPredictions') {
    return {
      strategyStatus: state,
      balance,
      verdict: isZh
        ? '学校清单已存在，但重点学校缺少最新预测，策略判断仍不完整。'
        : 'Your school list exists, but the focus schools are still missing fresh predictions.',
      reasons: [
        isZh
          ? '先补齐重点学校预测，再判断清单是否过冲或保守。'
          : 'Refresh the focus-school predictions before judging list balance with confidence.',
      ],
      riskBoundaries: [],
      missingPredictionSchoolNames,
      missingRoundSchoolNames,
    };
  }

  if (state === 'insufficientProfileData') {
    return {
      strategyStatus: state,
      balance: 'insufficient',
      verdict: isZh
        ? '当前基础档案还不足以支撑可信的学校级策略判断。'
        : 'The current profile is still too thin for a reliable school-level strategy view.',
      reasons: [
        isZh
          ? '先补齐核心背景，再看目标校和轮次是否合理。'
          : 'Complete the core evidence first before leaning on list strategy.',
      ],
      riskBoundaries: [],
      missingPredictionSchoolNames,
      missingRoundSchoolNames,
    };
  }

  const balanceLabel = isZh
    ? {
        balanced: '整体分布基本均衡。',
        reachHeavy: '清单偏冲刺，容错空间偏少。',
        safetyHeavy: '清单偏保守，可能存在 undermatch 风险。',
        undermatch: '当前清单偏稳，缺少足够上探学校。',
        insufficient: '学校清单数量还不足以判断分布。',
      }[balance]
    : {
        balanced: 'The overall list is reasonably balanced.',
        reachHeavy:
          'The list leans reach-heavy and leaves limited margin for error.',
        safetyHeavy:
          'The list leans conservative and may create undermatch risk.',
        undermatch: 'The list feels too safe and lacks enough upside schools.',
        insufficient: 'There are not enough schools yet to judge list balance.',
      }[balance];

  return {
    strategyStatus: state,
    balance,
    verdict: balanceLabel,
    reasons: [
      missingRoundSchoolNames.length
        ? isZh
          ? '部分学校尚未绑定轮次，round strategy 仍然不完整。'
          : 'Some schools still do not have an application round attached.'
        : isZh
          ? '重点学校已有可用预测，可以进入学校级差距分析。'
          : 'The focus schools have prediction coverage for school-level gap analysis.',
    ].filter(Boolean),
    riskBoundaries: [],
    missingPredictionSchoolNames,
    missingRoundSchoolNames,
  };
}

function resolvePortfolioBalance(
  schoolListItems: LoadedSchoolListItem[],
  predictionMap: Map<string, LoadedPrediction>,
): PortfolioBalance {
  if (schoolListItems.length < 3) return 'insufficient';

  // Count by EFFECTIVE tier (engine prediction wins for PREDICTED rows; MANUAL
  // wins; a PREDICTED row with no usable prediction is a stale TARGET placeholder
  // and is EXCLUDED). Uses the resolveEffectiveTier SSOT so this legacy v1 path
  // matches v2's resolveEffectiveTierCounts — closes the raw-`item.tier` recurrence
  // vector (#271 → #289 → #330) that otherwise let placeholders fake a balanced list.
  const counts = { REACH: 0, TARGET: 0, SAFETY: 0 } as Record<
    'REACH' | 'TARGET' | 'SAFETY',
    number
  >;
  for (const item of schoolListItems) {
    const predictionTier = predictionMap.get(item.schoolId)?.tier ?? null;
    const { tier, tierIsEstimated } = resolveEffectiveTier(
      item.tier,
      item.tierSource,
      predictionTier,
    );
    if (tierIsEstimated) continue; // stale PREDICTED placeholder — not a signal
    counts[tier] += 1;
  }

  if (counts.REACH >= counts.TARGET + counts.SAFETY) return 'reachHeavy';
  if (counts.SAFETY >= counts.REACH + counts.TARGET) return 'safetyHeavy';
  if (counts.REACH === 0 && counts.SAFETY >= counts.TARGET) return 'undermatch';
  return 'balanced';
}

function buildTargetSchoolInsight(
  item: LoadedSchoolListItem,
  prediction: LoadedPrediction | undefined,
  comparison: CaseComparisonResult | null,
  profile: LoadedProfile,
  locale: string,
  evidence?: SchoolEvidenceByDimension,
): TargetSchoolInsight {
  const schoolName = item.school.nameZh || item.school.name;
  const isZh = locale === 'zh';
  const factors = asPredictionFactors(prediction?.factors);
  const suggestions = asStringArray(prediction?.suggestions);
  const positiveFactors = factors.filter(
    (factor) => factor.impact === 'positive',
  );
  const negativeFactors = factors.filter(
    (factor) => factor.impact === 'negative',
  );

  const historicalSignals = buildHistoricalSignals(comparison, locale);
  const policyContext = buildSchoolPolicyContext(item, profile, evidence);
  const hardStopRisks = buildHardStopRisks(
    item,
    prediction,
    profile,
    policyContext,
    locale,
  );

  return {
    schoolId: item.schoolId,
    schoolName,
    tier: item.tier,
    round: item.round ?? profile.applicationRound ?? undefined,
    predictionSnapshot: prediction
      ? {
          probability: roundNumber(toNumber(prediction.probability) ?? 0, 4),
          probabilityLow: toOptionalRoundedNumber(prediction.probabilityLow, 4),
          probabilityHigh: toOptionalRoundedNumber(
            prediction.probabilityHigh,
            4,
          ),
          tier: normalizePredictionTier(prediction.tier),
          confidence: normalizeConfidence(prediction.confidence),
          updatedAt: prediction.updatedAt.toISOString(),
          roundContext: prediction.applicationRound ?? undefined,
          confidenceReason: prediction.confidenceReason ?? undefined,
        }
      : undefined,
    policyContext,
    whyThisIsHard:
      negativeFactors.map((factor) => factor.detail).slice(0, 3).length > 0
        ? negativeFactors.map((factor) => factor.detail).slice(0, 3)
        : [
            prediction
              ? isZh
                ? `${schoolName} 当前属于 ${formatPredictionTierLabel(prediction.tier, locale)}，需要把有限优势更集中地转化为申请卖点。`
                : `${schoolName} currently sits in your ${formatPredictionTierLabel(prediction.tier, locale)} bucket, so the margin for error is thin.`
              : isZh
                ? `${schoolName} 目前还缺少最新预测，无法给出更细的难点归因。`
                : `${schoolName} is still missing a fresh prediction, so the detailed difficulty profile is incomplete.`,
          ],
    compensatingStrengths:
      positiveFactors.map((factor) => factor.detail).slice(0, 3).length > 0
        ? positiveFactors.map((factor) => factor.detail).slice(0, 3)
        : [
            isZh
              ? '需要把现有最强学术或活动亮点集中成清晰叙事。'
              : 'You need to concentrate your strongest academic or activity evidence into a tighter story.',
          ],
    topGaps:
      suggestions.slice(0, 3).length > 0
        ? suggestions.slice(0, 3)
        : [
            isZh
              ? '需要补齐更明确的学校级差距证据。'
              : 'You still need clearer school-specific gap evidence.',
          ],
    nextActions: buildSchoolNextActions(item, prediction, suggestions, locale),
    historicalSignals,
    hardStopRisks,
  };
}

function buildHistoricalSignals(
  comparison: CaseComparisonResult | null,
  locale: string,
): string[] {
  const isZh = locale === 'zh';
  if (!comparison) {
    // No sufficient historical sample → emit no signals (the UI hides the whole
    // section) instead of surfacing a "not enough cases" caveat.
    return [];
  }

  const signals: string[] = [];
  if (comparison.admitted.gpaMedian != null) {
    signals.push(
      isZh
        ? `历史录取样本 GPA 中位数约为 ${comparison.admitted.gpaMedian.toFixed(2)}。`
        : `The admitted-case median GPA is about ${comparison.admitted.gpaMedian.toFixed(2)}.`,
    );
  }
  if (comparison.admitted.satMedian != null) {
    signals.push(
      isZh
        ? `历史录取样本 SAT 中位数约为 ${comparison.admitted.satMedian}。`
        : `The admitted-case median SAT is about ${comparison.admitted.satMedian}.`,
    );
  }
  if (comparison.nationalitySubset?.nationality) {
    signals.push(
      isZh
        ? `已纳入 ${comparison.nationalitySubset.nationality} 申请者子样本做对照。`
        : `A nationality-specific subset for ${comparison.nationalitySubset.nationality} is available.`,
    );
  }
  return signals.slice(0, 3);
}

function buildSchoolPolicyContext(
  item: LoadedSchoolListItem,
  profile: LoadedProfile,
  evidence?: SchoolEvidenceByDimension,
): SchoolPolicyContext {
  const testingFromEvidence = resolveEvidenceTestingPolicy(evidence);
  const intlAidFromEvidence = resolveEvidenceIntlAidPolicy(evidence);
  const roundFromEvidence = resolveEvidenceRoundContext(evidence);
  const testingPolicy = testingFromEvidence ?? resolveSchoolTestingPolicy(item);
  const intlAidPolicy = resolveSchoolIntlAidPolicy(
    item,
    profile,
    intlAidFromEvidence ?? undefined,
  );
  const roundContext =
    roundFromEvidence ?? resolveSchoolRoundContext(item, profile);

  return {
    testingPolicy,
    intlAidPolicy,
    roundContext,
    policySourceQuality: resolvePolicySourceQuality(
      {
        testing: Boolean(testingFromEvidence),
        intlAid: Boolean(intlAidFromEvidence),
        round: Boolean(roundFromEvidence),
      },
      testingPolicy,
      intlAidPolicy,
      roundContext,
    ),
  };
}

function resolveSchoolTestingPolicy(
  item: LoadedSchoolListItem,
): SchoolPolicyContext['testingPolicy'] {
  return resolveSchoolTestingPolicyValue({
    testingPolicy: item.school.testingPolicy,
    testOptional: item.school.testOptional,
  });
}

function resolveSchoolIntlAidPolicy(
  item: LoadedSchoolListItem,
  profile: LoadedProfile,
  evidencePolicy?: SchoolPolicyContext['intlAidPolicy'],
): SchoolPolicyContext['intlAidPolicy'] {
  const applicantType = resolveApplicantType(
    Boolean(
      profile.citizenship &&
      profile.countryOfResidence &&
      profile.citizenship !== 'US' &&
      profile.countryOfResidence !== 'US',
    ),
    profile,
  );

  if (applicantType !== 'international') {
    return 'UNKNOWN';
  }
  if (evidencePolicy) {
    return evidencePolicy;
  }
  if (item.school.needBlindInternational === true) {
    return 'NEED_BLIND';
  }
  if (item.school.needBlindInternational === false) {
    return 'NEED_AWARE';
  }
  return 'UNKNOWN';
}

function resolveSchoolRoundContext(
  item: LoadedSchoolListItem,
  profile: LoadedProfile,
): SchoolPolicyContext['roundContext'] {
  const normalized = normalizeRound(
    item.round ?? profile.applicationRound ?? undefined,
  );
  switch (normalized) {
    case 'ED':
    case 'ED2':
    case 'EA':
    case 'REA':
    case 'SCEA':
    case 'RD':
    case 'UC':
      return normalized;
    default:
      return item.school.testingPolicy === 'BLIND' ? 'UC' : 'UNKNOWN';
  }
}

function buildHardStopRisks(
  item: LoadedSchoolListItem,
  prediction: LoadedPrediction | undefined,
  profile: LoadedProfile,
  policyContext: SchoolPolicyContext,
  locale: string,
): string[] {
  const isZh = locale === 'zh';
  const risks: string[] = [];

  if (!item.round) {
    risks.push(
      isZh
        ? '该校尚未绑定申请轮次，任何 ED/EA/RD 策略判断都不稳定。'
        : 'This school still lacks an application round, so ED/EA/RD strategy is not stable yet.',
    );
  }
  if (!prediction) {
    risks.push(
      isZh
        ? '该校还没有最新预测，当前无法给出可靠的 school-level risk boundary。'
        : 'There is no fresh prediction for this school yet, so the risk boundary is incomplete.',
    );
  }
  if (
    !hasCoreStandardizedTest(profile) &&
    policyContext.testingPolicy === 'REQUIRED'
  ) {
    risks.push(
      isZh
        ? '该校并非 test-optional，缺少 SAT/ACT 会直接压缩竞争力。'
        : 'This school is not test-optional, so missing SAT/ACT directly compresses competitiveness.',
    );
  }
  if (
    profile.needsFinancialAid &&
    profile.citizenship &&
    profile.citizenship !== 'US' &&
    policyContext.intlAidPolicy === 'NEED_AWARE'
  ) {
    risks.push(
      isZh
        ? '国际生且需要资助，这会显著收紧该校的录取窗口。'
        : 'International aid need materially tightens the admit window at this school.',
    );
  }
  return risks.slice(0, 3);
}

function buildEvidenceMap(
  evidences: ApprovedPolicyEvidence[],
): SchoolEvidenceMap {
  const map: SchoolEvidenceMap = new Map();

  for (const evidence of evidences) {
    const existing = map.get(evidence.schoolId) ?? {};
    if (!existing[evidence.policyDimension]) {
      existing[evidence.policyDimension] = evidence;
      map.set(evidence.schoolId, existing);
    }
  }

  return map;
}

function normalizePolicyToken(value: string | undefined | null) {
  return value?.trim().toUpperCase() ?? null;
}

function resolveEvidenceTestingPolicy(
  evidence?: SchoolEvidenceByDimension,
): SchoolPolicyContext['testingPolicy'] | null {
  const token = normalizePolicyToken(evidence?.TESTING?.policyValue);
  switch (token) {
    case 'REQUIRED':
    case 'OPTIONAL':
    case 'BLIND':
      return token;
    default:
      return null;
  }
}

function resolveEvidenceIntlAidPolicy(
  evidence?: SchoolEvidenceByDimension,
): SchoolPolicyContext['intlAidPolicy'] | null {
  const token = normalizePolicyToken(evidence?.INTL_AID?.policyValue);
  switch (token) {
    case 'NEED_BLIND':
    case 'NEED_AWARE':
      return token;
    default:
      return null;
  }
}

function resolveEvidenceRoundContext(
  evidence?: SchoolEvidenceByDimension,
): SchoolPolicyContext['roundContext'] | null {
  const token = normalizePolicyToken(evidence?.ROUND?.policyValue);
  switch (token) {
    case 'ED':
    case 'ED2':
    case 'EA':
    case 'REA':
    case 'RD':
    case 'UC':
      return token;
    default:
      return null;
  }
}

function resolvePolicySourceQuality(
  reviewed: {
    testing: boolean;
    intlAid: boolean;
    round: boolean;
  },
  testingPolicy: SchoolPolicyContext['testingPolicy'],
  intlAidPolicy: SchoolPolicyContext['intlAidPolicy'],
  roundContext: SchoolPolicyContext['roundContext'],
): SchoolPolicyContext['policySourceQuality'] {
  if (reviewed.testing || reviewed.intlAid || reviewed.round) {
    return 'REVIEWED';
  }
  if (
    testingPolicy !== 'UNKNOWN' ||
    intlAidPolicy !== 'UNKNOWN' ||
    roundContext !== 'UNKNOWN'
  ) {
    return 'DERIVED';
  }
  return 'UNKNOWN';
}

function buildSchoolNextActions(
  item: LoadedSchoolListItem,
  prediction: LoadedPrediction | undefined,
  suggestions: string[],
  locale: string,
): string[] {
  const isZh = locale === 'zh';
  const actions = suggestions.slice(0, 3);

  if (!item.round) {
    actions.unshift(
      isZh
        ? '先确定该校轮次，再判断是否值得押 ED/EA。'
        : 'Set the round first before deciding whether this school deserves ED/EA priority.',
    );
  }

  if (!prediction) {
    actions.unshift(
      isZh
        ? '先刷新该校预测，再看是否保留在重点学校池。'
        : 'Refresh the prediction first before deciding whether this remains a focus school.',
    );
  }

  return actions.slice(0, 4);
}

function buildFallbackRecommendations(
  profile: LoadedProfile,
  locale: string,
): AnalysisRecommendations {
  const isZh = locale === 'zh';
  const major =
    profile.intendedMajor || profile.targetMajor || profile.secondMajor || '';
  const majorCategory = major ? classifyMajor(major) : null;
  const programEntries = majorCategory
    ? (MAJOR_CATEGORY_PROGRAMS[majorCategory] ?? {
        summer: [],
        competition: [],
      })
    : { summer: [], competition: [] };

  return {
    majors: [major, profile.secondMajor].filter((value): value is string =>
      Boolean(value),
    ),
    competitions: programEntries.competition
      .map((entry) => entry.name)
      .slice(0, 3),
    activities: [
      isZh
        ? `围绕 ${major || '目标专业'} 做一个能被学校直接理解的长期项目。`
        : `Build one sustained, school-readable project around ${major || 'your intended major'}.`,
    ],
    summerPrograms: programEntries.summer
      .map((entry) => entry.name)
      .slice(0, 3),
    timeline: [
      isZh
        ? '先围绕目标专业统一活动、奖项和文书叙事。'
        : 'Tighten activities, awards, and essays around one coherent academic story first.',
      isZh
        ? '在下一次学校清单复盘前，先补齐重点学校预测与轮次。'
        : 'Refresh focus-school predictions and rounds before the next list review.',
    ],
  };
}

function buildFallbackActionPlan(
  profile: LoadedProfile,
  state: AnalysisState,
  schoolListItems: LoadedSchoolListItem[],
  insights: TargetSchoolInsight[],
  locale: string,
): AnalysisActionPlan {
  const isZh = locale === 'zh';
  const focusActions = insights.flatMap((item) => item.nextActions).slice(0, 3);

  if (state === 'noTargetSchools') {
    return {
      now: [
        isZh
          ? '先补 3-5 所目标校，并为每所学校绑定初始申请轮次。'
          : 'Add 3-5 target schools and attach an initial application round to each.',
      ],
      next90Days: [
        isZh
          ? '补齐目标专业相关活动与奖项，再重新跑学校级预测。'
          : 'Add major-aligned activities and awards, then rerun school-level predictions.',
      ],
      beforeSubmission: [
        isZh
          ? '在提交前复盘 reach/target/safety 是否仍然均衡。'
          : 'Re-check whether the reach/target/safety mix is still balanced before submission.',
      ],
    };
  }

  return {
    now: [
      ...focusActions,
      !hasCoreStandardizedTest(profile)
        ? isZh
          ? '尽快明确 test-submit 还是 test-optional 策略。'
          : 'Decide quickly whether you are pursuing a test-submit or test-optional strategy.'
        : isZh
          ? '整理一版面向重点学校的主叙事与补充材料清单。'
          : 'Draft one coherent main narrative and supporting-material checklist for the focus schools.',
    ].slice(0, 4),
    next90Days: [
      schoolListItems.some((item) => !item.round)
        ? isZh
          ? '补齐所有重点学校轮次，并把 ED/EA 资源优先级固定下来。'
          : 'Attach rounds to all focus schools and lock the ED/EA resource priority.'
        : isZh
          ? '围绕重点学校的最大短板安排 1-2 个可验证成果。'
          : 'Create 1-2 verifiable wins that directly address the biggest school-level gaps.',
      isZh
        ? '尽早启动文书和推荐信 positioning，避免最后阶段只剩包装空间。'
        : 'Start essay and recommendation-letter positioning early so the final weeks are not just packaging.',
    ],
    beforeSubmission: [
      isZh
        ? '提交前再次核对每所重点学校的概率、置信度与 round 是否仍然匹配。'
        : 'Before submission, re-check each focus school’s probability, confidence, and round alignment.',
      isZh
        ? '把不可逆风险写清楚，避免在结果阶段误判为“运气不好”。'
        : 'Write down the irreversible risks clearly so they are not mistaken for bad luck later.',
    ],
  };
}

function buildDegradedActionPlan(
  fallback: AnalysisActionPlan,
  locale: string,
): AnalysisActionPlan {
  const isZh = locale === 'zh';

  return {
    now: dedupeStrings([
      isZh
        ? '稍后重试学校级申请分析，并确认最新预测是否已经刷新。'
        : 'Retry the school-level application analysis shortly and confirm the latest predictions have refreshed.',
      ...fallback.now,
    ]).slice(0, 5),
    next90Days: fallback.next90Days,
    beforeSubmission: fallback.beforeSubmission,
  };
}

function buildSummary(
  profileContext: AnalysisProfileContext,
  state: AnalysisState,
  focusSchoolCount: number,
  locale: string,
): string {
  const isZh = locale === 'zh';
  const major = profileContext.intendedMajor || profileContext.targetMajor;

  if (state === 'noTargetSchools') {
    return isZh
      ? `当前档案已具备初步分析基础，但还缺少目标校清单，因此只能停留在${major ?? '档案'}层面的竞争力判断。`
      : `Your profile is ready for an initial review, but without a target-school list the analysis can only stay at the ${major ?? 'profile'} level.`;
  }

  if (state === 'noPredictions') {
    return isZh
      ? `你已经有目标校清单，但重点学校还缺少最新预测，因此当前策略判断仍有盲区。`
      : `You already have a target-school list, but the focus schools still lack fresh predictions, so the strategy view still has blind spots.`;
  }

  if (state === 'insufficientProfileData') {
    return isZh
      ? '当前档案信息还不足以支撑可信的学校级分析，建议先补齐核心背景。'
      : 'The current profile is still too thin for a reliable school-level analysis, so the core evidence should be completed first.';
  }

  return isZh
    ? `本次分析已覆盖 ${focusSchoolCount} 所重点学校，并结合档案证据、预测结果和历史案例给出申请策略判断。`
    : `This analysis covers ${focusSchoolCount} focus schools and combines profile evidence, prediction output, and historical cases into a strategy view.`;
}

function mergeRecommendations(
  fallback: AnalysisRecommendations,
  synthesis?: AnalysisRecommendations | null,
): AnalysisRecommendations {
  return {
    majors: dedupeStrings([
      ...safeStrings(synthesis?.majors),
      ...fallback.majors,
    ]).slice(0, 4),
    competitions: dedupeStrings([
      ...safeStrings(synthesis?.competitions),
      ...fallback.competitions,
    ]).slice(0, 5),
    activities: dedupeStrings([
      ...safeStrings(synthesis?.activities),
      ...fallback.activities,
    ]).slice(0, 5),
    summerPrograms: dedupeStrings([
      ...safeStrings(synthesis?.summerPrograms),
      ...fallback.summerPrograms,
    ]).slice(0, 5),
    timeline: dedupeStrings([
      ...safeStrings(synthesis?.timeline),
      ...fallback.timeline,
    ]).slice(0, 5),
  };
}

function mergeActionPlan(
  fallback: AnalysisActionPlan,
  synthesis?: AnalysisActionPlan | null,
): AnalysisActionPlan {
  return {
    now: dedupeStrings([...safeStrings(synthesis?.now), ...fallback.now]).slice(
      0,
      5,
    ),
    next90Days: dedupeStrings([
      ...safeStrings(synthesis?.next90Days),
      ...fallback.next90Days,
    ]).slice(0, 5),
    beforeSubmission: dedupeStrings([
      ...safeStrings(synthesis?.beforeSubmission),
      ...fallback.beforeSubmission,
    ]).slice(0, 5),
  };
}

function mergeTargetSchoolInsights(
  fallback: TargetSchoolInsight[],
  synthesis?: AnalysisSynthesisResponse['targetSchoolInsights'],
): TargetSchoolInsight[] {
  const synthesisMap = new Map(
    (synthesis ?? [])
      .filter((item) => item.schoolId)
      .map((item) => [item.schoolId as string, item]),
  );

  return fallback.map((item) => {
    const llm = synthesisMap.get(item.schoolId);
    if (!llm) return item;

    return {
      ...item,
      whyThisIsHard: dedupeStrings([
        ...safeStrings(llm.whyThisIsHard),
        ...item.whyThisIsHard,
      ]).slice(0, 4),
      compensatingStrengths: dedupeStrings([
        ...safeStrings(llm.compensatingStrengths),
        ...item.compensatingStrengths,
      ]).slice(0, 4),
      topGaps: dedupeStrings([
        ...safeStrings(llm.topGaps),
        ...item.topGaps,
      ]).slice(0, 4),
      nextActions: dedupeStrings([
        ...safeStrings(llm.nextActions),
        ...item.nextActions,
      ]).slice(0, 4),
      historicalSignals: dedupeStrings([
        ...safeStrings(llm.historicalSignals),
        ...item.historicalSignals,
      ]).slice(0, 4),
      hardStopRisks: dedupeStrings([
        ...safeStrings(llm.hardStopRisks),
        ...(item.hardStopRisks ?? []),
      ]).slice(0, 4),
    };
  });
}

function mergePortfolioAnalysis(
  fallback: PortfolioAnalysis,
  synthesis?: AnalysisSynthesisResponse['portfolioAnalysis'],
): PortfolioAnalysis {
  return {
    ...fallback,
    verdict: synthesis?.verdict?.trim() || fallback.verdict,
    reasons: dedupeStrings([
      ...safeStrings(synthesis?.reasons),
      ...fallback.reasons,
    ]).slice(0, 4),
    riskBoundaries: dedupeStrings([
      ...safeStrings(synthesis?.riskBoundaries),
      ...fallback.riskBoundaries,
    ]).slice(0, 4),
  };
}

function validateSynthesis(
  data: AnalysisSynthesisResponse | null | undefined,
  schoolIds: string[],
): AnalysisSynthesisResponse | null {
  if (!data || typeof data !== 'object') return null;

  const allowedIds = new Set(schoolIds);

  return {
    summary: typeof data.summary === 'string' ? data.summary.trim() : undefined,
    portfolioAnalysis: data.portfolioAnalysis
      ? {
          verdict:
            typeof data.portfolioAnalysis.verdict === 'string'
              ? data.portfolioAnalysis.verdict.trim()
              : undefined,
          reasons: safeStrings(data.portfolioAnalysis.reasons).slice(0, 4),
          riskBoundaries: safeStrings(
            data.portfolioAnalysis.riskBoundaries,
          ).slice(0, 4),
        }
      : undefined,
    targetSchoolInsights: Array.isArray(data.targetSchoolInsights)
      ? data.targetSchoolInsights
          .filter((item) => item.schoolId && allowedIds.has(item.schoolId))
          .map((item) => ({
            schoolId: item.schoolId,
            whyThisIsHard: safeStrings(item.whyThisIsHard).slice(0, 4),
            compensatingStrengths: safeStrings(
              item.compensatingStrengths,
            ).slice(0, 4),
            topGaps: safeStrings(item.topGaps).slice(0, 4),
            nextActions: safeStrings(item.nextActions).slice(0, 4),
            historicalSignals: safeStrings(item.historicalSignals).slice(0, 4),
            hardStopRisks: safeStrings(item.hardStopRisks).slice(0, 4),
          }))
      : undefined,
    actionPlan: data.actionPlan
      ? {
          now: safeStrings(data.actionPlan.now).slice(0, 5),
          next90Days: safeStrings(data.actionPlan.next90Days).slice(0, 5),
          beforeSubmission: safeStrings(data.actionPlan.beforeSubmission).slice(
            0,
            5,
          ),
        }
      : undefined,
    recommendedPrograms: data.recommendedPrograms
      ? {
          majors: safeStrings(data.recommendedPrograms.majors).slice(0, 4),
          competitions: safeStrings(
            data.recommendedPrograms.competitions,
          ).slice(0, 5),
          activities: safeStrings(data.recommendedPrograms.activities).slice(
            0,
            5,
          ),
          summerPrograms: safeStrings(
            data.recommendedPrograms.summerPrograms,
          ).slice(0, 5),
          timeline: safeStrings(data.recommendedPrograms.timeline).slice(0, 5),
        }
      : undefined,
  };
}

function resolveDataQuality(
  profile: LoadedProfile,
  targetSchoolCount: number,
): AnalysisMeta['dataQuality'] {
  let score = 0;
  if (resolvePrimaryGpa(profile) != null) score += 25;
  if (profile.testScores.length > 0) score += 15;
  if (profile.activities.length > 0) score += 20;
  if (profile.awards.length > 0) score += 15;
  if (profile.targetMajor || profile.intendedMajor) score += 10;
  if (profile.education.length > 0) score += 10;
  if (targetSchoolCount > 0) score += 5;

  if (score >= 80) return 'high';
  if (score >= 55) return 'medium';
  if (score >= 35) return 'low';
  return 'insufficient';
}

function hasMinimumProfileEvidence(profile: LoadedProfile): boolean {
  return Boolean(
    resolvePrimaryGpa(profile) != null ||
    profile.testScores.length > 0 ||
    profile.activities.length > 0 ||
    profile.awards.length > 0,
  );
}

function resolvePrimaryGpa(profile: LoadedProfile): number | null {
  const profileGpa = toNumber(profile.gpa);
  if (profileGpa != null) return profileGpa;

  const semesterGpas = profile.semesterGpas
    .map((semester) => toNumber(semester.gpa))
    .filter((value): value is number => value != null);
  if (semesterGpas.length === 0) return null;

  return roundNumber(
    semesterGpas.reduce((sum, value) => sum + value, 0) / semesterGpas.length,
    2,
  );
}

function hasCoreStandardizedTest(profile: LoadedProfile): boolean {
  return profile.testScores.some((score) =>
    ['SAT', 'ACT'].includes(score.type),
  );
}

function buildAcademicFeedback(profile: LoadedProfile, locale: string): string {
  const gpa = resolvePrimaryGpa(profile);
  if (locale === 'zh') {
    return gpa != null
      ? `当前学术主线以 GPA ${gpa.toFixed(2)} 为核心，接下来更重要的是证明课程强度与稳定性。`
      : '当前缺少稳定的 GPA 证据，学校级判断会明显受限。';
  }
  return gpa != null
    ? `Your academic case is currently anchored by a GPA around ${gpa.toFixed(2)}; the next question is whether the rigor and consistency are equally clear.`
    : 'Your academic profile is still missing a stable GPA anchor, which materially limits school-level judgment.';
}

function buildAcademicHighlights(
  profile: LoadedProfile,
  locale: string,
): string[] {
  const isZh = locale === 'zh';
  const gpa = resolvePrimaryGpa(profile);
  const highlights: string[] = [];
  if (gpa != null && gpa >= 3.8) {
    highlights.push(
      isZh
        ? '当前 GPA 处于较强区间。'
        : 'Your current GPA is in a strong range.',
    );
  }
  const highSchool = profile.education.find(
    (education) => education.schoolType === 'HIGH_SCHOOL',
  )?.highSchool;
  if (highSchool?.tier != null) {
    highlights.push(
      isZh
        ? `已记录高中背景，可用于解释成绩语境。`
        : 'High-school context is available and can help calibrate the transcript story.',
    );
  }
  return highlights.slice(0, 3);
}

function buildAcademicImprovements(
  profile: LoadedProfile,
  locale: string,
): string[] {
  const isZh = locale === 'zh';
  const improvements: string[] = [];
  if (resolvePrimaryGpa(profile) == null) {
    improvements.push(
      isZh ? '补齐 GPA 或阶段成绩。' : 'Add GPA or term-by-term grades.',
    );
  }
  if (
    !profile.education.some(
      (education) => education.schoolType === 'HIGH_SCHOOL',
    )
  ) {
    improvements.push(
      isZh
        ? '补齐高中背景，便于解释课程强度与学校语境。'
        : 'Add high-school context so rigor can be interpreted correctly.',
    );
  }
  return improvements.slice(0, 3);
}

function buildTestingFeedback(profile: LoadedProfile, locale: string): string {
  const sat =
    profile.testScores.find((score) => score.type === 'SAT')?.score ?? null;
  const act =
    profile.testScores.find((score) => score.type === 'ACT')?.score ?? null;
  if (locale === 'zh') {
    if (sat != null || act != null) {
      return `当前标化策略以 ${sat != null ? `SAT ${sat}` : `ACT ${act}`} 为主，重点在于是否值得作为学校级加分项提交。`;
    }
    return '当前没有 SAT/ACT，后续需要尽快明确 test-submit 还是 test-optional。';
  }
  if (sat != null || act != null) {
    return `Your testing strategy is currently anchored by ${sat != null ? `SAT ${sat}` : `ACT ${act}`}; the key question is where it is worth submitting as an advantage.`;
  }
  return 'You do not currently have SAT/ACT on file, so test-submit versus test-optional needs to become an explicit strategy choice.';
}

function buildTestingHighlights(
  profile: LoadedProfile,
  locale: string,
): string[] {
  const isZh = locale === 'zh';
  const highlights: string[] = [];
  const sat =
    profile.testScores.find((score) => score.type === 'SAT')?.score ?? null;
  const act =
    profile.testScores.find((score) => score.type === 'ACT')?.score ?? null;
  if (sat != null && sat >= 1490) {
    highlights.push(
      isZh ? 'SAT 已达到较强区间。' : 'SAT is already in a strong range.',
    );
  }
  if (act != null && act >= 33) {
    highlights.push(
      isZh ? 'ACT 已达到较强区间。' : 'ACT is already in a strong range.',
    );
  }
  return highlights.slice(0, 3);
}

function buildTestingImprovements(
  profile: LoadedProfile,
  locale: string,
): string[] {
  const isZh = locale === 'zh';
  if (hasCoreStandardizedTest(profile)) return [];
  return [
    isZh
      ? '先按目标校逐所判断是否真的适合 test-optional。'
      : 'Make a school-by-school decision before defaulting to test-optional.',
  ];
}

function buildActivitiesFeedback(
  profile: LoadedProfile,
  locale: string,
): string {
  const isZh = locale === 'zh';
  if (profile.activities.length >= 6) {
    return isZh
      ? '活动数量已足够，接下来关键在于把少数高价值活动打磨成主卖点。'
      : 'You have enough activity volume; the next step is turning a few high-value activities into core selling points.';
  }
  return isZh
    ? '当前活动仍偏薄，需要强化深度、影响力和专业相关性。'
    : 'The activity profile is still thin and needs more depth, impact, and major alignment.';
}

function buildActivitiesHighlights(
  profile: LoadedProfile,
  locale: string,
): string[] {
  const isZh = locale === 'zh';
  const leadershipCount = profile.activities.filter((activity) =>
    /(president|founder|captain|lead|chair|director|主席|创始|队长|负责人)/i.test(
      activity.role,
    ),
  ).length;
  const highlights: string[] = [];
  if (leadershipCount > 0) {
    highlights.push(
      isZh
        ? `已有 ${leadershipCount} 项领导力经历。`
        : `${leadershipCount} leadership experiences are already visible.`,
    );
  }
  if (
    profile.activities.some(
      (activity) => (activity.activityTemplate?.tier ?? 5) <= 2,
    )
  ) {
    highlights.push(
      isZh
        ? '已有高信号活动模板匹配。'
        : 'At least one high-signal activity template is already present.',
    );
  }
  return highlights.slice(0, 3);
}

function buildActivitiesImprovements(
  profile: LoadedProfile,
  locale: string,
): string[] {
  const isZh = locale === 'zh';
  const improvements: string[] = [];
  if (profile.activities.length < 4) {
    improvements.push(
      isZh
        ? '增加与目标专业强相关的长期项目。'
        : 'Add one or two sustained activities tied closely to your intended major.',
    );
  }
  if (
    !profile.activities.some((activity) =>
      /(president|founder|captain|lead|chair|director|主席|创始|队长|负责人)/i.test(
        activity.role,
      ),
    )
  ) {
    improvements.push(
      isZh
        ? '补出可以证明 ownership 的角色或成果。'
        : 'Add clearer ownership signals such as leadership, founding, or a concrete outcome.',
    );
  }
  return improvements.slice(0, 3);
}

function buildAwardsFeedback(profile: LoadedProfile, locale: string): string {
  const isZh = locale === 'zh';
  if (profile.awards.length >= 2) {
    return isZh
      ? '奖项已经能提供一定外部验证，下一步是提升与专业叙事的相关性。'
      : 'Your awards already provide some external validation; the next step is making them support the major narrative more directly.';
  }
  return isZh
    ? '奖项外部验证仍偏弱，建议尽量补上更具辨识度的成果。'
    : 'External validation through awards is still light, so more distinctive outcomes would help.';
}

function buildAwardsHighlights(
  profile: LoadedProfile,
  locale: string,
): string[] {
  const isZh = locale === 'zh';
  const topAwards = profile.awards.filter((award) =>
    ['INTERNATIONAL', 'NATIONAL'].includes(String(award.level)),
  ).length;
  if (topAwards === 0) return [];
  return [
    isZh
      ? `已有 ${topAwards} 项较高等级奖项。`
      : `${topAwards} higher-signal awards are already on file.`,
  ];
}

function buildAwardsImprovements(
  profile: LoadedProfile,
  locale: string,
): string[] {
  const isZh = locale === 'zh';
  if (profile.awards.length > 0) return [];
  return [
    isZh
      ? '尽量补一项能被外部验证的竞赛、研究或项目成果。'
      : 'Add at least one externally verifiable outcome such as a competition, research result, or published project.',
  ];
}

function asPredictionFactors(value: unknown): Array<{
  name: string;
  impact: 'positive' | 'negative' | 'neutral';
  detail: string;
}> {
  if (!Array.isArray(value)) return [];
  return value
    .map((factor) => {
      if (!factor || typeof factor !== 'object') return null;
      const candidate = factor as Record<string, unknown>;
      if (
        typeof candidate.detail !== 'string' ||
        typeof candidate.name !== 'string'
      ) {
        return null;
      }
      const impact =
        candidate.impact === 'positive' ||
        candidate.impact === 'negative' ||
        candidate.impact === 'neutral'
          ? candidate.impact
          : 'neutral';
      return {
        name: candidate.name,
        impact,
        detail: candidate.detail,
      };
    })
    .filter(
      (
        factor,
      ): factor is {
        name: string;
        impact: 'positive' | 'negative' | 'neutral';
        detail: string;
      } => Boolean(factor),
    );
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (item): item is string =>
      typeof item === 'string' && item.trim().length > 0,
  );
}

function safeStrings(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (item): item is string =>
      typeof item === 'string' && item.trim().length > 0,
  );
}

function dedupeStrings(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function toNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (value == null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function toOptionalRoundedNumber(
  value: unknown,
  digits: number,
): number | undefined {
  const numeric = toNumber(value);
  return numeric == null ? undefined : roundNumber(numeric, digits);
}

function roundNumber(value: number, digits: number): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function normalizePredictionTier(
  tier: string | null | undefined,
): TargetSchoolPredictionSnapshot['tier'] | undefined {
  if (tier === 'reach' || tier === 'match' || tier === 'safety') return tier;
  return undefined;
}

function normalizeConfidence(
  confidence: string | null | undefined,
): TargetSchoolPredictionSnapshot['confidence'] | undefined {
  if (
    confidence === 'low' ||
    confidence === 'medium' ||
    confidence === 'high'
  ) {
    return confidence;
  }
  return undefined;
}

function normalizeRound(round: string | undefined): string | undefined {
  return round?.trim().toUpperCase() || undefined;
}

function formatPredictionTierLabel(
  tier: string | null | undefined,
  locale: string,
): string {
  const isZh = locale === 'zh';
  switch (tier) {
    case 'reach':
      return isZh ? '冲刺区间' : 'reach range';
    case 'match':
      return isZh ? '匹配区间' : 'match range';
    case 'safety':
      return isZh ? '保底区间' : 'safety range';
    default:
      return isZh ? '未知区间' : 'unknown range';
  }
}

function attachExperimentalGuidance(
  school: TargetSchoolInsight,
  profileContext: AnalysisProfileContext,
  locale: string,
  runtimeExperiments: RuntimeExperiment[],
): TargetSchoolInsight {
  const recourseExperiment = runtimeExperiments.find(
    (item) => item.capability === 'RECOURSE',
  );
  const uncertaintyExperiment = runtimeExperiments.find(
    (item) => item.capability === 'UNCERTAINTY',
  );

  return {
    ...school,
    recourseGuidance: recourseExperiment
      ? buildRecourseGuidance(school, profileContext, locale)
      : undefined,
    strategyUncertainty: uncertaintyExperiment
      ? buildStrategyUncertainty(school, locale, uncertaintyExperiment)
      : undefined,
  };
}

function buildRecourseGuidance(
  school: TargetSchoolInsight,
  profileContext: AnalysisProfileContext,
  locale: string,
): RecourseGuidance {
  const isZh = locale === 'zh';
  const recommendedChanges: RecourseGuidance['recommendedChanges'] = [];

  if (school.round == null) {
    recommendedChanges.push({
      action: isZh
        ? '先明确该校申请轮次，再重新生成分析。'
        : 'Lock the application round for this school before re-running analysis.',
      rationale: isZh
        ? '轮次会直接改变这所学校的风险边界和下一步动作。'
        : 'Round choice directly changes the risk boundary and the next best actions.',
      effort: 'low',
      timeHorizon: 'now',
      blockedBy: [],
    });
  }

  if (school.policyContext?.testingPolicy === 'REQUIRED') {
    recommendedChanges.push({
      action: isZh
        ? '把标化提交策略改成明确的 test-submit 路线，并尽快补齐考试计划。'
        : 'Commit to a test-submit path and lock an exam plan for this school.',
      rationale: isZh
        ? '该校不是 test-optional，测试策略不明确会直接压缩竞争力。'
        : 'This school is not test-optional, so an undefined testing plan directly compresses competitiveness.',
      effort: 'medium',
      timeHorizon: 'next90Days',
      blockedBy: [],
    });
  }

  if (school.topGaps[0]) {
    recommendedChanges.push({
      action: school.topGaps[0],
      rationale: isZh
        ? '这是当前这所学校最直接、最可行动的短板。'
        : 'This is the most direct school-specific gap you can still act on.',
      effort: 'medium',
      timeHorizon: 'next90Days',
      blockedBy: school.hardStopRisks?.slice(0, 1) ?? [],
    });
  }

  if (
    school.policyContext?.intlAidPolicy === 'NEED_AWARE' &&
    profileContext.applicantType === 'international'
  ) {
    recommendedChanges.push({
      action: isZh
        ? '把该校放回有资助约束的国际生策略里重新平衡，不要单独看分数。'
        : 'Re-balance this school inside an international aid-aware strategy, not as a standalone score chase.',
      rationale: isZh
        ? '国际生资助需求会显著收紧该校的窗口。'
        : 'International aid need materially tightens the window at this school.',
      effort: 'low',
      timeHorizon: 'beforeSubmission',
      blockedBy: [],
    });
  }

  if (recommendedChanges.length === 0) {
    recommendedChanges.push({
      action: isZh
        ? '把现有最强优势压缩成更清晰的 school-specific 叙事。'
        : 'Condense your strongest evidence into a tighter school-specific story.',
      rationale: isZh
        ? '当前更需要提升表达质量，而不是虚构新的履历。'
        : 'The current gap is mostly narrative precision, not inventing new credentials.',
      effort: 'low',
      timeHorizon: 'beforeSubmission',
      blockedBy: [],
    });
  }

  const probability = school.predictionSnapshot?.probability ?? 0;
  return {
    goal: isZh
      ? `提升 ${school.schoolName} 的可执行申请准备度`
      : `Improve actionable readiness for ${school.schoolName}`,
    recommendedChanges: recommendedChanges.slice(0, 4),
    estimatedDirection:
      probability >= 0.45
        ? 'stabilize'
        : probability >= 0.2
          ? 'upside'
          : 'mixed',
    constraints: [
      isZh
        ? '不要修改不可变特征，也不要伪造活动深度。'
        : 'Do not change immutable traits or fabricate extracurricular depth.',
      isZh
        ? '这些建议只代表 strategy layer，不代表录取承诺。'
        : 'These suggestions are strategy-layer guidance, not admissions guarantees.',
    ],
    whyNotGuaranteed: isZh
      ? '学校级 recourse 只能说明更好的行动方向，不能替代院校真实审查。'
      : 'School-level recourse can point to better actions, but it cannot replace actual institutional review.',
  };
}

function buildStrategyUncertainty(
  school: TargetSchoolInsight,
  locale: string,
  experiment: RuntimeExperiment,
): StrategyUncertainty {
  const isZh = locale === 'zh';
  const metrics =
    (experiment.evaluationRuns[0]?.metrics as Record<string, unknown> | null) ??
    {};
  const widthDelta =
    typeof metrics.medianIntervalWidthDelta === 'number'
      ? Number(metrics.medianIntervalWidthDelta)
      : 0.12;

  const baseProbability = school.predictionSnapshot?.probability ?? 0.35;
  const lowerBase =
    school.predictionSnapshot?.probabilityLow ??
    Math.max(0.05, baseProbability - 0.12);
  const upperBase =
    school.predictionSnapshot?.probabilityHigh ??
    Math.min(0.95, baseProbability + 0.12);
  const policyPenalty =
    school.policyContext?.policySourceQuality === 'UNKNOWN'
      ? 0.05
      : school.policyContext?.policySourceQuality === 'DERIVED'
        ? 0.02
        : 0;
  const historicalPenalty = school.historicalSignals.some((signal) =>
    /thin|不足|weak/i.test(signal),
  )
    ? 0.03
    : 0;
  const hardStopPenalty = Math.min(
    (school.hardStopRisks?.length ?? 0) * 0.015,
    0.05,
  );
  const spread = Math.min(
    widthDelta + policyPenalty + historicalPenalty + hardStopPenalty,
    0.22,
  );

  const reasons = [
    school.predictionSnapshot?.confidenceReason,
    school.policyContext?.policySourceQuality === 'UNKNOWN'
      ? isZh
        ? '这所学校的政策证据仍然不足，所以策略区间会更宽。'
        : 'School-policy evidence is still thin for this school, so the strategy interval is wider.'
      : null,
    school.historicalSignals.some((signal) => /thin|不足|weak/i.test(signal))
      ? isZh
        ? '历史案例样本偏薄，导致学校级参考区间更保守。'
        : 'Historical case coverage is thin, so the school-level interval stays more conservative.'
      : null,
    school.round &&
    school.predictionSnapshot?.roundContext &&
    school.round !== school.predictionSnapshot.roundContext
      ? isZh
        ? '当前学校轮次与预测快照轮次不完全一致。'
        : 'The current school round does not fully match the prediction snapshot round.'
      : null,
  ].filter((item): item is string => Boolean(item));

  return {
    probabilityLow: roundNumber(Math.max(0.02, lowerBase - spread / 2), 4),
    probabilityHigh: roundNumber(Math.min(0.98, upperBase + spread / 2), 4),
    intervalLabel:
      spread <= 0.1 ? 'tight' : spread <= 0.15 ? 'balanced' : 'wide',
    reasons: reasons.slice(0, 4),
  };
}

function buildFairnessDisclosure(
  runtimeExperiments: RuntimeExperiment[],
  locale: string,
): FairnessDisclosure | undefined {
  const isZh = locale === 'zh';
  const fairnessExperiment = runtimeExperiments.find(
    (item) => item.capability === 'FAIRNESS',
  );

  if (!fairnessExperiment) return undefined;

  const metrics =
    (fairnessExperiment.evaluationRuns[0]?.metrics as Record<
      string,
      unknown
    > | null) ?? {};
  const blockedSubgroupCount =
    typeof metrics.blockedSubgroupCount === 'number'
      ? Number(metrics.blockedSubgroupCount)
      : 0;
  const disclosurePass = metrics.disclosurePass === true;

  return {
    status:
      blockedSubgroupCount > 0
        ? 'blocked'
        : disclosurePass
          ? 'clear'
          : 'limited',
    notes:
      blockedSubgroupCount > 0
        ? [
            isZh
              ? '当前 fairness capability 仍对部分关键子群体保持阻断，不会影响主分析，但不会作为公开强化能力展示。'
              : 'The fairness capability is still blocked for one or more key subgroups, so it does not enhance the public analysis yet.',
          ]
        : disclosurePass
          ? [
              isZh
                ? '当前 fairness disclosure 已通过基础 gate，会继续在 canary / active 阶段监控。'
                : 'The current fairness disclosure passed its baseline gates and will continue to be monitored during canary and active rollout.',
            ]
          : [
              isZh
                ? '当前 fairness disclosure 仍处于有限态，说明子群体覆盖还不完整。'
                : 'The fairness disclosure is still limited, which means subgroup coverage is not complete yet.',
            ],
    appliesTo: [
      isZh ? '国际生' : 'International applicants',
      isZh ? '资助需求申请者' : 'Aid-seeking applicants',
      isZh ? '第一代大学生' : 'First-generation applicants',
      isZh ? 'UC / test-blind 学校' : 'UC / test-blind schools',
      isZh ? '不同申请轮次' : 'Different application rounds',
    ],
  };
}
