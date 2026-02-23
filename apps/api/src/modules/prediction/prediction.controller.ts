import { Controller, Post, Get, Body, Param, Patch } from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiParam,
} from '@nestjs/swagger';
import { PredictionService } from './prediction.service';
import { CurrentUser, Roles } from '../../common/decorators';
import type { CurrentUserPayload } from '../../common/decorators';
import { Role } from '@prisma/client';
import { ThrottleAI } from '../../common/decorators/throttle.decorator';
import { PrismaService } from '../../prisma/prisma.service';
import { PredictionRequestDto, PredictionResponseDto } from './dto';

@ApiTags('predictions')
@ApiBearerAuth()
@ThrottleAI()
@Controller('predictions')
export class PredictionController {
  constructor(
    private readonly predictionService: PredictionService,
    private readonly prisma: PrismaService,
  ) {}

  @Post()
  @ApiOperation({ summary: '运行录取预测（多引擎融合 v2）' })
  @ApiResponse({
    status: 200,
    description: '预测成功',
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

    const output = await this.predictionService.predict(
      profile.id,
      data.schoolIds,
      data.forceRefresh,
      user.locale,
    );

    return {
      results: output.results,
      processingTime: Date.now() - startTime,
      dataCompleteness: output.dataCompleteness,
      memoryContext: output.memoryContext,
    };
  }

  @Get('history')
  @ApiOperation({ summary: '获取预测历史' })
  async getHistory(@CurrentUser() user: CurrentUserPayload) {
    const profile = await this.prisma.profile.findUnique({
      where: { userId: user.id },
    });

    if (!profile) {
      return [];
    }

    return this.predictionService.getPredictionHistory(profile.id);
  }

  @Patch(':schoolId/result')
  @ApiOperation({ summary: '报告实际录取结果（用于校准）' })
  @ApiParam({ name: 'schoolId', description: '学校ID' })
  @ApiResponse({ status: 200, description: '结果已记录' })
  async reportResult(
    @CurrentUser() user: CurrentUserPayload,
    @Param('schoolId') schoolId: string,
    @Body() body: { result: 'ADMITTED' | 'REJECTED' | 'WAITLISTED' },
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
    );

    return { success: true, message: 'Result recorded for calibration' };
  }

  @Get('calibration')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: '获取模型校准数据（管理员）' })
  async getCalibration() {
    return this.predictionService.getCalibrationData();
  }

  @Get('dashboard')
  @ApiOperation({ summary: '获取预测仪表盘聚合数据' })
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
    });

    // Fetch school info separately (PredictionResult has no school relation)
    const schoolIds = [...new Set(predictions.map((p) => p.schoolId))];
    const schools = await this.prisma.school.findMany({
      where: { id: { in: schoolIds } },
      select: { id: true, name: true, nameZh: true, usNewsRank: true },
    });
    const schoolMap = new Map(schools.map((s) => [s.id, s]));

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
        schoolId: p.schoolId,
        school: schoolMap.get(p.schoolId) ?? null,
        probability: Number(p.probability),
        tier: p.tier,
        confidence: p.confidence,
        source: p.source,
        modelVersion: p.modelVersion,
        updatedAt: p.updatedAt,
      })),
    };
  }

  @Get('school/:schoolId')
  @ApiOperation({ summary: '获取单校预测详情 + 历史趋势' })
  @ApiParam({ name: 'schoolId', description: '学校ID' })
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
      }),
      this.prisma.predictionSnapshot.findMany({
        where: { profileId: profile.id, schoolId },
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
            probability: Number(current.probability),
            probabilityLow: current.probabilityLow
              ? Number(current.probabilityLow)
              : undefined,
            probabilityHigh: current.probabilityHigh
              ? Number(current.probabilityHigh)
              : undefined,
            tier: current.tier,
            confidence: current.confidence,
            factors: current.factors,
            source: current.source,
            modelVersion: current.modelVersion,
            updatedAt: current.updatedAt,
          }
        : null,
      history: history.map((h) => ({
        probability: Number(h.probability),
        tier: h.tier,
        confidence: h.confidence,
        source: h.source,
        modelVersion: h.modelVersion,
        createdAt: h.createdAt,
      })),
      school,
    };
  }
}
