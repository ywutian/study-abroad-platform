/**
 * Prediction Data Tools Service
 *
 * Tools: GET_PREDICTION_HISTORY, GET_PREDICTION_DASHBOARD, GET_SCHOOL_LIST_PREDICTIONS
 */

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { ProfileLoaderHelper } from './helpers/profile-loader.helper';
import { SchoolLookupHelper } from './helpers/school-lookup.helper';
import { ToolHandler, IToolHandlerProvider } from './tool-handler.interface';

@Injectable()
export class PredictionToolsService implements IToolHandlerProvider {
  private readonly logger = new Logger(PredictionToolsService.name);

  constructor(
    private prisma: PrismaService,
    private profileLoader: ProfileLoaderHelper,
    private schoolLookup: SchoolLookupHelper,
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
    ]);
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
      { id: true, name: true, nameZh: true },
    );
    if (!school) {
      return { error: isZh ? '未找到该学校' : 'School not found' };
    }

    const [current, history] = await Promise.all([
      this.prisma.predictionResult.findUnique({
        where: {
          profileId_schoolId: {
            profileId,
            schoolId: school.id,
          },
        },
      }),
      this.prisma.predictionSnapshot.findMany({
        where: { profileId, schoolId: school.id },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
    ]);

    return {
      school: { id: school.id, name: school.name, nameZh: school.nameZh },
      current: current
        ? {
            probability: Number(current.probability),
            probabilityLow: current.probabilityLow
              ? Number(current.probabilityLow)
              : undefined,
            probabilityHigh: current.probabilityHigh
              ? Number(current.probabilityHigh)
              : undefined,
            tier: current.tier,
            confidence: current.confidence,
            source: current.source,
            modelVersion: current.modelVersion,
            updatedAt: current.updatedAt,
          }
        : null,
      history: history.map((s) => ({
        probability: Number(s.probability),
        tier: s.tier,
        confidence: s.confidence,
        source: s.source,
        modelVersion: s.modelVersion,
        createdAt: s.createdAt,
      })),
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
      where: { profileId },
      take: 100,
      orderBy: { updatedAt: 'desc' },
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
      select: { id: true, name: true, nameZh: true, usNewsRank: true },
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
        school: schoolMap.get(p.schoolId) ?? null,
        probability: prob,
        tier,
        confidence: conf,
        source: p.source,
        modelVersion: p.modelVersion,
        updatedAt: p.updatedAt,
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
      },
      select: {
        schoolId: true,
        probability: true,
        tier: true,
        confidence: true,
        source: true,
        updatedAt: true,
      },
    });
    const predMap = new Map(preds.map((p) => [p.schoolId, p]));

    return items.map((item) => {
      const pred = predMap.get(item.schoolId);
      return {
        schoolId: item.schoolId,
        school: item.school,
        tier: item.tier,
        isAIRecommended: item.isAIRecommended,
        prediction: pred
          ? {
              probability: Number(pred.probability),
              tier: pred.tier,
              confidence: pred.confidence,
              source: pred.source,
              updatedAt: pred.updatedAt,
            }
          : null,
      };
    });
  }
}
