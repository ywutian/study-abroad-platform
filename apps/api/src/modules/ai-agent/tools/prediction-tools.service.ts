/**
 * Prediction Data Tools Service
 *
 * Tools: GET_PREDICTION_HISTORY, GET_PREDICTION_DASHBOARD, GET_SCHOOL_LIST_PREDICTIONS
 */

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { clampPercentRate } from '../../../common/utils/percent.util';
import { SCHOOL_PREDICTION_CONTEXT_SELECT } from '../../../common/constants/prisma-selects';
import { ProfileLoaderHelper } from './helpers/profile-loader.helper';
import { SchoolLookupHelper } from './helpers/school-lookup.helper';
import { ToolHandler, IToolHandlerProvider } from './tool-handler.interface';
import { PredictionReportingService } from '../../prediction/prediction-reporting.service';

@Injectable()
export class PredictionToolsService implements IToolHandlerProvider {
  private readonly logger = new Logger(PredictionToolsService.name);

  constructor(
    private prisma: PrismaService,
    private profileLoader: ProfileLoaderHelper,
    private schoolLookup: SchoolLookupHelper,
    private predictionReporting: PredictionReportingService,
  ) {}

  getHandlers(): Map<string, ToolHandler> {
    return new Map<string, ToolHandler>([
      [
        'get_prediction_history',
        (args, userId, _ctx, locale) =>
          this.getPredictionHistory(userId, args, locale),
      ],
      [
        'get_prediction_dashboard',
        (_args, userId, _ctx, locale) =>
          this.getPredictionDashboard(userId, locale),
      ],
      [
        'get_school_list_predictions',
        (_args, userId, _ctx, locale) =>
          this.getSchoolListPredictions(userId, locale),
      ],
      [
        'get_prediction_trace_summary',
        (args, userId, _ctx, locale) =>
          this.getPredictionTraceSummary(userId, args, locale),
      ],
    ]);
  }

  private numberFromValue(value: unknown): number | undefined {
    if (value == null) return undefined;
    if (typeof value === 'number') return value;
    if (
      typeof value === 'object' &&
      typeof (value as { toNumber?: () => number }).toNumber === 'function'
    ) {
      return (value as { toNumber: () => number }).toNumber();
    }
    return Number(value);
  }

  private formatSchoolContext(school: any) {
    if (!school) return null;
    return {
      id: school.id,
      name: school.name,
      nameZh: school.nameZh ?? undefined,
      usNewsRank: school.usNewsRank ?? undefined,
      acceptanceRate: clampPercentRate(
        this.numberFromValue(school.acceptanceRate),
      ),
      intlAcceptanceRate: clampPercentRate(
        this.numberFromValue(school.intlAcceptanceRate),
      ),
      intlStudentPct: this.numberFromValue(school.intlStudentPct),
      needBlindInternational: school.needBlindInternational ?? undefined,
    };
  }

  private mapLatestOutcome(
    records?: Parameters<
      PredictionReportingService['resolveCanonicalOutcome']
    >[0],
  ) {
    const canonical = this.predictionReporting.resolveCanonicalOutcome(records);
    return this.predictionReporting.mapLatestOutcomeLabel(
      canonical.displayRecord,
    );
  }

  private formatPredictionResult(prediction: any) {
    if (!prediction) return null;
    return {
      probability: this.numberFromValue(prediction.probability),
      probabilityLow:
        prediction.probabilityLow != null
          ? this.numberFromValue(prediction.probabilityLow)
          : undefined,
      probabilityHigh:
        prediction.probabilityHigh != null
          ? this.numberFromValue(prediction.probabilityHigh)
          : undefined,
      tier: prediction.tier ?? undefined,
      confidence: prediction.confidence ?? undefined,
      confidenceReason: prediction.confidenceReason ?? undefined,
      cohortKey: prediction.cohortKey ?? undefined,
      roundContext: prediction.applicationRound ?? undefined,
      sourceSummary: Array.isArray(prediction.sourceSummary)
        ? prediction.sourceSummary
        : undefined,
      uncertaintyReasons: prediction.uncertaintyReasons ?? undefined,
      // servedPolicyVersionId omitted — internal policy gate detail
      source: prediction.source ?? undefined,
      modelVersion: prediction.modelVersion ?? undefined,
      updatedAt: prediction.updatedAt,
      latestOutcomeLabel:
        prediction.outcomeLabelRecords != null
          ? this.mapLatestOutcome(prediction.outcomeLabelRecords)
          : undefined,
    };
  }

  private formatPredictionSnapshot(snapshot: any) {
    if (!snapshot) return null;
    return {
      probability: this.numberFromValue(snapshot.probability),
      tier: snapshot.tier ?? undefined,
      confidence: snapshot.confidence ?? undefined,
      confidenceReason: snapshot.confidenceReason ?? undefined,
      cohortKey: snapshot.cohortKey ?? undefined,
      roundContext: snapshot.applicationRound ?? undefined,
      sourceSummary: Array.isArray(snapshot.sourceSummary)
        ? snapshot.sourceSummary
        : undefined,
      uncertaintyReasons: snapshot.uncertaintyReasons ?? undefined,
      // servedPolicyVersionId omitted — internal policy gate detail (parity with formatPrediction)
      source: snapshot.source ?? undefined,
      modelVersion: snapshot.modelVersion ?? undefined,
      createdAt: snapshot.createdAt,
    };
  }

  async getPredictionHistory(
    userId: string,
    args: { schoolId?: string; schoolName?: string },
    locale = 'zh',
  ) {
    const isZh = locale === 'zh';
    const profileId = await this.profileLoader.getProfileId(userId);
    if (!profileId) {
      return {
        error: isZh ? '请先完善档案信息' : 'Please complete your profile first',
      };
    }

    const school = await this.schoolLookup.findSchool(
      args.schoolId,
      args.schoolName,
    );
    if (!school) {
      return { error: isZh ? '未找到该学校' : 'School not found' };
    }

    const [schoolContext, current, history] = await Promise.all([
      this.prisma.school.findUnique({
        where: { id: school.id },
        select: SCHOOL_PREDICTION_CONTEXT_SELECT,
      }),
      this.prisma.predictionResult.findFirst({
        where: {
          profileId,
          schoolId: school.id,
          authority: 'AUTHORITATIVE',
        },
        include: {
          outcomeLabelRecords: {
            orderBy: { createdAt: 'desc' },
          },
        },
      }),
      this.prisma.predictionSnapshot.findMany({
        where: {
          profileId,
          schoolId: school.id,
          authority: 'AUTHORITATIVE',
        },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
    ]);

    return {
      school: this.formatSchoolContext(schoolContext),
      current: this.formatPredictionResult(current),
      history: history
        .map((snapshot) => this.formatPredictionSnapshot(snapshot))
        .filter(Boolean),
    };
  }

  async getPredictionDashboard(userId: string, locale = 'zh') {
    const profileId = await this.profileLoader.getProfileId(userId);
    if (!profileId) {
      return {
        error:
          locale === 'zh'
            ? '请先完善档案信息'
            : 'Please complete your profile first',
      };
    }

    const predictions = await this.prisma.predictionResult.findMany({
      where: { profileId, authority: 'AUTHORITATIVE' },
      take: 100,
      orderBy: { updatedAt: 'desc' },
      include: {
        outcomeLabelRecords: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (predictions.length === 0) {
      return {
        totalSchools: 0,
        tierDistribution: { reach: 0, match: 0, safety: 0 },
        avgProbability: 0,
        confidenceBreakdown: { high: 0, medium: 0, low: 0 },
        predictions: [],
      };
    }

    const schools = await this.prisma.school.findMany({
      where: { id: { in: predictions.map((p) => p.schoolId) } },
      select: SCHOOL_PREDICTION_CONTEXT_SELECT,
    });
    const schoolMap = new Map(schools.map((s) => [s.id, s]));

    const tierDist = { reach: 0, match: 0, safety: 0 };
    const confDist = { high: 0, medium: 0, low: 0 };
    let totalProb = 0;

    const predList = predictions.map((p) => {
      const prob = Number(p.probability);
      totalProb += prob;
      const tier = (p.tier as 'reach' | 'match' | 'safety') || 'reach';
      tierDist[tier] = (tierDist[tier] || 0) + 1;
      const conf = (p.confidence as 'high' | 'medium' | 'low') || 'low';
      confDist[conf] = (confDist[conf] || 0) + 1;

      return {
        schoolId: p.schoolId,
        school: this.formatSchoolContext(schoolMap.get(p.schoolId)),
        ...this.formatPredictionResult(p),
      };
    });

    return {
      totalSchools: predictions.length,
      tierDistribution: tierDist,
      avgProbability: Math.round((totalProb / predictions.length) * 100),
      confidenceBreakdown: confDist,
      predictions: predList,
    };
  }

  async getSchoolListPredictions(userId: string, locale = 'zh') {
    const isZh = locale === 'zh';
    const profileId = await this.profileLoader.getProfileId(userId);
    if (!profileId) {
      return {
        error: isZh ? '请先完善档案信息' : 'Please complete your profile first',
      };
    }

    const items = await this.prisma.schoolListItem.findMany({
      where: { userId },
      include: {
        school: {
          select: { id: true, name: true, nameZh: true, usNewsRank: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    if (items.length === 0) {
      return {
        error: isZh
          ? '选校清单为空，请先添加学校'
          : 'School list is empty. Please add schools first.',
      };
    }

    const preds = await this.prisma.predictionResult.findMany({
      where: {
        profileId,
        schoolId: { in: items.map((i) => i.schoolId) },
        authority: 'AUTHORITATIVE',
      },
      include: {
        outcomeLabelRecords: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });
    const predMap = new Map(preds.map((p) => [p.schoolId, p]));

    return items.map((item) => {
      const pred = predMap.get(item.schoolId);
      return {
        schoolId: item.schoolId,
        school: {
          ...item.school,
          nameZh: item.school.nameZh ?? undefined,
          usNewsRank: item.school.usNewsRank ?? undefined,
        },
        tier: item.tier,
        isAIRecommended: item.isAIRecommended,
        prediction: this.formatPredictionResult(pred),
      };
    });
  }

  async getPredictionTraceSummary(
    userId: string,
    args: { schoolId?: string; schoolName?: string },
    locale = 'zh',
  ) {
    const isZh = locale === 'zh';
    const profileId = await this.profileLoader.getProfileId(userId);
    if (!profileId) {
      return {
        error: isZh ? '请先完善档案信息' : 'Please complete your profile first',
      };
    }

    const school = await this.schoolLookup.findSchool(
      args.schoolId,
      args.schoolName,
    );
    if (!school) {
      return { error: isZh ? '未找到该学校' : 'School not found' };
    }

    const prediction = await this.prisma.predictionResult.findUnique({
      where: {
        profileId_schoolId: {
          profileId,
          schoolId: school.id,
        },
      },
      include: {
        outcomeLabelRecords: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!prediction) {
      return {
        error: isZh
          ? '该学校暂无历史预测，请先重新运行预测'
          : 'No saved prediction was found for this school. Please run a prediction first.',
      };
    }

    return {
      school: {
        id: school.id,
        name: school.name,
        nameZh: school.nameZh ?? undefined,
      },
      current: {
        probability: Number(prediction.probability),
        tier: prediction.tier ?? undefined,
        confidence: prediction.confidence ?? undefined,
        updatedAt: prediction.updatedAt,
      },
      trace: {
        source: prediction.source ?? undefined,
        modelVersion: prediction.modelVersion ?? undefined,
        // servedPolicyVersionId omitted — internal policy gate detail
        roundContext: prediction.applicationRound ?? undefined,
        sourceSummary: Array.isArray(prediction.sourceSummary)
          ? prediction.sourceSummary
          : undefined,
        uncertaintyReasons: prediction.uncertaintyReasons ?? undefined,
        confidenceReason: prediction.confidenceReason ?? undefined,
        latestOutcomeLabel: this.mapLatestOutcome(
          prediction.outcomeLabelRecords,
        ),
        updatedAt: prediction.updatedAt,
      },
    };
  }
}
