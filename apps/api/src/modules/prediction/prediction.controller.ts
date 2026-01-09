import { Controller, Post, Get, Body } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { PredictionService } from './prediction.service';
import { CurrentUser } from '../../common/decorators';
import type { CurrentUserPayload } from '../../common/decorators';
import { PrismaService } from '../../prisma/prisma.service';
import { PredictionRequestDto, PredictionResponseDto } from './dto';

@ApiTags('predictions')
@ApiBearerAuth()
@Controller('predictions')
export class PredictionController {
  constructor(
    private readonly predictionService: PredictionService,
    private readonly prisma: PrismaService
  ) {}

  @Post()
  @ApiOperation({ summary: '运行录取预测' })
  @ApiResponse({ status: 200, description: '预测成功', type: PredictionResponseDto })
  async predict(
    @CurrentUser() user: CurrentUserPayload,
    @Body() data: PredictionRequestDto
  ): Promise<PredictionResponseDto> {
    const startTime = Date.now();

    const profile = await this.prisma.profile.findUnique({
      where: { userId: user.id },
    });

    if (!profile) {
      return { results: [], processingTime: 0 };
    }

    const results = await this.predictionService.predict(
      profile.id,
      data.schoolIds,
      data.forceRefresh
    );

    return {
      results,
      processingTime: Date.now() - startTime,
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
}

