import { Controller, Post, Get, Body } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { PredictionService } from './prediction.service';
import { CurrentUser } from '../../common/decorators';
import type { CurrentUserPayload } from '../../common/decorators';
import { PrismaService } from '../../prisma/prisma.service';

interface PredictionRequestDto {
  schoolIds: string[];
}

@ApiTags('predictions')
@ApiBearerAuth()
@Controller('predictions')
export class PredictionController {
  constructor(
    private readonly predictionService: PredictionService,
    private readonly prisma: PrismaService
  ) {}

  @Post()
  @ApiOperation({ summary: 'Run admission prediction' })
  async predict(@CurrentUser() user: CurrentUserPayload, @Body() data: PredictionRequestDto) {
    const profile = await this.prisma.profile.findUnique({
      where: { userId: user.id },
    });

    if (!profile) {
      return { results: [], message: 'Please complete your profile first' };
    }

    const results = await this.predictionService.predict(profile.id, data.schoolIds);
    return { results };
  }

  @Get('history')
  @ApiOperation({ summary: 'Get prediction history' })
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

