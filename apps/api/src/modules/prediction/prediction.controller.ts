import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Patch,
  Query,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiParam,
} from '@nestjs/swagger';
import { PredictionService } from './prediction.service';
import { SchoolService } from '../school/school.service';
import { CurrentUser, Roles } from '../../common/decorators';
import type { CurrentUserPayload } from '../../common/decorators';
import { Role } from '@prisma/client';
import {
  ThrottleAI,
  ThrottleSensitive,
} from '../../common/decorators/throttle.decorator';
import { PrismaService } from '../../prisma/prisma.service';
import {
  PredictionRequestDto,
  PredictionResponseDto,
  SubmitPredictionFeedbackDto,
  ReportResultDto,
} from './dto';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { clampPercentRate } from '../../common/utils/percent.util';
import { SCHOOL_PREDICTION_CONTEXT_SELECT } from '../../common/constants/prisma-selects';
import { PredictionReportingService } from './prediction-reporting.service';
import { PredictionFeedbackService } from './prediction-feedback.service';

@ApiTags('predictions')
@ApiBearerAuth()
@ThrottleAI()
@Controller('predictions')
export class PredictionController {
  constructor(
    private readonly predictionService: PredictionService,
    private readonly schoolService: SchoolService,
    private readonly prisma: PrismaService,
    private readonly reportingService: PredictionReportingService,
    private readonly feedbackService: PredictionFeedbackService,
  ) {}

  @Post()
  @ApiOperation({
    summary: 'Run admission prediction (counselor-primary)',
  })
  @ApiResponse({
    status: 200,
    description: 'Prediction successful',
    type: PredictionResponseDto,
  })
  async predict(
    @CurrentUser() user: CurrentUserPayload,
    @Body() data: PredictionRequestDto,
  ): Promise<PredictionResponseDto> {
    const startTime = Date.now();

    const profile = await this.prisma.profile.findUnique({
      where: { userId: user.id },
    });

    if (!profile) {
      return { results: [], processingTime: 0 };
    }

    // When user selects any UC school, expand to all 9 UC campuses for comparison (plan: UC 本科横向比较)
    const ucIds = await this.schoolService.getUcSchoolIds();
    const hasAnyUc = data.schoolIds.some((id) => ucIds.includes(id));
    const schoolIdsToUse = hasAnyUc ? ucIds : data.schoolIds;

    const output = await this.predictionService.predict(
      profile.id,
      schoolIdsToUse,
      data.forceRefresh,
      user.locale,
    );

    return {
      results: output.results,
      processingTime: Date.now() - startTime,
      dataCompleteness: output.dataCompleteness,
      memoryContext: output.memoryContext,
      ucComparisonExpanded: hasAnyUc ? true : undefined,
    };
  }

  @Get('history')
  @ApiOperation({ summary: 'Get prediction history (paginated)' })
  async getHistory(
    @CurrentUser() user: CurrentUserPayload,
    @Query() pagination: PaginationDto,
  ) {
    const profile = await this.prisma.profile.findUnique({
      where: { userId: user.id },
    });

    if (!profile) {
      return { items: [], total: 0, page: 1, pageSize: 20, totalPages: 0 };
    }

    return this.predictionService.getPredictionHistory(
      profile.id,
      pagination.page,
      pagination.pageSize,
    );
  }

  @Patch(':schoolId/result')
  @ThrottleSensitive()
  @ApiOperation({ summary: 'Report actual admission result (for calibration)' })
  @ApiParam({ name: 'schoolId', description: 'School ID' })
  @ApiResponse({ status: 200, description: 'Result recorded' })
  async reportResult(
    @CurrentUser() user: CurrentUserPayload,
    @Param('schoolId') schoolId: string,
    @Body() body: ReportResultDto,
  ) {
    const profile = await this.prisma.profile.findUnique({
      where: { userId: user.id },
    });

    if (!profile) {
      return { success: false, message: 'Profile not found' };
    }

    await this.predictionService.reportActualResult(
      profile.id,
      schoolId,
      body.result,
      {
        notes: body.notes,
        evidenceUrl: body.evidenceUrl,
        round: body.round,
        isFinal: body.isFinal,
      },
    );

    return { success: true, message: 'Result recorded for calibration' };
  }

  @Post(':predictionResultId/feedback')
  @ThrottleSensitive()
  @ApiOperation({
    summary: 'Submit subjective feedback on the quality of a prediction',
  })
  @ApiParam({
    name: 'predictionResultId',
    description: 'PredictionResult row ID returned by prediction APIs',
  })
  async submitFeedback(
    @CurrentUser() user: CurrentUserPayload,
    @Param('predictionResultId') predictionResultId: string,
    @Body() body: SubmitPredictionFeedbackDto,
  ) {
    return this.feedbackService.submitFeedback(
      user.id,
      predictionResultId,
      body,
    );
  }

  @Get('calibration')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Get model calibration data (admin)' })
  async getCalibration() {
    return this.predictionService.getCalibrationData();
  }

  @Get('dashboard')
  @ApiOperation({ summary: 'Get prediction dashboard aggregated data' })
  async getDashboard(@CurrentUser() user: CurrentUserPayload) {
    const profile = await this.prisma.profile.findUnique({
      where: { userId: user.id },
    });

    if (!profile) {
      return {
        totalSchools: 0,
        tierDistribution: { reach: 0, match: 0, safety: 0 },
        avgProbability: 0,
        confidenceBreakdown: { low: 0, medium: 0, high: 0 },
        predictions: [],
      };
    }

    const predictions = await this.prisma.predictionResult.findMany({
      where: { profileId: profile.id },
      orderBy: { updatedAt: 'desc' },
      include: {
        outcomeLabelRecords: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    // Fetch school info separately (PredictionResult has no school relation)
    const schoolIds = [...new Set(predictions.map((p) => p.schoolId))];
    const schools = await this.prisma.school.findMany({
      where: { id: { in: schoolIds } },
      select: SCHOOL_PREDICTION_CONTEXT_SELECT,
    });
    const schoolMap = new Map(
      schools.map((s) => [
        s.id,
        {
          ...s,
          acceptanceRate: clampPercentRate((s as any).acceptanceRate),
          intlAcceptanceRate: clampPercentRate((s as any).intlAcceptanceRate),
          intlStudentPct:
            (s as any).intlStudentPct != null
              ? Number((s as any).intlStudentPct)
              : undefined,
          needBlindInternational:
            (s as any).needBlindInternational || undefined,
        },
      ]),
    );

    const tierDistribution = { reach: 0, match: 0, safety: 0 };
    const confidenceBreakdown = { low: 0, medium: 0, high: 0 };
    let totalProbability = 0;

    for (const p of predictions) {
      const tier = (p.tier || 'match') as keyof typeof tierDistribution;
      if (tier in tierDistribution) tierDistribution[tier]++;

      const conf = (p.confidence ||
        'medium') as keyof typeof confidenceBreakdown;
      if (conf in confidenceBreakdown) confidenceBreakdown[conf]++;

      totalProbability += Number(p.probability);
    }

    return {
      totalSchools: predictions.length,
      tierDistribution,
      avgProbability:
        predictions.length > 0
          ? Math.round((totalProbability / predictions.length) * 100)
          : 0,
      confidenceBreakdown,
      predictions: predictions.map((p) => ({
        ...((): {
          latestOutcomeLabel?: ReturnType<
            PredictionReportingService['mapLatestOutcomeLabel']
          >;
        } => {
          const canonical = this.reportingService.resolveCanonicalOutcome(
            p.outcomeLabelRecords,
          );
          return {
            latestOutcomeLabel: this.reportingService.mapLatestOutcomeLabel(
              canonical.displayRecord,
            ),
          };
        })(),
        id: p.id,
        schoolId: p.schoolId,
        school: schoolMap.get(p.schoolId) ?? null,
        probability: Number(p.probability),
        tier: p.tier,
        confidence: p.confidence,
        confidenceReason: p.confidenceReason,
        cohortKey: p.cohortKey,
        roundContext: p.applicationRound,
        sourceSummary: p.sourceSummary,
        uncertaintyReasons: p.uncertaintyReasons,
        servedPolicyVersionId: p.policyVersionId ?? undefined,
        predictionMethod:
          (p.servedTrace as any)?.engine === 'counselor'
            ? 'counselor'
            : 'fusion',
        source: p.source,
        modelVersion: p.modelVersion,
        updatedAt: p.updatedAt,
      })),
    };
  }

  @Get('school/:schoolId')
  @ApiOperation({
    summary: 'Get single school prediction details + historical trends',
  })
  @ApiParam({ name: 'schoolId', description: 'School ID' })
  async getSchoolPrediction(
    @CurrentUser() user: CurrentUserPayload,
    @Param('schoolId') schoolId: string,
  ) {
    const profile = await this.prisma.profile.findUnique({
      where: { userId: user.id },
    });

    if (!profile) {
      return { current: null, history: [], school: null };
    }

    const [current, history, school] = await Promise.all([
      this.prisma.predictionResult.findUnique({
        where: {
          profileId_schoolId: {
            profileId: profile.id,
            schoolId,
          },
        },
        include: {
          outcomeLabelRecords: {
            orderBy: { createdAt: 'desc' },
          },
        },
      }),
      this.prisma.predictionSnapshot.findMany({
        where: {
          profileId: profile.id,
          schoolId,
          // Trend graph shows real predictions only; PREVIEW rows would mix
          // UI-transient quick-match estimates with served history.
          authority: 'AUTHORITATIVE',
        },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
      this.prisma.school.findUnique({
        where: { id: schoolId },
        select: {
          id: true,
          name: true,
          nameZh: true,
          usNewsRank: true,
          acceptanceRate: true,
        },
      }),
    ]);

    return {
      current: current
        ? {
            id: current.id,
            ...((): {
              latestOutcomeLabel?: ReturnType<
                PredictionReportingService['mapLatestOutcomeLabel']
              >;
            } => {
              const canonical = this.reportingService.resolveCanonicalOutcome(
                current.outcomeLabelRecords,
              );
              return {
                latestOutcomeLabel: this.reportingService.mapLatestOutcomeLabel(
                  canonical.displayRecord,
                ),
              };
            })(),
            probability: Number(current.probability),
            probabilityLow: current.probabilityLow
              ? Number(current.probabilityLow)
              : undefined,
            probabilityHigh: current.probabilityHigh
              ? Number(current.probabilityHigh)
              : undefined,
            tier: current.tier,
            confidence: current.confidence,
            confidenceReason: current.confidenceReason,
            cohortKey: current.cohortKey,
            roundContext: current.applicationRound,
            sourceSummary: current.sourceSummary,
            uncertaintyReasons: current.uncertaintyReasons,
            servedPolicyVersionId: current.policyVersionId ?? undefined,
            predictionMethod:
              (current.servedTrace as any)?.engine === 'counselor'
                ? 'counselor'
                : 'fusion',
            factors: current.factors,
            source: current.source,
            modelVersion: current.modelVersion,
            updatedAt: current.updatedAt,
          }
        : null,
      history: history.map((h) => ({
        id: h.id,
        probability: Number(h.probability),
        tier: h.tier,
        confidence: h.confidence,
        confidenceReason: h.confidenceReason,
        cohortKey: h.cohortKey,
        roundContext: h.applicationRound,
        sourceSummary: h.sourceSummary,
        uncertaintyReasons: h.uncertaintyReasons,
        servedPolicyVersionId: h.policyVersionId ?? undefined,
        predictionMethod:
          (h.servedTrace as any)?.engine === 'counselor'
            ? 'counselor'
            : 'fusion',
        source: h.source,
        modelVersion: h.modelVersion,
        createdAt: h.createdAt,
      })),
      school: school
        ? {
            ...school,
            acceptanceRate:
              clampPercentRate(school.acceptanceRate) ?? school.acceptanceRate,
          }
        : null,
    };
  }
}
