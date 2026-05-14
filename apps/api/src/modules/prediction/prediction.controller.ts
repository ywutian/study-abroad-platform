import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Patch,
  Query,
  Res,
  Logger,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiParam,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { PredictionService } from './prediction.service';
import { SchoolService } from '../school/school.service';
import { CurrentLocale, CurrentUser, Roles } from '../../common/decorators';
import type { CurrentUserPayload } from '../../common/decorators';
import type { SupportedLocale } from '@study-abroad/shared';
import { Role } from '@prisma/client';
import {
  ThrottleAI,
  ThrottleSensitive,
} from '../../common/decorators/throttle.decorator';
import { PrismaService } from '../../prisma/prisma.service';
import {
  PredictionRequestDto,
  PredictionResponseDto,
  PredictionExplanationStreamRequestDto,
  PredictionPortfolioSummaryStreamRequestDto,
  SubmitPredictionFeedbackDto,
  ReportResultDto,
} from './dto';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { clampPercentRate } from '../../common/utils/percent.util';
import { SCHOOL_PREDICTION_CONTEXT_SELECT } from '../../common/constants/prisma-selects';
import { PredictionReportingService } from './prediction-reporting.service';
import { PredictionFeedbackService } from './prediction-feedback.service';
import { PredictionExplanationService } from './prediction-explanation.service';
import { buildPredictionPublicExplanation } from './prediction-public-explanation';

function readStoredPublicExplanation(
  row: any,
  locale: SupportedLocale,
  school?: any,
) {
  const stored =
    row?.servedTrace?.publicExplanation?.rules ??
    row?.servedTrace?.publicExplanation?.llm?.publicExplanation;
  if (stored?.headline && Array.isArray(stored.reasons)) {
    return stored;
  }

  return buildPredictionPublicExplanation({
    locale,
    schoolName: school?.nameZh || school?.name || row?.schoolName,
    probability: row?.probability != null ? Number(row.probability) : null,
    probabilityLow:
      row?.probabilityLow != null ? Number(row.probabilityLow) : undefined,
    probabilityHigh:
      row?.probabilityHigh != null ? Number(row.probabilityHigh) : undefined,
    tier: row?.tier,
    confidence: row?.confidence,
    factors: Array.isArray(row?.factors) ? row.factors : [],
    suggestions: Array.isArray(row?.suggestions) ? row.suggestions : [],
    sourceSummary: Array.isArray(row?.sourceSummary) ? row.sourceSummary : [],
    uncertaintyReasons: Array.isArray(row?.uncertaintyReasons)
      ? row.uncertaintyReasons
      : [],
    predictionMethod:
      row?.servedTrace?.engine === 'counselor'
        ? 'counselor'
        : (row?.predictionMethod ?? 'fusion'),
    schoolAcceptanceRate:
      school?.acceptanceRate != null
        ? Number(school.acceptanceRate)
        : undefined,
  });
}

@ApiTags('predictions')
@ApiBearerAuth()
@ThrottleAI()
@Controller('predictions')
export class PredictionController {
  private readonly logger = new Logger(PredictionController.name);

  constructor(
    private readonly predictionService: PredictionService,
    private readonly schoolService: SchoolService,
    private readonly prisma: PrismaService,
    private readonly reportingService: PredictionReportingService,
    private readonly feedbackService: PredictionFeedbackService,
    private readonly explanationService: PredictionExplanationService,
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
    @CurrentLocale() localeOrPagination: SupportedLocale | PaginationDto,
    @Query() paginationMaybe?: PaginationDto,
  ) {
    const locale =
      typeof localeOrPagination === 'string' ? localeOrPagination : 'zh';
    const pagination =
      typeof localeOrPagination === 'string'
        ? (paginationMaybe ?? { page: 1, pageSize: 20 })
        : localeOrPagination;

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
      locale,
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
  async getDashboard(
    @CurrentUser() user: CurrentUserPayload,
    @CurrentLocale() locale: SupportedLocale,
  ) {
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
      where: { profileId: profile.id, authority: 'AUTHORITATIVE' },
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
          needBlindInternational: (s as any).needBlindInternational ?? null,
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
        probabilityLow: p.probabilityLow ? Number(p.probabilityLow) : undefined,
        probabilityHigh: p.probabilityHigh
          ? Number(p.probabilityHigh)
          : undefined,
        tier: p.tier,
        confidence: p.confidence,
        confidenceReason: p.confidenceReason,
        publicExplanation: readStoredPublicExplanation(
          p,
          locale,
          schoolMap.get(p.schoolId),
        ),
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
        factors: Array.isArray(p.factors) ? p.factors : [],
        suggestions: Array.isArray(p.suggestions) ? p.suggestions : [],
        modelVersion: p.modelVersion,
        updatedAt: p.updatedAt,
      })),
    };
  }

  @Post(':predictionResultId/explanation/stream')
  @ApiOperation({ summary: 'Stream an LLM explanation for one prediction' })
  async streamPredictionExplanation(
    @CurrentUser() user: CurrentUserPayload,
    @CurrentLocale() locale: SupportedLocale,
    @Param('predictionResultId') predictionResultId: string,
    @Body() body: PredictionExplanationStreamRequestDto | undefined,
    @Res() res: Response,
  ) {
    await this.writeSse(
      res,
      this.explanationService.streamPredictionExplanation({
        userId: user.id,
        predictionResultId,
        locale,
        refresh: Boolean(body?.refresh),
      }),
    );
  }

  @Post('portfolio-summary/stream')
  @ApiOperation({
    summary: 'Stream an LLM summary for the prediction portfolio',
  })
  async streamPortfolioSummary(
    @CurrentUser() user: CurrentUserPayload,
    @CurrentLocale() locale: SupportedLocale,
    @Body() body: PredictionPortfolioSummaryStreamRequestDto | undefined,
    @Res() res: Response,
  ) {
    await this.writeSse(
      res,
      this.explanationService.streamPortfolioSummary({
        userId: user.id,
        locale,
        predictionResultIds: body?.predictionResultIds,
        refresh: Boolean(body?.refresh),
      }),
    );
  }

  @Get('school/:schoolId')
  @ApiOperation({
    summary: 'Get single school prediction details + historical trends',
  })
  @ApiParam({ name: 'schoolId', description: 'School ID' })
  async getSchoolPrediction(
    @CurrentUser() user: CurrentUserPayload,
    @CurrentLocale() locale: SupportedLocale,
    @Param('schoolId') schoolId: string,
  ) {
    const profile = await this.prisma.profile.findUnique({
      where: { userId: user.id },
    });

    if (!profile) {
      return { current: null, history: [], school: null };
    }

    const [current, history, school] = await Promise.all([
      this.prisma.predictionResult.findFirst({
        where: {
          profileId: profile.id,
          schoolId,
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
            publicExplanation: readStoredPublicExplanation(
              current,
              locale,
              school,
            ),
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
        publicExplanation: readStoredPublicExplanation(h, locale, school),
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

  private async writeSse(
    res: Response,
    events: AsyncGenerator<Record<string, unknown>>,
  ) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    let clientDisconnected = false;
    res.on('close', () => {
      clientDisconnected = true;
    });

    try {
      for await (const event of events) {
        if (clientDisconnected) break;
        res.write(`data: ${JSON.stringify(event)}\n\n`);
      }
    } catch (error) {
      this.logger.error('Prediction SSE stream failed', error);
      if (!clientDisconnected) {
        res.write(
          `data: ${JSON.stringify({ type: 'error', error: 'Stream failed' })}\n\n`,
        );
      }
    }

    if (!clientDisconnected) {
      res.write('data: [DONE]\n\n');
    }
    res.end();
  }
}
